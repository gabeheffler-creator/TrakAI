import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useVideoCallStatus } from "@/hooks/use-video-call-status";
import { VideoCall } from "@/components/video-call";
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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { Dumbbell, ClipboardList, TrendingUp, ChevronRight, Video, CheckCircle2, Moon, Utensils } from "lucide-react";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

export function Dashboard() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { units, weightLabel } = useUnitSystem();
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const callActive = useVideoCallStatus(clientId);
  const { data: dashboard, isLoading, isError, refetch, isFetching } = useGetClientDashboard(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientDashboardQueryKey(clientId!) }
  });
  const { data: activeTasks } = useListActiveTasks(clientId!, {
    query: { enabled: !!clientId, queryKey: getListActiveTasksQueryKey(clientId!), refetchInterval: 10000 }
  });
  const completeTask = useCompleteTask();

  const { data: nutritionLogs } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) }
  });
  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) }
  });

  const todayISO = new Date().toISOString().split("T")[0];
  const yesterdayISO = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })();

  const todayMeals = (nutritionLogs ?? []).filter(n => n.date === todayISO && n.imageUrl !== "water_only");
  const hasTodayNutrition = todayMeals.length > 0;
  const todayCalories = todayMeals.reduce((sum, n) => sum + (n.calories ?? 0), 0);

  // Consider sleep logged if there's an entry for today or yesterday
  const recentSleep = (sleepLogs ?? [])
    .filter(s => s.date === todayISO || s.date === yesterdayISO)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl font-black text-primary">Trak</div>
          <p className="text-muted-foreground">You need an invite link from your coach to get started.</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load your dashboard. This is usually temporary."
        onRetry={() => refetch()}
        isRetrying={isFetching}
        testId="button-retry-dashboard"
        className="p-8"
      />
    );
  }

  const client = dashboard?.client;

  const videoRoomName = `trak-coaching-${clientId}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {videoCallOpen && (
        <VideoCall
          roomName={videoRoomName}
          displayName={client?.name ?? "Athlete"}
          onClose={() => setVideoCallOpen(false)}
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Good work,</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{client?.name ?? "Athlete"}</h1>
            {callActive && (
              <button
                onClick={() => setVideoCallOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <Video className="w-3.5 h-3.5" />
                Join Video Call
              </button>
            )}
          </div>
          {client?.goal && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground">{client.goal}</p>
              <Link href="/goal-history" className="text-xs text-primary hover:underline shrink-0">
                View history
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-primary">{dashboard?.workoutsThisWeek ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold">{dashboard?.pendingAssignments ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks Due</p>
          </CardContent>
        </Card>
        <Link href="/measurements" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 pb-4 text-center">
              {(() => {
                const m = dashboard?.latestMeasurement;
                if (!m?.weight) return (
                  <>
                    <p className="text-sm font-semibold text-primary leading-tight">Log weight</p>
                    <ChevronRight className="w-4 h-4 text-primary mx-auto mt-0.5" />
                    <p className="text-xs text-muted-foreground mt-0.5">Weight ({weightLabel})</p>
                  </>
                );
                const stored = m.unit === "metric" ? "metric" : "imperial";
                const val = stored === units ? m.weight : Math.round((stored === "imperial" ? m.weight * 0.453592 : m.weight * 2.20462) * 10) / 10;
                return (
                  <>
                    <p className="text-3xl font-bold">{val}</p>
                    <p className="text-xs text-muted-foreground mt-1">Weight ({weightLabel})</p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Nutrition & Sleep quick-status row */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/nutrition" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 pb-4 text-center">
              {hasTodayNutrition ? (
                <>
                  <p className="text-3xl font-bold">{todayCalories.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cal today</p>
                </>
              ) : (
                <>
                  <Utensils className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-primary mt-1.5">Log today's meals</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">No entries yet</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/sleep" className="block">
          <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 pb-4 text-center">
              {recentSleep ? (
                <>
                  <p className="text-3xl font-bold">{Number(recentSleep.hoursSlept)}h</p>
                  <p className="text-xs text-muted-foreground mt-1">Last sleep</p>
                </>
              ) : (
                <>
                  <Moon className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-primary mt-1.5">Log last night's sleep</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">No recent entry</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {activeTasks && activeTasks.length > 0 && (
        <div data-testid="section-active-tasks">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Your Tasks
            </h2>
            <Link href="/tasks" className="text-xs text-primary hover:underline shrink-0">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {activeTasks.map((task, index) => (
              <Card
                key={task.id}
                className="border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800"
                data-testid={index === 0 ? "card-active-task" : `card-active-task-${index}`}
              >
                <CardContent className="px-4 py-3 space-y-3">
                  <p className="text-sm leading-relaxed text-foreground">
                    {(task.altStatus === "accepted" && task.alternativeText) ? task.alternativeText : task.text}
                  </p>
                  <Button
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                    disabled={completeTask.isPending}
                    data-testid={index === 0 ? "button-mark-complete" : `button-mark-complete-${index}`}
                    onClick={() => {
                      completeTask.mutate(
                        { clientId: clientId!, taskId: task.id },
                        {
                          onSuccess: () => {
                            qc.invalidateQueries({ queryKey: getListActiveTasksQueryKey(clientId!) });
                          },
                        }
                      );
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Complete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/workout"
        data-testid="link-start-workout"
        className="block"
      >
        <Card className="bg-primary text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dumbbell className="w-6 h-6" />
              <div>
                <p className="font-bold">Start Today's Workout</p>
                <p className="text-xs text-primary-foreground/70">Log your sets and reps</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" />
          </CardContent>
        </Card>
      </Link>

      <button
        onClick={() => setVideoCallOpen(true)}
        className="w-full text-left"
        data-testid="button-join-video-call"
      >
        <Card className="bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-violet-400" />
              <div>
                <p className="font-bold">Join Coaching Call</p>
                <p className="text-xs text-zinc-400">Video session with your coach</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </CardContent>
        </Card>
      </button>

      {(dashboard?.weightHistory?.length ?? 0) > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Weight Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={dashboard?.weightHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} ${weightLabel}`, "Weight"]} labelFormatter={d => format(parseISO(d), "MMM d")} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(dashboard?.recentWorkouts?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Recent Workouts</h2>
            <Link href="/workouts" className="text-xs text-primary">See all</Link>
          </div>
          <div className="space-y-2">
            {dashboard?.recentWorkouts?.slice(0, 3).map(w => (
              <Link key={w.id} href="/workouts">
                <Card data-testid={`card-recent-workout-${w.id}`} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{w.programDayName ?? "Free workout"}</p>
                      <p className="text-xs text-muted-foreground">{w.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {w.durationMinutes && <p className="text-sm text-muted-foreground">{w.durationMinutes}min</p>}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(dashboard?.pendingAssignments ?? 0) > 0 && (
        <Link href="/assignments" className="block">
          <Card className="border-primary/30 bg-accent">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-accent-foreground">
                You have {dashboard?.pendingAssignments} pending assignment{dashboard?.pendingAssignments !== 1 ? "s" : ""}
              </p>
              <ChevronRight className="w-4 h-4 text-primary ml-auto" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
