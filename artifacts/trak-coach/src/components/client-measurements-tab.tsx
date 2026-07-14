import { useState, useRef } from "react";
import { Measurement } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

type TimeframeKey = "4w" | "3m" | "6m" | "1y" | "all";

const TIMEFRAME_OPTIONS: { value: TimeframeKey; label: string }[] = [
  { value: "4w",  label: "Last 4 weeks"  },
  { value: "3m",  label: "Last 3 months" },
  { value: "6m",  label: "Last 6 months" },
  { value: "1y",  label: "Last year"     },
  { value: "all", label: "All time"      },
];

type CoachMetricKey = "weight" | "chest" | "waist" | "hips" | "arms" | "thighs" | "calves" | "bodyFat";

const METRICS: { key: CoachMetricKey; label: string; lowerIsBetter: boolean }[] = [
  { key: "weight",  label: "Weight",   lowerIsBetter: true  },
  { key: "chest",   label: "Chest",    lowerIsBetter: false },
  { key: "waist",   label: "Waist",    lowerIsBetter: true  },
  { key: "hips",    label: "Hips",     lowerIsBetter: false },
  { key: "arms",    label: "Arms",     lowerIsBetter: false },
  { key: "thighs",  label: "Thighs",   lowerIsBetter: false },
  { key: "calves",  label: "Calves",   lowerIsBetter: false },
  { key: "bodyFat", label: "Body Fat", lowerIsBetter: true  },
];

function getTimeframeCutoff(tf: TimeframeKey): Date | null {
  const now = new Date();
  switch (tf) {
    case "4w":  return new Date(now.getTime() - 28  * 24 * 60 * 60 * 1000);
    case "3m":  return new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000);
    case "6m":  return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y":  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all": return null;
  }
}

function filterByTimeframe(measurements: Measurement[], tf: TimeframeKey): Measurement[] {
  const cutoff = getTimeframeCutoff(tf);
  if (!cutoff) return measurements;
  return measurements.filter(m => new Date(m.date) >= cutoff);
}

// Full ISO date in `date` for math; MM-DD in `label` for XAxis display
type ChartPoint = { date: string; label: string; value: number };

function calcLastChange(data: ChartPoint[]): number | null {
  if (data.length < 2) return null;
  return data[data.length - 1].value - data[data.length - 2].value;
}

function calcAvgRatePerWeek(data: ChartPoint[]): number | null {
  if (data.length < 2) return null;
  const first = data[0];
  const last  = data[data.length - 1];
  const weeks = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (7 * 24 * 60 * 60 * 1000);
  if (weeks < 0.1) return null;
  return (last.value - first.value) / weeks;
}

