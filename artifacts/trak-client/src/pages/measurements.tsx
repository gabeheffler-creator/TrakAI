import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
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
import { QueryErrorState } from "@/components/query-error-state";

const measurementSchema = z.object({
  date: z.string().min(1),
  weight: z.string().optional(),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  leftArm: z.string().optional(),
  rightArm: z.string().optional(),
  leftThigh: z.string().optional(),
  rightThigh: z.string().optional(),
  leftCalf: z.string().optional(),
  rightCalf: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof measurementSchema>;

export function MeasurementsPage() {
  const { clientId } = useClientId();
  const { units, weightLabel, lengthLabel } = useUnitSystem();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: measurements, isLoading, isError, refetch, isFetching } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) }
  });
  const logMeasurement = useLogMeasurement();
  const deleteMeasurement = useDeleteMeasurement();

  const form = useForm<FormValues>({
    resolver: zodResolver(measurementSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      weight: "", chest: "", waist: "", hips: "",
      leftArm: "", rightArm: "", leftThigh: "", rightThigh: "", leftCalf: "", rightCalf: "",
      notes: "",
    },
  });

  const p = (v?: string) => (v ? parseFloat(v) : undefined);

  const onSubmit = (values: FormValues) => {
    logMeasurement.mutate({
      clientId: clientId!,
      data: {
        date: values.date,
        weight: p(values.weight),
        chest: p(values.chest),
        waist: p(values.waist),
        hips: p(values.hips),
        leftArm: p(values.leftArm),
        rightArm: p(values.rightArm),
        leftThigh: p(values.leftThigh),
        rightThigh: p(values.rightThigh),
        leftCalf: p(values.leftCalf),
        rightCalf: p(values.rightCalf),
        unit: units,
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

  const fields: { key: keyof FormValues; label: string; unit: string }[] = [
    { key: "weight", label: "Weight", unit: weightLabel },
    { key: "chest", label: "Chest", unit: lengthLabel },
    { key: "waist", label: "Waist", unit: lengthLabel },
    { key: "hips", label: "Hips", unit: lengthLabel },
    { key: "leftArm", label: "Left Arm", unit: lengthLabel },
    { key: "rightArm", label: "Right Arm", unit: lengthLabel },
    { key: "leftThigh", label: "Left Thigh", unit: lengthLabel },
    { key: "rightThigh", label: "Right Thigh", unit: lengthLabel },
    { key: "leftCalf", label: "Left Calf", unit: lengthLabel },
    { key: "rightCalf", label: "Right Calf", unit: lengthLabel },
  ];

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Body Stats</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-log-measurement"><Plus className="w-4 h-4 mr-1" /> Log</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Measurements</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  {fields.map(f => (
                    <FormField key={f.key} control={form.control} name={f.key} render={({ field }) => (
                      <FormItem>
                        <FormLabel>{f.label} <span className="text-muted-foreground text-xs">({f.unit})</span></FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} data-testid={`input-${f.key}`} /></FormControl>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Weight Trend ({weightLabel})</CardTitle></CardHeader>
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
      {isError && (
        <QueryErrorState
          message="Couldn't load measurements. This is usually temporary."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-measurements"
        />
      )}
      {(measurements?.length ?? 0) === 0 && !isLoading && !isError && (
        <p className="text-muted-foreground text-sm text-center py-8">No measurements logged yet.</p>
      )}

      <div className="space-y-3">
        {!isError && measurements?.slice().reverse().map(m => {
          const wl = m.unit === "metric" ? "kg" : "lbs";
          const ll = m.unit === "metric" ? "cm" : "in";
          const cols: { label: string; value: number | null | undefined; unit: string }[] = [
            { label: "Weight", value: m.weight, unit: wl },
            { label: "Chest", value: m.chest, unit: ll },
            { label: "Waist", value: m.waist, unit: ll },
            { label: "Hips", value: m.hips, unit: ll },
            { label: "L Arm", value: m.leftArm, unit: ll },
            { label: "R Arm", value: m.rightArm, unit: ll },
            { label: "L Thigh", value: m.leftThigh, unit: ll },
            { label: "R Thigh", value: m.rightThigh, unit: ll },
            { label: "L Calf", value: m.leftCalf, unit: ll },
            { label: "R Calf", value: m.rightCalf, unit: ll },
          ].filter(c => c.value != null);
          return (
            <Card key={m.id} data-testid={`card-measurement-${m.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{m.date}</p>
                  <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-measurement-${m.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {cols.map(c => (
                    <div key={c.label} className="text-center">
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-sm font-bold">{c.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{c.unit}</span></p>
                    </div>
                  ))}
                </div>
                {m.notes && <p className="text-xs text-muted-foreground mt-2">{m.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
