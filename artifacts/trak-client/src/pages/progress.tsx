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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartData = { date: string; [key: string]: number | string | null };

/** Linear-regression slope in units per week. Returns null if fewer than 2 points. */
function weeklyRate(points: { date: string; value: number }[]): number | null {
  const valid = points.filter(p => p.value != null);
  if (valid.length < 2) return null;
  const t0 = new Date(valid[0].date).getTime();
  const xs = valid.map(p => (new Date(p.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 7));
  const ys = valid.map(p => p.value);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

function RateChip({ rate, unit, lowerIsBetter = false }: { rate: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (rate == null || Math.abs(rate) < 0.001) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> stable</span>;
  }
  const positive = rate > 0;
  const good = lowerIsBetter ? !positive : positive;
  const color = good ? "text-emerald-500" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {positive
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />}
      {sign}{rate.toFixed(2)} {unit}/wk
    </span>
  );
}

function MiniChart({
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
    <div className="h-36 w-full">
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

const MEASUREMENT_CHARTS: {
  key: string;
  label: string;
  color: string;
  unit: string;
  lowerIsBetter?: boolean;
}[] = [
  { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: "lbs", lowerIsBetter: true },
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

export function ProgressPage() {
  const { clientId } = useClientId();

  const { data: measurements } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) }
  });
  const { data: workoutLogs } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) }
  });
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) }
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  const sorted = (measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const weightDelta = first?.weight != null && last?.weight != null
    ? Number(last.weight) - Number(first.weight)
    : null;

  const hasMeasurements = sorted.length > 0;
  const hasSleep = (sleepLogs ?? []).length > 0;
  const hasWorkouts = (workoutLogs ?? []).length > 0;

  // Build chart data — one series per measurement type
  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? Number(m.weight)      : null,
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

  // Workouts per week rate
  const sortedWorkouts = (workoutLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const workoutRate = (() => {
    if (sortedWorkouts.length < 2) return null;
    const t0 = new Date(sortedWorkouts[0].date).getTime();
    const tN = new Date(sortedWorkouts[sortedWorkouts.length - 1].date).getTime();
    const weeks = (tN - t0) / (1000 * 60 * 60 * 24 * 7);
    if (weeks < 0.5) return null;
    return sortedWorkouts.length / weeks;
  })();

  const sleepRate = weeklyRate(sortedSleep.map(s => ({ date: s.date, value: s.hoursSlept ?? 0 })));

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
              const hasData = measurementData.some(d => d[key] != null);
              if (!hasData) return null;

              const firstVal = measurementData.find(d => d[key] != null)?.[key] as number | null;
              const lastVal = [...measurementData].reverse().find(d => d[key] != null)?.[key] as number | null;
              const diff = firstVal != null && lastVal != null ? lastVal - firstVal : null;

              const rate = weeklyRate(
                measurementData
                  .filter(d => d[key] != null)
                  .map(d => ({ date: d.date as string, value: d[key] as number }))
              );

              return (
                <Card key={key}>
                  <CardHeader className="pb-0 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                      <div className="text-right">
                        {lastVal != null && (
                          <span className="text-sm font-bold">{lastVal} {unit}</span>
                        )}
                        {diff != null && Math.abs(diff) > 0.05 && (
                          <span className={`ml-2 text-xs font-medium ${
                            lowerIsBetter
                              ? diff < 0 ? "text-emerald-500" : "text-red-400"
                              : diff > 0 ? "text-emerald-500" : "text-red-400"
                          }`}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Rate of change row */}
                    <div className="mt-0.5">
                      <RateChip rate={rate} unit={unit} lowerIsBetter={lowerIsBetter} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-3 px-2">
                    <MiniChart
                      data={measurementData}
                      dataKey={key}
                      color={color}
                      unit={unit}
                    />
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
                  {Number(sleepData[sleepData.length - 1]?.hours)?.toFixed(1)} hrs
                </span>
              </div>
              <div className="mt-0.5">
                <RateChip rate={sleepRate} unit="hrs" lowerIsBetter={false} />
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-2">
              <MiniChart data={sleepData} dataKey="hours" color="hsl(200,70%,50%)" unit="hrs" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workout frequency */}
      {hasWorkouts && (
        <div>
          <h2 className="text-base font-semibold mb-3">Workouts</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Total Sessions"
              value={workoutLogs?.length ?? 0}
              sub="all time"
            />
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
