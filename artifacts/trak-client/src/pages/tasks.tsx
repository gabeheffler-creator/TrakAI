import { useClientId } from "@/hooks/use-client-id";
import {
  useListClientTaskHistory,
  getListClientTaskHistoryQueryKey,
  useCompleteTask,
  getListActiveTasksQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/query-error-state";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Countdown logic ───────────────────────────────────────────────────────────

function useCountdownMs(dueDate: string | null | undefined): number {
  const [remaining, setRemaining] = useState<number>(() =>
    dueDate ? new Date(dueDate).getTime() - Date.now() : Infinity
  );

  useEffect(() => {
    if (!dueDate) return;
    const id = setInterval(() => {
      setRemaining(new Date(dueDate).getTime() - Date.now());
    }, 50);
    return () => clearInterval(id);
  }, [dueDate]);

  return remaining;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00:000";
  const h    = Math.floor(ms / 3_600_000);
  const m    = Math.floor((ms % 3_600_000) / 60_000);
  const s    = Math.floor((ms % 60_000) / 1_000);
  const msec = Math.floor(ms % 1_000);
  return [
    h.toString().padStart(2, "0"),
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0"),
    msec.toString().padStart(3, "0"),
  ].join(":");
}

// ── Per-task card with live countdown ────────────────────────────────────────

function TaskCard({
  task,
  clientId,
  index,
  onComplete,
  completeDisabled,
}: {
  task: {
    id: number;
    text: string;
    status: string;
    altStatus?: string | null;
    alternativeText?: string | null;
    dueDate?: string | null;
  };
  clientId: number;
  index: number;
  onComplete: () => void;
  completeDisabled: boolean;
}) {
  const remaining = useCountdownMs(task.dueDate);
  const firedRef  = useRef(false);

  const hasDue  = !!task.dueDate;
  const overdue = hasDue && remaining <= 0;
  const label   = task.altStatus === "accepted" && task.alternativeText
    ? task.alternativeText
    : task.text;

  // Fire the expire endpoint exactly once when the countdown hits zero
  useEffect(() => {
    if (overdue && !firedRef.current) {
      firedRef.current = true;
      fetch(`/api/clients/${clientId}/tasks/${task.id}/expire`, { method: "POST" }).catch(() => {});
    }
  }, [overdue, clientId, task.id]);

  return (
    <Card
      className={cn(
        "border",
        overdue
          ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700"
          : "border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800"
      )}
      data-testid={`card-task-${task.id}`}
    >
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {overdue && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 block mb-1">
                Overdue
              </span>
            )}
            <p className="text-sm leading-relaxed text-foreground">{label}</p>
          </div>
          {hasDue && (
            <span className={cn(
              "text-[10px] font-mono tabular-nums shrink-0 pt-0.5",
              overdue ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
            )}>
              {formatCountdown(remaining)}
            </span>
          )}
        </div>

        <Button
          className={cn(
            "w-full gap-2",
            overdue ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700"
          )}
          disabled={completeDisabled}
          data-testid={index === 0 ? "button-mark-complete" : `button-mark-complete-${index}`}
          onClick={onComplete}
        >
          <CheckCircle2 className="w-4 h-4" />
          Mark Complete
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function TasksPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();

  const { data: allTasks, isLoading, isError, refetch, isFetching } = useListClientTaskHistory(
    clientId!,
    { query: { enabled: !!clientId, queryKey: getListClientTaskHistoryQueryKey(clientId!) } }
  );

  const completeTask = useCompleteTask();
  const tasks = allTasks?.filter(t => t.status === "accepted") ?? [];

  if (!clientId) {
    return <div className="p-4 text-muted-foreground">Not logged in.</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">All Tasks</h1>
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

      {!isLoading && !isError && tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">You're all caught up!</p>
          <p className="text-sm mt-1">No accepted tasks waiting to be completed.</p>
        </div>
      )}

      {!isError && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              clientId={clientId!}
              index={index}
              completeDisabled={completeTask.isPending}
              onComplete={() =>
                completeTask.mutate(
                  { clientId: clientId!, taskId: task.id },
                  {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: getListClientTaskHistoryQueryKey(clientId!) });
                      qc.invalidateQueries({ queryKey: getListActiveTasksQueryKey(clientId!) });
                    },
                  }
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
