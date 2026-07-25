import { useState, useMemo } from "react";
import { useListExercises } from "@workspace/api-client-react";
import type { Exercise } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink, LayoutList, LayoutGrid, X } from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ORDER: Record<string, number> = {
  Chest: 1, Back: 2, Shoulders: 3, Biceps: 4, Triceps: 5, Traps: 6,
  Legs: 7, Glutes: 8, Core: 9, "Full Body": 10,
  Cardio: 97, HIIT: 98, Mobility: 99,
};
function groupOrder(g: string) { return GROUP_ORDER[g] ?? 50; }

const MOVEMENT_ORDER: Record<string, number> = {
  Push: 1, Pull: 2, Hinge: 3, Squat: 4, Carry: 5,
};
function movementOrder(m: string | null | undefined) { return MOVEMENT_ORDER[m ?? ""] ?? 99; }

const DIFFICULTY_ORDER: Record<string, number> = {
  Beginner: 1, Intermediate: 2, Advanced: 3,
};

const CARDIO_GROUPS = new Set(["Cardio", "HIIT"]);
const MOBILITY_GROUPS = new Set(["Mobility"]);

const EQUIPMENT_OPTIONS = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Bands", "Other"] as const;
type EquipmentFilter = typeof EQUIPMENT_OPTIONS[number] | "all";

type FilterMode = "all" | "strength" | "cardio" | "mobility";
type SortMode =
  | "default"
  | "name-asc"
  | "name-desc"
  | "target-area"
  | "compound-first"
  | "isolation-first"
  | "movement"
  | "unilateral-first"
  | "bilateral-first"
  | "beginner-first"
  | "advanced-first";
type ViewMode = "list" | "grid";

const VIEW_STORAGE_KEY = "trak-exercises-view";
const SORT_STORAGE_KEY = "trak-exercises-sort";

