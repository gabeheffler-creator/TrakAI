import { useClientId } from "@/hooks/use-client-id";
import { useListActiveTasks, getListActiveTasksQueryKey, useCompleteTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, CheckCheck } from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";

export function TasksPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();

  const { data: tasks, isLoading, isError, refetch, isFetching } = useListActiveTasks(
    clientId!,
    {
      query: {
        enabled: !!clientId,
        queryKey: getListActiveTasksQueryKey(clientId!),
        refetchInterval: 15000,
      },
    }
  );
  const completeTask = useCompleteTask();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load your tasks."
        onRetry={() => refetch()}
        isRetrying={isFetching}
        className="pt-16"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Your Tasks</h1>
        {tasks && tasks.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{tasks.length} active</span>
        )}
      </div>

      {!tasks || tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-20 text-center">
          <CheckCheck className="w-12 h-12 text-emerald-400" />
          <p className="font-semibold text-muted-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground/70">No active tasks from your coach right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30">
              <CardContent className="px-4 py-4 space-y-3">
                <p className="text-sm leading-relaxed text-foreground">
                  {task.altStatus === "accepted" && task.alternativeText
                    ? task.alternativeText
                    : task.text}
                </p>
                {task.altStatus === "accepted" && task.alternativeText && (
                  <p className="text-xs text-muted-foreground italic">
                    Alternative approved by coach
                  </p>
                )}
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 h-9 text-sm"
                  disabled={completeTask.isPending}
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
                  Mark as Complete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
