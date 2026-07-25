import { useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useWorkoutPrefs } from "@/hooks/use-workout-prefs";
import { useNotificationPrefs } from "@/hooks/use-notification-prefs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Ruler, Dumbbell, BarChart2, Bug, MessageSquare, ChevronRight, CheckCircle, Bell, ClipboardList } from "lucide-react";

function SettingRow({
  icon, label, description, children, onClick,
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

async function submitFeedback(type: "bug" | "feedback", content: string, from: "coach" | "client") {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, content, from }),
  });
  if (!res.ok) throw new Error("Failed to send");
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  const { units, setUnits } = useUnitSystem();
  const { workoutView, setWorkoutView, showProgressBar, setShowProgressBar, progressMode, setProgressMode } = useWorkoutPrefs();
  const { prefs: notifPrefs, setPref: setNotifPref } = useNotificationPrefs();
  const { toast } = useToast();

  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const [bugText, setBugText] = useState("");
  const [bugPending, setBugPending] = useState(false);
  const [bugSubmitted, setBugSubmitted] = useState(false);

  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleOpenBug = () => { setBugText(""); setBugSubmitted(false); setBugSheetOpen(true); };
  const handleOpenFeedback = () => { setFeedbackText(""); setFeedbackSubmitted(false); setFeedbackSheetOpen(true); };

  const handleSubmitBug = async () => {
    if (!bugText.trim()) return;
    setBugPending(true);
    try {
      await submitFeedback("bug", bugText.trim(), "client");
      setBugSubmitted(true);
      setBugText("");
      setTimeout(() => { setBugSheetOpen(false); setBugSubmitted(false); }, 1800);
    } catch {
      toast({ title: "Failed to send report", variant: "destructive" });
    } finally {
      setBugPending(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackPending(true);
    try {
      await submitFeedback("feedback", feedbackText.trim(), "client");
      setFeedbackSubmitted(true);
      setFeedbackText("");
      setTimeout(() => { setFeedbackSheetOpen(false); setFeedbackSubmitted(false); }, 1800);
    } catch {
      toast({ title: "Failed to send feedback", variant: "destructive" });
    } finally {
      setFeedbackPending(false);
    }
  };

  return (
    <div className="space-y-1 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your experience</p>
      </div>

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

      <SectionHeader title="Measurements" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow icon={<Ruler className="w-4 h-4" />} label="Unit system" description="Affects weight and body measurements">
            <Select value={units} onValueChange={v => setUnits(v as "imperial" | "metric")}>
              <SelectTrigger className="w-[120px] text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Imperial</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      <SectionHeader title="Notifications" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow icon={<Dumbbell className="w-4 h-4" />} label="Workout reminders" description="Alerts when a scheduled workout is due">
            <Switch checked={notifPrefs.workoutReminders} onCheckedChange={v => setNotifPref("workoutReminders", v)} />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow icon={<ClipboardList className="w-4 h-4" />} label="Task alerts" description="Reminders when a coach task is due">
            <Switch checked={notifPrefs.taskAlerts} onCheckedChange={v => setNotifPref("taskAlerts", v)} />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow icon={<Bell className="w-4 h-4" />} label="Message notifications" description="Alerts when your coach sends a message">
            <Switch checked={notifPrefs.messageNotifications} onCheckedChange={v => setNotifPref("messageNotifications", v)} />
          </SettingRow>
        </div>
      </div>

      <SectionHeader title="Workout" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow icon={<Dumbbell className="w-4 h-4" />} label="Exercise view" description="How exercises are shown during a workout">
            <Select value={workoutView} onValueChange={v => setWorkoutView(v as "one-at-a-time" | "list")}>
              <SelectTrigger className="w-[140px] text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one-at-a-time">One at a time</SelectItem>
                <SelectItem value="list">Full list</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow icon={<BarChart2 className="w-4 h-4" />} label="Progress bar" description="Show workout progress bar at the top">
            <Switch checked={showProgressBar} onCheckedChange={setShowProgressBar} />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow icon={<BarChart2 className="w-4 h-4" />} label="Set progress style" description="How completed sets are shown per exercise">
            <Select value={progressMode} onValueChange={v => setProgressMode(v as "bar" | "ratio")}>
              <SelectTrigger className="w-[120px] text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Progress bar</SelectItem>
                <SelectItem value="ratio">Ratio (2/4)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      <SectionHeader title="Support" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow icon={<MessageSquare className="w-4 h-4" />} label="Send feedback" description="Share ideas or suggestions" onClick={handleOpenFeedback} />
        </div>
        <div className="px-4">
          <SettingRow icon={<Bug className="w-4 h-4" />} label="Report a bug" description="Something not working? Let us know" onClick={handleOpenBug} />
        </div>
      </div>

      {/* Feedback sheet */}
      <Sheet open={feedbackSheetOpen} onOpenChange={open => { if (!open) setFeedbackSheetOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4"><SheetTitle>Send feedback</SheetTitle></SheetHeader>
          {feedbackSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the feedback!</p>
              <p className="text-xs text-muted-foreground">We'll take a look.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Got an idea or suggestion? We'd love to hear it.</p>
              <Textarea
                placeholder="e.g. It would be great to see a weekly summary…"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setFeedbackSheetOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={!feedbackText.trim() || feedbackPending} onClick={handleSubmitFeedback}>
                  {feedbackPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Bug report sheet */}
      <Sheet open={bugSheetOpen} onOpenChange={open => { if (!open) setBugSheetOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4"><SheetTitle>Report a bug</SheetTitle></SheetHeader>
          {bugSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the report!</p>
              <p className="text-xs text-muted-foreground">We'll look into it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Describe what happened and what you expected to happen.</p>
              <Textarea
                placeholder="e.g. When I tap 'Log set', nothing happens..."
                value={bugText}
                onChange={e => setBugText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setBugSheetOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={!bugText.trim() || bugPending} onClick={handleSubmitBug}>
                  {bugPending ? "Sending…" : "Send report"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
