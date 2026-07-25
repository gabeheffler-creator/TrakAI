import { useState } from "react";
import { useGetCoachDashboard, useSendMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, ActivitySquare, AlertCircle, MessageSquare, Sparkles, X, CheckCircle2, CalendarDays, Clock, Send } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { useToast } from "@/hooks/use-toast";

const AI_ALERT_KEY = "trak_ai_model_alert_v1_dismissed";
const DEFAULT_NUDGE = "Hey — just checking in on your tasks! Let me know if you need any help. 💪";

function AiModelAlert({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 text-sm">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">AI nutrition model updated</p>
        <p className="text-muted-foreground mt-0.5">
          We've improved macro and calorie estimates — your clients will see more accurate AI results going forward.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetCoachDashboard();
  const [aiAlertDismissed, setAiAlertDismissed] = useState(
    () => localStorage.getItem(AI_ALERT_KEY) === "true"
  );
  const [heatmapClient, setHeatmapClient] = useState<{ id: number; name: string } | null>(null);

  // Nudge state
  const [nudgeSelected, setNudgeSelected] = useState<Set<number>>(new Set());
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState(DEFAULT_NUDGE);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [staleExpanded, setStaleExpanded] = useState(true);

  const sendMessage = useSendMessage();
  const { toast } = useToast();

  const dismissAiAlert = () => {
    localStorage.setItem(AI_ALERT_KEY, "true");
    setAiAlertDismissed(true);
  };

  const staleClients = (dashboard as any)?.staleTaskClients ?? [];

  const toggleClient = (id: number) => {
    setNudgeSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (nudgeSelected.size === staleClients.length) {
      setNudgeSelected(new Set());
    } else {
      setNudgeSelected(new Set(staleClients.map((c: any) => c.clientId)));
    }
  };

  const handleOpenNudge = () => {
    setNudgeMessage(DEFAULT_NUDGE);
    setNudgeOpen(true);
  };

  const handleSendNudge = async () => {
    const recipients = staleClients.filter((c: any) => nudgeSelected.has(c.clientId));
    if (recipients.length === 0) return;
    setNudgeSending(true);
    let failed = 0;
    for (const client of recipients) {
      try {
        await sendMessage.mutateAsync({
          clientId: client.clientId,
          data: { sender: "coach", content: nudgeMessage.trim() },
        });
      } catch {
        failed++;
      }
    }
    setNudgeSending(false);
    setNudgeOpen(false);
    setNudgeSelected(new Set());
    if (failed === 0) {
      toast({ title: `Nudge sent to ${recipients.length} client${recipients.length === 1 ? "" : "s"}` });
    } else {
      toast({
        title: `Sent to ${recipients.length - failed} client${recipients.length - failed === 1 ? "" : "s"}`,
        description: `${failed} message${failed === 1 ? "" : "s"} failed to send.`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error || !dashboard) {
    return <div className="p-8 text-destructive">Failed to load dashboard</div>;
  }

  const allClients = dashboard.clientSummaries ?? [];
  const visibleClients = allClients.slice(0, 5);
  const hasMore = allClients.length > 5;
  const completedTasks = (dashboard as any).completedTasks ?? [];
  const selectedCount = nudgeSelected.size;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">Welcome back, Coach.</p>
      </div>

      {!aiAlertDismissed && <AiModelAlert onDismiss={dismissAiAlert} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalClients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.activePrograms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allClients.reduce((acc, c) => acc + (c.assignmentsDue || 0) + (c.unreadMessages || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stale tasks section */}
      {staleClients.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {staleClients.length} {staleClients.length === 1 ? "client has" : "clients have"} a task pending for 24+ hours
              </p>
              <button
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-0.5"
                onClick={() => setStaleExpanded(o => !o)}
              >
                {staleExpanded ? "Hide list ↑" : "Show list ↓"}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedCount > 0 && (
                <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
              )}
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={selectedCount === 0}
                onClick={handleOpenNudge}
              >
                <Send className="w-3.5 h-3.5" />
                Send nudge
              </Button>
            </div>
          </div>

          {/* Client list */}
          {staleExpanded && (
            <div className="border-t border-amber-500/20">
              {/* Select all */}
              <div className="flex items-center gap-2.5 px-4 py-2 border-b border-amber-500/10">
                <Checkbox
                  id="nudge-select-all"
                  checked={nudgeSelected.size === staleClients.length && staleClients.length > 0}
                  onCheckedChange={toggleAll}
                />
                <label htmlFor="nudge-select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Select all
                </label>
              </div>
              {staleClients.map((client: any) => (
                <div
                  key={client.clientId}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-500/5 transition-colors border-b border-amber-500/10 last:border-0"
                >
                  <Checkbox
                    id={`nudge-${client.clientId}`}
                    checked={nudgeSelected.has(client.clientId)}
                    onCheckedChange={() => toggleClient(client.clientId)}
                  />
                  <label
                    htmlFor={`nudge-${client.clientId}`}
                    className="flex-1 text-sm font-medium cursor-pointer select-none"
                  >
                    {client.name}
                  </label>
                  <Link
                    href={`/clients/${client.clientId}`}
                    className="text-xs text-primary hover:underline shrink-0"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    View profile →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visibleClients.map((client) => (
                <Link
                  key={client.clientId}
                  href={`/clients/${client.clientId}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{client.name}</span>
                    <button
                      type="button"
                      data-testid={`button-view-activity-${client.clientId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHeatmapClient({ id: client.clientId, name: client.name });
                      }}
                      className="flex items-center gap-1 text-xs text-primary underline-offset-2 underline hover:text-primary/80 text-left w-fit mt-0.5"
                    >
                      <CalendarDays className="w-3 h-3 flex-shrink-0" />
                      {client.lastWorkout ? formatDistanceToNow(parseISO(client.lastWorkout), { addSuffix: true }) : 'No activity yet'}
                    </button>
                  </div>
                  <div className="flex space-x-3">
                    {(client as any).hasUnreviewedRejection && (
                      <div className="flex items-center text-rose-500 text-sm" title="Has a rejected task">
                        <AlertCircle className="w-4 h-4 mr-1" /> rejected
                      </div>
                    )}
                    {client.assignmentsDue > 0 && (
                      <div className="flex items-center text-orange-500 text-sm">
                        <ActivitySquare className="w-4 h-4 mr-1" /> {client.assignmentsDue}
                      </div>
                    )}
                    {client.unreadMessages && client.unreadMessages > 0 && (
                      <div className="flex items-center text-blue-500 text-sm">
                        <MessageSquare className="w-4 h-4 mr-1" /> {client.unreadMessages}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {allClients.length === 0 && (
                <div className="text-sm text-muted-foreground">No clients found.</div>
              )}
              {hasMore && (
                <Link
                  href="/clients"
                  className="block text-center text-sm text-primary hover:underline pt-1"
                >
                  View all {allClients.length} clients →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentActivity?.map((activity, idx) => (
                <div key={idx} className="flex flex-col border-b last:border-0 pb-3 last:pb-0">
                  <span className="text-sm font-medium">{activity.clientName}</span>
                  <span className="text-sm text-muted-foreground">{activity.description}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
              {(!dashboard.recentActivity || dashboard.recentActivity.length === 0) && (
                <div className="text-sm text-muted-foreground">No recent activity.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completed Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedTasks.map((task: any) => (
                <Link
                  key={task.id}
                  href={`/clients/${task.clientId}`}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
                    {task.completedAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(parseISO(task.completedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity heatmap dialog */}
      <Dialog open={heatmapClient !== null} onOpenChange={(open) => !open && setHeatmapClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{heatmapClient?.name}'s activity</DialogTitle>
          </DialogHeader>
          {heatmapClient && <ActivityHeatmap clientId={heatmapClient.id} />}
        </DialogContent>
      </Dialog>

      {/* Nudge confirmation sheet */}
      <Sheet open={nudgeOpen} onOpenChange={setNudgeOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Send nudge</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-sm font-medium mb-2">Recipients ({selectedCount})</p>
              <div className="flex flex-wrap gap-2">
                {staleClients
                  .filter((c: any) => nudgeSelected.has(c.clientId))
                  .map((c: any) => (
                    <Badge key={c.clientId} variant="secondary" className="text-xs">
                      {c.name}
                    </Badge>
                  ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Message</p>
              <Textarea
                value={nudgeMessage}
                onChange={e => setNudgeMessage(e.target.value)}
                rows={4}
                placeholder="Type your message…"
                className="resize-none"
              />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setNudgeOpen(false)} disabled={nudgeSending}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSendNudge}
              disabled={nudgeSending || !nudgeMessage.trim()}
            >
              <Send className="w-4 h-4" />
              {nudgeSending ? "Sending…" : `Send to ${selectedCount}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
