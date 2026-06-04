import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListMeasurements,
  useLogMeasurement,
  useDeleteMeasurement,
  getListMeasurementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Plus, Trash2 } from "lucide-react";

const measurementSchema = z.object({
  date: z.string().min(1),
  weight: z.string().optional(),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  arms: z.string().optional(),
  thighs: z.string().optional(),
  calves: z.string().optional(),
  notes: z.string().optional(),
});

const MEASUREMENT_FIELDS = ["weight", "chest", "waist", "hips", "arms", "thighs", "calves"] as const;

export function MeasurementsPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: measurements, isLoading } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) }
  });
  const logMeasurement = useLogMeasurement();
  const deleteMeasurement = useDeleteMeasurement();

  const form = useForm<z.infer<typeof measurementSchema>>({
    resolver: zodResolver(measurementSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], weight: "", chest: "", waist: "", hips: "", arms: "", thighs: "", calves: "", notes: "" },
  });

  const onSubmit = (values: z.infer<typeof measurementSchema>) => {
    logMeasurement.mutate({
      clientId: clientId!,
      data: {
        date: values.date,
        weight: values.weight ? parseFloat(values.weight) : undefined,
        chest: values.chest ? parseFloat(values.chest) : undefined,
        waist: values.waist ? parseFloat(values.waist) : undefined,
        hips: values.hips ? parseFloat(values.hips) : undefined,
        arms: values.arms ? parseFloat(values.arms) : undefined,
        thighs: values.thighs ? parseFloat(values.thighs) : undefined,
        calves: values.calves ? parseFloat(values.calves) : undefined,
        notes: values.notes || undefined,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMeasurementsQueryKey(clientId!) });
        setDialogOpen(false);
        form.reset({ date: new Date().toISOString().split("T")[0] });
        toast({ title: "Measurements saved!" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMeasurement.mutate({ clientId: clientId!, measurementId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListMeasurementsQueryKey(clientId!) })
    });
  };

  const weightData = measurements?.filter(m => m.weight).map(m => ({ date: m.date, weight: m.weight })) ?? [];

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Body Stats</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-log-measurement"><Plus className="w-4 h-4 mr-1" /> Log</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Measurements</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  {MEASUREMENT_FIELDS.map(f => (
                    <FormField key={f} control={form.control} name={f} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{f} (lbs/in)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} data-testid={`input-${f}`} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={logMeasurement.isPending}>Save</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {weightData.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Weight Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(measurements?.length ?? 0) === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No measurements logged yet.</p>
      )}

      <div className="space-y-3">
        {measurements?.slice().reverse().map(m => (
          <Card key={m.id} data-testid={`card-measurement-${m.id}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{m.date}</p>
                <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-measurement-${m.id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MEASUREMENT_FIELDS.map(f => {
                  const val = m[f];
                  if (!val) return null;
                  return (
                    <div key={f} className="text-center">
                      <p className="text-xs text-muted-foreground capitalize">{f}</p>
                      <p className="text-sm font-bold">{val}</p>
                    </div>
                  );
                })}
              </div>
              {m.notes && <p className="text-xs text-muted-foreground mt-2">{m.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
