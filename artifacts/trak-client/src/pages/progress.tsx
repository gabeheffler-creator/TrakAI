import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem, type UnitSystem } from "@/hooks/use-unit-system";
import {
  useListMeasurements,
  useListWorkoutLogs,
  useListSleepLogs,
  getListMeasurementsQueryKey,
  getListWorkoutLogsQueryKey,
  getListSleepLogsQueryKey,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, format, parseISO } from "date-fns";

type ChartData = { date: string; [key: string]: number | string | null };

// ─── Unit conversion ─────────────────────────────────────────────────────────

function toDisplayWeight(val: number, stored: string | null | undefined, display: UnitSystem): number {
  const s = stored === "metric" ? "metric" : "imperial";
  if (s === display) return val;
  const converted = s === "imperial" ? val * 0.453592 : val * 2.20462;
  return Math.round(converted * 10) / 10;
}

function toDisplayLength(val: number, stored: string | null | undefined, display: UnitSystem): number {
  const s = stored === "metric" ? "metric" : "imperial";
  if (s === display) return val;
  const converted = s === "imperial" ? val * 2.54 : val / 2.54;
  return Math.round(converted * 10) / 10;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Linear-regression slope in units per week. Null if < 2 points. */
function weeklyRate(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map(p => (new Date(p.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 7));
  const ys = points.map(p => p.value);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Week-over-week deltas: bucket by ISO week (Mon), keep last value per week. */
function weeklyDeltas(points: { date: string; value: number }[]): { week: string; delta: number }[] {
  if (points.length < 2) return [];
  const byWeek: Record<string, number> = {};
  for (const p of points) {
    const ws = format(startOfWeek(parseISO(p.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    byWeek[ws] = p.value;
  }
  const weeks = Object.keys(byWeek).sort();
  return weeks.slice(1).map((w, i) => ({
    week: format(parseISO(w), "MMM d"),
    delta: Number((byWeek[w] - byWeek[weeks[i]]).toFixed(2)),
  }));
}

/**
 * Rolling 7-day net change: for each data point, find the nearest prior point
 * at least 5 days back and compute the delta. Returns a time series.
 */
function rolling7dDeltas(points: { date: string; value: number }[]): { date: string; delta: number }[] {
  if (points.length < 2) return [];
  const result: { date: string; delta: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const curTime = new Date(cur.date).getTime();
    const cutoff = curTime - 5 * 24 * 60 * 60 * 1000;
    // find closest prior point that is at least 5 days back
    let best: { date: string; value: number } | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (new Date(points[j].date).getTime() <= cutoff) {
        best = points[j];
        break;
      }
    }
    if (best) {
      result.push({
        date: format(parseISO(cur.date), "MMM d"),
        delta: Number((cur.value - best.value).toFixed(2)),
      });
    }
  }
  return result;
}

/** Delta vs the closest measurement ~7 days before the most recent. */
function lastWeekDelta(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const lastTime = new Date(last.date).getTime();
  const cutoff = lastTime - 5 * 24 * 60 * 60 * 1000;
  const prior = [...points].reverse().find(p => new Date(p.date).getTime() <= cutoff);
  if (!prior) return null;
  return Number((last.value - prior.value).toFixed(2));
}

// ─── Components ──────────────────────────────────────────────────────────────

function RateChip({
  rate,
  unit,
  lowerIsBetter = false,
}: {
  rate: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (rate == null || Math.abs(rate) < 0.001) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> stable avg
      </span>
    );
  }
  const positive = rate > 0;
  const good = lowerIsBetter ? !positive : positive;
  const color = good ? "text-emerald-500" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {sign}{rate.toFixed(2)} {unit}/wk avg
    </span>
  );
}

function LastWeekChip({
  delta,
  unit,
  lowerIsBetter = false,
}: {
  delta: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (delta == null) return null;
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> no change this week
      </span>
    );
  }
  const positive = delta > 0;
  const good = lowerIsBetter ? !positive : positive;
  const color = good ? "text-emerald-500" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {sign}{delta} {unit} this week
    </span>
  );
}

function MiniLineChart({
  data,
  dataKey,
  color,
  unit,
}: {
  data: ChartData[];
  dataKey: string;
  color: string;
  unit?: string;
}) {
  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
            tickFormatter={v => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
            domain={["auto", "auto"]}
            unit={unit ? ` ${unit}` : ""}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={v => new Date(v).toLocaleDateString()}
            formatter={(val: number) => [`${val}${unit ? ` ${unit}` : ""}`, ""]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaHistoryChart({
  deltas,
  unit,
  lowerIsBetter = false,
}: {
  deltas: { date: string; delta: number }[];
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (deltas.length === 0) return null;
  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <p className="text-[10px] text-muted-foreground mb-1 px-1">Net change vs. prior ~7 days ({unit})</p>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={deltas} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} width={38} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(val: number) => {
                const sign = val > 0 ? "+" : "";
                return [`${sign}${val} ${unit}`, "7d change"];
              }}
            />
            <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
              {deltas.map((d, i) => {
                const isGood = lowerIsBetter ? d.delta < 0 : d.delta > 0;
                return (
                  <Cell
                    key={i}
                    fill={
                      Math.abs(d.delta) < 0.01
                        ? "hsl(var(--muted-foreground))"
                        : isGood
                        ? "hsl(142,70%,45%)"
                        : "hsl(0,72%,60%)"
                    }
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  delta,
  deltaUnit = "lbs",
}: {
  title: string;
  value: string | number;
  sub?: string;
  delta?: number | null;
  deltaUnit?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {delta != null && (
          <p className={`text-xs font-medium mt-1 ${delta < 0 ? "text-emerald-500" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{Math.abs(delta).toFixed(1)} {deltaUnit}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getMeasurementCharts(weightUnit: string, lengthUnit: string) {
  return [
    { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: weightUnit, lowerIsBetter: true },
    { key: "body_fat",    label: "Body Fat %",   color: "hsl(15,85%,55%)",  unit: "%",         lowerIsBetter: true },
    { key: "chest",       label: "Chest",        color: "hsl(340,75%,55%)", unit: lengthUnit },
    { key: "waist",       label: "Waist",        color: "hsl(200,70%,50%)", unit: lengthUnit,  lowerIsBetter: true },
    { key: "hips",        label: "Hips",         color: "hsl(38,92%,50%)",  unit: lengthUnit,  lowerIsBetter: true },
    { key: "left_arm",    label: "Left Arm",     color: "hsl(158,64%,38%)", unit: lengthUnit },
    { key: "right_arm",   label: "Right Arm",    color: "hsl(158,64%,50%)", unit: lengthUnit },
    { key: "left_thigh",  label: "Left Thigh",   color: "hsl(28,85%,50%)",  unit: lengthUnit },
    { key: "right_thigh", label: "Right Thigh",  color: "hsl(28,85%,60%)",  unit: lengthUnit },
    { key: "left_calf",   label: "Left Calf",    color: "hsl(260,50%,55%)", unit: lengthUnit },
    { key: "right_calf",  label: "Right Calf",   color: "hsl(260,50%,65%)", unit: lengthUnit },
  ];
}

// ─── History list view ───────────────────────────────────────────────────────

type MeasurementEntry = ChartData & { date: string };

function RateRow({
  label,
  rate,
  unit,
  lowerIsBetter = false,
}: {
  label: string;
  rate: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (rate == null || Math.abs(rate) < 0.001) return null;
  const positive = rate > 0;
  const good = lowerIsBetter ? !positive : positive;
  const color = good ? "text-emerald-500" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {positive ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
        {sign}{rate.toFixed(2)} {unit}/wk
      </span>
    </div>
  );
}

function HistoryList({
  entries,
  charts,
}: {
  entries: MeasurementEntry[];
  charts: ReturnType<typeof getMeasurementCharts>;
}) {
  const newest = [...entries].reverse();

  return (
    <div className="space-y-3">
      {newest.map((entry, revIdx) => {
        const origIdx = entries.length - 1 - revIdx;
        const prev = origIdx > 0 ? entries[origIdx - 1] : null;

        const presentMetrics = charts.filter(({ key }) => entry[key] != null);
        if (presentMetrics.length === 0) return null;

        return (
          <Card key={entry.date}>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-sm font-bold mb-2">
                {format(parseISO(entry.date), "MMM d, yyyy")}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {presentMetrics.map(({ key, label, unit, lowerIsBetter }) => {
                  const val = entry[key] as number;
                  const prevVal = prev?.[key] as number | null | undefined;
                  const delta = prevVal != null ? Number((val - prevVal).toFixed(2)) : null;
                  const showDelta = delta != null && Math.abs(delta) > 0.01;
                  const good = showDelta && (lowerIsBetter ? delta! < 0 : delta! > 0);
                  return (
                    <div key={key} className="flex items-baseline justify-between text-xs gap-1">
                      <span className="text-muted-foreground truncate">{label}</span>
                      <span className="font-medium shrink-0">
                        {val} {unit}
                        {showDelta && (
                          <span className={`ml-1 ${good ? "text-emerald-500" : "text-red-400"}`}>
                            {delta! > 0 ? "+" : ""}{delta}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Timeframe = "30d" | "90d" | "1y" | "all";

function filterByTf<T extends { date: string }>(items: T[], tf: Timeframe): T[] {
  if (tf === "all") return items;
  const days = tf === "30d" ? 30 : tf === "90d" ? 90 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return items.filter(i => i.date >= cutoffStr);
}

export function ProgressPage() {
  const [view, setView] = useState<"charts" | "history">("charts");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const { clientId } = useClientId();
  const { units, weightLabel, lengthLabel } = useUnitSystem();

  const { data: measurements } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) },
  });
  const { data: workoutLogs } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) },
  });
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) },
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  const MEASUREMENT_CHARTS = getMeasurementCharts(weightLabel, lengthLabel);

  const sorted = filterByTf((measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Convert first/last weight to display unit for summary cards
  const firstWeightDisplay = first?.weight != null
    ? toDisplayWeight(Number(first.weight), first.unit, units)
    : null;
  const lastWeightDisplay = last?.weight != null
    ? toDisplayWeight(Number(last.weight), last.unit, units)
    : null;
  const weightDelta = firstWeightDisplay != null && lastWeightDisplay != null
    ? Number((lastWeightDisplay - firstWeightDisplay).toFixed(1))
    : null;

  const hasMeasurements = sorted.length > 0;
  const hasSleep = (sleepLogs ?? []).length > 0;
  const hasWorkouts = (workoutLogs ?? []).length > 0;

  // Convert each measurement's values from its stored unit to the current display unit
  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? toDisplayWeight(Number(m.weight),    m.unit, units) : null,
    body_fat:     m.bodyFat     != null ? Number(m.bodyFat)                                   : null,
    chest:        m.chest       != null ? toDisplayLength(Number(m.chest),     m.unit, units) : null,
    waist:        m.waist       != null ? toDisplayLength(Number(m.waist),     m.unit, units) : null,
    hips:         m.hips        != null ? toDisplayLength(Number(m.hips),      m.unit, units) : null,
    left_arm:     m.leftArm     != null ? toDisplayLength(Number(m.leftArm),   m.unit, units) : null,
    right_arm:    m.rightArm    != null ? toDisplayLength(Number(m.rightArm),  m.unit, units) : null,
    left_thigh:   m.leftThigh   != null ? toDisplayLength(Number(m.leftThigh), m.unit, units) : null,
    right_thigh:  m.rightThigh  != null ? toDisplayLength(Number(m.rightThigh),m.unit, units) : null,
    left_calf:    m.leftCalf    != null ? toDisplayLength(Number(m.leftCalf),  m.unit, units) : null,
    right_calf:   m.rightCalf   != null ? toDisplayLength(Number(m.rightCalf), m.unit, units) : null,
  }));

  const sortedSleep = filterByTf((sleepLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const sleepData: ChartData[] = sortedSleep.map(s => ({ date: s.date, hours: s.hoursSlept }));
  const sleepPoints = sortedSleep.map(s => ({ date: s.date, value: Number(s.hoursSlept) }));

  const sortedWorkouts = filterByTf((workoutLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const workoutRate = (() => {
    if (sortedWorkouts.length < 2) return null;
    const t0 = new Date(sortedWorkouts[0].date).getTime();
    const tN = new Date(sortedWorkouts[sortedWorkouts.length - 1].date).getTime();
    const weeks = (tN - t0) / (1000 * 60 * 60 * 24 * 7);
    if (weeks < 0.5) return null;
    return sortedWorkouts.length / weeks;
  })();

  if (!hasMeasurements && !hasSleep && !hasWorkouts) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your stats over time</p>
        </div>
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No data yet. Start logging workouts and measurements!</p>
        </div>
      </div>
    );
  }

  // Rate-of-change summary for history view header
  const rateRows = MEASUREMENT_CHARTS.map(({ key, label, unit, lowerIsBetter }) => {
    const points = measurementData
      .filter(d => d[key] != null)
      .map(d => ({ date: d.date as string, value: d[key] as number }));
    return { label, unit, lowerIsBetter, rate: weeklyRate(points) };
  }).filter(r => r.rate != null && Math.abs(r.rate) >= 0.001);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      {/* Header + controls */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your stats over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          {hasMeasurements && (
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                onClick={() => setView("charts")}
                className={`px-3 py-1.5 transition-colors ${view === "charts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Charts
              </button>
              <button
                onClick={() => setView("history")}
                className={`px-3 py-1.5 transition-colors ${view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                History
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards — always visible */}
      {hasMeasurements && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Starting Weight"
            value={firstWeightDisplay != null ? `${firstWeightDisplay} ${weightLabel}` : "—"}
            sub={first?.date}
          />
          <StatCard
            title="Current Weight"
            value={lastWeightDisplay != null ? `${lastWeightDisplay} ${weightLabel}` : "—"}
            sub={last?.date}
          />
          <StatCard
            title="Total Change"
            value={weightDelta != null ? `${Math.abs(weightDelta)} ${weightLabel}` : "—"}
            sub={weightDelta != null ? (weightDelta < 0 ? "lost" : "gained") : undefined}
            delta={weightDelta}
            deltaUnit={weightLabel}
          />
        </div>
      )}

      {/* ── History view ────────────────────────────────────────────── */}
      {view === "history" && hasMeasurements && (
        <div className="space-y-4">
          {/* Rate-of-change summary */}
          {rateRows.length > 0 && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Avg rate of change</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {rateRows.map(r => (
                  <RateRow
                    key={r.label}
                    label={r.label}
                    rate={r.rate}
                    unit={r.unit}
                    lowerIsBetter={r.lowerIsBetter}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Measurement entries */}
          <h2 className="text-base font-semibold">Measurement entries</h2>
          <HistoryList
            entries={measurementData as MeasurementEntry[]}
            charts={MEASUREMENT_CHARTS}
          />
        </div>
      )}

      {/* ── Charts view ─────────────────────────────────────────────── */}
      {view === "charts" && (
        <>
          {/* Individual measurement charts */}
          {hasMeasurements && measurementData.length >= 2 && (
            <div>
              <h2 className="text-base font-semibold mb-4">Body Measurements</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MEASUREMENT_CHARTS.map(({ key, label, color, unit, lowerIsBetter }) => {
                  const points = measurementData
                    .filter(d => d[key] != null)
                    .map(d => ({ date: d.date as string, value: d[key] as number }));
                  if (points.length === 0) return null;

                  const firstVal = points[0].value;
                  const lastVal = points[points.length - 1].value;
                  const diff = lastVal - firstVal;
                  const rate = weeklyRate(points);
                  const lwDelta = lastWeekDelta(points);
                  const deltas = rolling7dDeltas(points);

                  return (
                    <Card key={key}>
                      <CardHeader className="pb-0 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold">{lastVal} {unit}</span>
                            {Math.abs(diff) > 0.05 && (
                              <span className={`text-xs font-medium ${
                                lowerIsBetter
                                  ? diff < 0 ? "text-emerald-500" : "text-red-400"
                                  : diff > 0 ? "text-emerald-500" : "text-red-400"
                              }`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <RateChip rate={rate} unit={unit} lowerIsBetter={lowerIsBetter} />
                          <span className="text-muted-foreground text-xs">·</span>
                          <LastWeekChip delta={lwDelta} unit={unit} lowerIsBetter={lowerIsBetter} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2 pb-3 px-2">
                        <MiniLineChart data={measurementData} dataKey={key} color={color} unit={unit} />
                        <DeltaHistoryChart deltas={deltas} unit={unit} lowerIsBetter={lowerIsBetter} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sleep */}
          {hasSleep && sleepData.length >= 2 && (
            <div>
              <h2 className="text-base font-semibold mb-3">Sleep</h2>
              <Card>
                <CardHeader className="pb-0 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Hours slept</CardTitle>
                    <span className="text-sm font-bold">
                      {Number(sleepData[sleepData.length - 1]?.hours).toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <RateChip rate={weeklyRate(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                    <span className="text-muted-foreground text-xs">·</span>
                    <LastWeekChip delta={lastWeekDelta(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pb-3 px-2">
                  <MiniLineChart data={sleepData} dataKey="hours" color="hsl(200,70%,50%)" unit="hrs" />
                  <DeltaHistoryChart deltas={rolling7dDeltas(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Workouts */}
          {hasWorkouts && (
            <div>
              <h2 className="text-base font-semibold mb-3">Workouts</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard title="Total Sessions" value={workoutLogs?.length ?? 0} sub="all time" />
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Avg Frequency</p>
                    <p className="text-2xl font-bold">
                      {workoutRate != null ? workoutRate.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">sessions/week</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
