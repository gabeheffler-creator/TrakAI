import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useVideoCallStatus } from "@/hooks/use-video-call-status";
import { VideoCall } from "@/components/video-call";
import { useGetClientDashboard, getGetClientDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { Dumbbell, ClipboardList, TrendingUp, ChevronRight, Video } from "lucide-react";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

export function Dashboard() {
  const { clientId } = useClientId();
  const { units, weightLabel } = useUnitSystem();
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const callActive = useVideoCallStatus(clientId);
  const { data: dashboard, isLoading, isError, refetch, isFetching } = useGetClientDashboard(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientDashboardQueryKey(clientId!) }
  });

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
          {client?.goal && <p className="text-sm text-muted-foreground mt-1">{client.goal}</p>}
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
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold">
              {(() => {
                const m = dashboard?.latestMeasurement;
                if (!m?.weight) return "—";
                const stored = m.unit === "metric" ? "metric" : "imperial";
                if (stored === units) return m.weight;
                const converted = stored === "imperial" ? m.weight * 0.453592 : m.weight * 2.20462;
                return Math.round(converted * 10) / 10;
              })()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Weight ({weightLabel})</p>
          </CardContent>
        </Card>
      </div>

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
