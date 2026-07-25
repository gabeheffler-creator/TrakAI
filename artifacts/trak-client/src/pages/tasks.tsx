import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListClientTaskHistory,
  getListClientTaskHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ClipboardList, ArrowLeft, CheckCircle2, XCircle, Clock, RefreshCcw, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { QueryErrorState } from "@/components/query-error-state";
import { useToast } from "@/hooks/use-toast";

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
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tasks, isLoading, isError, refetch, isFetching } = useListClientTaskHistory(
    clientId!,
    { query: { enabled: !!clientId, queryKey: getListClientTaskHistoryQueryKey(clientId!) } }
  );

  // Resubmission sheet state
  const [resubmitTaskId, setResubmitTaskId] = useState<number | null>(null);
  const [resubmitNote, setResubmitNote] = useState("");
  const [resubmitSaving, setResubmitSaving] = useState(false);

  const openResubmit = (taskId: number) => {
    setResubmitNote("");
    setResubmitTaskId(taskId);
  };

  const handleResubmit = async () => {
    if (!clientId || resubmitTaskId === null) return;
    setResubmitSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/tasks/${resubmitTaskId}/resubmit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: resubmitNote.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Resubmit failed");
      qc.invalidateQueries({ queryKey: getListClientTaskHistoryQueryKey(clientId) });
      setResubmitTaskId(null);
      toast({ title: "Task resubmitted!", description: "Your coach will be notified." });
    } catch {
      toast({ title: "Failed to resubmit", variant: "destructive" });
    } finally {
      setResubmitSaving(false);
    }
  };

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

                  {task.status === "rejected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                      onClick={() => openResubmit(task.id)}
                      data-testid={`button-resubmit-task-${task.id}`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Try again
                    </Button>
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

      {/* Resubmit sheet */}
      <Sheet open={resubmitTaskId !== null} onOpenChange={open => { if (!open) setResubmitTaskId(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Try this task again</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a note for your coach explaining what you'll do differently — or just tap "Resubmit" to reset the task.
            </p>
            <Textarea
              placeholder="e.g. I'll complete this by Thursday — I had a scheduling conflict last week."
              value={resubmitNote}
              onChange={e => setResubmitNote(e.target.value)}
              className="resize-none text-sm"
              rows={3}
            />
          </div>
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setResubmitTaskId(null)} disabled={resubmitSaving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleResubmit} disabled={resubmitSaving}>
              {resubmitSaving ? "Submitting…" : "Resubmit"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
