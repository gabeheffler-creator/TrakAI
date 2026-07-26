import { useState, useMemo } from "react";
import { useListExercises } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowLeft, ExternalLink, LayoutGrid, List } from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";

// ─── Types ────────────────────────────────────────────────────────────────────

type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  isCompound?: boolean;
  movementPattern?: string | null;
  description?: string | null;
  videoUrl?: string | null;
};

type SortMode = "target" | "name" | "compound" | "isolation";
type ViewMode = "grid" | "list";
type CategoryFilter = "all" | "strength" | "cardio" | "mobility" | "hiit";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDIO_GROUPS = new Set(["Cardio", "HIIT"]);
const MOBILITY_GROUPS = new Set(["Mobility"]);
const HIIT_GROUPS = new Set(["HIIT"]);

const GROUP_ORDER: Record<string, number> = {
  Chest: 1, Back: 2, Shoulders: 3, Biceps: 4, Triceps: 5, Traps: 6,
  Legs: 7, Glutes: 8, Core: 9, "Full Body": 10,
  Cardio: 97, HIIT: 98, Mobility: 99,
};
function groupOrder(g: string) { return GROUP_ORDER[g] ?? 50; }

const CATEGORY_CHIPS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "strength", label: "Strength" },
  { id: "cardio", label: "Cardio" },
  { id: "mobility", label: "Mobility" },
  { id: "hiit", label: "HIIT" },
];

function matchesCategory(e: Exercise, cat: CategoryFilter): boolean {
  if (cat === "all") return true;
  if (cat === "cardio") return CARDIO_GROUPS.has(e.muscleGroup);
  if (cat === "hiit") return HIIT_GROUPS.has(e.muscleGroup);
  if (cat === "mobility") return MOBILITY_GROUPS.has(e.muscleGroup);
  // strength = everything that isn't cardio, hiit, or mobility
  return !CARDIO_GROUPS.has(e.muscleGroup) && !MOBILITY_GROUPS.has(e.muscleGroup);
}

// ─── Detail overlay ───────────────────────────────────────────────────────────

function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 py-4 sticky top-0 bg-background border-b border-border mb-6">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1 truncate">{exercise.name}</h1>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="secondary" className="text-sm">
            {exercise.muscleGroup}
          </Badge>
          {exercise.isCompound !== undefined && (
            <Badge
              variant="outline"
              className={exercise.isCompound
                ? "border-violet-400 text-violet-700 dark:text-violet-300"
                : "border-sky-400 text-sky-700 dark:text-sky-300"}
            >
              {exercise.isCompound ? "Compound" : "Isolation"}
            </Badge>
          )}
          {exercise.movementPattern && (
            <Badge variant="outline" className="text-muted-foreground">
              {exercise.movementPattern}
            </Badge>
          )}
        </div>

        {/* Description */}
        {exercise.description && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Description
            </h2>
            <p className="text-sm leading-relaxed text-foreground">{exercise.description}</p>
          </div>
        )}

        {/* Video link */}
        {exercise.videoUrl && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Video
            </h2>
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Watch demonstration
            </a>
          </div>
        )}

        {!exercise.description && !exercise.videoUrl && (
          <p className="text-sm text-muted-foreground italic">No additional details available for this exercise.</p>
        )}
      </div>
    </div>
  );
}

// ─── Exercise card (grid) ─────────────────────────────────────────────────────

function ExerciseCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="border-2 border-purple-500/40 hover:border-purple-500/70 transition-colors cursor-pointer"
    >
      <CardContent className="pt-4 pb-4 px-5">
        <p className="font-semibold text-base">{exercise.name}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {exercise.isCompound !== undefined && (
            <span className="text-xs text-muted-foreground">
              {exercise.isCompound ? "Compound" : "Isolation"}
            </span>
          )}
          {exercise.movementPattern && (
            <span className="text-xs text-muted-foreground">· {exercise.movementPattern}</span>
          )}
        </div>
        {exercise.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{exercise.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Exercise row (list) ──────────────────────────────────────────────────────

function ExerciseRow({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{exercise.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {exercise.muscleGroup}
          {exercise.isCompound !== undefined && ` · ${exercise.isCompound ? "Compound" : "Isolation"}`}
        </p>
      </div>
      <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LS_VIEW_KEY = "trak-exercises-view";

export function ExercisesPage() {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("target");
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(LS_VIEW_KEY) as ViewMode | null) ?? "grid"
  );
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<Exercise | null>(null);

  const { data: exercises, isLoading, isError, refetch, isFetching } = useListExercises();

  function handleViewMode(v: ViewMode) {
    setViewMode(v);
    localStorage.setItem(LS_VIEW_KEY, v);
  }

  // 1. filter by search + category
  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    return exercises.filter(e =>
      matchesCategory(e as Exercise, category) &&
      (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      )
    );
  }, [exercises, search, category]);

  // 2. sort / group
  const isGrouped = sortMode === "target";

  const grouped = useMemo(() => {
    if (!isGrouped) return null;
    return filtered.reduce<Record<string, Exercise[]>>((acc, e) => {
      (acc[e.muscleGroup] ??= []).push(e as Exercise);
      return acc;
    }, {});
  }, [filtered, isGrouped]);

  const flat = useMemo(() => {
    if (isGrouped) return null;
    const arr = [...filtered] as Exercise[];
    if (sortMode === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "compound") {
      arr.sort((a, b) => {
        const ac = a.isCompound ? 0 : 1;
        const bc = b.isCompound ? 0 : 1;
        return ac - bc || a.name.localeCompare(b.name);
      });
    } else if (sortMode === "isolation") {
      arr.sort((a, b) => {
        const ac = a.isCompound ? 1 : 0;
        const bc = b.isCompound ? 1 : 0;
        return ac - bc || a.name.localeCompare(b.name);
      });
    }
    return arr;
  }, [filtered, sortMode, isGrouped]);

  const renderExercise = (e: Exercise) =>
    viewMode === "grid"
      ? <ExerciseCard key={e.id} exercise={e} onClick={() => setSelected(e)} />
      : <ExerciseRow key={e.id} exercise={e} onClick={() => setSelected(e)} />;

  return (
    <>
      {selected && (
        <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} />
      )}

      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Exercise Library</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{exercises?.length ?? 0} exercises</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              className="h-9 w-9"
              onClick={() => handleViewMode("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              className="h-9 w-9"
              onClick={() => handleViewMode("list")}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search + sort row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-9"
            />
          </div>
          <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="target">Target muscle</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="compound">Compound first</SelectItem>
              <SelectItem value="isolation">Isolation first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORY_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setCategory(chip.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                category === chip.id
                  ? "bg-violet-600 text-white border-violet-600"
                  : "border-border text-muted-foreground hover:border-violet-400 hover:text-foreground"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* States */}
        {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

        {isError && (
          <QueryErrorState
            message="Couldn't load exercises. This is usually temporary."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            testId="button-retry-exercises"
          />
        )}

        {/* Grouped (Target muscle sort) */}
        {!isError && isGrouped && grouped && (
          <div className="space-y-6">
            {Object.entries(grouped)
              .sort(([a], [b]) => groupOrder(a) - groupOrder(b))
              .map(([group, exs]) => (
                <div key={group}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    {group}
                  </h2>
                  <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
                    {exs.map(e => renderExercise(e))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Flat (Name / Compound / Isolation sort) */}
        {!isError && !isGrouped && flat && flat.length > 0 && (
          <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
            {flat.map(e => renderExercise(e))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No exercises match your search.
          </p>
        )}
      </div>
    </>
  );
}
