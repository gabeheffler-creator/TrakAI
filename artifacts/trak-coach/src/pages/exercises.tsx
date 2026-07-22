import { useState } from "react";
import { useListExercises, useCreateExercise, getListExercisesQueryKey } from "@workspace/api-client-react";
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
import { Plus, Search, LayoutGrid, List, X, ChevronRight, Dumbbell } from "lucide-react";
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
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupExercises(exercises: Exercise[], sortBy: SortMode): [string, Exercise[]][] {
  switch (sortBy) {
    case "target": {
      const map: Record<string, Exercise[]> = {};
      for (const e of exercises) {
        (map[e.muscleGroup] ??= []).push(e);
      }
      return Object.entries(map).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
    }
    case "compound": {
      const compound: Exercise[] = [];
      const isolation: Exercise[] = [];
      for (const e of exercises) {
        if (e.isCompound) compound.push(e);
        else isolation.push(e);
      }
      const result: [string, Exercise[]][] = [];
      if (compound.length) result.push(["Compound", compound]);
      if (isolation.length) result.push(["Isolation", isolation]);
      return result;
    }
    case "movement": {
      const bilateral: Exercise[] = [];
      const unilateral: Exercise[] = [];
      const other: Exercise[] = [];
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
    </div>
  );
}

function ExerciseDetailPanel({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" data-testid="exercise-detail-panel">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex justify-end mb-6">
          <button
            onClick={onClose}
            data-testid="button-close-exercise-detail"
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Dumbbell className="w-7 h-7 text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
            <p className="text-muted-foreground mt-1">{exercise.muscleGroup}</p>
          </div>
        </div>

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

        {exercise.description && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</p>
            <p className="text-base leading-relaxed">{exercise.description}</p>
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
                          <button
                            key={mg}
                            type="button"
                            onClick={() => form.setValue("muscleGroup", mg)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${field.value === mg ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >
                            {mg}
                          </button>
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
                        <button
                          type="button"
                          onClick={() => form.setValue("isCompound", true)}
                          className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        >
                          Compound
                        </button>
                        <button
                          type="button"
                          onClick={() => form.setValue("isCompound", false)}
                          className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${!field.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        >
                          Isolation
                        </button>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="movementPattern" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Movement Pattern</FormLabel>
                      <div className="flex gap-2">
                        {["bilateral", "unilateral"].map(mp => (
                          <button
                            key={mp}
                            type="button"
                            onClick={() => form.setValue("movementPattern", field.value === mp ? "" : mp)}
                            className={`flex-1 text-sm px-3 py-2 rounded border transition-colors ${field.value === mp ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                          >
                            {capitalize(mp)}
                          </button>
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
                      <div className="mt-3">
                        <ExerciseBadges exercise={e} size="xs" />
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
                    <ExerciseBadges exercise={e} size="xs" />
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
        />
      )}
    </>
  );
}
