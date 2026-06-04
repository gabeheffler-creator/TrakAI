import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListSleepLogs,
  useLogSleep,
  useDeleteSleepLog,
  getListSleepLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";

const sleepSchema = z.object({
  date: z.string().min(1),
  hoursSlept: z.coerce.number().min(0).max(24),
  quality: z.enum(["poor", "fair", "good", "great"]).optional(),
  notes: z.string().optional(),
});

const qualityColors: Record<string, string> = {
  poor: "text-red-500",
  fair: "text-yellow-500",
  good: "text-blue-500",
  great: "text-green-500",
};

export function SleepPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: logs, isLoading } = useListSleepLogs(clientId!, {
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
      data: { date: values.date, hoursSlept: values.hoursSlept, quality: values.quality, notes: values.notes || undefined }
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

  const avgSleep = logs?.length ? (logs.reduce((acc, l) => acc + Number(l.hoursSlept), 0) / logs.length).toFixed(1) : null;

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sleep</h1>
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
                    <FormLabel>Quality</FormLabel>
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
                <Button type="submit" className="w-full" disabled={logSleep.isPending}>Log</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {avgSleep && (
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <Moon className="w-8 h-8 text-primary" />
            <div>
              <p className="text-3xl font-bold">{avgSleep}h</p>
              <p className="text-xs text-muted-foreground">average sleep ({logs?.length} entries)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {(logs?.length ?? 0) === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No sleep logged yet.</p>
      )}

      <div className="space-y-2">
        {logs?.slice().reverse().map(s => (
          <Card key={s.id} data-testid={`card-sleep-${s.id}`}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[40px]">
                  <p className="text-xl font-bold">{s.hoursSlept}h</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{s.date}</p>
                  {s.quality && <span className={`text-xs font-medium capitalize ${qualityColors[s.quality] ?? ""}`}>{s.quality}</span>}
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
