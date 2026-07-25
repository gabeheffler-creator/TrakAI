import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import {
  useGetClientDashboard,
  getGetClientDashboardQueryKey,
  useListActiveTasks,
  getListActiveTasksQueryKey,
  useCompleteTask,
  useListNutritionLogs,
  getListNutritionLogsQueryKey,
  useListSleepLogs,
  getListSleepLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Link } from "wouter";
import {
  Dumbbell, ClipboardList, TrendingUp, ChevronRight, CheckCircle2, Moon, Utensils,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

export function Dashboard() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { units, weightLabel } = useUnitSystem();

  const { data: dashboard, isLoading, isError, refetch, isFetching } =
    useGetClientDashboard(clientId!, {
      query: { enabled: !!clientId, queryKey: getGetClientDashboardQueryKey(clientId!) },
    });

  const { data: activeTasks } = useListActiveTasks(clientId!, {
    query: {
      enabled: !!clientId,
      queryKey: getListActiveTasksQueryKey(clientId!),
      refetchInterval: 10000,
    },
  });
  const completeTask = useCompleteTask();

  const { data: nutritionLogs } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) },
  });
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) },
  });

  const todayISO = new Date().toISOString().split("T")[0];
  const yesterdayISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const todayMeals = (nutritionLogs ?? []).filter(
    (n) => n.date === todayISO && n.imageUrl !== "water_only"
  );
  const hasTodayNutrition = todayMeals.length > 0;
  const todayCalories = todayMeals.reduce((sum, n) => sum + (n.calories ?? 0), 0);

  const recentSleep = (sleepLogs ?? [])
    .filter((s) => s.date === todayISO || s.date === yesterdayISO)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  if (!clientId) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-4 text-center">
        <div>
          <div className="text-4xl font-black text-primary mb-2">Trak</div>
          <p className="text-muted-foreground text-sm">You need an invite link from your coach to get started.</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Loading…</div>;

  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load your dashboard."
        onRetry={() => refetch()}
        isRetrying={isFetching}
        testId="button-retry-dashboard"
        className="p-8"
      />
    );
  }

  const client = dashboard?.client;

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground">Good work,</p>
        <h1 className="text-xl font-bold">{client?.name ?? "Athlete"}</h1>
        {client?.goal && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">{client.goal}</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{dashboard?.workoutsThisWeek ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold">{dashboard?.pendingAssignments ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tasks Due</p>
          </CardContent>
        </Card>
        <Link href="/stats" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 text-center">
              {(() => {
                const m = dashboard?.latestMeasurement;
                if (!m?.weight)
                  return (
                    <>
                      <p className="text-xs font-semibold text-primary leading-tight">Log weight</p>
                      <ChevronRight className="w-3 h-3 text-primary mx-auto mt-0.5" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Weight ({weightLabel})</p>
                    </>
                  );
                const stored = m.unit === "metric" ? "metric" : "imperial";
                const val =
                  stored === units
                    ? m.weight
                    : Math.round(
                        (stored === "imperial" ? m.weight * 0.453592 : m.weight * 2.20462) * 10
                      ) / 10;
                return (
                  <>
                    <p className="text-2xl font-bold">{val}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Weight ({weightLabel})</p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Nutrition & Sleep */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/nutrition" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 text-center">
              {hasTodayNutrition ? (
                <>
                  <p className="text-2xl font-bold">{todayCalories.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Cal today</p>
                </>
              ) : (
                <>
                  <Utensils className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-primary mt-1">Log meals</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">No entries yet</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/sleep" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 text-center">
              {recentSleep ? (
                <>
                  <p className="text-2xl font-bold">{Number(recentSleep.hoursSlept)}h</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Last sleep</p>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-primary mt-1">Log sleep</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">No recent entry</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Active tasks */}
      {activeTasks && activeTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Your Tasks
            </h2>
            <Link href="/tasks" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {activeTasks.map((task, index) => (
              <Card key={task.id} className="border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800">
                <CardContent className="px-3 py-2.5 space-y-2">
                  <p className="text-xs leading-relaxed text-foreground">
                    {task.altStatus === "accepted" && task.alternativeText
                      ? task.alternativeText
                      : task.text}
                  </p>
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                    disabled={completeTask.isPending}
                    onClick={() => {
                      completeTask.mutate(
                        { clientId: clientId!, taskId: task.id },
                        {
                          onSuccess: () => {
                            qc.invalidateQueries({
                              queryKey: getListActiveTasksQueryKey(clientId!),
                            });
                          },
                        }
                      );
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Start workout CTA */}
      <Link href="/workout" className="block">
        <Card className="bg-primary text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Dumbbell className="w-5 h-5" />
              <div>
                <p className="font-bold text-sm">Start Today's Workout</p>
                <p className="text-xs text-primary-foreground/70">Log your sets and reps</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" />
          </CardContent>
        </Card>
      </Link>

      {/* Weight chart */}
      {(dashboard?.weightHistory?.length ?? 0) > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" /> Weight Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={dashboard?.weightHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => [`${v} ${weightLabel}`, "Weight"]}
                  labelFormatter={(d) => format(parseISO(d), "MMM d")}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent workouts */}
      {(dashboard?.recentWorkouts?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Workouts
            </h2>
            <Link href="/workout" className="text-xs text-primary">
              See all
            </Link>
          </div>
          <div className="space-y-1.5">
            {dashboard?.recentWorkouts?.slice(0, 3).map((w) => (
              <Link key={w.id} href="/workout">
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-2.5 pb-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{w.programDayName ?? "Free workout"}</p>
                      <p className="text-xs text-muted-foreground">{w.date}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
