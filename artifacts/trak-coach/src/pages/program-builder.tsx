import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetProgram,
  useCreateProgramPhase,
  useUpdateProgramPhase,
  useDeleteProgramPhase,
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
import { Plus, Trash2, ArrowLeft, GripVertical, Layers, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const phaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  durationWeeks: z.coerce.number().min(1).max(52),
  daysPerWeek: z.coerce.number().min(1).max(7).optional(),
});

const daySchema = z.object({
  dayNumber: z.coerce.number().min(1),
  name: z.string().min(1),
  notes: z.string().optional(),
  phaseId: z.coerce.number().optional(),
});

const SET_TYPES = ["Normal", "Warm-up", "Drop Set", "Rest-Pause", "Failure"] as const;

function encodeExNotes(setType: string, rpe: string, notes: string): string {
  const parts: string[] = [];
  if (setType && setType !== "Normal") parts.push(`[${setType}]`);
  if (rpe) parts.push(`RPE ${rpe}`);
  if (notes) parts.push(notes);
  return parts.join(" | ");
}

function decodeExNotes(raw: string | null | undefined): { setType: string; rpe: string; notes: string } {
  if (!raw) return { setType: "Normal", rpe: "", notes: "" };
  const setTypeMatch = raw.match(/^\[([^\]]+)\]/);
  const rpeMatch = raw.match(/RPE (\d+(?:\.\d+)?)/);
  let notes = raw;
  if (setTypeMatch) notes = notes.replace(setTypeMatch[0], "").trim();
  if (rpeMatch) notes = notes.replace(`RPE ${rpeMatch[1]}`, "").trim();
  notes = notes.replace(/^\|?\s*|\s*\|?$/g, "").replace(/\s*\|\s*/g, " ").trim();
  return {
    setType: setTypeMatch ? setTypeMatch[1] : "Normal",
    rpe: rpeMatch ? rpeMatch[1] : "",
    notes,
  };
}

const exerciseSchema = z.object({
  exerciseId: z.coerce.number().min(1),
  sets: z.coerce.number().min(1),
  reps: z.string().min(1),
  weight: z.string().optional(),
  restSeconds: z.coerce.number().optional(),
  setType: z.string().default("Normal"),
  rpe: z.string().optional(),
  notes: z.string().optional(),
  order: z.coerce.number().default(0),
});

