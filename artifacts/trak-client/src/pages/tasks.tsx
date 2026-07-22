import { useClientId } from "@/hooks/use-client-id";
import {
  useListClientTaskHistory,
  getListClientTaskHistoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, ArrowLeft, CheckCircle2, XCircle, Clock, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { QueryErrorState } from "@/components/query-error-state";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  accepted: {
    label: "Accepted",
    icon: <RefreshCcw className="w-4 h-4 text-violet-500" />,
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-4 h-4 text-rose-500" />,
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  },
  pending: {
    label: "Pending",
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

export function TasksPage() {
  const { clientId } = useClientId();

  const { data: tasks, isLoading, isError, refetch, isFetching } = useListClientTaskHistory(
    clientId!,
    { query: { enabled: !!clientId, queryKey: getListClientTaskHistoryQueryKey(clientId!) } }
  );

  if (!clientId) {
    return <div className="p-4 text-muted-foreground">Not logged in.</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Task History</h1>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading tasks…</p>
      )}

      {isError && (
        <QueryErrorState
          message="Couldn't load your tasks. This is usually temporary."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-tasks"
        />
      )}

      {!isLoading && !isError && (!tasks || tasks.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No tasks yet.</p>
        </div>
      )}

      {!isError && tasks && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task) => {
            const cfg = statusConfig[task.status] ?? statusConfig.pending;
            const displayText =
              task.altStatus === "accepted" && task.alternativeText
                ? task.alternativeText
                : task.text;

            return (
              <Card key={task.id} data-testid={`card-task-${task.id}`}>
                <CardContent className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-relaxed text-foreground flex-1">{displayText}</p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>

                  {task.altStatus === "accepted" && task.text && task.alternativeText && (
                    <p className="text-xs text-muted-foreground line-through">{task.text}</p>
                  )}

                  {task.status === "rejected" && task.rejectionReason && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      Reason: {task.rejectionReason}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Assigned {format(new Date(task.createdAt), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
