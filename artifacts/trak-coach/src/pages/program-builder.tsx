import { useState, useEffect } from "react";
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
  useSetPhaseNutritionGoal,
  useSetDayNutritionGoal,
  useDeleteDayNutritionGoal,
  useUpdateProgramSleepAdjustment,
  getGetProgramQueryKey,
  useGetProgramAssignedClients,
  getGetProgramAssignedClientsQueryKey,
  useBulkAssignProgram,
  useSyncProgramToClients,
  useListClients,
  getListClientsQueryKey,
  useListNutritionPeriods,
  useCreateNutritionPeriod,
  useUpdateNutritionPeriod,
  useDeleteNutritionPeriod,
  getListNutritionPeriodsQueryKey,
  type NutritionPeriod,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link as WLink, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, GripVertical, Layers, Pencil, Apple, LayoutGrid, List, Users, Save, Moon, CalendarIcon, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryErrorState } from "@/components/query-error-state";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, isAfter, isBefore, isValid } from "date-fns";

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
  phaseId: z.coerce.number().min(1, "A phase is required"),
});

const nutritionGoalSchema = z.object({
  calories: z.coerce.number().min(0).optional(),
  protein: z.coerce.number().min(0).optional(),
  carbs: z.coerce.number().min(0).optional(),
  fat: z.coerce.number().min(0).optional(),
});

const nutritionPeriodSchema = z.object({
  label: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  calories: z.coerce.number().min(0).optional(),
  protein: z.coerce.number().min(0).optional(),
  carbs: z.coerce.number().min(0).optional(),
  fat: z.coerce.number().min(0).optional(),
});

const SET_TYPES = [
  "Normal", "Warm-up", "Drop Set", "Rest-Pause", "Failure",
  "Duration", "Machine", "Reps Only", "Negative", "Bodyweight", "Weighted Bodyweight",
] as const;

const EQUIPMENT_TYPES = [
  "Dumbbell", "Barbell", "Hex Bar", "Suspension Band", "Band",
  "T-Bar", "Sled", "Straight Bar", "EZ-Curl Bar", "Cable",
] as const;

const CABLE_GRIPS = [
  "Rope", "Straight Bar", "V-Bar", "Standard Lat Bar",
  "Neutral Grip Lat Bar", "Single Handle", "Ankle Strap", "Tricep Bar",
] as const;

function encodeExNotes(setType: string, rpe: string, laterality: string, equipment: string, grip: string, notes: string): string {
  const parts: string[] = [];
  if (setType && setType !== "Normal") parts.push(`[${setType}]`);
  if (rpe) parts.push(`RPE ${rpe}`);
  const tags: string[] = [];
  if (laterality === "unilateral") tags.push("@lat:uni");
  if (equipment) tags.push(`@equip:${equipment.replace(/ /g, "_")}`);
  if (equipment === "Cable" && grip) tags.push(`@grip:${grip.replace(/ /g, "_")}`);
  if (tags.length) parts.push(tags.join(" "));
  if (notes) parts.push(notes);
  return parts.join(" | ");
}

