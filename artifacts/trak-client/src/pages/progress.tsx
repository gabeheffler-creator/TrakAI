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
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartData = { date: string; [key: string]: number | string | null };

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-36 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
      No {label} data yet
    </div>
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

const MEASUREMENT_CHARTS = [
  { key: "weight",  label: "Body Weight",  color: "hsl(271,70%,56%)", unit: "lbs" },
  { key: "chest",   label: "Chest",        color: "hsl(340,75%,55%)", unit: "in" },
  { key: "waist",   label: "Waist",        color: "hsl(200,70%,50%)", unit: "in" },
  { key: "hips",    label: "Hips",         color: "hsl(38,92%,50%)",  unit: "in" },
  { key: "left_arm",  label: "Left Arm",   color: "hsl(158,64%,38%)", unit: "in" },
  { key: "right_arm", label: "Right Arm",  color: "hsl(158,64%,50%)", unit: "in" },
  { key: "left_thigh",  label: "Left Thigh",  color: "hsl(28,85%,50%)", unit: "in" },
  { key: "right_thigh", label: "Right Thigh", color: "hsl(28,85%,60%)", unit: "in" },
  { key: "left_calf",   label: "Left Calf",   color: "hsl(260,50%,55%)", unit: "in" },
  { key: "right_calf",  label: "Right Calf",  color: "hsl(260,50%,65%)", unit: "in" },
] as const;

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

  const sleepData: ChartData[] = (sleepLogs ?? [])
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ date: s.date, hours: s.hoursSlept }));

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
        <>
          <div>
            <h2 className="text-base font-semibold mb-4">Body Measurements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MEASUREMENT_CHARTS.map(({ key, label, color, unit }) => {
                const hasData = measurementData.some(d => d[key] != null);
                if (!hasData) return null;

                const firstVal = measurementData.find(d => d[key] != null)?.[key] as number | null;
                const lastVal = [...measurementData].reverse().find(d => d[key] != null)?.[key] as number | null;
                const diff = firstVal != null && lastVal != null ? lastVal - firstVal : null;

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
                              key === "waist" || key === "hips"
                                ? diff < 0 ? "text-emerald-500" : "text-red-400"
                                : diff > 0 ? "text-emerald-500" : "text-red-400"
                            }`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          )}
                        </div>
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
        </>
      )}

      {/* Sleep */}
      {hasSleep && sleepData.length >= 2 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Sleep (hours)</h2>
          <Card>
            <CardContent className="pt-3 pb-3 px-2">
              <MiniChart data={sleepData} dataKey="hours" color="hsl(200,70%,50%)" />
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
            <StatCard
              title="This Week"
              value={
                (workoutLogs ?? []).filter(w => {
                  const d = new Date(w.date);
                  const now = new Date();
                  const startOfWeek = new Date(now);
                  startOfWeek.setDate(now.getDate() - now.getDay());
                  return d >= startOfWeek;
                }).length
              }
              sub="sessions"
            />
          </div>
        </div>
      )}
    </div>
  );
}