export function ProgramBuilder() {
  const { programId: programIdStr } = useParams<{ programId: string }>();
  const programId = Number(programIdStr);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editPhaseId, setEditPhaseId] = useState<number | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [exDialogOpen, setExDialogOpen] = useState(false);
  const [dayDialogPhaseId, setDayDialogPhaseId] = useState<number | undefined>(undefined);

  const { data: program, isLoading } = useGetProgram(programId, {
    query: { enabled: !!programId, queryKey: getGetProgramQueryKey(programId) },
  });
  const { data: exercises } = useListExercises();
  const createPhase = useCreateProgramPhase();
  const updatePhase = useUpdateProgramPhase();
  const deletePhase = useDeleteProgramPhase();
  const createDay = useCreateProgramDay();
  const deleteDay = useDeleteProgramDay();
  const addExercise = useAddExerciseToDay();
  const deleteExercise = useDeleteProgramExercise();

  const phaseForm = useForm<z.infer<typeof phaseSchema>>({
    resolver: zodResolver(phaseSchema),
    defaultValues: { name: "", durationWeeks: 4, daysPerWeek: undefined },
  });
  const editPhaseForm = useForm<z.infer<typeof phaseSchema>>({
    resolver: zodResolver(phaseSchema),
    defaultValues: { name: "", durationWeeks: 4, daysPerWeek: undefined },
  });
  const dayForm = useForm<z.infer<typeof daySchema>>({
    resolver: zodResolver(daySchema),
    defaultValues: { dayNumber: 1, name: "", notes: "", phaseId: undefined },
  });
  const exForm = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, setType: "Normal", rpe: "", notes: "", order: 0 },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) });

  const handleCreatePhase = (values: z.infer<typeof phaseSchema>) => {
    createPhase.mutate(
      {
        programId,
        data: {
          name: values.name,
          durationWeeks: values.durationWeeks,
          daysPerWeek: values.daysPerWeek ?? null,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setPhaseDialogOpen(false);
          phaseForm.reset({ name: "", durationWeeks: 4, daysPerWeek: undefined });
        },
        onError: () => toast({ title: "Failed to create phase", variant: "destructive" }),
      }
    );
  };

  const openEditPhase = (ph: { id: number; name: string; durationWeeks: number; daysPerWeek?: number | null }) => {
    setEditPhaseId(ph.id);
    editPhaseForm.reset({
      name: ph.name,
      durationWeeks: ph.durationWeeks,
      daysPerWeek: ph.daysPerWeek ?? undefined,
    });
  };

  const handleEditPhase = (values: z.infer<typeof phaseSchema>) => {
    if (!editPhaseId) return;
    updatePhase.mutate(
      {
        programId,
        phaseId: editPhaseId,
        data: {
          name: values.name,
          durationWeeks: values.durationWeeks,
          daysPerWeek: values.daysPerWeek ?? null,
        },
      },
      {
        onSuccess: () => { invalidate(); setEditPhaseId(null); },
        onError: () => toast({ title: "Failed to update phase", variant: "destructive" }),
      }
    );
  };

  const handleDeletePhase = (phaseId: number) => {
    deletePhase.mutate({ programId, phaseId }, {
      onSuccess: invalidate,
      onError: () => toast({ title: "Failed to delete phase", variant: "destructive" }),
    });
  };

  const openAddDay = (phaseId?: number) => {
    setDayDialogPhaseId(phaseId);
    dayForm.reset({ dayNumber: (program?.days.length ?? 0) + 1, name: "", notes: "", phaseId });
    setDayDialogOpen(true);
  };

  const handleCreateDay = (values: z.infer<typeof daySchema>) => {
    createDay.mutate(
      { programId, data: { dayNumber: values.dayNumber, name: values.name, notes: values.notes || undefined, phaseId: values.phaseId || undefined } },
      { onSuccess: () => { invalidate(); setDayDialogOpen(false); dayForm.reset(); } }
    );
  };

  const handleDeleteDay = (dayId: number) => {
    deleteDay.mutate({ programId, dayId }, {
      onSuccess: () => { invalidate(); if (selectedDayId === dayId) setSelectedDayId(null); },
    });
  };

  const handleAddExercise = (values: z.infer<typeof exerciseSchema>) => {
    if (!selectedDayId) return;
    const encodedNotes = encodeExNotes(values.setType ?? "Normal", values.rpe ?? "", values.notes ?? "");
    addExercise.mutate(
      { programId, dayId: selectedDayId, data: { exerciseId: values.exerciseId, sets: values.sets, reps: values.reps, weight: values.weight || undefined, restSeconds: values.restSeconds || undefined, notes: encodedNotes || undefined, order: values.order } },
      { onSuccess: () => { invalidate(); setExDialogOpen(false); exForm.reset({ exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, setType: "Normal", rpe: "", notes: "", order: 0 }); } }
    );
  };

  const handleDeleteExercise = (dayId: number, peId: number) => {
    deleteExercise.mutate({ programId, dayId, peId }, { onSuccess: invalidate });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!program) return <div className="p-8 text-muted-foreground">Program not found.</div>;

  const selectedDay = program.days.find(d => d.id === selectedDayId);
  const unphasedDays = program.days.filter(d => !d.phaseId);
  const hasPhases = program.phases.length > 0;

  const DayRow = ({ d }: { d: typeof program.days[number] }) => (
    <div
      key={d.id}
      data-testid={`day-${d.id}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors group ${selectedDayId === d.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
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
  );

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
        {/* Phases + Days list */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {hasPhases ? "Phases & Days" : "Days"}
            </CardTitle>
            <div className="flex items-center gap-1">
              {/* Add Phase dialog */}
              <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="button-add-phase">
                    <Layers className="w-3.5 h-3.5" /> Phase
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Phase</DialogTitle></DialogHeader>
                  <Form {...phaseForm}>
                    <form onSubmit={phaseForm.handleSubmit(handleCreatePhase)} className="space-y-4">
                      <FormField control={phaseForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phase Name</FormLabel>
                          <FormControl><Input {...field} placeholder="e.g. Foundation, Strength, Peak" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={phaseForm.control} name="durationWeeks" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration</FormLabel>
                            <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value)}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Weeks" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {WEEK_OPTIONS.map(w => (
                                  <SelectItem key={w} value={String(w)}>{w} {w === 1 ? "week" : "weeks"}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={phaseForm.control} name="daysPerWeek" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days / week</FormLabel>
                            <Select
                              onValueChange={v => field.onChange(v === "any" ? undefined : Number(v))}
                              value={field.value ? String(field.value) : "any"}
                            >
                              <FormControl><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="any">Any</SelectItem>
                                {DAYS_PER_WEEK_OPTIONS.map(d => (
                                  <SelectItem key={d} value={String(d)}>{d}×/wk</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={createPhase.isPending}>Add Phase</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Add Day */}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddDay(undefined)} data-testid="button-add-day">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-1 p-3">
            {program.phases.map((ph) => (
              <div key={ph.id} className="mb-3">
                <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/40 mb-1 group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-semibold truncate">{ph.name}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 flex-shrink-0">{ph.durationWeeks}w</Badge>
                    {ph.daysPerWeek && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">{ph.daysPerWeek}×/wk</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditPhase(ph)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                      title="Edit phase"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openAddDay(ph.id)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                      title="Add day to phase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeletePhase(ph.id)}
                      className="p-0.5 rounded text-muted-foreground hover:text-destructive"
                      title="Delete phase"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {ph.days.length === 0 && (
                  <p className="text-muted-foreground text-xs text-center py-2 pl-6">No days yet</p>
                )}
                {ph.days.map(d => <DayRow key={d.id} d={d} />)}
              </div>
            ))}

            {unphasedDays.length > 0 && (
              <div className={hasPhases ? "mt-2" : ""}>
                {hasPhases && (
                  <p className="text-xs text-muted-foreground px-2 mb-1 font-medium uppercase tracking-wide">Unassigned</p>
                )}
                {unphasedDays.map(d => <DayRow key={d.id} d={d} />)}
              </div>
            )}

            {program.days.length === 0 && program.phases.length === 0 && (
              <p className="text-muted-foreground text-xs text-center py-4">
                Add a phase or day to get started
              </p>
            )}
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
                              {exercises?.map(e => (
                                <SelectItem key={e.id} value={String(e.id)}>
                                  {e.name} <span className="text-muted-foreground text-xs">({e.muscleGroup})</span>
                                </SelectItem>
                              ))}
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
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={exForm.control} name="setType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Set Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                {SET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={exForm.control} name="rpe" render={({ field }) => (
                          <FormItem>
                            <FormLabel>RPE <span className="text-muted-foreground">(1–10)</span></FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="10" step="0.5" placeholder="e.g. 8" {...field} />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={exForm.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coach Notes <span className="text-muted-foreground">(Optional)</span></FormLabel>
                          <FormControl><Input {...field} placeholder="e.g. Control the eccentric" /></FormControl>
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={addExercise.isPending}>Add Exercise</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {!selectedDay && <p className="text-muted-foreground text-sm text-center py-8">Select a day to view its exercises</p>}
            {selectedDay?.exercises?.length === 0 && <p className="text-muted-foreground text-xs text-center py-8">No exercises added yet</p>}
            {selectedDay?.exercises?.map((e, idx) => {
              const decoded = decodeExNotes(e.notes);
              const isSpecialSet = decoded.setType !== "Normal";
              return (
                <div key={e.id} data-testid={`exercise-${e.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-muted/50">
                  <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium">{e.exerciseName}</p>
                      {isSpecialSet && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">{decoded.setType}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.muscleGroup}</Badge>
                      <span className="text-xs text-muted-foreground">{e.sets} × {e.reps}</span>
                      {e.weight && <span className="text-xs text-muted-foreground">@ {e.weight}</span>}
                      {e.restSeconds && <span className="text-xs text-muted-foreground">{e.restSeconds}s rest</span>}
                      {decoded.rpe && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">RPE {decoded.rpe}</span>}
                      {decoded.notes && <span className="text-xs text-muted-foreground italic">"{decoded.notes}"</span>}
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
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Edit Phase Dialog */}
      <Dialog open={editPhaseId !== null} onOpenChange={open => { if (!open) setEditPhaseId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Phase</DialogTitle>
          </DialogHeader>
          <Form {...editPhaseForm}>
            <form onSubmit={editPhaseForm.handleSubmit(handleEditPhase)} className="space-y-4">
              <FormField control={editPhaseForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase Name</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Foundation, Strength, Peak" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editPhaseForm.control} name="durationWeeks" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Weeks" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {WEEK_OPTIONS.map(w => (
                          <SelectItem key={w} value={String(w)}>{w} {w === 1 ? "week" : "weeks"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editPhaseForm.control} name="daysPerWeek" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days / week</FormLabel>
                    <Select
                      onValueChange={v => field.onChange(v === "any" ? undefined : Number(v))}
                      value={field.value ? String(field.value) : "any"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {DAYS_PER_WEEK_OPTIONS.map(d => (
                          <SelectItem key={d} value={String(d)}>{d}×/wk</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={updatePhase.isPending}>Save Changes</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Day Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dayDialogPhaseId
                ? `Add Day to ${program.phases.find(p => p.id === dayDialogPhaseId)?.name ?? "Phase"}`
                : "Add Day"}
            </DialogTitle>
          </DialogHeader>
          <Form {...dayForm}>
            <form onSubmit={dayForm.handleSubmit(handleCreateDay)} className="space-y-4">
              <FormField control={dayForm.control} name="dayNumber" render={({ field }) => (
                <FormItem><FormLabel>Day Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={dayForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Push Day, Legs" /></FormControl><FormMessage /></FormItem>
              )} />
              {program.phases.length > 0 && (
                <FormField control={dayForm.control} name="phaseId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phase</FormLabel>
                    <Select
                      onValueChange={v => field.onChange(v === "none" ? undefined : Number(v))}
                      value={field.value ? String(field.value) : "none"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="No phase" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No phase</SelectItem>
                        {program.phases.map(ph => (
                          <SelectItem key={ph.id} value={String(ph.id)}>
                            {ph.name} ({ph.durationWeeks}w{ph.daysPerWeek ? ` · ${ph.daysPerWeek}×/wk` : ""})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              )}
              <FormField control={dayForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createDay.isPending}>Add Day</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