function decodeExNotes(raw: string | null | undefined): { setType: string; rpe: string; laterality: string; equipment: string; grip: string; notes: string } {
  if (!raw) return { setType: "Normal", rpe: "", laterality: "bilateral", equipment: "", grip: "", notes: "" };
  const setTypeMatch = raw.match(/^\[([^\]]+)\]/);
  const rpeMatch = raw.match(/RPE (\d+(?:\.\d+)?)/);
  const latMatch = raw.match(/@lat:(\S+)/);
  const equipMatch = raw.match(/@equip:(\S+)/);
  const gripMatch = raw.match(/@grip:(\S+)/);
  let notes = raw;
  if (setTypeMatch) notes = notes.replace(setTypeMatch[0], "").trim();
  if (rpeMatch) notes = notes.replace(`RPE ${rpeMatch[1]}`, "").trim();
  notes = notes.replace(/@\S+/g, "").trim();
  notes = notes.replace(/^\|?\s*|\s*\|?$/g, "").replace(/\s*\|\s*/g, " ").trim();
  return {
    setType: setTypeMatch ? setTypeMatch[1] : "Normal",
    rpe: rpeMatch ? rpeMatch[1] : "",
    laterality: latMatch?.[1] === "uni" ? "unilateral" : "bilateral",
    equipment: equipMatch ? equipMatch[1].replace(/_/g, " ") : "",
    grip: gripMatch ? gripMatch[1].replace(/_/g, " ") : "",
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
  laterality: z.enum(["bilateral", "unilateral"]).default("bilateral"),
  equipment: z.string().default(""),
  grip: z.string().default(""),
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
  const [phasesViewMode, setPhasesViewMode] = useState<"list" | "grid">("list");
  const [nutritionTarget, setNutritionTarget] = useState<
    { type: "phase"; phaseId: number } | { type: "day"; phaseId: number; dayId: number } | null
  >(null);

  const { data: program, isLoading, isError, refetch, isFetching } = useGetProgram(programId, {
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
  const setPhaseNutritionGoal = useSetPhaseNutritionGoal();
  const setDayNutritionGoal = useSetDayNutritionGoal();
  const deleteDayNutritionGoal = useDeleteDayNutritionGoal();
  const updateSleepAdjustment = useUpdateProgramSleepAdjustment();
  const [sleepAdjustEnabled, setSleepAdjustEnabled] = useState<boolean | null>(null);
  const [sleepAdjustPercent, setSleepAdjustPercent] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // Auto-enter edit mode for brand-new (phaseless) template programs
  useEffect(() => {
    if (program && !program.clientId && program.phases.length === 0) {
      setIsEditing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [propagateOpen, setPropagateOpen] = useState(false);
  const [selectedAssignIds, setSelectedAssignIds] = useState<number[]>([]);
  const [selectedSyncIds, setSelectedSyncIds] = useState<number[]>([]);
  const [, setLocation] = useLocation();
  const { data: allClients } = useListClients({ query: { queryKey: getListClientsQueryKey() } });
  const bulkAssign = useBulkAssignProgram();
  const syncToClients = useSyncProgramToClients();
  const { data: nutritionPeriods, refetch: refetchPeriods } = useListNutritionPeriods(programId);
  const createPeriod = useCreateNutritionPeriod();
  const updatePeriod = useUpdateNutritionPeriod();
  const deletePeriod = useDeleteNutritionPeriod();
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<NutritionPeriod | null>(null);
  const { data: assignedClients, refetch: refetchAssigned } = useGetProgramAssignedClients(programId, {
    query: { enabled: !!programId, queryKey: getGetProgramAssignedClientsQueryKey(programId) },
  });

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
  const nutritionForm = useForm<z.infer<typeof nutritionGoalSchema>>({
    resolver: zodResolver(nutritionGoalSchema),
    defaultValues: { calories: undefined, protein: undefined, carbs: undefined, fat: undefined },
  });
  const periodForm = useForm<z.infer<typeof nutritionPeriodSchema>>({
    resolver: zodResolver(nutritionPeriodSchema),
    defaultValues: { label: "", startDate: "", endDate: "", calories: undefined, protein: undefined, carbs: undefined, fat: undefined },
  });
  const exForm = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, setType: "Normal", rpe: "", laterality: "bilateral", equipment: "", grip: "", notes: "", order: 0 },
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

  const openAddDay = (phaseId: number) => {
    setDayDialogPhaseId(phaseId);
    dayForm.reset({ dayNumber: (program?.days.length ?? 0) + 1, name: "", notes: "", phaseId });
    setDayDialogOpen(true);
  };

  const handleCreateDay = (values: z.infer<typeof daySchema>) => {
    createDay.mutate(
      { programId, data: { dayNumber: values.dayNumber, name: values.name, notes: values.notes || undefined, phaseId: values.phaseId } },
      {
        onSuccess: () => { invalidate(); setDayDialogOpen(false); dayForm.reset(); },
        onError: () => toast({ title: "Failed to create day", variant: "destructive" }),
      }
    );
  };

  const handleDeleteDay = (dayId: number) => {
    deleteDay.mutate({ programId, dayId }, {
      onSuccess: () => { invalidate(); if (selectedDayId === dayId) setSelectedDayId(null); },
    });
  };

  const handleAddExercise = (values: z.infer<typeof exerciseSchema>) => {
    if (!selectedDayId) return;
    const encodedNotes = encodeExNotes(values.setType ?? "Normal", values.rpe ?? "", values.laterality ?? "bilateral", values.equipment ?? "", values.grip ?? "", values.notes ?? "");
    addExercise.mutate(
      { programId, dayId: selectedDayId, data: { exerciseId: values.exerciseId, sets: values.sets, reps: values.reps, weight: values.weight || undefined, restSeconds: values.restSeconds || undefined, notes: encodedNotes || undefined, order: values.order } },
      {
        onSuccess: () => { invalidate(); setExDialogOpen(false); exForm.reset({ exerciseId: 0, sets: 3, reps: "8-12", weight: "", restSeconds: 60, setType: "Normal", rpe: "", laterality: "bilateral", equipment: "", grip: "", notes: "", order: 0 }); },
        onError: () => { toast({ title: "Failed to add exercise", description: "Please try again.", variant: "destructive" }); },
      }
    );
  };

  const handleDeleteExercise = (dayId: number, peId: number) => {
    deleteExercise.mutate({ programId, dayId, peId }, { onSuccess: invalidate });
  };

  const openPhaseNutritionGoal = (ph: { id: number; nutritionGoal?: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null } }) => {
    nutritionForm.reset({
      calories: ph.nutritionGoal?.calories ?? undefined,
      protein: ph.nutritionGoal?.protein ?? undefined,
      carbs: ph.nutritionGoal?.carbs ?? undefined,
      fat: ph.nutritionGoal?.fat ?? undefined,
    });
    setNutritionTarget({ type: "phase", phaseId: ph.id });
  };

  const openDayNutritionOverride = (phaseId: number, d: { id: number; nutritionGoalOverride?: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null } }) => {
    nutritionForm.reset({
      calories: d.nutritionGoalOverride?.calories ?? undefined,
      protein: d.nutritionGoalOverride?.protein ?? undefined,
      carbs: d.nutritionGoalOverride?.carbs ?? undefined,
      fat: d.nutritionGoalOverride?.fat ?? undefined,
    });
    setNutritionTarget({ type: "day", phaseId, dayId: d.id });
  };

  const handleSaveNutritionGoal = (values: z.infer<typeof nutritionGoalSchema>) => {
    if (!nutritionTarget) return;
    const data = {
      calories: values.calories ?? null,
      protein: values.protein ?? null,
      carbs: values.carbs ?? null,
      fat: values.fat ?? null,
    };
    const onSuccess = () => { invalidate(); setNutritionTarget(null); };
    const onError = () => toast({ title: "Failed to save nutrition goal", variant: "destructive" });
    if (nutritionTarget.type === "phase") {
      setPhaseNutritionGoal.mutate({ programId, phaseId: nutritionTarget.phaseId, data }, { onSuccess, onError });
    } else {
      setDayNutritionGoal.mutate(
        { programId, phaseId: nutritionTarget.phaseId, dayId: nutritionTarget.dayId, data },
        { onSuccess, onError }
      );
    }
  };

  const openAddPeriod = () => {
    setEditingPeriod(null);
    periodForm.reset({ label: "", startDate: "", endDate: "", calories: undefined, protein: undefined, carbs: undefined, fat: undefined });
    setPeriodDialogOpen(true);
  };

  const openEditPeriod = (p: NutritionPeriod) => {
    setEditingPeriod(p);
    periodForm.reset({
      label: p.label ?? "",
      startDate: p.startDate,
      endDate: p.endDate,
      calories: p.calories ?? undefined,
      protein: p.protein ?? undefined,
      carbs: p.carbs ?? undefined,
      fat: p.fat ?? undefined,
    });
    setPeriodDialogOpen(true);
  };

  const handleSavePeriod = (values: z.infer<typeof nutritionPeriodSchema>) => {
    const data = {
      label: values.label || undefined,
      startDate: values.startDate,
      endDate: values.endDate,
      calories: values.calories ?? null,
      protein: values.protein ?? null,
      carbs: values.carbs ?? null,
      fat: values.fat ?? null,
    };
    const onSuccess = () => { refetchPeriods(); setPeriodDialogOpen(false); };
    const onError = () => toast({ title: "Failed to save nutrition period", variant: "destructive" });
    if (editingPeriod) {
      updatePeriod.mutate({ programId, periodId: editingPeriod.id, data }, { onSuccess, onError });
    } else {
      createPeriod.mutate({ programId, data }, { onSuccess, onError });
    }
  };

  const handleDeletePeriod = (periodId: number) => {
    deletePeriod.mutate({ programId, periodId }, {
      onSuccess: () => refetchPeriods(),
      onError: () => toast({ title: "Failed to delete period", variant: "destructive" }),
    });
  };

  const handleClearDayOverride = (phaseId: number, dayId: number) => {
    deleteDayNutritionGoal.mutate({ programId, phaseId, dayId }, {
      onSuccess: invalidate,
      onError: () => toast({ title: "Failed to clear override", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load this program. This is usually temporary."
        onRetry={() => refetch()}
        isRetrying={isFetching}
        testId="button-retry-program"
        className="p-8"
      />
    );
  }
  if (!program) return <div className="p-8 text-muted-foreground">Program not found.</div>;

  const selectedDay = program.days.find(d => d.id === selectedDayId);
  const unphasedDays = program.days.filter(d => !d.phaseId);
  const hasPhases = program.phases.length > 0;
  const isTemplate = !program.clientId;
  const canEdit = !isTemplate || isEditing;

  const DayRow = ({ d }: { d: typeof program.days[number] }) => (
    <div
      key={d.id}
      data-testid={`day-${d.id}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors group ${
        phasesViewMode === "grid" ? "flex-col items-stretch border border-border" : ""
      } ${selectedDayId === d.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      onClick={() => setSelectedDayId(d.id)}
    >
      <div className="flex items-center gap-2 w-full">
        <GripVertical className="w-4 h-4 opacity-40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">Day {d.dayNumber}: {d.name}</p>
          {d.nutritionGoalOverride && (
            <p className={`text-[10px] truncate ${selectedDayId === d.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {d.nutritionGoalOverride.calories ? `${d.nutritionGoalOverride.calories} cal` : "custom"} override
            </p>
          )}
        </div>
        {canEdit && d.phaseId && (
          <button
            onClick={(e) => { e.stopPropagation(); openDayNutritionOverride(d.phaseId!, d); }}
            className={`opacity-0 group-hover:opacity-100 ${selectedDayId === d.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"} transition-opacity`}
            title="Set nutrition override"
            data-testid={`button-nutrition-day-${d.id}`}
          >
            <Apple className="w-3.5 h-3.5" />
          </button>
        )}
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteDay(d.id); }}
            className={`opacity-0 group-hover:opacity-100 ${selectedDayId === d.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"} transition-opacity`}
            data-testid={`button-delete-day-${d.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isEditing ? setIsEditing(false) : setLocation("/programs")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{program.name}</h1>
            {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
          </div>
        </div>
        {isTemplate && !isEditing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-1.5" /> Edit program
            </Button>
          </div>
        )}
      </div>

      {/* Sleep Adjustment Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Moon className="w-4 h-4 text-muted-foreground" /> Sleep Adjustment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Auto-adjust on poor sleep</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reduces volume when client logs poor/fair sleep and low energy (≤ 5)</p>
            </div>
            <Switch
              checked={sleepAdjustEnabled ?? program.sleepAdjustEnabled ?? true}
              onCheckedChange={(enabled) => {
                setSleepAdjustEnabled(enabled);
                updateSleepAdjustment.mutate(
                  { programId, data: { sleepAdjustEnabled: enabled, sleepAdjustPercent: sleepAdjustPercent ?? program.sleepAdjustPercent ?? 20 } },
                  {
                    onSuccess: () => qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) }),
                    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
                  }
                );
              }}
            />
          </div>
          {(sleepAdjustEnabled ?? program.sleepAdjustEnabled ?? true) && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground flex-1">Volume reduction</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={sleepAdjustPercent ?? program.sleepAdjustPercent ?? 20}
                  onChange={e => setSleepAdjustPercent(Number(e.target.value))}
                  onBlur={() => {
                    const pct = Math.min(50, Math.max(0, sleepAdjustPercent ?? program.sleepAdjustPercent ?? 20));
                    setSleepAdjustPercent(pct);
                    updateSleepAdjustment.mutate(
                      { programId, data: { sleepAdjustEnabled: sleepAdjustEnabled ?? program.sleepAdjustEnabled ?? true, sleepAdjustPercent: pct } },
                      {
                        onSuccess: () => qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programId) }),
                        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
                      }
                    );
                  }}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nutrition Periods */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Apple className="w-4 h-4 text-muted-foreground" /> Nutrition Periods
            </CardTitle>
            {canEdit && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openAddPeriod}>
                <Plus className="w-3.5 h-3.5" /> Add Period
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Set macro targets for specific date windows. Applied after per-day overrides but before phase defaults.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {(() => {
            const periods = nutritionPeriods ?? [];
            if (periods.length === 0) {
              return <p className="text-xs text-muted-foreground text-center py-3">No nutrition periods set</p>;
            }
            // Detect overlaps
            const overlapping = new Set<number>();
            for (let i = 0; i < periods.length; i++) {
              for (let j = i + 1; j < periods.length; j++) {
                const a = periods[i], b = periods[j];
                if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
                  overlapping.add(a.id);
                  overlapping.add(b.id);
                }
              }
            }
            return periods.map((p: NutritionPeriod) => (
              <div key={p.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-md group ${overlapping.has(p.id) ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" : "bg-muted/50"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {overlapping.has(p.id) && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    <span className="text-sm font-medium truncate">
                      {p.label || `${p.startDate} → ${p.endDate}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.startDate} – {p.endDate}</span>
                  </div>
                  <div className="flex gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    {p.calories != null && <span>{p.calories} cal</span>}
                    {p.protein != null && <span>{p.protein}g protein</span>}
                    {p.carbs != null && <span>{p.carbs}g carbs</span>}
                    {p.fat != null && <span>{p.fat}g fat</span>}
                    {overlapping.has(p.id) && <span className="text-amber-600 dark:text-amber-400 font-medium">Overlapping window</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditPeriod(p)} className="p-1 text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeletePeriod(p.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ));
          })()}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Phases + Days list */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {hasPhases ? "Phases & Days" : "Days"}
            </CardTitle>
            <div className="flex items-center gap-1">
              {/* Add Phase dialog */}
              {canEdit && <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
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
              </Dialog>}

              {/* Grid/List view toggle */}
              <Select value={phasesViewMode} onValueChange={v => setPhasesViewMode(v as "list" | "grid")}>
                <SelectTrigger className="h-7 w-[86px] text-xs" data-testid="select-phases-view-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list"><span className="flex items-center gap-1.5"><List className="w-3.5 h-3.5" /> List</span></SelectItem>
                  <SelectItem value="grid"><span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> Grid</span></SelectItem>
                </SelectContent>
              </Select>
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
                    {ph.nutritionGoal && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0 gap-1">
                        <Apple className="w-2.5 h-2.5" /> {ph.nutritionGoal.calories ?? "set"}
                      </Badge>
                    )}
                  </div>
                  {canEdit && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openPhaseNutritionGoal(ph)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                      title="Set nutrition goal"
                      data-testid={`button-nutrition-phase-${ph.id}`}
                    >
                      <Apple className="w-3 h-3" />
                    </button>
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
                      data-testid={`button-add-day-phase-${ph.id}`}
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
                  )}
                </div>
                {ph.days.length === 0 && (
                  <p className="text-muted-foreground text-xs text-center py-2 pl-6">No days yet</p>
                )}
                <div className={phasesViewMode === "grid" ? "grid grid-cols-2 gap-1.5" : "space-y-1"}>
                  {ph.days.map(d => <DayRow key={d.id} d={d} />)}
                </div>
              </div>
            ))}

            {unphasedDays.length > 0 && (
              <div className={hasPhases ? "mt-2" : ""}>
                <p className="text-xs text-muted-foreground px-2 mb-1 font-medium uppercase tracking-wide">
                  Unassigned (legacy)
                </p>
                <div className={phasesViewMode === "grid" ? "grid grid-cols-2 gap-1.5" : "space-y-1"}>
                  {unphasedDays.map(d => <DayRow key={d.id} d={d} />)}
                </div>
              </div>
            )}

            {program.phases.length === 0 && (
              <p className="text-muted-foreground text-xs text-center py-4">
                Add a phase first — days must belong to a phase
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
            {selectedDay && canEdit && (
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
                          <Select onValueChange={v => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose exercise" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {exercises?.map(e => (
                                <SelectItem key={e.id} value={String(e.id)}>
                                  {e.name} ({e.muscleGroup})
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
                      <FormField control={exForm.control} name="laterality" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Movement Type</FormLabel>
                          <div className="flex gap-2">
                            {(["bilateral", "unilateral"] as const).map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => field.onChange(v)}
                                className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-all capitalize ${field.value === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </FormItem>
                      )} />
                      <FormField control={exForm.control} name="equipment" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment <span className="text-muted-foreground">(Optional)</span></FormLabel>
                          <Select
                            value={field.value || "__none__"}
                            onValueChange={v => {
                              const val = v === "__none__" ? "" : v;
                              field.onChange(val);
                              if (val !== "Cable") exForm.setValue("grip", "");
                            }}
                          >
                            <FormControl><SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {EQUIPMENT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      {exForm.watch("equipment") === "Cable" && (
                        <FormField control={exForm.control} name="grip" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cable Grip</FormLabel>
                            <Select
                              value={field.value || "__none__"}
                              onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                            >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select grip" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="__none__">Not specified</SelectItem>
                                {CABLE_GRIPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      )}
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
                      {decoded.equipment && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{decoded.equipment}{decoded.grip ? ` · ${decoded.grip}` : ""}</Badge>}
                      {decoded.laterality === "unilateral" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400/50 text-blue-600 dark:text-blue-400">Unilateral</Badge>}
                      {decoded.notes && <span className="text-xs text-muted-foreground italic">"{decoded.notes}"</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteExercise(selectedDay.id, e.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-delete-exercise-${e.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Assigned clients section (template only) */}
      {isTemplate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Assigned clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!assignedClients || assignedClients.length === 0) ? (
              <p className="text-sm text-muted-foreground">No clients assigned yet.</p>
            ) : (
              <div className="space-y-1">
                {assignedClients.map(c => (
                  <div key={c.clientId} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                    <span className="text-sm font-medium">{c.clientName}</span>
                    <span className="text-xs text-muted-foreground">
                      Assigned {new Date(c.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assign program dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign program to clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(!allClients || allClients.length === 0) ? (
              <p className="text-sm text-muted-foreground">No clients found.</p>
            ) : (
              <>
                {(() => {
                  const assignedIds = new Set((assignedClients ?? []).map(c => c.clientId));
                  const unassigned = allClients.filter(c => !assignedIds.has(c.id));
                  return (
                    <>
                      <div className="flex items-center gap-2 pb-1 border-b">
                        <Checkbox
                          id="assign-all"
                          checked={unassigned.length > 0 && unassigned.every(c => selectedAssignIds.includes(c.id))}
                          disabled={unassigned.length === 0}
                          onCheckedChange={(checked) =>
                            setSelectedAssignIds(checked ? unassigned.map(c => c.id) : [])
                          }
                        />
                        <label htmlFor="assign-all" className="text-sm font-medium cursor-pointer">
                          Assign to all unassigned ({unassigned.length})
                        </label>
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {allClients.map(c => {
                          const alreadyAssigned = assignedIds.has(c.id);
                          return (
                            <div key={c.id} className="flex items-center gap-2 py-1">
                              <Checkbox
                                id={`assign-client-${c.id}`}
                                checked={alreadyAssigned || selectedAssignIds.includes(c.id)}
                                disabled={alreadyAssigned}
                                onCheckedChange={(checked) =>
                                  setSelectedAssignIds(prev =>
                                    checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                                  )
                                }
                              />
                              <label htmlFor={`assign-client-${c.id}`} className={`text-sm flex-1 ${alreadyAssigned ? "text-muted-foreground" : "cursor-pointer"}`}>
                                {c.name}
                              </label>
                              {alreadyAssigned && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Assigned</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={selectedAssignIds.length === 0 || bulkAssign.isPending}
                onClick={() => {
                  bulkAssign.mutate(
                    { programId, data: { clientIds: selectedAssignIds } },
                    {
                      onSuccess: (result) => {
                        setAssignOpen(false);
                        refetchAssigned();
                        toast({
                          title: result.skipped.length > 0
                            ? `Assigned to ${result.assigned.length} client${result.assigned.length !== 1 ? "s" : ""} · ${result.skipped.length} already assigned`
                            : `Assigned to ${result.assigned.length} client${result.assigned.length !== 1 ? "s" : ""}`,
                          duration: 2000,
                        });
                      },
                      onError: () => toast({ title: "Failed to assign program", variant: "destructive" }),
                    }
                  );
                }}
              >
                {bulkAssign.isPending ? "Assigning…" : `Assign to ${selectedAssignIds.length} client${selectedAssignIds.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Propagation dialog — shown when saving changes to template */}
      <Dialog open={propagateOpen} onOpenChange={setPropagateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Changes to this template have been saved. Do you want to push these updates to assigned clients?
            </p>
            {assignedClients && assignedClients.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b">
                  <Checkbox
                    id="sync-all"
                    checked={selectedSyncIds.length === assignedClients.length}
                    onCheckedChange={(checked) =>
                      setSelectedSyncIds(checked ? assignedClients.map(c => c.clientId) : [])
                    }
                  />
                  <label htmlFor="sync-all" className="text-sm font-medium cursor-pointer">
                    Apply to all ({assignedClients.length})
                  </label>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {assignedClients.map(c => (
                    <div key={c.clientId} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`sync-client-${c.clientId}`}
                        checked={selectedSyncIds.includes(c.clientId)}
                        onCheckedChange={(checked) =>
                          setSelectedSyncIds(prev =>
                            checked ? [...prev, c.clientId] : prev.filter(id => id !== c.clientId)
                          )
                        }
                      />
                      <label htmlFor={`sync-client-${c.clientId}`} className="text-sm cursor-pointer flex-1">{c.clientName}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setPropagateOpen(false)}
              >
                Cancel
              </Button>
              {assignedClients && assignedClients.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    disabled={selectedSyncIds.length === 0 || syncToClients.isPending}
                    onClick={() => {
                      syncToClients.mutate(
                        { programId, data: { clientIds: selectedSyncIds } },
                        {
                          onSuccess: (result) => {
                            setPropagateOpen(false);
                            setIsEditing(false);
                            toast({ title: `Updated ${result.synced.length} client program${result.synced.length !== 1 ? "s" : ""}` });
                          },
                          onError: () => toast({ title: "Failed to sync to clients", variant: "destructive" }),
                        }
                      );
                    }}
                  >
                    {syncToClients.isPending ? "Applying…" : `Apply to ${selectedSyncIds.length}`}
                  </Button>
                  <Button
                    disabled={syncToClients.isPending}
                    onClick={() => {
                      const allIds = assignedClients.map(c => c.clientId);
                      syncToClients.mutate(
                        { programId, data: { clientIds: allIds } },
                        {
                          onSuccess: (result) => {
                            setPropagateOpen(false);
                            setIsEditing(false);
                            toast({ title: `Updated ${result.synced.length} client program${result.synced.length !== 1 ? "s" : ""}` });
                          },
                          onError: () => toast({ title: "Failed to sync to clients", variant: "destructive" }),
                        }
                      );
                    }}
                  >
                    Apply to all
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <FormField control={dayForm.control} name="phaseId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase</FormLabel>
                  <Select
                    onValueChange={v => field.onChange(Number(v))}
                    value={field.value ? String(field.value) : ""}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a phase" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {program.phases.map(ph => (
                        <SelectItem key={ph.id} value={String(ph.id)}>
                          {ph.name} ({ph.durationWeeks}w{ph.daysPerWeek ? ` · ${ph.daysPerWeek}×/wk` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={dayForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createDay.isPending}>Add Day</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Nutrition Period Dialog */}
      <Dialog open={periodDialogOpen} onOpenChange={open => { if (!open) setPeriodDialogOpen(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPeriod ? "Edit Nutrition Period" : "Add Nutrition Period"}</DialogTitle>
          </DialogHeader>
          <Form {...periodForm}>
            <form onSubmit={periodForm.handleSubmit(handleSavePeriod)} className="space-y-4">
              <FormField control={periodForm.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Label <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Cut phase, Maintenance, Bulking" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={periodForm.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button type="button" className={`w-full flex items-center gap-2 px-3 h-10 rounded-md border text-sm text-left ${field.value ? "text-foreground" : "text-muted-foreground"} border-input bg-background hover:bg-accent hover:text-accent-foreground`}>
                            <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                            {field.value ? format(parseISO(field.value), "MMM d, yyyy") : "Pick a date"}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value && isValid(parseISO(field.value)) ? parseISO(field.value) : undefined}
                          onSelect={date => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={periodForm.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button type="button" className={`w-full flex items-center gap-2 px-3 h-10 rounded-md border text-sm text-left ${field.value ? "text-foreground" : "text-muted-foreground"} border-input bg-background hover:bg-accent hover:text-accent-foreground`}>
                            <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                            {field.value ? format(parseISO(field.value), "MMM d, yyyy") : "Pick a date"}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value && isValid(parseISO(field.value)) ? parseISO(field.value) : undefined}
                          onSelect={date => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              {(() => {
                const s = periodForm.watch("startDate");
                const e = periodForm.watch("endDate");
                if (s && e && s > e) return (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> End date must be on or after start date
                  </p>
                );
                return null;
              })()}
              <p className="text-xs text-muted-foreground">Nutrition targets for this window. Leave a field blank to skip it.</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={periodForm.control} name="calories" render={({ field }) => (
                  <FormItem><FormLabel>Calories</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="e.g. 2200" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={periodForm.control} name="protein" render={({ field }) => (
                  <FormItem><FormLabel>Protein (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={periodForm.control} name="carbs" render={({ field }) => (
                  <FormItem><FormLabel>Carbs (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={periodForm.control} name="fat" render={({ field }) => (
                  <FormItem><FormLabel>Fat (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createPeriod.isPending || updatePeriod.isPending}
              >
                {editingPeriod ? "Save Changes" : "Add Period"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Nutrition Goal Dialog (phase default or day override) */}
      <Dialog open={nutritionTarget !== null} onOpenChange={open => { if (!open) setNutritionTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nutritionTarget?.type === "phase" ? "Phase Nutrition Goal" : "Day Nutrition Override"}
            </DialogTitle>
          </DialogHeader>
          <Form {...nutritionForm}>
            <form onSubmit={nutritionForm.handleSubmit(handleSaveNutritionGoal)} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {nutritionTarget?.type === "phase"
                  ? "Sets the default daily nutrition goal for the entire phase. Leave a field blank to skip it."
                  : "Overrides the phase default for this specific day only. Leave a field blank to skip it."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={nutritionForm.control} name="calories" render={({ field }) => (
                  <FormItem><FormLabel>Calories</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="e.g. 2200" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={nutritionForm.control} name="protein" render={({ field }) => (
                  <FormItem><FormLabel>Protein (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={nutritionForm.control} name="carbs" render={({ field }) => (
                  <FormItem><FormLabel>Carbs (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={nutritionForm.control} name="fat" render={({ field }) => (
                  <FormItem><FormLabel>Fat (g)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex gap-2">
                {nutritionTarget?.type === "day" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={deleteDayNutritionGoal.isPending}
                    onClick={() => {
                      if (nutritionTarget.type === "day") {
                        handleClearDayOverride(nutritionTarget.phaseId, nutritionTarget.dayId);
                        setNutritionTarget(null);
                      }
                    }}
                  >
                    Revert to phase default
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={setPhaseNutritionGoal.isPending || setDayNutritionGoal.isPending}>
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign program — full-width, bottom of page (view mode only) */}
      {isTemplate && !isEditing && (
        <Button
          className="w-full"
          onClick={() => { setAssignOpen(true); setSelectedAssignIds([]); }}
        >
          <Users className="w-4 h-4 mr-2" /> Assign program
        </Button>
      )}

      {/* Sticky edit-mode toolbar (template only) */}
      {isTemplate && isEditing && (
        <div className="sticky bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-end gap-2 -mx-4 md:-mx-6">
          <span className="text-sm text-muted-foreground mr-auto">Editing template</span>
          <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button onClick={() => { setPropagateOpen(true); setSelectedSyncIds((assignedClients ?? []).map(c => c.clientId)); }}>
            <Save className="w-4 h-4 mr-1.5" /> Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
