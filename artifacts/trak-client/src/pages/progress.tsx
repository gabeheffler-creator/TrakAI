import { useClientId } from "@/hooks/use-client-id";
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
import { startOfWeek, format, parseISO } from "date-fns";

type ChartData = { date: string; [key: string]: number | string | null };

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
}: {
  title: string;
  value: string | number;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {delta != null && (
          <p className={`text-xs font-medium mt-1 ${delta < 0 ? "text-emerald-500" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)} lbs
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MEASUREMENT_CHARTS: {
  key: string;
  label: string;
  color: string;
  unit: string;
  lowerIsBetter?: boolean;
}[] = [
  { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: "lbs", lowerIsBetter: true },
  { key: "body_fat",    label: "Body Fat %",   color: "hsl(15,85%,55%)",  unit: "%",   lowerIsBetter: true },
  { key: "chest",       label: "Chest",        color: "hsl(340,75%,55%)", unit: "in" },
  { key: "waist",       label: "Waist",        color: "hsl(200,70%,50%)", unit: "in",  lowerIsBetter: true },
  { key: "hips",        label: "Hips",         color: "hsl(38,92%,50%)",  unit: "in",  lowerIsBetter: true },
  { key: "left_arm",    label: "Left Arm",     color: "hsl(158,64%,38%)", unit: "in" },
  { key: "right_arm",   label: "Right Arm",    color: "hsl(158,64%,50%)", unit: "in" },
  { key: "left_thigh",  label: "Left Thigh",   color: "hsl(28,85%,50%)",  unit: "in" },
  { key: "right_thigh", label: "Right Thigh",  color: "hsl(28,85%,60%)",  unit: "in" },
  { key: "left_calf",   label: "Left Calf",    color: "hsl(260,50%,55%)", unit: "in" },
  { key: "right_calf",  label: "Right Calf",   color: "hsl(260,50%,65%)", unit: "in" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export function ProgressPage() {
  const { clientId } = useClientId();

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

  const sorted = (measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const weightDelta =
    first?.weight != null && last?.weight != null
      ? Number(last.weight) - Number(first.weight)
      : null;

  const hasMeasurements = sorted.length > 0;
  const hasSleep = (sleepLogs ?? []).length > 0;
  const hasWorkouts = (workoutLogs ?? []).length > 0;

  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? Number(m.weight)      : null,
    body_fat:     m.bodyFat     != null ? Number(m.bodyFat)     : null,
    chest:        m.chest       != null ? Number(m.chest)       : null,
    waist:        m.waist       != null ? Number(m.waist)       : null,
    hips:         m.hips        != null ? Number(m.hips)        : null,
    left_arm:     m.leftArm     != null ? Number(m.leftArm)     : null,
    right_arm:    m.rightArm    != null ? Number(m.rightArm)    : null,
    left_thigh:   m.leftThigh   != null ? Number(m.leftThigh)   : null,
    right_thigh:  m.rightThigh  != null ? Number(m.rightThigh)  : null,
    left_calf:    m.leftCalf    != null ? Number(m.leftCalf)    : null,
    right_calf:   m.rightCalf   != null ? Number(m.rightCalf)   : null,
  }));

  const sortedSleep = (sleepLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const sleepData: ChartData[] = sortedSleep.map(s => ({ date: s.date, hours: s.hoursSlept }));
  const sleepPoints = sortedSleep.map(s => ({ date: s.date, value: Number(s.hoursSlept) }));

  const sortedWorkouts = (workoutLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
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

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your stats over time</p>
      </div>

      {/* Summary cards */}
      {hasMeasurements && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Starting Weight"
            value={first?.weight != null ? `${first.weight} lbs` : "—"}
            sub={first?.date}
          />
          <StatCard
            title="Current Weight"
            value={last?.weight != null ? `${last.weight} lbs` : "—"}
            sub={last?.date}
          />
          <StatCard
            title="Total Change"
            value={weightDelta != null ? `${Math.abs(weightDelta).toFixed(1)} lbs` : "—"}
            sub={weightDelta != null ? (weightDelta < 0 ? "lost" : "gained") : undefined}
            delta={weightDelta}
          />
        </div>
      )}

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
                    {/* Row 1: name + current value + total diff */}
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
                    {/* Row 2: trend avg + this-week delta */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <RateChip rate={rate} unit={unit} lowerIsBetter={lowerIsBetter} />
                      <span className="text-muted-foreground text-xs">·</span>
                      <LastWeekChip delta={lwDelta} unit={unit} lowerIsBetter={lowerIsBetter} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-3 px-2">
                    {/* Value over time */}
                    <MiniLineChart data={measurementData} dataKey={key} color={color} unit={unit} />
                    {/* Rolling 7-day net change history */}
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
    </div>
  );
}
