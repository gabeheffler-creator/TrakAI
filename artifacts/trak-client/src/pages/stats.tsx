import { useClientId } from "@/hooks/use-client-id";
import { useListWorkoutLogs, getListWorkoutLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trophy, TrendingUp, Dumbbell } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";

interface SetEntry {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number | null;
  weightUnit: string | null;
}

interface WorkoutLogWithSets {
  id: number;
  date: string;
  programDayName?: string | null;
  sets?: SetEntry[];
}

export function StatsPage() {
  const { clientId } = useClientId();
  const { data: logs, isLoading } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) }
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  const allLogs = (logs ?? []) as WorkoutLogWithSets[];

  // ── Personal Records ────────────────────────────────────────────────────────
  // For each exercise, find the heaviest single set weight ever lifted
  const prMap: Record<string, { weight: number; unit: string; date: string; reps: number }> = {};
  for (const log of allLogs) {
    for (const s of log.sets ?? []) {
      if (s.weight == null) continue;
      const existing = prMap[s.exerciseName];
      if (!existing || s.weight > existing.weight) {
        prMap[s.exerciseName] = { weight: s.weight, unit: s.weightUnit ?? "lbs", date: log.date, reps: s.reps };
      }
    }
  }
  const prs = Object.entries(prMap)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 20);

  // ── Volume Per Week ─────────────────────────────────────────────────────────
  // Total sets × reps grouped by ISO week start
  const weekMap: Record<string, number> = {};
  for (const log of allLogs) {
    const weekStart = format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), "MMM d");
    const volume = (log.sets ?? []).reduce((sum, s) => sum + s.reps, 0);
    weekMap[weekStart] = (weekMap[weekStart] ?? 0) + volume;
  }
  const volumeData = Object.entries(weekMap)
    .sort((a, b) => {
      const aLogs = allLogs.filter(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === a[0]);
      const bLogs = allLogs.filter(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === b[0]);
      return (aLogs[0]?.date ?? "").localeCompare(bLogs[0]?.date ?? "");
    })
    .map(([week, reps]) => ({ week, reps }));

  // ── Sets Per Week ───────────────────────────────────────────────────────────
  const setsWeekMap: Record<string, number> = {};
  for (const log of allLogs) {
    const weekStart = format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), "MMM d");
    setsWeekMap[weekStart] = (setsWeekMap[weekStart] ?? 0) + (log.sets?.length ?? 0);
  }
  const setsData = Object.entries(setsWeekMap)
    .sort((a, b) => {
      const aLog = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === a[0]);
      const bLog = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === b[0]);
      return (aLog?.date ?? "").localeCompare(bLog?.date ?? "");
    })
    .map(([week, sets]) => ({ week, sets }));

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalWorkouts = allLogs.length;
  const totalSets = allLogs.reduce((s, l) => s + (l.sets?.length ?? 0), 0);
  const totalReps = allLogs.reduce((s, l) => s + (l.sets ?? []).reduce((r, ss) => r + ss.reps, 0), 0);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="text-sm text-muted-foreground">Your training performance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Dumbbell className="w-5 h-5 mx-auto mb-1.5 text-primary" />
            <p className="text-2xl font-bold">{totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">Workouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-primary" />
            <p className="text-2xl font-bold">{totalSets}</p>
            <p className="text-xs text-muted-foreground">Total sets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1.5 text-primary" />
            <p className="text-2xl font-bold">{prs.length}</p>
            <p className="text-xs text-muted-foreground">PRs tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Volume trend */}
      {volumeData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Rep Volume by Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={volumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v} reps`, "Volume"]}
                />
                <Bar dataKey="reps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Sets per week */}
      {setsData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary" />
              Sets per Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={setsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v} sets`, "Sets"]}
                />
                <Bar dataKey="sets" fill="hsl(var(--chart-2, 139 100% 40%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Personal Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Personal Records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {prs.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No weighted sets logged yet.</p>
          )}
          {prs.map(([name, pr], i) => (
            <div key={name} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-xs text-muted-foreground">{pr.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold">{pr.weight} {pr.unit}</p>
                <p className="text-xs text-muted-foreground">{pr.reps} reps</p>
              </div>
              {i === 0 && <Badge className="flex-shrink-0 text-xs">Top</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {totalWorkouts === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No workouts yet</p>
          <p className="text-sm mt-1">Log a workout to see your stats here.</p>
        </div>
      )}
    </div>
  );
}
