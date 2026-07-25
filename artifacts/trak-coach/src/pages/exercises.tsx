import { useRef, useState } from "react";
import {
  useListExercises, useCreateExercise, useUpdateExercise,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, LayoutGrid, List, X, ChevronRight,
  Dumbbell, Pencil, Upload, Video, Loader2, Link2, Trash2,
} from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";


type SortMode = "target" | "compound" | "movement" | "cardio" | "mobility" | "strength";
type ViewMode = "grid" | "list";

const EQUIPMENT_OPTIONS = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Bands", "Other"] as const;
type Equipment = typeof EQUIPMENT_OPTIONS[number];

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
type Difficulty = typeof DIFFICULTY_OPTIONS[number];

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().min(1),
  isCompound: z.boolean().optional(),
  isUnilateral: z.boolean().optional(),
  movementPattern: z.string().optional(),
  description: z.string().optional(),
  equipment: z.enum(EQUIPMENT_OPTIONS).optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
});

const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Traps",
  "Legs", "Glutes", "Core", "Full Body", "Cardio", "HIIT", "Mobility",
];

const GROUP_ORDER: Record<string, number> = {
  "Chest": 1, "Back": 2, "Shoulders": 3, "Biceps": 4, "Triceps": 5, "Traps": 6,
  "Legs": 7, "Glutes": 8, "Core": 9, "Full Body": 10,
  "Cardio": 97, "HIIT": 98, "Mobility": 99,
};
function groupOrder(g: string) { return GROUP_ORDER[g] ?? 50; }

const CARDIO_GROUPS = new Set(["Cardio", "HIIT"]);
const MOBILITY_GROUPS = new Set(["Mobility"]);

type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  isCompound: boolean;
  isUnilateral: boolean;
  movementPattern?: string | null;
  description?: string | null;
  videoUrl?: string | null;
  equipment?: Equipment | null;
  difficulty?: Difficulty | null;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupExercises(exercises: Exercise[], sortBy: SortMode): [string, Exercise[]][] {
  switch (sortBy) {
    case "target": {
      const map: Record<string, Exercise[]> = {};
      for (const e of exercises) (map[e.muscleGroup] ??= []).push(e);
      return Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
    }
    case "compound": {
      const compound: Exercise[] = [], isolation: Exercise[] = [];
      for (const e of exercises) (e.isCompound ? compound : isolation).push(e);
      const result: [string, Exercise[]][] = [];
      if (compound.length) result.push(["Compound", compound]);
      if (isolation.length) result.push(["Isolation", isolation]);
      return result;
    }
    case "movement": {
      const bilateral: Exercise[] = [], unilateral: Exercise[] = [], other: Exercise[] = [];
      for (const e of exercises) {
        const mp = e.movementPattern?.toLowerCase();
        if (mp === "bilateral") bilateral.push(e);
        else if (mp === "unilateral") unilateral.push(e);
        else other.push(e);
      }
      const result: [string, Exercise[]][] = [];
      if (bilateral.length) result.push(["Bilateral", bilateral]);
      if (unilateral.length) result.push(["Unilateral", unilateral]);
      if (other.length) result.push(["Other", other]);
      return result;
    }
    case "cardio": {
      const cardio = exercises.filter(e => CARDIO_GROUPS.has(e.muscleGroup));
      const map: Record<string, Exercise[]> = {};
      for (const e of cardio) (map[e.muscleGroup] ??= []).push(e);
      return Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
    }
    case "mobility": {
      const mobility = exercises.filter(e => MOBILITY_GROUPS.has(e.muscleGroup));
      const map: Record<string, Exercise[]> = {};
      for (const e of mobility) (map[e.muscleGroup] ??= []).push(e);
      return Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
    }
    case "strength": {
      const strength = exercises.filter(e => !CARDIO_GROUPS.has(e.muscleGroup) && !MOBILITY_GROUPS.has(e.muscleGroup));
      const map: Record<string, Exercise[]> = {};
      for (const e of strength) (map[e.muscleGroup] ??= []).push(e);
      return Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
    }
  }
}

