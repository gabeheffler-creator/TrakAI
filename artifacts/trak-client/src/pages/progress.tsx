import { useClientId } from "@/hooks/use-client-id";
import {
  useListMeasurements,
  useListWorkoutLogs,
  useListSleepLogs,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartData = { date: string; [key: string]: number | string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
      No {label} data yet
    </div>
  );
}

function TrakLineChart({
  data,
  lines,
  unit,
}: {
  data: ChartData[];
  lines: { key: string; color: string; label: string }[];
  unit?: string;
}) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickFormatter={v => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            unit={unit ? ` ${unit}` : ""}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={v => {
              const d = new Date(v);
              return d.toLocaleDateString();
            }}
          />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {lines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              dot={{ r: 3, fill: l.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressPage() {
  const { clientId } = useClientId();

  const { data: measurements } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId }
  });
  const { data: workoutLogs } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId }
  });
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId }
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  // ── Weight chart ──────────────────────────────────────
  const weightData: ChartData[] = (measurements ?? [])
    .filter(m => m.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({ date: m.date, weight: m.weight! }));

  // ── Body measurements chart ───────────────────────────
  const measurementFields = [
    { key: "chest", label: "Chest", color: "hsl(271,70%,56%)" },
    { key: "waist", label: "Waist", color: "hsl(200,70%,50%)" },
    { key: "hips", label: "Hips", color: "hsl(38,92%,50%)" },
    { key: "arms", label: "Arms", color: "hsl(158,64%,38%)" },
  ] as const;

  const bodyData: ChartData[] = (measurements ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({
      date: m.date,
      chest: m.chest ?? null,
      waist: m.waist ?? null,
      hips: m.hips ?? null,
      arms: m.arms ?? null,
    }));

  // ── Sleep chart ───────────────────────────────────────
  const sleepData: ChartData[] = (sleepLogs ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      date: s.date,
      hours: s.hoursSlept,
    }));

  // ── Workout volume chart ──────────────────────────────
  const workoutData: ChartData[] = (workoutLogs ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({
      date: w.date,
      sessions: 1,
    }));

  const hasMeasurements = measurements && measurements.length > 0;
  const hasSleep = sleepLogs && sleepLogs.length > 0;
  const hasWorkouts = workoutLogs && workoutLogs.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your stats over time</p>
      </div>

      {!hasMeasurements && !hasSleep && !hasWorkouts && (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No data yet. Start logging workouts, sleep, and measurements!</p>
        </div>
      )}

      {/* Weight */}
      <Section title="Body Weight">
        {weightData.length < 2 ? (
          <EmptyChart label="weight" />
        ) : (
          <TrakLineChart
            data={weightData}
            lines={[{ key: "weight", color: "hsl(271,70%,56%)", label: "Weight" }]}
            unit="lbs"
          />
        )}
      </Section>

      {/* Body measurements */}
      <Section title="Measurements">
        {bodyData.length < 2 ? (
          <EmptyChart label="measurement" />
        ) : (
          <TrakLineChart
            data={bodyData}
            lines={measurementFields.map(f => ({ key: f.key, color: f.color, label: f.label }))}
            unit="in"
          />
        )}
      </Section>

      {/* Sleep */}
      <Section title="Sleep (hours)">
        {sleepData.length < 2 ? (
          <EmptyChart label="sleep" />
        ) : (
          <TrakLineChart
            data={sleepData}
            lines={[
              { key: "hours", color: "hsl(200,70%,50%)", label: "Hours slept" },
            ]}
          />
        )}
      </Section>

      {/* Workout frequency */}
      <Section title="Workout Frequency">
        {workoutData.length < 2 ? (
          <EmptyChart label="workout" />
        ) : (
          <TrakLineChart
            data={workoutData}
            lines={[{ key: "sessions", color: "hsl(158,64%,38%)", label: "Sessions" }]}
          />
        )}
      </Section>
    </div>
  );
}