// Most recent entry within the 7-day window before the last entry
function calcLast7DaysChange(data: ChartPoint[]): number | null {
  if (data.length < 2) return null;
  const last   = data[data.length - 1];
  const cutoff = new Date(new Date(last.date).getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev   = [...data].slice(0, -1).reverse().find(d => new Date(d.date) >= cutoff);
  if (!prev) return null;
  return last.value - prev.value;
}

// Slope between the last two visible points, expressed as per-week change
function calcSlopeLastTwo(data: ChartPoint[]): number | null {
  if (data.length < 2) return null;
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const days = (new Date(last.date).getTime() - new Date(prev.date).getTime()) / (24 * 60 * 60 * 1000);
  if (days < 0.5) return null;
  return ((last.value - prev.value) / days) * 7;
}

function formatChange(val: number | null, unit: string): string {
  if (val == null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)} ${unit}`;
}

function changeColor(val: number | null, lowerIsBetter: boolean): string {
  if (val == null || val === 0) return "text-muted-foreground";
  const improved = lowerIsBetter ? val < 0 : val > 0;
  return improved ? "text-green-600 dark:text-green-400" : "text-red-500";
}

function barFill(current: number, prev: number | undefined, lowerIsBetter: boolean): string {
  if (prev === undefined) return "hsl(var(--primary) / 0.55)";
  if (lowerIsBetter) {
    return current <= prev ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
  }
  return "hsl(var(--primary) / 0.55)";
}

interface ClientMeasurementsTabProps {
  measurements: Measurement[];
}

export function ClientMeasurementsTab({ measurements }: ClientMeasurementsTabProps) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>("3m");
  const [historyOpen, setHistoryOpen] = useState(false);
  const metricRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sortedAll = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const filtered  = filterByTimeframe(sortedAll, timeframe);

  // Pills show metrics that have ANY data across full history
  const activeMetrics = METRICS.filter(m =>
    sortedAll.some(entry => entry[m.key] != null)
  );

  // History table columns: only metrics present in the filtered window
  const filteredActiveMetrics = METRICS.filter(m =>
    filtered.some(entry => entry[m.key] != null)
  );

  const unitLabel = sortedAll[0]?.unit === "metric"
    ? { weight: "kg", length: "cm" }
    : { weight: "lbs", length: "in" };

  function getUnit(key: CoachMetricKey): string {
    if (key === "weight")  return unitLabel.weight;
    if (key === "bodyFat") return "%";
    return unitLabel.length;
  }

  if (measurements.length === 0) {
    return <p className="text-muted-foreground text-sm">No measurements logged.</p>;
  }

  function scrollToMetric(key: string) {
    metricRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filteredDesc = [...filtered].reverse();

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-start gap-3 flex-wrap">
        <Select value={timeframe} onValueChange={v => setTimeframe(v as TimeframeKey)}>
          <SelectTrigger className="w-40 h-8 text-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1.5 flex-wrap">
          {activeMetrics.map(m => (
            <button
              key={m.key}
              onClick={() => scrollToMetric(m.key)}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-background hover:bg-accent transition-colors"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">No measurements in this timeframe.</p>
      )}

      {/* Per-metric sections */}
      {activeMetrics.map(metric => {
        const unit = getUnit(metric.key);
        const chartData: ChartPoint[] = filtered
          .filter(m => m[metric.key] != null)
          .map(m => ({
            date:  m.date,          // full ISO for math
            label: m.date.slice(5), // MM-DD for display
            value: m[metric.key] as number,
          }));

        if (chartData.length === 0) return null;

        const lc    = calcLastChange(chartData);
        const avg   = calcAvgRatePerWeek(chartData);
        const l7    = calcLast7DaysChange(chartData);
        const slope = calcSlopeLastTwo(chartData);

        const stats = [
          { label: "Last change", val: lc  },
          { label: "Avg / week",  val: avg },
          { label: "Last 7 days", val: l7  },
        ];

        const slopeText = slope != null
          ? `${slope > 0 ? "+" : ""}${slope.toFixed(1)}/wk`
          : null;

        return (
          <div
            key={metric.key}
            ref={el => { metricRefs.current[metric.key] = el; }}
          >
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4 px-4">
                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2">
                  {stats.map(stat => (
                    <div key={stat.label} className="rounded-lg bg-muted/50 px-2 py-2 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5 leading-tight">{stat.label}</p>
                      <p className={`text-sm font-semibold tabular-nums ${changeColor(stat.val, metric.lowerIsBetter)}`}>
                        {formatChange(stat.val, unit)}
                      </p>
                    </div>
                  ))}
                </div>

                {chartData.length >= 2 ? (
                  <>
                    {/* Line chart with slope annotation near right edge */}
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                          <Tooltip
                            formatter={(v: number) => [`${v} ${unit}`, metric.label]}
                            labelFormatter={l => `Date: ${l}`}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                          {slopeText != null && (
                            <ReferenceLine
                              x={chartData[chartData.length - 1].label}
                              stroke="transparent"
                              label={{
                                value: slopeText,
                                position: "insideTopRight",
                                fontSize: 10,
                                fill: slope! > 0
                                  ? (metric.lowerIsBetter ? "hsl(0 84% 60%)" : "hsl(142 71% 45%)")
                                  : (metric.lowerIsBetter ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"),
                                offset: 4,
                              }}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Bar chart */}
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} />
                        <Tooltip
                          formatter={(v: number) => [`${v} ${unit}`, metric.label]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {chartData.map((entry, idx) => (
                            <Cell
                              key={idx}
                              fill={barFill(
                                entry.value,
                                idx > 0 ? chartData[idx - 1].value : undefined,
                                metric.lowerIsBetter
                              )}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Log another measurement to see trend charts.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {/* Collapsible history table — columns limited to metrics present in filtered window */}
      {filtered.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1.5 w-full text-left mb-2"
            onClick={() => setHistoryOpen(o => !o)}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History
            </p>
            <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
            {historyOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
          </button>

          {historyOpen && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Date</th>
                    {filteredActiveMetrics.map(m => (
                      <th key={m.key} className="text-right px-3 py-2 font-medium whitespace-nowrap">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDesc.map(m => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.date}</td>
                      {filteredActiveMetrics.map(metric => {
                        const val = m[metric.key];
                        return (
                          <td key={metric.key} className="px-3 py-2 text-right tabular-nums">
                            {val != null
                              ? `${val} ${getUnit(metric.key)}`
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