// ─── Exercise Detail ──────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ExerciseDetailContent({ exercise }: { exercise: Exercise }) {
  const equipment = (exercise as any).equipment as string | undefined;
  const difficulty = (exercise as any).difficulty as string | undefined;

  return (
    <div className="space-y-5 px-1">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold leading-tight">{exercise.name}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {exercise.muscleGroup}
          </span>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            exercise.isCompound
              ? "bg-violet-500/10 text-violet-600"
              : "bg-amber-500/10 text-amber-600"
          )}>
            {exercise.isCompound ? "Compound" : "Isolation"}
          </span>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            exercise.isUnilateral
              ? "bg-sky-500/10 text-sky-600"
              : "bg-muted text-muted-foreground"
          )}>
            {exercise.isUnilateral ? "Unilateral" : "Bilateral"}
          </span>
          {equipment && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
              {equipment}
            </span>
          )}
          {difficulty && (
            <span className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full",
              difficulty === "Beginner" ? "bg-green-500/10 text-green-700"
              : difficulty === "Advanced" ? "bg-red-500/10 text-red-700"
              : "bg-muted text-muted-foreground"
            )}>
              {difficulty}
            </span>
          )}
          {exercise.movementPattern && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {exercise.movementPattern}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {exercise.description && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Description</p>
          <p className="text-sm leading-relaxed">{exercise.description}</p>
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <DetailField label="Target muscle" value={exercise.muscleGroup} />
        <DetailField label="Type" value={exercise.isCompound ? "Compound" : "Isolation"} />
        <DetailField label="Laterality" value={exercise.isUnilateral ? "Unilateral" : "Bilateral"} />
        {equipment && <DetailField label="Equipment" value={equipment} />}
        {difficulty && <DetailField label="Difficulty" value={difficulty} />}
        {exercise.movementPattern && (
          <DetailField label="Movement pattern" value={exercise.movementPattern} />
        )}
      </div>

      {/* Video link */}
      {exercise.videoUrl && (
        <a
          href={exercise.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline pt-1"
        >
          <ExternalLink className="w-4 h-4" />
          Watch demo video
        </a>
      )}
    </div>
  );
}

interface ExerciseDetailProps {
  exercise: Exercise | null;
  onClose: () => void;
  isMobile: boolean;
}

function ExerciseDetail({ exercise, onClose, isMobile }: ExerciseDetailProps) {
  if (!exercise) return null;

  if (isMobile) {
    return (
      <Sheet open={!!exercise} onOpenChange={open => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-8">
          <div className="pt-2 pb-4">
            <ExerciseDetailContent exercise={exercise} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!exercise} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <ExerciseDetailContent exercise={exercise} />
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label}
    </button>
  );
}

// ─── ExercisesPage ────────────────────────────────────────────────────────────

function useIsMobile() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

interface ExercisesPageProps {
  swapMode?: boolean;
  onSwapSelect?: (ex: Exercise) => void;
  onCancelSwap?: () => void;
}

export function ExercisesPage({ swapMode = false, onSwapSelect, onCancelSwap }: ExercisesPageProps = {}) {
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all");
  const [sortBy, setSortBy] = useState<SortMode>(() => {
    try { return (localStorage.getItem(SORT_STORAGE_KEY) as SortMode) ?? "default"; } catch { return "default"; }
  });
  const [view, setView] = useState<ViewMode>(() => {
    try { return (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) ?? "list"; } catch { return "list"; }
  });
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [swapCandidate, setSwapCandidate] = useState<Exercise | null>(null);

  const { data: exercises, isLoading, isError, refetch, isFetching } = useListExercises();

  function handleViewChange(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch {}
  }

  function handleSortChange(s: SortMode) {
    setSortBy(s);
    try { localStorage.setItem(SORT_STORAGE_KEY, s); } catch {}
  }

  // 1. Search
  const searched = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    if (!q) return exercises;
    return exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.muscleGroup.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      (e.movementPattern ?? "").toLowerCase().includes(q)
    );
  }, [exercises, search]);

  // 2. Filter
  const filtered = useMemo(() => {
    let result = searched;

    // Category filter
    if (filter === "cardio") result = result.filter(e => CARDIO_GROUPS.has(e.muscleGroup));
    else if (filter === "mobility") result = result.filter(e => MOBILITY_GROUPS.has(e.muscleGroup));
    else if (filter === "strength") result = result.filter(e => !CARDIO_GROUPS.has(e.muscleGroup) && !MOBILITY_GROUPS.has(e.muscleGroup));

    // Equipment filter
    if (equipmentFilter !== "all") {
      result = result.filter(e => ((e as any).equipment ?? "Other") === equipmentFilter);
    }

    // Difficulty filter
    if (difficultyFilter !== "all") {
      result = result.filter(e => ((e as any).difficulty ?? "Intermediate") === difficultyFilter);
    }

    return result;
  }, [searched, filter, equipmentFilter, difficultyFilter]);

  // 3. Sort + group
  const display = useMemo(() => {
    const showGroups = view === "list" && sortBy === "default";

    if (showGroups) {
      const grouped = filtered.reduce<Record<string, Exercise[]>>((acc, e) => {
        (acc[e.muscleGroup] ??= []).push(e);
        return acc;
      }, {});
      return { mode: "grouped" as const, grouped };
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "default":
          { const go = groupOrder(a.muscleGroup) - groupOrder(b.muscleGroup);
            return go !== 0 ? go : a.name.localeCompare(b.name); }
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "target-area": {
          const mg = a.muscleGroup.localeCompare(b.muscleGroup);
          return mg !== 0 ? mg : a.name.localeCompare(b.name);
        }
        case "compound-first":
          if (a.isCompound !== b.isCompound) return a.isCompound ? -1 : 1;
          return a.name.localeCompare(b.name);
        case "isolation-first":
          if (a.isCompound !== b.isCompound) return a.isCompound ? 1 : -1;
          return a.name.localeCompare(b.name);
        case "unilateral-first":
          if (a.isUnilateral !== b.isUnilateral) return a.isUnilateral ? -1 : 1;
          return a.name.localeCompare(b.name);
        case "bilateral-first":
          if (a.isUnilateral !== b.isUnilateral) return a.isUnilateral ? 1 : -1;
          return a.name.localeCompare(b.name);
        case "movement": {
          const mo = movementOrder(a.movementPattern) - movementOrder(b.movementPattern);
          return mo !== 0 ? mo : a.name.localeCompare(b.name);
        }
        case "beginner-first": {
          const da = DIFFICULTY_ORDER[((a as any).difficulty ?? "Intermediate")] ?? 2;
          const db = DIFFICULTY_ORDER[((b as any).difficulty ?? "Intermediate")] ?? 2;
          return da !== db ? da - db : a.name.localeCompare(b.name);
        }
        case "advanced-first": {
          const da = DIFFICULTY_ORDER[((a as any).difficulty ?? "Intermediate")] ?? 2;
          const db = DIFFICULTY_ORDER[((b as any).difficulty ?? "Intermediate")] ?? 2;
          return da !== db ? db - da : a.name.localeCompare(b.name);
        }
        default: return 0;
      }
    });
    return { mode: "flat" as const, sorted };
  }, [filtered, sortBy, view]);

  const totalShown = display.mode === "grouped"
    ? Object.values(display.grouped).reduce((s, arr) => s + arr.length, 0)
    : display.sorted.length;

  function renderCard(e: Exercise) {
    const equipment = (e as any).equipment as string | undefined;
    const difficulty = (e as any).difficulty as string | undefined;
    const isCandidate = swapMode && swapCandidate?.id === e.id;
    return (
      <Card
        key={e.id}
        className={cn(
          "border-2 transition-colors cursor-pointer active:scale-[0.98]",
          isCandidate
            ? "border-primary bg-primary/5"
            : "border-purple-500/40 hover:border-purple-500/70"
        )}
        onClick={() => {
          if (swapMode) {
            setSwapCandidate(isCandidate ? null : e);
          } else {
            setSelected(e);
          }
        }}
      >
        <CardContent className="pt-4 pb-4 px-5">
          <p className="font-semibold text-base leading-snug">{e.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {sortBy !== "target-area" && sortBy !== "default" && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {e.muscleGroup}
              </span>
            )}
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              e.isCompound ? "bg-violet-500/10 text-violet-600" : "bg-amber-500/10 text-amber-600"
            )}>
              {e.isCompound ? "Compound" : "Isolation"}
            </span>
            {equipment && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                {equipment}
              </span>
            )}
            {difficulty && (
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                difficulty === "Beginner" ? "bg-green-500/10 text-green-700"
                : difficulty === "Advanced" ? "bg-red-500/10 text-red-700"
                : "bg-muted text-muted-foreground"
              )}>
                {difficulty}
              </span>
            )}
            {e.movementPattern && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {e.movementPattern}
              </span>
            )}
          </div>
          {e.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{e.description}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!swapMode && <ExerciseDetail exercise={selected} onClose={() => setSelected(null)} isMobile={isMobile} />}

      <div className={cn("space-y-4", swapMode && swapCandidate ? "pb-24" : "")}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">{swapMode ? "Swap Exercise" : "Exercise Library"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {swapMode
                ? (swapCandidate ? `Selected: ${swapCandidate.name}` : "Tap an exercise to select it")
                : (isLoading ? "Loading…" : `${totalShown} exercise${totalShown !== 1 ? "s" : ""}${totalShown !== (exercises?.length ?? 0) ? ` of ${exercises?.length ?? 0}` : ""}`)
              }
            </p>
          </div>

          {swapMode ? (
            <button
              onClick={onCancelSwap}
              className="p-2 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Cancel swap"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            /* View toggle */
            <Select value={view} onValueChange={v => handleViewChange(v as ViewMode)}>
              <SelectTrigger className="w-[105px] h-9 text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">
                  <span className="flex items-center gap-1.5"><LayoutList className="w-3.5 h-3.5" /> List</span>
                </SelectItem>
                <SelectItem value="grid">
                  <span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> Grid</span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter row 1: Category + Sort */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0">
            {(["all", "strength", "cardio", "mobility"] as FilterMode[]).map(f => (
              <FilterChip
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                active={filter === f}
                onClick={() => setFilter(f)}
              />
            ))}
          </div>

          <Select value={sortBy} onValueChange={v => handleSortChange(v as SortMode)}>
            <SelectTrigger className="w-[148px] h-9 text-sm shrink-0">
              <SelectValue placeholder="Sort by…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="target-area">Target area</SelectItem>
              <SelectItem value="compound-first">Compound first</SelectItem>
              <SelectItem value="isolation-first">Isolation first</SelectItem>
              <SelectItem value="movement">Movement pattern</SelectItem>
              <SelectItem value="unilateral-first">Unilateral first</SelectItem>
              <SelectItem value="bilateral-first">Bilateral first</SelectItem>
              <SelectItem value="beginner-first">Beginner first</SelectItem>
              <SelectItem value="advanced-first">Advanced first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter row 2: Equipment + Difficulty */}
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <FilterChip
              label="All equipment"
              active={equipmentFilter === "all"}
              onClick={() => setEquipmentFilter("all")}
            />
            {EQUIPMENT_OPTIONS.map(eq => (
              <FilterChip
                key={eq}
                label={eq}
                active={equipmentFilter === eq}
                onClick={() => setEquipmentFilter(eq)}
              />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(["all", "Beginner", "Intermediate", "Advanced"] as const).map(d => (
              <FilterChip
                key={d}
                label={d === "all" ? "All levels" : d}
                active={difficultyFilter === d}
                onClick={() => setDifficultyFilter(d)}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {isError && (
          <QueryErrorState
            message="Couldn't load exercises. This is usually temporary."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            testId="button-retry-exercises"
          />
        )}

        {/* Content */}
        {!isError && (
          <>
            {display.mode === "grouped" ? (
              Object.entries(display.grouped)
                .sort(([a], [b]) => groupOrder(a) - groupOrder(b))
                .map(([group, exs]) => (
                  <div key={group}>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
                    <div className={cn(
                      "gap-3",
                      view === "grid" ? "grid grid-cols-2" : "grid sm:grid-cols-2"
                    )}>
                      {exs.map(renderCard)}
                    </div>
                  </div>
                ))
            ) : (
              <div className={cn(
                "gap-3",
                view === "grid" ? "grid grid-cols-2" : "grid sm:grid-cols-2"
              )}>
                {display.sorted.map(renderCard)}
              </div>
            )}

            {totalShown === 0 && !isLoading && (
              <p className="text-muted-foreground text-sm text-center py-8">
                No exercises match your search{filter !== "all" ? ` in ${filter}` : ""}.
              </p>
            )}
          </>
        )}
      </div>

      {/* Frozen swap action bar — appears when an exercise is selected in swap mode */}
      {swapMode && swapCandidate && (
        <div className="fixed bottom-0 left-0 right-0 z-[75] bg-background border-t border-border px-4 py-4 flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 h-12"
            onClick={() => setSwapCandidate(null)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-12 font-semibold"
            onClick={() => {
              onSwapSelect?.(swapCandidate);
              setSwapCandidate(null);
            }}
          >
            Swap
          </Button>
        </div>
      )}
    </>
  );
}
