import { useClientId } from "@/hooks/use-client-id";
import { useListWorkoutLogs, getListWorkoutLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell } from "lucide-react";

export function WorkoutsPage() {
  const { clientId } = useClientId();
  const { data: logs, isLoading } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) }
  });

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Workout History</h1>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(logs?.length ?? 0) === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No workouts logged yet. Start your first one!</p>
        </div>
      )}

      <div className="space-y-2">
        {logs?.slice().reverse().map(log => (
          <Card key={log.id} data-testid={`card-workout-${log.id}`}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{log.programDayName ?? "Free workout"}</p>
                <p className="text-xs text-muted-foreground">{log.date}{log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}</p>
                {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
              </div>
              <Badge variant={log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
