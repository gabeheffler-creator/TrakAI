import { useState, useMemo, useEffect, useRef } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListSleepLogs,
  useLogSleep,
  useDeleteSleepLog,
  getListSleepLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Moon, BellRing, CheckCircle2, ArrowLeft, Copy } from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";

const sleepSchema = z.object({
  date: z.string().min(1),
  hoursSlept: z.coerce.number().min(0).max(24),
  quality: z.enum(["poor", "fair", "good", "great"]).optional(),
  energyRating: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

const qualityColors: Record<string, string> = {
  poor: "text-red-500",
  fair: "text-yellow-500",
  good: "text-blue-500",
  great: "text-green-500",
};

type Timeframe = "7d" | "1m" | "6m" | "1y" | "all";

function filterByTimeframe<T extends { date: string }>(items: T[], tf: Timeframe): T[] {
  if (tf === "all") return items;
  const days = tf === "7d" ? 7 : tf === "1m" ? 30 : tf === "6m" ? 180 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return items.filter(i => i.date >= cutoffStr);
}

// ─── Alarm app definitions ───────────────────────────────────────────────────

interface AlarmApp {
  id: string;
  name: string;
  emoji: string;
  platform: string;
  instructions: string[];
}

const ALARM_APPS: AlarmApp[] = [
  {
    id: "ios-clock",
    name: "Clock (iOS)",
    emoji: "⏰",
    platform: "iPhone",
    instructions: [
      "Open the Shortcuts app on your iPhone.",
      'Tap Automation at the bottom, then tap the + button.',
      'Choose "App" from the list.',
      'Tap "Choose" next to App, search for Clock, and select it.',
      'Under "When", select "Is Opened".',
      'Tap Next.',
      'Tap "New Blank Automation", then tap "Open URLs".',
      'Paste your personal link below into the URL field.',
      'Tap Done. From now on, opening the Clock app will bring you straight to the sleep prompt.',
    ],
  },
  {
    id: "alarmy",
    name: "Alarmy",
    emoji: "🔔",
    platform: "iOS & Android",
    instructions: [
      "Open Alarmy and tap the alarm you want to connect.",
      'Scroll down to "Missions" and tap to edit.',
      'Choose "URL" from the mission list.',
      'Paste your personal link below into the URL field.',
      'Save the alarm.',
      "When you dismiss this alarm's mission, Alarmy will open the sleep prompt automatically.",
    ],
  },
  {
    id: "sleep-cycle",
    name: "Sleep Cycle",
    emoji: "🌙",
    platform: "iOS & Android",
    instructions: [
      "Sleep Cycle doesn't natively open URLs on wake-up.",
      "On iPhone: use a Shortcuts automation triggered when Sleep Cycle is opened.",
      'Open Shortcuts → Automation → + → App → Choose "Sleep Cycle" → Is Opened.',
      'Add an "Open URL" action and paste your personal link below.',
      "Tap Done to save.",
    ],
  },
  {
    id: "google-clock",
    name: "Google Clock",
    emoji: "🕐",
    platform: "Android",
    instructions: [
      "Google Clock supports Google Assistant routines when an alarm is dismissed.",
      "Open the Google Home app and create a new Routine.",
      'Set the trigger to "When I dismiss an alarm".',
      'Add an action: "Open app or website" and paste your personal link below.',
      "Save the routine. It will activate each morning when you dismiss your alarm.",
    ],
  },
  {
    id: "bedtime",
    name: "Bedtime / Health (iOS)",
    emoji: "💤",
    platform: "iPhone",
    instructions: [
      "Apple Health's Bedtime alarms can be paired with a Shortcut.",
      "Open the Shortcuts app on your iPhone.",
      'Tap Automation → + → "Time of Day".',
      "Set it to the time you typically wake up.",
      'Add an "Open URL" action and paste your personal link below.',
      "Make sure the shortcut is set to run automatically (not ask before running).",
      "Tap Done to save.",
    ],
  },
  {
    id: "other",
    name: "Other alarm app",
    emoji: "📱",
    platform: "Any",
    instructions: [
      "Most alarm apps that support URL shortcuts or shortcut integrations can be connected.",
      "Copy your personal link below.",
      "In your alarm app, look for a setting called 'URL action', 'Open URL', or 'Shortcut' after dismissing.",
      "Paste your personal link there.",
      "Alternatively, create an iOS Shortcut or Android Tasker task that opens the URL when triggered by your alarm app.",
    ],
  },
];

const ALARM_STORAGE_KEY = "trak_connected_alarm_app";

// ─── Alarm sheet ─────────────────────────────────────────────────────────────

function AlarmSheet({
  open,
  onOpenChange,
  connectedAppId,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectedAppId: string | null;
  onConnect: (id: string) => void;
}) {
  const [selected, setSelected] = useState<AlarmApp | null>(null);
  const { toast } = useToast();

  const deepLink = typeof window !== "undefined"
    ? `${window.location.origin}/client/sleep?prompt=true`
    : "/client/sleep?prompt=true";

  const handleCopy = () => {
    navigator.clipboard.writeText(deepLink).then(() => {
      toast({ title: "Link copied!" });
    });
  };

  const handleDone = () => {
    if (selected) {
      onConnect(selected.id);
      localStorage.setItem(ALARM_STORAGE_KEY, selected.id);
    }
    onOpenChange(false);
    setSelected(null);
  };

  const handleBack = () => setSelected(null);

  const handleClose = () => {
    onOpenChange(false);
    setSelected(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          {selected ? (
            <div className="flex items-center gap-2">
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <SheetTitle>{selected.emoji} {selected.name}</SheetTitle>
            </div>
          ) : (
            <SheetTitle>Connect your alarm</SheetTitle>
          )}
        </SheetHeader>

        {!selected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose your alarm app to get step-by-step instructions. When your alarm fires, TrakClient will open automatically so you can log your sleep instantly.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {ALARM_APPS.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelected(app)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-colors hover:bg-muted ${
                    connectedAppId === app.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="text-3xl">{app.emoji}</span>
                  <div>
                    <p className="text-sm font-medium leading-tight">{app.name}</p>
                    <p className="text-xs text-muted-foreground">{app.platform}</p>
                  </div>
                  {connectedAppId === app.id && (
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Follow these steps to wire up {selected.name} so it opens your sleep tracker automatically.
            </p>

            {/* Deep link */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your personal link</p>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-xs flex-1 break-all">{deepLink}</code>
                <button
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
              <ol className="space-y-2">
                {selected.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>Back</Button>
              <Button className="flex-1" onClick={handleDone}>Done — mark as connected</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Wake-up prompt dialog ────────────────────────────────────────────────────

function WakeUpPromptDialog({
  clientId,
  onLogged,
}: {
  clientId: number;
  onLogged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const qc = useQueryClient();
  const logSleep = useLogSleep();
  const { toast } = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("prompt") === "true") {
      handledRef.current = true;
      setOpen(true);
      // Strip ?prompt=true from the URL so a refresh doesn't retrigger
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const unit = hours === "1" ? "hr" : "hrs";

  const handleSubmit = () => {
    const val = parseFloat(hours);
    if (isNaN(val) || val < 0 || val > 24) return;
    // Log sleep for yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    logSleep.mutate(
      { clientId, data: { date: dateStr, hoursSlept: val } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListSleepLogsQueryKey(clientId) });
          toast({ title: "Sleep logged!" });
          setOpen(false);
          onLogged();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">How much sleep did you get?</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-3 py-4">
          <Input
            type="number"
            min={0}
            max={24}
            step={0.5}
            placeholder="8"
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="w-24 text-center text-2xl h-14"
            autoFocus
            data-testid="input-wakeup-hours"
          />
          <span className="text-xl font-medium text-muted-foreground w-8">{unit}</span>
        </div>
        <Button
          className="w-full"
          disabled={!hours || isNaN(parseFloat(hours)) || logSleep.isPending}
          onClick={handleSubmit}
          data-testid="button-log-wakeup-sleep"
        >
          Log sleep
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SleepPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [alarmSheetOpen, setAlarmSheetOpen] = useState(false);
  const [connectedAppId, setConnectedAppId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ALARM_STORAGE_KEY);
    if (stored) setConnectedAppId(stored);
  }, []);

  const { data: logs, isLoading, isError, refetch, isFetching } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) }
  });
  const logSleep = useLogSleep();
  const deleteSleepLog = useDeleteSleepLog();

  const form = useForm<z.infer<typeof sleepSchema>>({
    resolver: zodResolver(sleepSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], hoursSlept: 7, notes: "" },
  });

  const onSubmit = (values: z.infer<typeof sleepSchema>) => {
    logSleep.mutate({
      clientId: clientId!,
      data: {
        date: values.date,
        hoursSlept: values.hoursSlept,
        quality: values.quality,
        energyRating: values.energyRating,
        notes: values.notes || undefined,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSleepLogsQueryKey(clientId!) });
        setDialogOpen(false);
        form.reset({ date: new Date().toISOString().split("T")[0], hoursSlept: 7 });
        toast({ title: "Sleep logged!" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteSleepLog.mutate({ clientId: clientId!, sleepId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSleepLogsQueryKey(clientId!) })
    });
  };

  const filtered = useMemo(() => filterByTimeframe(logs ?? [], timeframe), [logs, timeframe]);
  const sortedFiltered = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));

  const avgSleep = filtered.length
    ? (filtered.reduce((acc, l) => acc + Number(l.hoursSlept), 0) / filtered.length).toFixed(1)
    : null;

  const connectedApp = connectedAppId ? ALARM_APPS.find(a => a.id === connectedAppId) : null;

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Wake-up prompt (auto-opens when ?prompt=true) */}
      <WakeUpPromptDialog
        clientId={clientId}
        onLogged={() => {
          qc.invalidateQueries({ queryKey: getListSleepLogsQueryKey(clientId!) });
        }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sleep</h1>
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="h-8 text-xs w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="1m">Last month</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-log-sleep"><Plus className="w-4 h-4 mr-1" /> Log Sleep</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Sleep</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="hoursSlept" render={({ field }) => (
                    <FormItem><FormLabel>Hours Slept</FormLabel><FormControl><Input type="number" step="0.5" {...field} data-testid="input-hours-slept" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="quality" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sleep Quality</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="How did you sleep?" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="great">Great</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="energyRating" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Energy on Waking</FormLabel>
                      <Select
                        onValueChange={v => field.onChange(Number(v))}
                        value={field.value != null ? String(field.value) : ""}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Rate your energy (1–10)" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={String(n)}>{n} — {n <= 3 ? "Exhausted" : n <= 5 ? "Tired" : n <= 7 ? "OK" : n <= 9 ? "Good" : "Excellent"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={logSleep.isPending}>Log</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connect alarm button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-sm"
        onClick={() => setAlarmSheetOpen(true)}
        data-testid="button-connect-alarm"
      >
        {connectedApp ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Alarm connected · {connectedApp.name}</span>
          </>
        ) : (
          <>
            <BellRing className="w-4 h-4" />
            <span>Connect alarm</span>
          </>
        )}
      </Button>

      <AlarmSheet
        open={alarmSheetOpen}
        onOpenChange={setAlarmSheetOpen}
        connectedAppId={connectedAppId}
        onConnect={setConnectedAppId}
      />

      {avgSleep && (
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <Moon className="w-8 h-8 text-primary" />
            <div>
              <p className="text-3xl font-bold">{avgSleep}h</p>
              <p className="text-xs text-muted-foreground">average sleep · {filtered.length} entries</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {isError && (
        <QueryErrorState
          message="Couldn't load sleep logs. This is usually temporary."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-sleep"
        />
      )}
      {sortedFiltered.length === 0 && !isLoading && !isError && (
        <p className="text-muted-foreground text-sm text-center py-8">No sleep logged for this period.</p>
      )}

      <div className="space-y-2">
        {!isError && sortedFiltered.map(s => (
          <Card key={s.id} data-testid={`card-sleep-${s.id}`}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[40px]">
                  <p className="text-xl font-bold">{s.hoursSlept}h</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{s.date}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.quality && <span className={`text-xs font-medium capitalize ${qualityColors[s.quality] ?? ""}`}>{s.quality}</span>}
                    {s.energyRating != null && (
                      <span className="text-xs text-muted-foreground">⚡ Energy {s.energyRating}/10</span>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-sleep-${s.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