function ExerciseBadges({ exercise, size = "sm" }: { exercise: Exercise; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "text-[10px] px-1.5 py-0" : "";
  return (
    <div className="flex gap-1 flex-wrap">
      <Badge variant={exercise.isCompound ? "default" : "secondary"} className={cls}>
        {exercise.isCompound ? "Compound" : "Isolation"}
      </Badge>
      {exercise.movementPattern && (
        <Badge variant="outline" className={cls}>
          {capitalize(exercise.movementPattern)}
        </Badge>
      )}
      {exercise.equipment && exercise.equipment !== "Other" && (
        <Badge variant="outline" className={cls}>{exercise.equipment}</Badge>
      )}
      {exercise.difficulty && (
        <Badge variant="secondary" className={cls}>{exercise.difficulty}</Badge>
      )}
    </div>
  );
}

function VideoUploadButton({
  exerciseId,
  onUploadComplete,
}: {
  exerciseId: number;
  onUploadComplete: (videoUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, objectPath } = await urlRes.json() as { uploadUrl: string; objectPath: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(file);
      });

      onUploadComplete(objectPath);
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        data-testid={`button-upload-video-${exerciseId}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {progress > 0 ? `${progress}%` : "Uploading…"}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload video
          </>
        )}
      </Button>
    </>
  );
}

function ExerciseDetailPanel({
  exercise: initialExercise,
  onClose,
  onUpdate,
}: {
  exercise: Exercise;
  onClose: () => void;
  onUpdate: (updated: Exercise) => void;
}) {
  const [exercise, setExercise] = useState(initialExercise);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(exercise.name);
  const [editMuscleGroup, setEditMuscleGroup] = useState(exercise.muscleGroup);
  const [editIsCompound, setEditIsCompound] = useState(exercise.isCompound);
  const [editIsUnilateral, setEditIsUnilateral] = useState(exercise.isUnilateral);
  const [editMovement, setEditMovement] = useState(exercise.movementPattern ?? "");
  const [editDescription, setEditDescription] = useState(exercise.description ?? "");
  const [editEquipment, setEditEquipment] = useState<Equipment>(exercise.equipment ?? "Other");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>(exercise.difficulty ?? "Intermediate");

  const updateExercise = useUpdateExercise();
  const { toast } = useToast();
  const qc = useQueryClient();

  function startEdit() {
    setEditName(exercise.name);
    setEditMuscleGroup(exercise.muscleGroup);
    setEditIsCompound(exercise.isCompound);
    setEditIsUnilateral(exercise.isUnilateral);
    setEditMovement(exercise.movementPattern ?? "");
    setEditDescription(exercise.description ?? "");
    setEditEquipment(exercise.equipment ?? "Other");
    setEditDifficulty(exercise.difficulty ?? "Intermediate");
    setEditing(true);
  }

  function saveEdit() {
    updateExercise.mutate(
      {
        exerciseId: exercise.id,
        data: {
          name: editName,
          muscleGroup: editMuscleGroup,
          isCompound: editIsCompound,
          isUnilateral: editIsUnilateral,
          movementPattern: editMovement || null,
          description: editDescription || null,
          equipment: editEquipment,
          difficulty: editDifficulty,
        },
      },
      {
        onSuccess: (updated) => {
          const refreshed = { ...exercise, ...updated };
          setExercise(refreshed);
          onUpdate(refreshed);
          setEditing(false);
          qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
          toast({ title: "Exercise saved" });
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      }
    );
  }

  function handleVideoUploaded(objectPath: string) {
    updateExercise.mutate(
      { exerciseId: exercise.id, data: { videoUrl: objectPath } },
      {
        onSuccess: (updated) => {
          const refreshed = { ...exercise, ...updated };
          setExercise(refreshed);
          onUpdate(refreshed);
          qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
          toast({ title: "Video uploaded" });
        },
        onError: () => toast({ title: "Failed to save video", variant: "destructive" }),
      }
    );
  }

  const videoSrc = exercise.videoUrl ? `/api/storage${exercise.videoUrl}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" data-testid="exercise-detail-panel">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Top bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={startEdit}
                data-testid="button-edit-exercise"
              >
                <Pencil className="w-4 h-4 mr-1.5" /> Edit
              </Button>
            )}
          </div>
          <button
            onClick={onClose}
            data-testid="button-close-exercise-detail"
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Dumbbell className="w-7 h-7 text-purple-500" />
          </div>
          <div className="flex-1">
            {editing ? (
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-2xl font-bold h-auto py-1"
                data-testid="input-edit-exercise-name"
              />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
            )}
            <p className="text-muted-foreground mt-1">{editing ? editMuscleGroup : exercise.muscleGroup}</p>
          </div>
        </div>

        {/* Edit fields */}
        {editing && (
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-medium mb-2">Muscle Group</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {MUSCLE_GROUPS.map(mg => (
                  <button
                    key={mg}
                    type="button"
                    onClick={() => setEditMuscleGroup(mg)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${editMuscleGroup === mg ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {mg}
                  </button>
                ))}
              </div>
              <Input
                value={editMuscleGroup}
                onChange={e => setEditMuscleGroup(e.target.value)}
                placeholder="Or type custom group"
                className="mt-1"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Type</p>
              <div className="flex gap-2">
                {[{ label: "Compound", val: true }, { label: "Isolation", val: false }].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setEditIsCompound(opt.val)}
                    className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${editIsCompound === opt.val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Laterality</p>
              <div className="flex gap-2">
                {[{ label: "Bilateral", val: false }, { label: "Unilateral", val: true }].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setEditIsUnilateral(opt.val)}
                    className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${editIsUnilateral === opt.val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Movement Pattern</p>
              <div className="flex gap-2">
                {["bilateral", "unilateral"].map(mp => (
                  <button
                    key={mp}
                    type="button"
                    onClick={() => setEditMovement(editMovement === mp ? "" : mp)}
                    className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${editMovement === mp ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {capitalize(mp)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Equipment</p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(eq => (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => setEditEquipment(eq)}
                    className={`text-sm px-3 py-2 rounded border transition-colors ${editEquipment === eq ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    data-testid={`button-equipment-${eq.toLowerCase()}`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEditDifficulty(d)}
                    className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${editDifficulty === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    data-testid={`button-difficulty-${d.toLowerCase()}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info tiles (view mode) */}
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Type</p>
              <p className="font-semibold text-base">{exercise.isCompound ? "Compound" : "Isolation"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {exercise.isCompound
                  ? "Works multiple muscle groups simultaneously"
                  : "Targets a single muscle group in isolation"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Laterality</p>
              <p className="font-semibold text-base">{exercise.isUnilateral ? "Unilateral" : "Bilateral"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {exercise.isUnilateral
                  ? "Each side works independently"
                  : "Both sides of the body work together"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Movement</p>
              <p className="font-semibold text-base">
                {exercise.movementPattern ? capitalize(exercise.movementPattern) : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {exercise.movementPattern ? `${capitalize(exercise.movementPattern)} movement` : "Movement pattern not specified"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Target Area</p>
              <p className="font-semibold text-base">{exercise.muscleGroup}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Equipment</p>
              <p className="font-semibold text-base">{exercise.equipment ?? "Other"}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Difficulty</p>
              <p className="font-semibold text-base">{exercise.difficulty ?? "Intermediate"}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Category</p>
              <p className="font-semibold text-base">
                {CARDIO_GROUPS.has(exercise.muscleGroup)
                  ? "Cardio"
                  : MOBILITY_GROUPS.has(exercise.muscleGroup)
                  ? "Mobility"
                  : "Strength"}
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="rounded-xl border bg-card p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</p>
          {editing ? (
            <Textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={3}
              placeholder="Describe this exercise…"
              data-testid="textarea-edit-exercise-description"
            />
          ) : (
            <p className="text-base leading-relaxed">
              {exercise.description || <span className="text-muted-foreground italic">No description</span>}
            </p>
          )}
        </div>

        {/* Video section */}
        <div className="rounded-xl border bg-card p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Video className="w-3.5 h-3.5" /> Video
            </p>
            <VideoUploadButton exerciseId={exercise.id} onUploadComplete={handleVideoUploaded} />
          </div>

          {/* Video player */}
          {videoSrc ? (
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              className="w-full rounded-lg max-h-80 bg-black"
              data-testid="exercise-video-player"
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">No video yet — upload one above.</p>
          )}
        </div>

        {/* Edit mode actions */}
        {editing && (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={saveEdit}
              disabled={updateExercise.isPending || !editName.trim() || !editMuscleGroup.trim()}
              data-testid="button-save-exercise"
            >
              {updateExercise.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={updateExercise.isPending}
              data-testid="button-cancel-edit-exercise"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Exercises() {
  const { data: exercises, isLoading, isError, refetch, isFetching } = useListExercises();
  const createExercise = useCreateExercise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("target");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      name: "", muscleGroup: "", isCompound: false, isUnilateral: false,
      movementPattern: "", description: "", equipment: "Other", difficulty: "Intermediate",
    },
  });

  const onSubmit = (values: z.infer<typeof exerciseSchema>) => {
    createExercise.mutate({
      data: {
        name: values.name,
        muscleGroup: values.muscleGroup,
        isCompound: values.isCompound,
        isUnilateral: values.isUnilateral,
        movementPattern: values.movementPattern || undefined,
        description: values.description || undefined,
        equipment: values.equipment,
        difficulty: values.difficulty,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        setDialogOpen(false);
        form.reset();
        toast({ title: "Exercise created" });
      },
    });
  };

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscleGroup.toLowerCase().includes(search.toLowerCase())
  ) as Exercise[] | undefined;

  const groups = filtered ? groupExercises(filtered, sortBy) : [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Exercise Library</h1>
            <p className="text-muted-foreground mt-1">{exercises?.length ?? 0} exercises</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-exercise"><Plus className="w-4 h-4 mr-2" /> Add Exercise</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-exercise-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="muscleGroup" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Muscle Group</FormLabel>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {MUSCLE_GROUPS.map(mg => (
                          <button key={mg} type="button"
                            onClick={() => form.setValue("muscleGroup", mg)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${field.value === mg ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{mg}</button>
                        ))}
                      </div>
                      <FormControl><Input {...field} placeholder="Or type custom group" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isCompound" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <div className="flex gap-2">
                        {[{ label: "Compound", val: true }, { label: "Isolation", val: false }].map(opt => (
                          <button key={opt.label} type="button"
                            onClick={() => form.setValue("isCompound", opt.val)}
                            className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value === opt.val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isUnilateral" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laterality</FormLabel>
                      <div className="flex gap-2">
                        {[{ label: "Bilateral", val: false }, { label: "Unilateral", val: true }].map(opt => (
                          <button key={opt.label} type="button"
                            onClick={() => form.setValue("isUnilateral", opt.val)}
                            className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value === opt.val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="movementPattern" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Movement Pattern</FormLabel>
                      <div className="flex gap-2">
                        {["bilateral", "unilateral"].map(mp => (
                          <button key={mp} type="button"
                            onClick={() => form.setValue("movementPattern", field.value === mp ? "" : mp)}
                            className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value === mp ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{capitalize(mp)}</button>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="equipment" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {EQUIPMENT_OPTIONS.map(eq => (
                          <button key={eq} type="button"
                            onClick={() => form.setValue("equipment", eq)}
                            className={`text-sm px-3 py-2 rounded border transition-colors ${field.value === eq ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{eq}</button>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="difficulty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <div className="flex gap-2">
                        {DIFFICULTY_OPTIONS.map(d => (
                          <button key={d} type="button"
                            onClick={() => form.setValue("difficulty", d)}
                            className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >{d}</button>
                        ))}
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createExercise.isPending}>Add</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Toolbar */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-9"
              data-testid="input-search-exercise"
            />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortMode)}>
            <SelectTrigger className="w-[200px]" data-testid="select-sort-by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="target">Target area</SelectItem>
              <SelectItem value="compound">Compound vs. Isolation</SelectItem>
              <SelectItem value="movement">Unilateral vs. Bilateral</SelectItem>
              <SelectItem value="cardio">Cardio</SelectItem>
              <SelectItem value="mobility">Mobility</SelectItem>
              <SelectItem value="strength">Strength</SelectItem>
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[130px]" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">
                <span className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Grid</span>
              </SelectItem>
              <SelectItem value="list">
                <span className="flex items-center gap-2"><List className="w-4 h-4" /> List</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading...</p>}

        {isError && (
          <QueryErrorState
            message="Couldn't load exercises. This is usually temporary."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            testId="button-retry-exercises"
          />
        )}

        {!isError && groups.length > 0 && groups.map(([groupName, exs]) => (
          <div key={groupName}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {groupName}
              <span className="ml-2 font-normal normal-case tracking-normal">({exs.length})</span>
            </h2>
            {viewMode === "grid" ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {exs.map(e => (
                  <Card
                    key={e.id}
                    data-testid={`card-exercise-${e.id}`}
                    onClick={() => setSelectedExercise(e)}
                    className="border-2 border-purple-500/40 hover:border-purple-500/70 transition-colors cursor-pointer hover:shadow-sm"
                  >
                    <CardContent className="pt-4 pb-4 px-5">
                      <p className="font-semibold text-base">{e.name}</p>
                      {e.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                      <div className="flex items-center justify-between mt-3">
                        <ExerciseBadges exercise={e} size="xs" />
                        {e.videoUrl && <Video className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {exs.map(e => (
                  <div
                    key={e.id}
                    data-testid={`row-exercise-${e.id}`}
                    onClick={() => setSelectedExercise(e)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.name}</p>
                      <p className="text-sm text-muted-foreground">{e.muscleGroup}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExerciseBadges exercise={e} size="xs" />
                      {e.videoUrl && <Video className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered?.length === 0 && !isLoading && !isError && (
          <p className="text-muted-foreground text-sm text-center py-8">No exercises match your search.</p>
        )}

        {groups.length === 0 && filtered && filtered.length > 0 && !isLoading && !isError && (
          <p className="text-muted-foreground text-sm text-center py-8">No exercises in this category.</p>
        )}
      </div>

      {selectedExercise && (
        <ExerciseDetailPanel
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          onUpdate={(updated) => setSelectedExercise(updated)}
        />
      )}
    </>
  );
}
