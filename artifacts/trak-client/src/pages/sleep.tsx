import { useState, useMemo } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Moon } from "lucide-react";
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

export function SleepPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");

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

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
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
