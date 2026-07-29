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
  Dumbbell, Pencil, Upload, Video, Loader2, SlidersHorizontal, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QueryErrorState } from "@/components/query-error-state";

type SortMode = "target" | "compound" | "movement" | "cardio" | "mobility" | "strength";
type ViewMode = "grid" | "list";

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().min(1),
  isCompound: z.boolean().optional(),
  movementPattern: z.string().optional(),
  description: z.string().optional(),
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
  movementPattern?: string | null;
  description?: string | null;
  videoUrl?: string | null;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupExercises(exercises: Exercise[], sortBy: SortMode[]): [string, Exercise[]][] {
  const criteria = sortBy.length === 0 ? ["target" as SortMode] : sortBy;

  // 1. Filter criteria narrow the pool (union — show all selected categories)
  const filterModes = criteria.filter(m => m === "cardio" || m === "mobility" || m === "strength");
  let pool = exercises;
  if (filterModes.length > 0) {
    pool = exercises.filter(e =>
      filterModes.some(mode => {
        if (mode === "cardio") return CARDIO_GROUPS.has(e.muscleGroup);
        if (mode === "mobility") return MOBILITY_GROUPS.has(e.muscleGroup);
        if (mode === "strength") return !CARDIO_GROUPS.has(e.muscleGroup) && !MOBILITY_GROUPS.has(e.muscleGroup);
        return false;
      })
    );
  }

  // 2. Primary grouping = first grouping-type criterion (target/compound/movement)
  const groupModes = criteria.filter(m => m === "target" || m === "compound" || m === "movement");
  const primaryGroup: SortMode = groupModes[0] ?? (filterModes.length === 0 ? "target" : null as any);

  let groups: [string, Exercise[]][];
  if (!primaryGroup || primaryGroup === "target") {
    const map: Record<string, Exercise[]> = {};
    for (const e of pool) (map[e.muscleGroup] ??= []).push(e);
    groups = Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
  } else if (primaryGroup === "compound") {
    const compound: Exercise[] = [], isolation: Exercise[] = [];
    for (const e of pool) (e.isCompound ? compound : isolation).push(e);
    groups = [];
    if (compound.length) groups.push(["Compound", compound]);
    if (isolation.length) groups.push(["Isolation", isolation]);
  } else if (primaryGroup === "movement") {
    const bilateral: Exercise[] = [], unilateral: Exercise[] = [], other: Exercise[] = [];
    for (const e of pool) {
      const mp = e.movementPattern?.toLowerCase();
      if (mp === "bilateral") bilateral.push(e);
      else if (mp === "unilateral") unilateral.push(e);
      else other.push(e);
    }
    groups = [];
    if (bilateral.length) groups.push(["Bilateral", bilateral]);
    if (unilateral.length) groups.push(["Unilateral", unilateral]);
    if (other.length) groups.push(["Other", other]);
  } else {
    groups = [["All", pool]];
  }

  // 3. Secondary grouping criteria are applied as intra-group sort
  const secondaryCriteria = groupModes.slice(1);
  if (secondaryCriteria.length > 0) {
    groups = groups.map(([name, exs]) => {
      let sorted = [...exs];
      for (const sec of secondaryCriteria) {
        if (sec === "compound") {
          sorted.sort((a, b) => (a.isCompound ? 0 : 1) - (b.isCompound ? 0 : 1));
        } else if (sec === "movement") {
          const ord: Record<string, number> = { bilateral: 0, unilateral: 1 };
          sorted.sort((a, b) => (ord[a.movementPattern?.toLowerCase() ?? ""] ?? 2) - (ord[b.movementPattern?.toLowerCase() ?? ""] ?? 2));
        } else if (sec === "target") {
          sorted.sort((a, b) => groupOrder(a.muscleGroup) - groupOrder(b.muscleGroup) || a.name.localeCompare(b.name));
        }
      }
      return [name, sorted] as [string, Exercise[]];
    });
  }

  return groups;
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
  const [editMovement, setEditMovement] = useState(exercise.movementPattern ?? "");
  const [editDescription, setEditDescription] = useState(exercise.description ?? "");

  const updateExercise = useUpdateExercise();
  const { toast } = useToast();
  const qc = useQueryClient();

  function startEdit() {
    setEditName(exercise.name);
    setEditMuscleGroup(exercise.muscleGroup);
    setEditIsCompound(exercise.isCompound);
    setEditMovement(exercise.movementPattern ?? "");
    setEditDescription(exercise.description ?? "");
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
          movementPattern: editMovement || null,
          description: editDescription || null,
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
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Movement</p>
              <p className="font-semibold text-base">
                {exercise.movementPattern ? capitalize(exercise.movementPattern) : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {exercise.movementPattern === "bilateral"
                  ? "Both sides of the body work together"
                  : exercise.movementPattern === "unilateral"
                  ? "Each side works independently"
                  : "Movement pattern not specified"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Target Area</p>
              <p className="font-semibold text-base">{exercise.muscleGroup}</p>
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
            <VideoUploadButton
              exerciseId={exercise.id}
              onUploadComplete={handleVideoUploaded}
            />
          </div>
          {videoSrc ? (
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              className="w-full rounded-lg max-h-80 bg-black"
              data-testid="exercise-video-player"
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">No video yet — upload one using the button above.</p>
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
  const [sortBy, setSortBy] = useState<SortMode[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingSort, setPendingSort] = useState<SortMode[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { name: "", muscleGroup: "", isCompound: false, movementPattern: "", description: "" },
  });

  const onSubmit = (values: z.infer<typeof exerciseSchema>) => {
    createExercise.mutate({
      data: {
        name: values.name,
        muscleGroup: values.muscleGroup,
        isCompound: values.isCompound,
        movementPattern: values.movementPattern || undefined,
        description: values.description || undefined,
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
  const isFiltered = sortBy.length > 0;

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
          <button
            onClick={() => { setPendingSort(sortBy); setFilterOpen(true); }}
            data-testid="button-filter-exercises"
            className={cn(
              "flex items-center gap-1.5 px-3 h-10 rounded-md border text-sm font-medium transition-colors",
              isFiltered
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Sort
            {isFiltered && (
              <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {sortBy.length}
              </span>
            )}
          </button>

          {/* Filter sheet */}
          {filterOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-end"
              onClick={() => setFilterOpen(false)}
            >
              <div
                className="w-full bg-background border-t border-border rounded-t-3xl pb-10 px-5 pt-5 space-y-4 animate-in slide-in-from-bottom duration-200"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">Sort exercises</h3>
                  <button onClick={() => setFilterOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sort by — select multiple</p>
                  {(["target","compound","movement","cardio","mobility","strength"] as SortMode[]).map(val => {
                    const labels: Record<SortMode, string> = {
                      target: "Target area",
                      compound: "Compound vs. Isolation",
                      movement: "Unilateral vs. Bilateral",
                      cardio: "Cardio only",
                      mobility: "Mobility only",
                      strength: "Strength only",
                    };
                    const idx = pendingSort.indexOf(val);
                    const isSelected = idx >= 0;
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          if (isSelected) setPendingSort(pendingSort.filter(v => v !== val));
                          else setPendingSort([...pendingSort, val]);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors",
                          isSelected ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50"
                        )}
                      >
                        {labels[val]}
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => { setPendingSort([]); setSortBy([]); setFilterOpen(false); }}
                    className="py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => { setSortBy(pendingSort); setFilterOpen(false); }}
                    className="py-3 rounded-2xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
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
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
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
