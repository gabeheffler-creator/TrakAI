import { useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useWorkoutPrefs } from "@/hooks/use-workout-prefs";
import { useClientId } from "@/hooks/use-client-id";
import { useSendMessage } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Ruler, Dumbbell, BarChart2, Bug, MessageSquare, ChevronRight, CheckCircle } from "lucide-react";

function SettingRow({
  icon,
  label,
  description,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1">
        {children}
        {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left hover:bg-muted/30 transition-colors rounded-xl">
        {inner}
      </button>
    );
  }

  return inner;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-6 pb-1 first:pt-0">
      {title}
    </p>
  );
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  const { units, setUnits } = useUnitSystem();
  const { workoutView, setWorkoutView, showProgressBar, setShowProgressBar } = useWorkoutPrefs();
  const { clientId } = useClientId();
  const { toast } = useToast();
  const sendMessage = useSendMessage();

  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugText, setBugText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim() || !clientId) return;
    sendMessage.mutate(
      {
        clientId,
        data: { content: `💬 Feedback:\n\n${feedbackText.trim()}`, sender: "client" },
      },
      {
        onSuccess: () => {
          setFeedbackSubmitted(true);
          setFeedbackText("");
          setTimeout(() => {
            setFeedbackDialogOpen(false);
            setFeedbackSubmitted(false);
          }, 1800);
        },
        onError: () => {
          toast({ title: "Failed to send feedback", variant: "destructive" });
        },
      }
    );
  };

  const handleOpenFeedback = () => {
    setFeedbackText("");
    setFeedbackSubmitted(false);
    setFeedbackDialogOpen(true);
  };

  const handleSubmitBug = () => {
    if (!bugText.trim() || !clientId) return;
    sendMessage.mutate(
      {
        clientId,
        data: { content: `🐛 Bug report:\n\n${bugText.trim()}`, sender: "client" },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setBugText("");
          setTimeout(() => {
            setBugDialogOpen(false);
            setSubmitted(false);
          }, 1800);
        },
        onError: () => {
          toast({ title: "Failed to send report", variant: "destructive" });
        },
      }
    );
  };

  const handleOpenBug = () => {
    setBugText("");
    setSubmitted(false);
    setBugDialogOpen(true);
  };

  return (
    <div className="max-w-lg mx-auto space-y-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your experience</p>
      </div>

      {/* ── Appearance ─────────────────────────────── */}
      <SectionHeader title="Appearance" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            label="Dark mode"
            description="Switch between light and dark theme"
          >
            <Switch checked={dark} onCheckedChange={toggle} />
          </SettingRow>
        </div>
      </div>

      {/* ── Measurements ───────────────────────────── */}
      <SectionHeader title="Measurements" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Ruler className="w-4 h-4" />}
            label="Unit system"
            description="Affects weight and body measurements"
          >
            <Select value={units} onValueChange={v => setUnits(v as "imperial" | "metric")}>
              <SelectTrigger className="w-[120px] text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Imperial</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* ── Workout ────────────────────────────────── */}
      <SectionHeader title="Workout" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Dumbbell className="w-4 h-4" />}
            label="Exercise view"
            description="How exercises are shown during a workout"
          >
            <Select
              value={workoutView}
              onValueChange={v => setWorkoutView(v as "one-at-a-time" | "list")}
            >
              <SelectTrigger className="w-[140px] text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-at-a-time">One at a time</SelectItem>
                <SelectItem value="list">Full list</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<BarChart2 className="w-4 h-4" />}
            label="Progress bar"
            description="Show workout progress bar at the top"
          >
            <Switch checked={showProgressBar} onCheckedChange={setShowProgressBar} />
          </SettingRow>
        </div>
      </div>

      {/* ── Support ────────────────────────────────── */}
      <SectionHeader title="Support" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="Send feedback"
            description="Share ideas or suggestions with your coach"
            onClick={handleOpenFeedback}
          />
        </div>
        <div className="px-4">
          <SettingRow
            icon={<Bug className="w-4 h-4" />}
            label="Report a bug"
            description="Let your coach know something isn't working"
            onClick={handleOpenBug}
          />
        </div>
      </div>

      {/* ── Feedback dialog ───────────────────────── */}
      <Dialog open={feedbackDialogOpen} onOpenChange={open => { if (!open) setFeedbackDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
          </DialogHeader>

          {feedbackSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the feedback!</p>
              <p className="text-xs text-muted-foreground">Your coach has been notified.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Got an idea or suggestion? We'd love to hear it.
              </p>
              <Textarea
                placeholder="e.g. It would be great to see a weekly summary of my progress…"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setFeedbackDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!feedbackText.trim() || sendMessage.isPending}
                  onClick={handleSubmitFeedback}
                >
                  {sendMessage.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bug report dialog ─────────────────────── */}
      <Dialog open={bugDialogOpen} onOpenChange={open => { if (!open) setBugDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report a bug</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the report!</p>
              <p className="text-xs text-muted-foreground">Your coach has been notified.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe what happened and what you expected. Your message will be sent directly to your coach.
              </p>
              <Textarea
                placeholder="e.g. When I tap 'Log set', nothing happens..."
                value={bugText}
                onChange={e => setBugText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setBugDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!bugText.trim() || sendMessage.isPending}
                  onClick={handleSubmitBug}
                >
                  {sendMessage.isPending ? "Sending…" : "Send report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
