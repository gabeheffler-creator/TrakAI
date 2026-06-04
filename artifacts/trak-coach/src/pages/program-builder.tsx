import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetProgram,
  useUpdateProgram,
  useCreateProgramDay,
  useDeleteProgramDay,
  useAddExerciseToDay,
  useDeleteProgramExercise,
  useListExercises,
  getGetProgramQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link as WLink } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const daySchema = z.object({
  dayNumber: z.coerce.number().min(1),
  name: z.string().min(1),
  notes: z.string().optional(),
});

const exerciseSchema = z.object({
  exerciseId: z.coerce.number().min(1),
  sets: z.coerce.number().min(1),
  reps: z.string().min(1),
  weight: z.string().optional(),
  restSeconds: z.coerce.number().optional(),
  notes: z.string().optional(),
  order: z.coerce.number().default(0),
});

export function ProgramBuilder() {
  const { programId: programIdStr } = useParams<{ programId: string }>();
  const programId = Number(programIdStr);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [exDialogOpen, setExDialogOpen] = useState(false);

  const { data: program, isLoading } = useGetProgram(programId, { query: { enabled: !!programId, queryKey: getGetProgramQueryKey(programId) } });
  const { data: exercises } = useListExercises();
  const createDay = useCreateProgramDay();
  const deleteDay = useDeleteProgramDay();
  const addExercise = useAddExerciseToDay();
  const deleteExercise = useDeleteProgramExercise();

  const dayForm = useForm<z.infer<typeof daySchema>>({
    resolver: zodResolver(daySchema),
    defaultValues: { dayNumber: 1, name: "", notes: "" },
  });
  const exForm = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, notes: "", order: 0 },
  });

  const handleCreateDay = (values: z.infer<typeof daySchema>) => {
    createDay.mutate({ programId, data: { dayNumber: values.dayNumber, name: values.name, notes: values.notes || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) });
        setDayDialogOpen(false);
        dayForm.reset();
      },
    });
  };

  const handleDeleteDay = (dayId: number) => {
    deleteDay.mutate({ programId, dayId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) });
        if (selectedDayId === dayId) setSelectedDayId(null);
      },
    });
  };

  const handleAddExercise = (values: z.infer<typeof exerciseSchema>) => {
    if (!selectedDayId) return;
    addExercise.mutate({ programId, dayId: selectedDayId, data: { exerciseId: values.exerciseId, sets: values.sets, reps: values.reps, weight: values.weight || undefined, restSeconds: values.restSeconds || undefined, notes: values.notes || undefined, order: values.order } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) });
        setExDialogOpen(false);
        exForm.reset({ exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, notes: "", order: 0 });
      },
    });
  };

  const handleDeleteExercise = (dayId: number, peId: number) => {
    deleteExercise.mutate({ programId, dayId, peId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) }),
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!program) return <div className="p-8 text-muted-foreground">Program not found.</div>;

  const selectedDay = program.days.find(d => d.id === selectedDayId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <WLink href="/programs" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </WLink>
        <div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Days list */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Days</CardTitle>
            <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-add-day">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Day</DialogTitle></DialogHeader>
                <Form {...dayForm}>
                  <form onSubmit={dayForm.handleSubmit(handleCreateDay)} className="space-y-4">
                    <FormField control={dayForm.control} name="dayNumber" render={({ field }) => (
                      <FormItem><FormLabel>Day Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={dayForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Push Day, Legs" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={dayForm.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createDay.isPending}>Add</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {program.days.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">No days yet</p>}
            {program.days.map(d => (
              <div
                key={d.id}
                data-testid={`day-${d.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${selectedDayId === d.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setSelectedDayId(d.id)}
              >
                <GripVertical className="w-4 h-4 opacity-40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Day {d.dayNumber}: {d.name}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDay(d.id); }}
                  className={`opacity-0 group-hover:opacity-100 ${selectedDayId === d.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"} transition-opacity`}
                  data-testid={`button-delete-day-${d.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Day exercises */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {selectedDay ? `Day ${selectedDay.dayNumber}: ${selectedDay.name}` : "Select a day"}
            </CardTitle>
            {selectedDay && (
              <Dialog open={exDialogOpen} onOpenChange={setExDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7" data-testid="button-add-exercise">
                    <Plus className="w-4 h-4 mr-1" /> Add Exercise
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
                  <Form {...exForm}>
                    <form onSubmit={exForm.handleSubmit(handleAddExercise)} className="space-y-4">
                      <FormField control={exForm.control} name="exerciseId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exercise</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose exercise" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {exercises?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name} <span className="text-muted-foreground text-xs">({e.muscleGroup})</span></SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={exForm.control} name="sets" render={({ field }) => (
                          <FormItem><FormLabel>Sets</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={exForm.control} name="reps" render={({ field }) => (
                          <FormItem><FormLabel>Reps</FormLabel><FormControl><Input {...field} placeholder="8-12" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={exForm.control} name="weight" render={({ field }) => (
                          <FormItem><FormLabel>Weight</FormLabel><FormControl><Input {...field} placeholder="e.g. BW, 135lbs" /></FormControl></FormItem>
                        )} />
                        <FormField control={exForm.control} name="restSeconds" render={({ field }) => (
                          <FormItem><FormLabel>Rest (sec)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={addExercise.isPending}>Add</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {!selectedDay && <p className="text-muted-foreground text-sm text-center py-8">Select a day to view its exercises</p>}
            {selectedDay?.exercises?.length === 0 && <p className="text-muted-foreground text-xs text-center py-8">No exercises added yet</p>}
            {selectedDay?.exercises?.map((e, idx) => (
              <div key={e.id} data-testid={`exercise-${e.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-muted/50">
                <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.exerciseName}</p>
                  <div className="flex gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">{e.muscleGroup}</Badge>
                    <span className="text-xs text-muted-foreground">{e.sets} × {e.reps}</span>
                    {e.weight && <span className="text-xs text-muted-foreground">@ {e.weight}</span>}
                    {e.restSeconds && <span className="text-xs text-muted-foreground">{e.restSeconds}s rest</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteExercise(selectedDay.id, e.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  data-testid={`button-delete-exercise-${e.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
