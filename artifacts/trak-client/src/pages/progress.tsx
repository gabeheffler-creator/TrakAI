import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem, type UnitSystem } from "@/hooks/use-unit-system";
import {
  useListMeasurements,
  useListSleepLogs,
  getListMeasurementsQueryKey,
  getListSleepLogsQueryKey,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

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
  fullHeight = false,
}: {
  data: ChartData[];
  dataKey: string;
  color: string;
  unit?: string;
  fullHeight?: boolean;
}) {
  return (
    <div className={fullHeight ? "h-full w-full" : "h-28 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: fullHeight ? 11 : 9, fill: "var(--color-muted-foreground)" }}
            tickFormatter={v => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fontSize: fullHeight ? 11 : 9, fill: "var(--color-muted-foreground)" }}
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
            strokeWidth={fullHeight ? 2.5 : 2}
            dot={{ r: fullHeight ? 4 : 3, fill: color }}
            activeDot={{ r: fullHeight ? 6 : 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getMeasurementCharts(weightUnit: string, lengthUnit: string) {
  return [
    { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: weightUnit,  lowerIsBetter: true },
    { key: "body_fat",    label: "Body Fat %",   color: "hsl(15,85%,55%)",  unit: "%",          lowerIsBetter: true },
    { key: "chest",       label: "Chest",        color: "hsl(340,75%,55%)", unit: lengthUnit,   lowerIsBetter: false },
    { key: "waist",       label: "Waist",        color: "hsl(200,70%,50%)", unit: lengthUnit,   lowerIsBetter: true },
    { key: "hips",        label: "Hips",         color: "hsl(38,92%,50%)",  unit: lengthUnit,   lowerIsBetter: true },
    { key: "left_arm",    label: "Left Arm",     color: "hsl(158,64%,38%)", unit: lengthUnit,   lowerIsBetter: false },
    { key: "right_arm",   label: "Right Arm",    color: "hsl(158,64%,50%)", unit: lengthUnit,   lowerIsBetter: false },
    { key: "left_thigh",  label: "Left Thigh",   color: "hsl(28,85%,50%)",  unit: lengthUnit,   lowerIsBetter: false },
    { key: "right_thigh", label: "Right Thigh",  color: "hsl(28,85%,60%)",  unit: lengthUnit,   lowerIsBetter: false },
    { key: "left_calf",   label: "Left Calf",    color: "hsl(260,50%,55%)", unit: lengthUnit,   lowerIsBetter: false },
    { key: "right_calf",  label: "Right Calf",   color: "hsl(260,50%,65%)", unit: lengthUnit,   lowerIsBetter: false },
  ];
}

// ─── History list view ───────────────────────────────────────────────────────

type MeasurementEntry = ChartData & { date: string };

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

type Timeframe = "1w" | "1m" | "3m" | "6m" | "1y" | "all" | "custom";

function filterByTf<T extends { date: string }>(
  items: T[],
  tf: Timeframe,
  customStart?: string | null,
  customEnd?: string | null,
): T[] {
  if (tf === "custom") {
    if (!customStart || !customEnd) return items;
    return items.filter(i => i.date >= customStart && i.date <= customEnd);
  }
  if (tf === "all") return items;
  const days = tf === "1w" ? 7 : tf === "1m" ? 30 : tf === "3m" ? 90 : tf === "6m" ? 180 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return items.filter(i => i.date >= cutoffStr);
}

type FullscreenChart = {
  label: string;
  color: string;
  unit: string;
  lowerIsBetter: boolean;
  data: ChartData[];
  dataKey: string;
  lwDelta: number | null;
  lastVal: number | null;
};

export function ProgressPage() {
  const [view, setView] = useState<"charts" | "history">("charts");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [fullscreenChart, setFullscreenChart] = useState<FullscreenChart | null>(null);
  const { clientId } = useClientId();
  const { units, weightLabel, lengthLabel } = useUnitSystem();

  const { data: measurements, isError: measurementsError, refetch: refetchMeasurements, isFetching: measurementsFetching } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) },
  });
  const { data: sleepLogs, isError: sleepLogsError, refetch: refetchSleepLogs, isFetching: sleepLogsFetching } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) },
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  const isError = measurementsError || sleepLogsError;
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Progress</h1>
        <QueryErrorState
          message="Couldn't load your progress data. This is usually temporary."
          onRetry={() => { refetchMeasurements(); refetchSleepLogs(); }}
          isRetrying={measurementsFetching || sleepLogsFetching}
          testId="button-retry-progress"
        />
      </div>
    );
  }

  const MEASUREMENT_CHARTS = getMeasurementCharts(weightLabel, lengthLabel);

  const sorted = filterByTf(
    (measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    timeframe,
    customStart || null,
    customEnd || null,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

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

  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? toDisplayWeight(Number(m.weight),     m.unit, units) : null,
    body_fat:     m.bodyFat     != null ? Number(m.bodyFat)                                    : null,
    chest:        m.chest       != null ? toDisplayLength(Number(m.chest),      m.unit, units) : null,
    waist:        m.waist       != null ? toDisplayLength(Number(m.waist),      m.unit, units) : null,
    hips:         m.hips        != null ? toDisplayLength(Number(m.hips),       m.unit, units) : null,
    left_arm:     m.leftArm     != null ? toDisplayLength(Number(m.leftArm),    m.unit, units) : null,
    right_arm:    m.rightArm    != null ? toDisplayLength(Number(m.rightArm),   m.unit, units) : null,
    left_thigh:   m.leftThigh   != null ? toDisplayLength(Number(m.leftThigh),  m.unit, units) : null,
    right_thigh:  m.rightThigh  != null ? toDisplayLength(Number(m.rightThigh), m.unit, units) : null,
    left_calf:    m.leftCalf    != null ? toDisplayLength(Number(m.leftCalf),   m.unit, units) : null,
    right_calf:   m.rightCalf   != null ? toDisplayLength(Number(m.rightCalf),  m.unit, units) : null,
  }));

  const sortedSleep = filterByTf(
    (sleepLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    timeframe,
    customStart || null,
    customEnd || null,
  );
  const sleepData: ChartData[] = sortedSleep.map(s => ({ date: s.date, hours: s.hoursSlept }));
  const sleepPoints = sortedSleep.map(s => ({ date: s.date, value: Number(s.hoursSlept) }));

  if (!hasMeasurements && !hasSleep) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your stats over time</p>
        </div>
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No data yet. Start logging measurements!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
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
              <SelectItem value="1w">Week</SelectItem>
              <SelectItem value="1m">Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="1y">Year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
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

      {/* Custom date range inputs */}
      {timeframe === "custom" && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
            <Input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
            <Input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
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
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Change</p>
              <div className="flex items-center justify-center gap-1">
                {weightDelta != null && weightDelta < 0 && (
                  <ArrowDown className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                {weightDelta != null && weightDelta > 0 && (
                  <ArrowUp className="w-5 h-5 text-red-400 shrink-0" />
                )}
                {weightDelta != null && weightDelta === 0 && (
                  <Minus className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <p className="text-2xl font-bold">
                  {weightDelta != null ? `${Math.abs(weightDelta)} ${weightLabel}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── History view ────────────────────────────────────────────── */}
      {view === "history" && hasMeasurements && (
        <div className="space-y-4">
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
          {hasMeasurements && measurementData.length >= 2 && (
            <div>
              <h2 className="text-base font-semibold mb-4">Body Measurements</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MEASUREMENT_CHARTS.map(({ key, label, color, unit, lowerIsBetter }) => {
                  const points = measurementData
                    .filter(d => d[key] != null)
                    .map(d => ({ date: d.date as string, value: d[key] as number }));
                  if (points.length === 0) return null;

                  const lastVal = points[points.length - 1].value;
                  const firstVal = points[0].value;
                  const diff = lastVal - firstVal;
                  const lwDelta = lastWeekDelta(points);

                  return (
                    <Card key={key}>
                      <CardHeader className="pb-0 pt-3 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm font-semibold truncate">{label}</CardTitle>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-baseline gap-1">
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
                            <button
                              onClick={() => setFullscreenChart({
                                label, color, unit, lowerIsBetter,
                                data: measurementData, dataKey: key,
                                lwDelta, lastVal,
                              })}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={`View ${label} fullscreen`}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1">
                          <LastWeekChip delta={lwDelta} unit={unit} lowerIsBetter={lowerIsBetter} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2 pb-3 px-2">
                        <MiniLineChart data={measurementData} dataKey={key} color={color} unit={unit} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {hasSleep && sleepData.length >= 2 && (
            <div>
              <h2 className="text-base font-semibold mb-3">Sleep</h2>
              <Card>
                <CardHeader className="pb-0 pt-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">Hours slept</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">
                        {Number(sleepData[sleepData.length - 1]?.hours).toFixed(1)} hrs
                      </span>
                      <button
                        onClick={() => setFullscreenChart({
                          label: "Hours Slept",
                          color: "hsl(200,70%,50%)",
                          unit: "hrs",
                          lowerIsBetter: false,
                          data: sleepData,
                          dataKey: "hours",
                          lwDelta: lastWeekDelta(sleepPoints),
                          lastVal: Number(sleepData[sleepData.length - 1]?.hours),
                        })}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View sleep chart fullscreen"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1">
                    <LastWeekChip delta={lastWeekDelta(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pb-3 px-2">
                  <MiniLineChart data={sleepData} dataKey="hours" color="hsl(200,70%,50%)" unit="hrs" />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Fullscreen chart dialog */}
      <Dialog open={!!fullscreenChart} onOpenChange={open => !open && setFullscreenChart(null)}>
        <DialogContent className="max-w-full w-[95vw] h-[85vh] flex flex-col p-4 gap-2">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-6">
              <DialogTitle>{fullscreenChart?.label}</DialogTitle>
              {fullscreenChart && (
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold">
                    {fullscreenChart.lastVal != null
                      ? `${fullscreenChart.lastVal} ${fullscreenChart.unit}`
                      : "—"}
                  </span>
                  <LastWeekChip
                    delta={fullscreenChart.lwDelta}
                    unit={fullscreenChart.unit}
                    lowerIsBetter={fullscreenChart.lowerIsBetter}
                  />
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {fullscreenChart && (
              <MiniLineChart
                data={fullscreenChart.data}
                dataKey={fullscreenChart.dataKey}
                color={fullscreenChart.color}
                unit={fullscreenChart.unit}
                fullHeight
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
