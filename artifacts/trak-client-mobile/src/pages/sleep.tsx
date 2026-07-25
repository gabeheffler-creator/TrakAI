import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListSleepLogs, getListSleepLogsQueryKey,
  useLogSleep,
} from "@workspace/api-client-react";
import type { SleepLogInputQuality } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Moon, Plus, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type QualityEnum = SleepLogInputQuality;

const QUALITY_OPTIONS: { value: QualityEnum; label: string; color: string }[] = [
  { value: "poor", label: "Poor", color: "text-red-500" },
  { value: "fair", label: "Fair", color: "text-orange-500" },
  { value: "good", label: "Good", color: "text-emerald-500" },
  { value: "great", label: "Great", color: "text-green-600" },
];

function qualityColor(q: string | undefined | null): string {
  const found = QUALITY_OPTIONS.find(o => o.value === q);
  return found?.color ?? "text-muted-foreground";
}

function qualityLabel(q: string | undefined | null): string {
  const found = QUALITY_OPTIONS.find(o => o.value === q);
  return found?.label ?? "—";
}

export function SleepPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: logs, isLoading, isError, refetch, isFetching } =
    useListSleepLogs(clientId!, {
      query: {
        enabled: !!clientId,
        queryKey: getListSleepLogsQueryKey(clientId!),
      },
    });

  const create = useLogSleep();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    date: string;
    hoursSlept: string;
    quality: QualityEnum;
    notes: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    hoursSlept: "",
    quality: "good",
    notes: "",
  });

  const sorted = [...(logs ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const chartData = sorted
    .slice(0, 14)
    .reverse()
    .map((l) => ({ date: l.date, hours: Number(l.hoursSlept) }));

  const avgHours =
    sorted.length > 0
      ? (sorted.slice(0, 7).reduce((s, l) => s + Number(l.hoursSlept), 0) / Math.min(sorted.length, 7)).toFixed(1)
      : null;

  const handleSubmit = () => {
    if (!clientId) return;
    const hrs = parseFloat(form.hoursSlept);
    if (!form.date || isNaN(hrs) || hrs <= 0 || hrs > 24) {
      toast({ title: "Please enter a valid number of hours", variant: "destructive" });
      return;
    }
    create.mutate(
      { clientId, data: { date: form.date, hoursSlept: hrs, quality: form.quality, notes: form.notes || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListSleepLogsQueryKey(clientId!) });
          setOpen(false);
          setForm({ date: new Date().toISOString().split("T")[0], hoursSlept: "", quality: "good", notes: "" });
          toast({ title: "Sleep logged!" });
        },
        onError: () => toast({ title: "Failed to log sleep", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="space-y-3 mt-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  if (isError) return <QueryErrorState message="Couldn't load sleep data." onRetry={() => refetch()} isRetrying={isFetching} className="pt-16" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Sleep</h1>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Log Sleep
        </Button>
      </div>

      {avgHours && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-2xl font-bold">{avgHours}h</p>
              <p className="text-xs text-muted-foreground">7-day avg</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 text-center">
              {sorted[0] ? (
                <>
                  <p className={`text-2xl font-bold ${qualityColor(sorted[0].quality)}`}>
                    {qualityLabel(sorted[0].quality)}
                  </p>
                  <p className="text-xs text-muted-foreground">Last night</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length >= 3 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" /> Sleep Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => [`${v}h`, "Hours"]}
                  labelFormatter={(d) => format(parseISO(d), "MMM d")}
                />
                <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Logs</h2>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-10 text-center">
            <Moon className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No sleep logged yet. Track your rest!</p>
          </div>
        ) : (
          sorted.slice(0, 14).map((log) => (
            <Card key={log.id}>
              <CardContent className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{format(parseISO(log.date), "EEE, MMM d")}</p>
                  {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{Number(log.hoursSlept)}h</p>
                  {log.quality && (
                    <p className={`text-xs font-medium ${qualityColor(log.quality)}`}>
                      {qualityLabel(log.quality)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Log Sleep</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Hours slept</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="24"
                placeholder="7.5"
                value={form.hoursSlept}
                onChange={(e) => setForm((f) => ({ ...f, hoursSlept: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Quality: {qualityLabel(form.quality)}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, quality: q.value }))}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      form.quality === q.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Woke up early, vivid dreams…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={create.isPending} className="w-full bg-primary hover:bg-primary/90">
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
