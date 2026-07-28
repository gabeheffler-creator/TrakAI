import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useWorkoutPrefs } from "@/hooks/use-workout-prefs";
import { useClientId } from "@/hooks/use-client-id";
import {
  useGetClientProgramAssignment,
  useGetClientProgram,
  useCreateWorkoutLog,
  useUpdateWorkoutLog,
  useLogSet,
  useListExercises,
  useGetLatestSleepLog,
  useGetLastWorkoutPerformance,
  getGetLatestSleepLogQueryKey,
  getGetLastWorkoutPerformanceQueryKey,
  getListExercisesQueryKey,
  getGetClientProgramAssignmentQueryKey,
  getGetClientProgramQueryKey,
  getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronRight, Dumbbell, X, Trophy, ArrowRight, RefreshCw, Upload, FolderOpen, ImageIcon, Pencil, RotateCcw, Check, Moon, ArrowLeft, Search, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import type { Exercise } from "@workspace/api-client-react";
import { QueryErrorState } from "@/components/query-error-state";

type Mode = "select" | "checkin" | "overview" | "active" | "upload" | "done" | "early-exit-done";

interface SetState {
  targetReps: string;
  weight: string;
  reps: string;
  leftReps: string;
  rightReps: string;
  prevWeight: string;
  prevReps: string;
  isUnilateral: boolean;
  logged: boolean;
  rpe: number | null;
}

function decodeExMeta(raw: string | null | undefined): { laterality: string; equipment: string; grip: string } {
  if (!raw) return { laterality: "bilateral", equipment: "", grip: "" };
  const latMatch = raw.match(/@lat:(\S+)/);
  const equipMatch = raw.match(/@equip:(\S+)/);
  const gripMatch = raw.match(/@grip:(\S+)/);
  return {
    laterality: latMatch?.[1] === "uni" ? "unilateral" : "bilateral",
    equipment: equipMatch ? equipMatch[1].replace(/_/g, " ") : "",
    grip: gripMatch ? gripMatch[1].replace(/_/g, " ") : "",
  };
}

interface RpeModal {
  exIdx: number;
  setIdx: number;
}

function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>{label ?? `Exercise ${value} of ${total}`}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function playRing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1760, ctx.currentTime);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.4);
    osc.onended = () => ctx.close();
  } catch {}
}

function playConfirm() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const mk = (freq: number, start: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
      osc.start(start);
      osc.stop(start + 0.9);
    };
    mk(1760, t,        0.28);
    mk(1319, t + 0.18, 0.24);
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

function playSwipe() {
  try {
    const ctx = new AudioContext();
  } catch {}
}

function playWorkoutComplete() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // Ping layer — bright high C one octave up, very fast decay
    const ping = (freq: number, start: number, vol: number, decay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
      osc.start(start); osc.stop(start + decay + 0.05);
    };

    // C major 1-5-8: C6 → G6 → C7, 90ms apart
    ping(1046.50, t + 0.000, 0.26, 1.0); // C6 (1)
    ping(1567.98, t + 0.090, 0.26, 1.0); // G6 (5)
    ping(2093.00, t + 0.180, 0.30, 1.4); // C7 (8)

    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

const RPE_META: Record<number, { label: string; detail: string; color: string; bg: string; track: string }> = {
  1:  { label: "Very Easy",     detail: "Minimal effort — warm-up pace",           color: "text-emerald-600", bg: "bg-emerald-500",  track: "bg-emerald-400" },
  2:  { label: "Easy",          detail: "Light effort, could go all day",           color: "text-emerald-600", bg: "bg-emerald-500",  track: "bg-emerald-400" },
  3:  { label: "Moderate",      detail: "Comfortable, could do many more reps",     color: "text-emerald-600", bg: "bg-emerald-500",  track: "bg-emerald-400" },
  4:  { label: "Somewhat Hard", detail: "Starting to feel it, 6+ reps in reserve",  color: "text-lime-600",    bg: "bg-lime-500",     track: "bg-lime-400" },
  5:  { label: "Hard",          detail: "Solid effort, ~5 reps in reserve",         color: "text-yellow-600",  bg: "bg-yellow-500",   track: "bg-yellow-400" },
  6:  { label: "Hard",          detail: "Challenging, ~4 reps in reserve",          color: "text-yellow-600",  bg: "bg-yellow-500",   track: "bg-yellow-400" },
  7:  { label: "Very Hard",     detail: "Could only do 2–3 more reps",              color: "text-orange-600",  bg: "bg-orange-500",   track: "bg-orange-400" },
  8:  { label: "Very Hard",     detail: "1–2 reps left in the tank",                color: "text-orange-600",  bg: "bg-orange-500",   track: "bg-orange-400" },
  9:  { label: "Near Max",      detail: "Could barely squeeze out 1 more rep",      color: "text-red-600",     bg: "bg-red-500",      track: "bg-red-400" },
  10: { label: "Max Effort",    detail: "Absolute limit — nothing left",            color: "text-red-700",     bg: "bg-red-600",      track: "bg-red-500" },
};

function RpeBottomSheet({ open, onSelect, onCancel }: { open: boolean; onSelect: (rpe: number) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  // Reset selection whenever the sheet closes
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const display = selected ?? 7;
  const meta = RPE_META[display];

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onCancel}
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-3xl px-6 pt-4 pb-8 transition-transform duration-300 ease-out shadow-2xl max-h-[90vh] overflow-y-auto",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

        <h2 className="text-xl font-bold text-center">How hard was that?</h2>
        <p className="text-xs text-muted-foreground text-center mt-1 mb-4">Rate of Perceived Exertion</p>

        {/* Selected value display */}
        {selected !== null && (
          <div className="flex flex-col items-center mb-4">
            <span className={cn("text-5xl font-black tabular-nums leading-none transition-colors", meta.color)}>
              {display}
            </span>
            <span className={cn("text-sm font-semibold mt-1 transition-colors", meta.color)}>{meta.label}</span>
            <span className="text-xs text-muted-foreground mt-0.5 text-center px-4">{meta.detail}</span>
          </div>
        )}

        {/* RPE button grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
            const m = RPE_META[n];
            const isActive = n === selected;
            return (
              <button
                key={n}
                aria-label={`RPE ${n}`}
                onClick={() => setSelected(n)}
                className={cn(
                  "h-12 rounded-xl font-bold text-sm transition-all active:scale-95",
                  isActive ? m.bg + " text-white shadow-md scale-105" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground mb-4">
          <span>← Easy</span>
          <span>Max effort →</span>
        </div>

        {/* Actions */}
        <button
          onClick={() => { setSelected(null); onSelect(display); }}
          className={cn("w-full h-12 rounded-2xl font-semibold text-white text-sm transition-all active:scale-[.98]", meta.bg)}
        >
          Log RPE {display}
        </button>
        <button onClick={onCancel} className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          Skip
        </button>
      </div>
    </>,
    document.getElementById("root")!
  );
}

const SWAP_CARDIO_GROUPS = new Set(["Cardio", "HIIT"]);
const SWAP_MOBILITY_GROUPS = new Set(["Mobility"]);
const SWAP_HIIT_GROUPS = new Set(["HIIT"]);
const SWAP_GROUP_ORDER: Record<string, number> = {
  Chest: 1, Back: 2, Shoulders: 3, Biceps: 4, Triceps: 5, Traps: 6,
  Legs: 7, Glutes: 8, Core: 9, "Full Body": 10,
  Cardio: 97, HIIT: 98, Mobility: 99,
};
const SWAP_CATEGORY_CHIPS = [
  { id: "all" as const, label: "All" },
  { id: "strength" as const, label: "Strength" },
  { id: "cardio" as const, label: "Cardio" },
  { id: "mobility" as const, label: "Mobility" },
  { id: "hiit" as const, label: "HIIT" },
];
type SwapCategory = "all" | "strength" | "cardio" | "mobility" | "hiit";
type SwapSort = "target" | "name" | "compound" | "isolation";
type SwapView = "grid" | "list";

function matchesSwapCategory(e: Exercise, cat: SwapCategory): boolean {
  if (cat === "all") return true;
  if (cat === "cardio") return SWAP_CARDIO_GROUPS.has(e.muscleGroup);
  if (cat === "hiit") return SWAP_HIIT_GROUPS.has(e.muscleGroup);
  if (cat === "mobility") return SWAP_MOBILITY_GROUPS.has(e.muscleGroup);
  return !SWAP_CARDIO_GROUPS.has(e.muscleGroup) && !SWAP_MOBILITY_GROUPS.has(e.muscleGroup);
}

function SwapBrowser({
  currentExerciseName,
  allExercises,
  onSelect,
  onCancel,
}: {
  currentExerciseName: string;
  allExercises: Exercise[];
  onSelect: (ex: Exercise) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SwapSort>("target");
  const [viewMode, setViewMode] = useState<SwapView>(
    () => (localStorage.getItem("trak-exercises-view") as SwapView | null) ?? "grid"
  );
  const [category, setCategory] = useState<SwapCategory>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingSort, setPendingSort] = useState<SwapSort>("target");
  const [pendingCategory, setPendingCategory] = useState<SwapCategory>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allExercises.filter(e =>
      e.name !== currentExerciseName &&
      matchesSwapCategory(e, category) &&
      (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      )
    );
  }, [allExercises, search, category, currentExerciseName]);

  const isGrouped = sortMode === "target";

  const grouped = useMemo(() => {
    if (!isGrouped) return null;
    return filtered.reduce<Record<string, Exercise[]>>((acc, e) => {
      (acc[e.muscleGroup] ??= []).push(e);
      return acc;
    }, {});
  }, [filtered, isGrouped]);

  const flat = useMemo(() => {
    if (isGrouped) return null;
    const arr = [...filtered];
    if (sortMode === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "compound") arr.sort((a, b) => (a.isCompound ? 0 : 1) - (b.isCompound ? 0 : 1) || a.name.localeCompare(b.name));
    else if (sortMode === "isolation") arr.sort((a, b) => (a.isCompound ? 1 : 0) - (b.isCompound ? 1 : 0) || a.name.localeCompare(b.name));
    return arr;
  }, [filtered, sortMode, isGrouped]);

  const renderExercise = (e: Exercise) =>
    viewMode === "grid" ? (
      <button
        key={e.id}
        onClick={() => onSelect(e)}
        className="w-full text-left p-4 rounded-2xl border-2 border-purple-500/40 hover:border-purple-500/70 bg-card transition-colors cursor-pointer"
      >
        <p className="font-semibold text-base">{e.name}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {e.muscleGroup}{e.isCompound !== undefined && ` · ${e.isCompound ? "Compound" : "Isolation"}`}
        </p>
      </button>
    ) : (
      <button
        key={e.id}
        onClick={() => onSelect(e)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{e.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {e.muscleGroup}{e.isCompound !== undefined && ` · ${e.isCompound ? "Compound" : "Isolation"}`}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    );

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-3">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Swap Exercise</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} exercises</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search + Filter button */}
      <div className="px-4 pt-3 pb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="pl-9"
          />
        </div>
        <button
          onClick={() => { setPendingSort(sortMode); setPendingCategory(category); setFilterOpen(true); }}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3 h-10 rounded-lg border text-sm font-medium transition-colors",
            (sortMode !== "target" || category !== "all")
              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filter
          {(sortMode !== "target" || category !== "all") && (
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 ml-0.5" />
          )}
        </button>
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-[80] flex flex-col"
          onClick={() => setFilterOpen(false)}
        >
          <div className="flex-1" />
          <div
            className="bg-background border-t border-border rounded-t-3xl pb-10 px-5 pt-5 space-y-5 animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Filter & Sort</h3>
              <button onClick={() => setFilterOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sort by</p>
              {(["target", "name", "compound", "isolation"] as const).map(opt => {
                const labels: Record<string, string> = { target: "Target muscle", name: "Name A–Z", compound: "Compound first", isolation: "Isolation first" };
                return (
                  <button
                    key={opt}
                    onClick={() => setPendingSort(opt)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors",
                      pendingSort === opt ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50"
                    )}
                  >
                    {labels[opt]}
                    {pendingSort === opt && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
              <div className="flex flex-wrap gap-2">
                {SWAP_CATEGORY_CHIPS.map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => setPendingCategory(chip.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      pendingCategory === chip.id
                        ? "bg-violet-600 text-white border-violet-600"
                        : "border-border text-muted-foreground hover:border-violet-400 hover:text-foreground"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setFilterOpen(false)}
                className="py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setSortMode(pendingSort); setCategory(pendingCategory); setFilterOpen(false); }}
                className="py-3 rounded-2xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Sort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-8">
        {isGrouped && grouped ? (
          <div className="space-y-6">
            {Object.entries(grouped)
              .sort(([a], [b]) => (SWAP_GROUP_ORDER[a] ?? 50) - (SWAP_GROUP_ORDER[b] ?? 50))
              .map(([group, exs]) => (
                <div key={group}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
                  <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
                    {exs.map(e => renderExercise(e))}
                  </div>
                </div>
              ))}
          </div>
        ) : flat && flat.length > 0 ? (
          <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
            {flat.map(e => renderExercise(e))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">No exercises match your search.</p>
        )}
      </div>
    </div>
  );
}

function VideoUploadSheet({ onSkip }: { onSkip: () => void }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-[60]">
      <Upload className="w-16 h-16 text-primary mb-6 opacity-80" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold mb-2">Upload Form Videos</h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-xs">
        Share your form videos with your coach so they can give you feedback.
      </p>

      {showOptions ? (
        <div className="w-full max-w-xs space-y-3">
          <button className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-accent transition-colors">
            <ImageIcon className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold">Photo Gallery</p>
              <p className="text-xs text-muted-foreground">Choose from your device</p>
            </div>
          </button>
          <button className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-accent transition-colors">
            <FolderOpen className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold">Google Drive</p>
              <p className="text-xs text-muted-foreground">Upload from Drive or Docs</p>
            </div>
          </button>
          <button
            onClick={() => setShowOptions(false)}
            className="text-sm text-muted-foreground mt-2"
          >
            ← Back
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold gap-2"
            onClick={() => setShowOptions(true)}
          >
            <Upload className="w-5 h-5" /> Upload Form Videos
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full h-12 text-muted-foreground"
            onClick={onSkip}
          >
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}

const EXIT_ANIMS = [
  { anim: "ex-fly-right",   origin: "center center" },
  { anim: "ex-bounce-up",   origin: "center center" },
  { anim: "ex-fly-left",    origin: "center center" },
  { anim: "ex-bounce-down", origin: "center center" },
  { anim: "ex-spin-throw",  origin: "center center" },
  { anim: "ex-card-flip",   origin: "center center" },
  { anim: "ex-fling-diag",  origin: "center center" },
  { anim: "ex-slam-up",     origin: "center center" },
  { anim: "ex-roll-left",   origin: "left center"   },
  { anim: "ex-roll-right",  origin: "right center"  },
  { anim: "ex-peel-br",     origin: "bottom right"  },
  { anim: "ex-peel-tl",     origin: "top left"      },
  { anim: "ex-peel-bl",     origin: "bottom left"   },
  { anim: "ex-peel-tr",     origin: "top right"     },
] as const;

function RestTimerOverlay({ secondsLeft, total, onSkip }: { secondsLeft: number; total: number; onSkip: () => void }) {
  const circumference = 2 * Math.PI * 54;
  const progress = total > 0 ? secondsLeft / total : 0;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-10">Rest</p>
      <div className="relative mb-10">
        <svg viewBox="0 0 120 120" className="w-52 h-52 -rotate-90">
          <circle
            cx="60" cy="60" r="54"
            fill="none" stroke="currentColor" strokeWidth="7"
            className="text-muted/20"
          />
          <circle
            cx="60" cy="60" r="54"
            fill="none" stroke="currentColor" strokeWidth="7"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-6xl font-black tabular-nums leading-none">{secondsLeft}</span>
          <span className="text-xs text-muted-foreground mt-1">seconds</span>
        </div>
      </div>
      <Button
        size="lg"
        variant="outline"
        className="w-44 h-12 text-base font-semibold"
        onClick={onSkip}
      >
        Skip Rest
      </Button>
    </div>,
    document.body
  );
}

export function WorkoutPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<Mode>("select");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [sets, setSets] = useState<SetState[][]>([]);
  const [rpeModal, setRpeModal] = useState<RpeModal | null>(null);
  const [rpeSheetOpen, setRpeSheetOpen] = useState(false);
  const [swapModal, setSwapModal] = useState(false);
  const [editingSetIdx, setEditingSetIdx] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRpe, setEditRpe] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [exitAnimation, setExitAnimation] = useState("ex-fly-right");
  const [exitOrigin, setExitOrigin] = useState("center center");
  const [showEarlyExit, setShowEarlyExit] = useState(false);
  const [earlyExitReason, setEarlyExitReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [swappedExercises, setSwappedExercises] = useState<Record<number, { exerciseName: string; muscleGroup: string; exerciseId: number }>>({});
  const [listEditingSet, setListEditingSet] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [isExitingWorkout, setIsExitingWorkout] = useState(false);
  const [listEditWeight, setListEditWeight] = useState("");
  const [listEditReps, setListEditReps] = useState("");
  const [listEditRpe, setListEditRpe] = useState<number | null>(null);
  const { workoutView, showProgressBar } = useWorkoutPrefs();

  // Pre-workout checkin
  const [energy, setEnergy] = useState<number | null>(null);
  const [isAdjusted, setIsAdjusted] = useState(false);
  const [adjustPercent, setAdjustPercent] = useState(20);
  const [setAdjustPct, setSetAdjustPct] = useState(0);
  const [adjustTier, setAdjustTier] = useState<"heavy" | "moderate" | "none">("none");
  const [effectiveRestSeconds, setEffectiveRestSeconds] = useState<(number | null)[]>([]);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: assignment, isError: assignmentError, refetch: refetchAssignment, isFetching: assignmentFetching } = useGetClientProgramAssignment(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId!) }
  });

  const { data: latestSleepLog } = useGetLatestSleepLog(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetLatestSleepLogQueryKey(clientId!) }
  });
  const { data: program, isError: programError, refetch: refetchProgram, isFetching: programFetching } = useGetClientProgram(clientId!, {
    query: { enabled: !!clientId && !!assignment, queryKey: getGetClientProgramQueryKey(clientId!) }
  });
  const { data: allExercises } = useListExercises({ query: { enabled: mode === "active" && swapModal, queryKey: getListExercisesQueryKey() } });

  const createWorkoutLog = useCreateWorkoutLog();
  const updateWorkoutLog = useUpdateWorkoutLog();
  const logSet = useLogSet();

  const today = new Date().toISOString().split("T")[0];
  const days = program?.days ?? [];

  // Auto-select today's day based on program start date + day cycle
  const todayAutoIdx = (() => {
    if (!assignment?.startDate || days.length === 0) return 0;
    const start = new Date(assignment.startDate);
    const now = new Date(today);
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return ((diff % days.length) + days.length) % days.length;
  })();

  useEffect(() => {
    if (!assignment?.startDate || days.length === 0) return;
    setSelectedDayIdx(todayAutoIdx);
  }, [assignment?.startDate, days.length, todayAutoIdx]);

  const selectedDay = days[selectedDayIdx];
  const baseExercises = selectedDay?.exercises ?? [];

  // Merge in any swapped exercises
  const exercises = baseExercises.map((ex, i) => {
    const swapped = swappedExercises[i];
    if (swapped) return { ...ex, exerciseName: swapped.exerciseName, muscleGroup: swapped.muscleGroup, exerciseId: swapped.exerciseId };
    return ex;
  });

  const currentEx = exercises[currentExIdx];
  const currentSets = sets[currentExIdx] ?? [];

  const { data: lastPerformanceData } = useGetLastWorkoutPerformance(clientId!, selectedDay?.id ?? 0, {
    query: { enabled: !!clientId && !!selectedDay?.id, queryKey: getGetLastWorkoutPerformanceQueryKey(clientId!, selectedDay?.id ?? 0) }
  });
  const prevPerfMap = useMemo(() => {
    const m: Record<number, { weight: string; reps: string }> = {};
    for (const p of lastPerformanceData ?? []) {
      m[p.exerciseId] = {
        weight: p.weight != null ? String(p.weight) : "",
        reps: String(p.reps),
      };
    }
    return m;
  }, [lastPerformanceData]);

  const stopRestTimer = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setShowRestTimer(false);
    setRestSecondsLeft(0);
  }, []);

  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    const secs = Math.max(1, seconds);
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    setShowRestTimer(true);
    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          playRing();
          setShowRestTimer(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  const initSets = useCallback((dayExercises: typeof exercises, applyAdjust: boolean, setAdjustPct: number, restAdjustPct: number, prevPerf: Record<number, { weight: string; reps: string }> = {}) => {
    const initial: SetState[][] = dayExercises.map(ex => {
      const reps = ex.reps.includes("-") ? ex.reps.split("-")[1] : ex.reps;
      const meta = decodeExMeta(ex.notes);
      const isUnilateral = meta.laterality === "unilateral";
      const setCount = applyAdjust
        ? Math.max(1, Math.round(ex.sets * (1 - setAdjustPct / 100)))
        : ex.sets;
      const prev = prevPerf[ex.exerciseId];
      return Array.from({ length: setCount }, () => ({
        targetReps: reps,
        weight: "",
        reps: "",
        leftReps: "",
        rightReps: "",
        prevWeight: prev?.weight ?? (ex.weight ?? ""),
        prevReps: prev?.reps ?? reps,
        isUnilateral,
        logged: false,
        rpe: null,
      }));
    });
    setSets(initial);
    setEffectiveRestSeconds(dayExercises.map(ex => {
      if (!ex.restSeconds) return null;
      return applyAdjust
        ? Math.round(ex.restSeconds * (1 + restAdjustPct / 100))
        : ex.restSeconds;
    }));
  }, []);

  const handleBeginWorkout = () => {
    if (!clientId || !selectedDay) return;

    const e = energy ?? 10;
    const basePct = program?.sleepAdjustPercent ?? 20;
    const poorSleep = latestSleepLog?.quality === "poor" || latestSleepLog?.quality === "fair";
    const adjustEnabled = program?.sleepAdjustEnabled !== false;

    let tier: "heavy" | "moderate" | "none" = "none";
    let sAdjust = 0;
    let rAdjust = 0;

    if (adjustEnabled) {
      if (e <= 3) {
        tier = "heavy";
        sAdjust = 50;
        rAdjust = poorSleep ? Math.min(50, Math.round(basePct * 1.5)) : basePct;
      } else if (e <= 6) {
        tier = "moderate";
        sAdjust = 25;
        rAdjust = poorSleep ? Math.min(40, Math.round(basePct * 0.75)) : Math.round(basePct / 2);
      }
    }

    const shouldAdjust = tier !== "none";
    setIsAdjusted(shouldAdjust);
    setAdjustPercent(rAdjust);
    setSetAdjustPct(sAdjust);
    setAdjustTier(tier);

    createWorkoutLog.mutate({
      clientId,
      data: { programDayId: selectedDay.id, date: today }
    }, {
      onSuccess: (log) => {
        setWorkoutLogId(log.id);
        setCurrentExIdx(0);
        setSwappedExercises({});
        initSets(exercises, shouldAdjust, sAdjust, rAdjust, prevPerfMap);
        setMode("active");
      },
      onError: () => toast({ title: "Failed to start workout", variant: "destructive" })
    });
  };

  // Open the bottom sheet whenever a set is tapped
  useEffect(() => {
    if (rpeModal) setRpeSheetOpen(true);
  }, [rpeModal]);

  const closeRpeSheet = (cb?: () => void) => {
    setRpeSheetOpen(false);
    setTimeout(() => {
      setRpeModal(null);
      cb?.();
    }, 300);
  };

  const handleCheckSet = (setIdx: number) => {
    const s = currentSets[setIdx];
    if (!s || s.logged) return;
    playRing();
    setRpeModal({ exIdx: currentExIdx, setIdx });
  };

  const handleRpeSelect = (rpe: number) => {
    if (!rpeModal || !workoutLogId || !clientId) return;
    const { exIdx, setIdx } = rpeModal;
    const ex = exercises[exIdx];
    const s = sets[exIdx]?.[setIdx];
    if (!ex || !s) return;

    // Resolve effective values: typed entry takes priority, ghost placeholder (prev perf) is the fallback
    const effectiveWeight = s.weight || s.prevWeight;
    const effectiveReps = s.reps || s.prevReps;
    const effectiveLeftReps = s.leftReps || s.prevReps;
    const effectiveRightReps = s.rightReps || s.prevReps;

    const repsToLog = s.isUnilateral
      ? (Math.max(parseInt(effectiveLeftReps) || 0, parseInt(effectiveRightReps) || 0) || parseInt(s.targetReps) || 0)
      : (parseInt(effectiveReps) || parseInt(s.targetReps) || 0);
    const lateralNotes = s.isUnilateral && (effectiveLeftReps || effectiveRightReps)
      ? `L: ${effectiveLeftReps || 0} / R: ${effectiveRightReps || 0}`
      : undefined;

    logSet.mutate({
      clientId,
      logId: workoutLogId,
      data: {
        exerciseId: ex.exerciseId,
        setNumber: setIdx + 1,
        reps: repsToLog,
        weight: effectiveWeight ? parseFloat(effectiveWeight) : undefined,
        weightUnit: effectiveWeight ? "lbs" : undefined,
        rpe,
        notes: lateralNotes,
      }
    });

    // Write resolved values back so the locked display shows actual numbers
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((item, i) =>
        i === setIdx ? {
          ...item,
          logged: true,
          rpe,
          weight: item.weight || item.prevWeight,
          reps: item.reps || item.prevReps,
          leftReps: item.leftReps || item.prevReps,
          rightReps: item.rightReps || item.prevReps,
        } : item
      );
      return next;
    });

    const prev = prevPerfMap[ex.exerciseId];
    if (prev) {
      const loggedWeight = effectiveWeight ? parseFloat(effectiveWeight) : 0;
      const prevWeight = prev.weight ? parseFloat(prev.weight) : 0;
      const prevReps = parseInt(prev.reps) || 0;
      const isPR = loggedWeight > prevWeight || (loggedWeight >= prevWeight && repsToLog > prevReps);
      if (isPR) {
        toast({ title: "🏆 New PR!", description: "You beat your last session on this exercise!" });
      }
    }

    const exSets = sets[exIdx] ?? [];
    const isLastSetOfExercise = setIdx >= exSets.length - 1;
    if (!isLastSetOfExercise) {
      const restSec = effectiveRestSeconds[exIdx] ?? 60;
      startRestTimer(restSec);
    }
  };

  const handleRpeConfirm = (rpe: number) => {
    playConfirm();
    closeRpeSheet(() => handleRpeSelect(rpe));
  };

  const updateWeight = (setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) => i === setIdx ? { ...s, weight: value } : s);
      return next;
    });
  };

  const updateReps = (setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) => i === setIdx ? { ...s, reps: value } : s);
      return next;
    });
  };

  const updateLeftReps = (setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) => i === setIdx ? { ...s, leftReps: value } : s);
      return next;
    });
  };

  const updateRightReps = (setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) => i === setIdx ? { ...s, rightReps: value } : s);
      return next;
    });
  };

  const openEditSet = (i: number) => {
    const s = currentSets[i];
    if (!s) return;
    setEditingSetIdx(i);
    setEditWeight(s.weight);
    setEditReps(s.reps);
    setEditRpe(s.rpe);
  };

  const saveEditSet = () => {
    if (editingSetIdx === null) return;
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) =>
        i === editingSetIdx ? { ...s, weight: editWeight, reps: editReps, rpe: editRpe } : s
      );
      return next;
    });
    setEditingSetIdx(null);
  };

  const undoSet = (setIdx: number) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) =>
        i === setIdx ? { ...s, logged: false, rpe: null } : s
      );
      return next;
    });
    setEditingSetIdx(null);
  };

  const allCurrentSetsLogged = currentSets.length > 0 && currentSets.every(s => s.logged);

  // ── List-mode handlers ──────────────────────────────────────────────────
  const handleCheckSetForEx = (exIdx: number, setIdx: number) => {
    const s = (sets[exIdx] ?? [])[setIdx];
    if (!s || s.logged) return;
    playRing();
    setRpeModal({ exIdx, setIdx });
  };

  const updateWeightForEx = (exIdx: number, setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) => i === setIdx ? { ...s, weight: value } : s);
      return next;
    });
  };

  const updateRepsForEx = (exIdx: number, setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) => i === setIdx ? { ...s, reps: value } : s);
      return next;
    });
  };

  const updateLeftRepsForEx = (exIdx: number, setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) => i === setIdx ? { ...s, leftReps: value } : s);
      return next;
    });
  };

  const updateRightRepsForEx = (exIdx: number, setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) => i === setIdx ? { ...s, rightReps: value } : s);
      return next;
    });
  };

  const openEditSetForEx = (exIdx: number, setIdx: number) => {
    const s = (sets[exIdx] ?? [])[setIdx];
    if (!s) return;
    setListEditingSet({ exIdx, setIdx });
    setListEditWeight(s.weight);
    setListEditReps(s.reps);
    setListEditRpe(s.rpe);
  };

  const saveEditSetForEx = () => {
    if (!listEditingSet) return;
    const { exIdx, setIdx } = listEditingSet;
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) =>
        i === setIdx ? { ...s, weight: listEditWeight, reps: listEditReps, rpe: listEditRpe } : s
      );
      return next;
    });
    setListEditingSet(null);
  };

  const undoSetForEx = (exIdx: number, setIdx: number) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((s, i) =>
        i === setIdx ? { ...s, logged: false, rpe: null } : s
      );
      return next;
    });
    setListEditingSet(null);
  };

  const handleFinishWorkout = () => {
    qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
    setMode("upload");
  };

  const handleNextExercise = () => {
    const picked = EXIT_ANIMS[Math.floor(Math.random() * EXIT_ANIMS.length)];
    setExitAnimation(picked.anim);
    setExitOrigin(picked.origin);
    setIsExiting(true);
    setEditingSetIdx(null);
    setTimeout(() => {
      setIsExiting(false);
      if (currentExIdx < exercises.length - 1) {
        setCurrentExIdx(i => i + 1);
      } else {
        qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
        setMode("upload");
      }
    }, 420);
  };

  const handleSwap = (ex: Exercise) => {
    setSwappedExercises(prev => ({
      ...prev,
      [currentExIdx]: { exerciseName: ex.name, muscleGroup: ex.muscleGroup, exerciseId: ex.id },
    }));
    setSwapModal(false);
  };

  const reset = useCallback(() => {
    setMode("select");
    setCurrentExIdx(0);
    setSets([]);
    setSwappedExercises({});
    setEnergy(null);
    setIsAdjusted(false);
    setAdjustPercent(20);
    setEffectiveRestSeconds([]);
    stopRestTimer();
    setShowEarlyExit(false);
    setEarlyExitReason("");
    setShowCancelConfirm(false);
    setIsExitingWorkout(false);
  }, [stopRestTimer]);

  const handleWorkoutExit = useCallback((dest = "/") => {
    setIsExitingWorkout(true);
    setTimeout(() => {
      reset();
      setLocation(dest);
    }, 380);
  }, [reset, setLocation]);

  const handleCancelWorkout = () => {
    if (clientId && workoutLogId) {
      updateWorkoutLog.mutate({
        clientId,
        logId: workoutLogId,
        data: { status: "cancelled" },
      });
    }
    handleWorkoutExit("/");
  };

  const handleEarlyExitSubmit = () => {
    if (clientId && workoutLogId) {
      updateWorkoutLog.mutate({
        clientId,
        logId: workoutLogId,
        data: { notes: earlyExitReason, status: "early_exit" },
      });
    }
    setShowEarlyExit(false);
    // If at least one set was logged, send to video upload; otherwise just exit
    const anyLogged = sets.some(exSets => exSets.some(s => s.logged));
    if (anyLogged) {
      qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
      setMode("upload");
    } else {
      setMode("early-exit-done");
    }
  };

  useEffect(() => {
    if (mode !== "early-exit-done") return;
    const t = setTimeout(() => handleWorkoutExit("/"), 2800);
    return () => clearTimeout(t);
  }, [mode]);

  if (!clientId) {
    return (
      <div className="max-w-sm mx-auto py-20 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold">You're not connected yet</p>
          <p className="text-sm text-muted-foreground mt-1">Enter the access code your coach gave you to get started.</p>
        </div>
        <Link href="/enter-code">
          <Button className="w-full h-12 font-bold">Enter access code</Button>
        </Link>
      </div>
    );
  }

  if ((assignmentError || programError) && mode === "select") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Workout</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ready when you are</p>
        </div>
        <QueryErrorState
          message="Couldn't load your program. This is usually temporary."
          onRetry={() => { refetchAssignment(); if (assignment?.programId) refetchProgram(); }}
          isRetrying={assignmentFetching || programFetching}
          testId="button-retry-workout-program"
        />
      </div>
    );
  }

  if (!assignment && mode === "select") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Workout</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ready when you are</p>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Dumbbell className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-semibold">No program assigned yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your coach hasn't assigned a program yet. Check back soon!</p>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold opacity-40 cursor-not-allowed"
          disabled
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Start Workout
        </Button>
        <div className="pt-2">
          <Link href="/workouts">
            <Button variant="ghost" className="w-full text-muted-foreground" size="sm">
              View History
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── VIDEO UPLOAD SCREEN ──────────────────────────────────────────────────
  if (mode === "upload") {
    return (
      <VideoUploadSheet onSkip={() => { playWorkoutComplete(); setMode("done"); }} />
    );
  }

  const exitSlide = isExitingWorkout
    ? "translate-y-full opacity-0 transition-transform transition-opacity duration-[380ms] ease-in"
    : "";

  // ── EARLY EXIT DONE ──────────────────────────────────────────────────────
  if (mode === "early-exit-done") {
    return (
      <div className={cn("fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-[60] animate-in fade-in slide-in-from-bottom-8 duration-500", exitSlide)}>
        <div className="text-7xl mb-6 animate-in zoom-in duration-500 delay-150">💪</div>
        <h1 className="text-3xl font-black mb-3 animate-in fade-in duration-500 delay-200">No worries!</h1>
        <p className="text-muted-foreground text-lg animate-in fade-in duration-500 delay-300">
          See you on the next one!
        </p>
      </div>
    );
  }

  // ── DONE SCREEN ──────────────────────────────────────────────────────────
  if (mode === "done") {
    return (
      <div className={cn("fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-[60]", exitSlide)}>
        <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-black mb-2">Workout Complete!</h1>
        <p className="text-muted-foreground mb-2">{selectedDay?.name}</p>
        <p className="text-lg font-semibold mb-8">{exercises.length} exercises</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => handleWorkoutExit("/workouts")} className="w-full">View History</Button>
          <Button size="lg" variant="outline" onClick={() => handleWorkoutExit("/")} className="w-full">Go Home</Button>
        </div>
      </div>
    );
  }

  // ── PRE-WORKOUT CHECK-IN ─────────────────────────────────────────────────
  if (mode === "checkin") {
    return (
      <div className={cn("fixed inset-0 bg-background flex flex-col z-[60]", exitSlide)}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <button onClick={() => setMode("select")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
            <X className="w-4 h-4" /> Back
          </button>
          <span className="text-sm font-medium">{selectedDay?.name}</span>
          <div className="w-16" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 space-y-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Before you begin</h1>
            <p className="text-muted-foreground text-sm">Quick check-in</p>
          </div>

          {/* Energy */}
          <div className="w-full max-w-sm space-y-3">
            <label className="block text-base font-semibold text-center">How is your energy today?</label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                const isSelected = energy === n;
                const color = n <= 3 ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                  n <= 6 ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400" :
                  n <= 8 ? "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400" :
                  "border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
                return (
                  <button
                    key={n}
                    onClick={() => setEnergy(n)}
                    className={cn(
                      "h-12 rounded-xl border-2 font-bold text-base transition-all active:scale-95",
                      isSelected ? color : "border-border bg-card text-foreground hover:border-primary/50"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Low</span><span>High</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <Button
            size="lg"
            className="w-full h-14 text-base font-bold"
            onClick={() => setMode("overview")}
            disabled={!energy}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ── WORKOUT OVERVIEW ─────────────────────────────────────────────────────
  if (mode === "overview") {
    return (
      <div className={cn("fixed inset-0 bg-background flex flex-col z-[60]", exitSlide)}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <button onClick={() => setMode("checkin")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
            <X className="w-4 h-4" /> Back
          </button>
          <span className="text-sm font-medium">{selectedDay?.name}</span>
          <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          <div className="mb-5">
            <h1 className="text-2xl font-bold">{selectedDay?.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{exercises.length} exercises · {assignment?.programName}</p>
          </div>

          {exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ex.exerciseName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ex.sets} sets × {ex.reps} reps
                  {ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ""}
                </p>
                <Badge variant="secondary" className="text-[10px] mt-1.5">{ex.muscleGroup}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-8 pt-3 border-t border-border bg-background">
          <Button
            size="lg"
            className="w-full h-14 text-base font-bold"
            onClick={handleBeginWorkout}
            disabled={createWorkoutLog.isPending}
          >
            {createWorkoutLog.isPending ? "Starting…" : "Begin Workout"}
          </Button>
        </div>
      </div>
    );
  }

  // ── ACTIVE WORKOUT — LIST MODE ───────────────────────────────────────────
  if (mode === "active" && workoutView === "list" && sets.length > 0) {
    const totalSets = sets.reduce((a, ex) => a + ex.length, 0);
    const loggedSets = sets.reduce((a, ex) => a + ex.filter(s => s.logged).length, 0);
    const allDone = totalSets > 0 && loggedSets === totalSets;

    return (
      <>
        <RpeBottomSheet
          open={rpeSheetOpen}
          onSelect={handleRpeConfirm}
          onCancel={() => { playSwipe(); closeRpeSheet(); }}
        />
        {showRestTimer && (
          <RestTimerOverlay
            secondsLeft={restSecondsLeft}
            total={restTotalSeconds}
            onSkip={stopRestTimer}
          />
        )}

        <div className={cn("fixed inset-0 z-[60] overflow-hidden", exitSlide)}>
          <div className="absolute inset-0 bg-background flex flex-col">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleWorkoutExit("/")}
                  className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Exit
                </button>
                <span className="text-xs text-muted-foreground font-medium">{selectedDay?.name}</span>
                <div className="w-16" />
              </div>
              {showProgressBar && (
                <ProgressBar
                  value={loggedSets}
                  total={totalSets}
                  label={`${loggedSets} of ${totalSets} sets`}
                />
              )}
              {isAdjusted && (
                <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <Moon className="w-3.5 h-3.5 flex-shrink-0" />
                  {adjustTier === "heavy" ? `Recovery mode — sets ×½, rest +${adjustPercent}%` : `Light recovery — sets ×¾, rest +${adjustPercent}%`}
                </div>
              )}
            </div>

            {/* Scrollable exercise list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {exercises.map((ex, exIdx) => {
                const exSets = sets[exIdx] ?? [];
                const allExSetsLogged = exSets.length > 0 && exSets.every(s => s.logged);
                return (
                  <div key={exIdx} className="px-4 py-4">
                    {/* Exercise header */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        {allExSetsLogged
                          ? <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          : <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 flex-shrink-0" />
                        }
                        <h2 className={cn("text-base font-bold leading-tight", allExSetsLogged && "text-primary")}>
                          {ex.exerciseName}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <Badge variant="secondary" className="text-[10px]">{ex.muscleGroup}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {ex.sets} × {ex.reps}{ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ""}
                        </span>
                      </div>
                      {isAdjusted ? (
                        <div className="ml-6 mt-1.5 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1">
                          <Moon className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            Today: {Math.max(1, Math.round(ex.sets * (1 - setAdjustPct / 100)))} × {ex.reps}
                            {effectiveRestSeconds[exIdx] != null ? ` · ${effectiveRestSeconds[exIdx]}s rest` : ""}
                          </span>
                        </div>
                      ) : (
                        <p className="ml-6 mt-1 text-[11px] text-muted-foreground">
                          Target: {ex.sets} × {ex.reps}{ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ""}
                        </p>
                      )}
                    </div>

                    {/* Set rows */}
                    <div className="space-y-2 pl-6">
                      {exSets.map((s, i) => {
                        const isNext = !s.logged && exSets.slice(0, i).every(p => p.logged);
                        const isListEditing = listEditingSet?.exIdx === exIdx && listEditingSet?.setIdx === i;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "rounded-2xl border transition-all duration-200",
                              s.logged
                                ? isListEditing ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400/60" : "bg-primary/8 border-primary/20"
                                : isNext
                                ? "bg-card border-2 border-primary shadow-sm"
                                : "bg-muted/40 border-transparent opacity-60"
                            )}
                          >
                            <div className="px-3 pt-2.5 pb-0.5 flex items-center justify-between">
                              <span className={cn("text-xs font-semibold uppercase tracking-wide", s.logged ? "text-primary" : "text-muted-foreground")}>
                                Set {i + 1}{s.logged && !isListEditing && s.rpe != null && ` · RPE ${s.rpe}`}
                              </span>
                              {s.logged && !isListEditing && (
                                <button
                                  onClick={() => openEditSetForEx(exIdx, i)}
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5 px-1.5 rounded-md hover:bg-muted"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                              )}
                            </div>

                            {isListEditing ? (
                              <div className="px-3 pb-3 space-y-2">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Weight</label>
                                    <Input
                                      type="number"
                                      value={listEditWeight}
                                      onChange={e => setListEditWeight(e.target.value)}
                                      placeholder="lbs"
                                      className="h-10 text-center text-sm font-semibold rounded-xl"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Reps</label>
                                    <Input
                                      type="number"
                                      value={listEditReps}
                                      onChange={e => setListEditReps(e.target.value)}
                                      placeholder={s.targetReps}
                                      className="h-10 text-center text-sm font-semibold rounded-xl"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">RPE</label>
                                  <div className="flex gap-1">
                                    {Array.from({ length: 10 }, (_, j) => j + 1).map(n => {
                                      const m = RPE_META[n];
                                      const sel = listEditRpe === n;
                                      return (
                                        <button
                                          key={n}
                                          onClick={() => setListEditRpe(n)}
                                          className={cn(
                                            "flex-1 h-8 rounded-lg text-xs font-bold transition-all",
                                            sel ? `${m.bg} text-white shadow` : "bg-muted text-muted-foreground"
                                          )}
                                        >
                                          {n}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-0.5">
                                  <button
                                    onClick={() => undoSetForEx(exIdx, i)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive border border-border rounded-xl px-3 h-9 transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Undo
                                  </button>
                                  <button
                                    onClick={saveEditSetForEx}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl h-9"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="px-3 pb-3 flex items-center gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Weight</label>
                                  {s.logged ? (
                                    <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                      {s.weight ? `${s.weight} lbs` : "—"}
                                    </div>
                                  ) : (
                                    <Input
                                      type="number"
                                      value={s.weight}
                                      onChange={e => updateWeightForEx(exIdx, i, e.target.value)}
                                      placeholder={s.prevWeight || "lbs"}
                                      className="h-10 text-center text-sm font-semibold rounded-xl"
                                    />
                                  )}
                                </div>
                                {s.isUnilateral ? (
                                  <>
                                    <div className="flex-1">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">L Reps</label>
                                      {s.logged ? (
                                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                          {s.leftReps || "—"}
                                        </div>
                                      ) : (
                                        <Input type="number" value={s.leftReps} onChange={e => updateLeftRepsForEx(exIdx, i, e.target.value)} placeholder={s.prevReps || s.targetReps} className="h-10 text-center text-sm font-semibold rounded-xl" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">R Reps</label>
                                      {s.logged ? (
                                        <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                          {s.rightReps || "—"}
                                        </div>
                                      ) : (
                                        <Input type="number" value={s.rightReps} onChange={e => updateRightRepsForEx(exIdx, i, e.target.value)} placeholder={s.prevReps || s.targetReps} className="h-10 text-center text-sm font-semibold rounded-xl" />
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Reps</label>
                                    {s.logged ? (
                                      <div className="h-10 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                        {s.reps}
                                      </div>
                                    ) : (
                                      <Input
                                        type="number"
                                        value={s.reps}
                                        onChange={e => updateRepsForEx(exIdx, i, e.target.value)}
                                        placeholder={s.prevReps || s.targetReps}
                                        className="h-10 text-center text-sm font-semibold rounded-xl"
                                      />
                                    )}
                                  </div>
                                )}
                                <button
                                  onClick={() => handleCheckSetForEx(exIdx, i)}
                                  disabled={s.logged || (!isNext && i !== 0)}
                                  aria-label={s.logged ? `Set ${i + 1} logged` : `Log set ${i + 1}`}
                                  className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0 mt-5",
                                    s.logged
                                      ? "bg-primary/20 text-primary cursor-default"
                                      : isNext || i === 0
                                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                                      : "bg-muted text-muted-foreground cursor-not-allowed"
                                  )}
                                >
                                  {s.logged ? <CheckCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom action */}
            <div className="px-4 pb-20 md:pb-6 pt-3 border-t border-border bg-background">
              {allDone ? (
                <Button size="lg" className="w-full text-base font-bold h-14" onClick={handleFinishWorkout}>
                  Finish Workout <Trophy className="ml-2 w-5 h-5" />
                </Button>
              ) : (
                <div className="h-14 flex items-center justify-center text-muted-foreground text-sm">
                  Complete all sets to finish
                </div>
              )}
              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => { setShowEarlyExit(true); setEarlyExitReason(""); }}
                  className="flex-1 py-2 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  Finish early
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 py-2 text-xs text-muted-foreground/60 hover:text-destructive transition-colors"
                >
                  Cancel workout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Early exit modal */}
        {showEarlyExit && (
          <div className="fixed inset-0 bg-background z-[70] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-4 pt-6 pb-2">
              <h2 className="text-2xl font-black">Finishing early?</h2>
              <button
                onClick={() => setShowEarlyExit(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 text-sm text-muted-foreground mb-5">
              Let your coach know why you're ending the workout early.
            </p>
            <div className="px-4 flex-1">
              <Textarea
                placeholder="e.g. Ran out of time, feeling sore today..."
                value={earlyExitReason}
                onChange={e => setEarlyExitReason(e.target.value)}
                className="min-h-40 text-base resize-none leading-relaxed"
                autoFocus
              />
            </div>
            <div className="px-4 pb-16 pt-5 space-y-3">
              <Button
                size="lg"
                className={cn(
                  "w-full h-14 text-base font-bold transition-all duration-200",
                  earlyExitReason.trim() ? "bg-foreground text-background hover:bg-foreground/90" : "opacity-35 cursor-not-allowed"
                )}
                disabled={!earlyExitReason.trim()}
                onClick={handleEarlyExitSubmit}
              >
                Submit &amp; finish early
              </Button>
              <Button size="lg" variant="ghost" className="w-full h-12 text-muted-foreground" onClick={() => setShowEarlyExit(false)}>
                Back to workout
              </Button>
            </div>
          </div>
        )}

        {/* Cancel workout confirmation sheet */}
        <>
          <div
            className={cn(
              "fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300",
              showCancelConfirm ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setShowCancelConfirm(false)}
          />
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-3xl px-6 pt-4 pb-10 transition-transform duration-300 ease-out shadow-2xl",
              showCancelConfirm ? "translate-y-0" : "translate-y-full pointer-events-none"
            )}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />
            <h2 className="text-xl font-bold text-center">Cancel workout?</h2>
            <p className="text-sm text-muted-foreground text-center mt-2 mb-8">
              Your progress won't be saved and your coach won't see a log for today.
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-13 text-base font-semibold"
                onClick={handleCancelWorkout}
              >
                Yes, cancel workout
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full h-12 text-muted-foreground"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep going
              </Button>
            </div>
          </div>
        </>
      </>
    );
  }

  // ── ACTIVE WORKOUT ───────────────────────────────────────────────────────
  if (mode === "active" && currentEx) {
    return (
      <>
        <RpeBottomSheet open={rpeSheetOpen} onSelect={handleRpeConfirm} onCancel={() => { playSwipe(); closeRpeSheet(); }} />
        {showRestTimer && (
          <RestTimerOverlay
            secondsLeft={restSecondsLeft}
            total={restTotalSeconds}
            onSkip={stopRestTimer}
          />
        )}
        {swapModal && (
          <SwapBrowser
            currentExerciseName={currentEx.exerciseName}
            allExercises={allExercises ?? []}
            onSelect={handleSwap}
            onCancel={() => setSwapModal(false)}
          />
        )}

        {/* Outer: clipping layer only */}
        <div className={cn("fixed inset-0 z-[60] overflow-hidden", exitSlide)}>
          {/* Inner: the WHOLE page moves as one unit */}
          <div
            className="absolute inset-0 bg-background flex flex-col"
            style={{
              animation: isExiting
                ? `${exitAnimation} 0.48s ease-in forwards`
                : "none",
              transformOrigin: exitOrigin,
            }}
          >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => handleWorkoutExit("/")}
                className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Exit
              </button>
              <span className="text-xs text-muted-foreground font-medium">{selectedDay?.name}</span>
              <div className="w-16" />
            </div>
            {showProgressBar && <ProgressBar value={currentExIdx} total={exercises.length} />}
            {isAdjusted && (
              <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <Moon className="w-3.5 h-3.5 flex-shrink-0" />
                {adjustTier === "heavy" ? `Recovery mode — sets ×½, rest +${adjustPercent}%` : `Light recovery — sets ×¾, rest +${adjustPercent}%`}
              </div>
            )}
          </div>

          {/* Exercise content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {/* Exercise name — big */}
            <div className="mb-6">
              <Badge variant="secondary" className="text-xs mb-2">{currentEx.muscleGroup}</Badge>
              <h1 className="text-3xl font-black leading-tight">{currentEx.exerciseName}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {currentEx.sets} sets × {currentEx.reps} reps
                {currentEx.restSeconds ? ` · ${currentEx.restSeconds}s rest` : ""}
              </p>
              {isAdjusted ? (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                  <Moon className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Today: {Math.max(1, Math.round(currentEx.sets * (1 - setAdjustPct / 100)))} × {currentEx.reps}
                    {effectiveRestSeconds[currentExIdx] != null ? ` · ${effectiveRestSeconds[currentExIdx]}s rest` : ""}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Target: {currentEx.sets} × {currentEx.reps}{currentEx.restSeconds ? ` · ${currentEx.restSeconds}s rest` : ""}
                </p>
              )}
            </div>

            {/* Set rows */}
            <div className="space-y-3 mb-6">
              {currentSets.map((s, i) => {
                const isNext = !s.logged && currentSets.slice(0, i).every(prev => prev.logged);
                const isEditing = editingSetIdx === i;

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl border transition-all duration-200",
                      s.logged
                        ? isEditing ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400/60" : "bg-primary/8 border-primary/20"
                        : isNext
                        ? "bg-card border-2 border-primary shadow-sm"
                        : "bg-muted/40 border-transparent opacity-60"
                    )}
                  >
                    {/* Set label row */}
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", s.logged ? "text-primary" : "text-muted-foreground")}>
                        Set {i + 1}
                        {s.logged && !isEditing && s.rpe != null && ` · RPE ${s.rpe}`}
                      </span>
                      {s.logged && !isEditing && (
                        <button
                          onClick={() => openEditSet(i)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5 px-1.5 rounded-md hover:bg-muted"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {/* ── EDIT MODE ── */}
                    {isEditing ? (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Weight</label>
                            <Input
                              type="number"
                              value={editWeight}
                              onChange={e => setEditWeight(e.target.value)}
                              placeholder="lbs"
                              className="h-11 text-center text-base font-semibold rounded-xl"
                              autoFocus
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Reps</label>
                            <Input
                              type="number"
                              value={editReps}
                              onChange={e => setEditReps(e.target.value)}
                              placeholder={s.targetReps}
                              className="h-11 text-center text-base font-semibold rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Compact RPE row */}
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">RPE</label>
                          <div className="flex gap-1">
                            {Array.from({ length: 10 }, (_, j) => j + 1).map(n => {
                              const m = RPE_META[n];
                              const sel = editRpe === n;
                              return (
                                <button
                                  key={n}
                                  onClick={() => setEditRpe(n)}
                                  className={cn(
                                    "flex-1 h-9 rounded-lg text-xs font-bold transition-all",
                                    sel ? `${m.bg} text-white shadow` : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  )}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                          {editRpe && (
                            <p className={cn("text-[11px] mt-1", RPE_META[editRpe].color)}>
                              {RPE_META[editRpe].label} — {RPE_META[editRpe].detail}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => undoSet(i)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive border border-border rounded-xl px-3 h-9 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Undo set
                          </button>
                          <button
                            onClick={saveEditSet}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl h-9 transition-all active:scale-[.98]"
                          >
                            <Check className="w-3.5 h-3.5" /> Save changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── NORMAL DISPLAY MODE ── */
                      <div className="px-4 pb-4 flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Weight</label>
                          {s.logged ? (
                            <div className="h-12 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                              {s.weight ? `${s.weight} lbs` : "—"}
                            </div>
                          ) : (
                            <Input
                              type="number"
                              value={s.weight}
                              onChange={e => updateWeight(i, e.target.value)}
                              placeholder={s.prevWeight || "lbs"}
                              className="h-12 text-center text-base font-semibold rounded-xl"
                            />
                          )}
                        </div>

                        {s.isUnilateral ? (
                          <>
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">L Reps</label>
                              {s.logged ? (
                                <div className="h-12 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">{s.leftReps || "—"}</div>
                              ) : (
                                <Input type="number" value={s.leftReps} onChange={e => updateLeftReps(i, e.target.value)} placeholder={s.prevReps || s.targetReps} className="h-12 text-center text-base font-semibold rounded-xl" />
                              )}
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">R Reps</label>
                              {s.logged ? (
                                <div className="h-12 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">{s.rightReps || "—"}</div>
                              ) : (
                                <Input type="number" value={s.rightReps} onChange={e => updateRightReps(i, e.target.value)} placeholder={s.prevReps || s.targetReps} className="h-12 text-center text-base font-semibold rounded-xl" />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Reps</label>
                            {s.logged ? (
                              <div className="h-12 rounded-xl bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                {s.reps}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                value={s.reps}
                                onChange={e => updateReps(i, e.target.value)}
                                placeholder={s.prevReps || s.targetReps}
                                className="h-12 text-center text-base font-semibold rounded-xl"
                              />
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleCheckSet(i)}
                          disabled={s.logged || (!isNext && i !== 0)}
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0 mt-5",
                            s.logged
                              ? "bg-primary/20 text-primary cursor-default"
                              : isNext || i === 0
                              ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          {s.logged ? <CheckCircle className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Swap exercise */}
            <button
              onClick={() => setSwapModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Swap Exercise
            </button>
          </div>

          {/* Bottom action */}
          <div className="px-4 pb-20 md:pb-6 pt-3 border-t border-border bg-background">
            {allCurrentSetsLogged ? (
              <Button size="lg" className="w-full text-base font-bold h-14" onClick={handleNextExercise}>
                {currentExIdx < exercises.length - 1 ? (
                  <>Next Exercise <ArrowRight className="ml-2 w-5 h-5" /></>
                ) : (
                  <>Finish Workout <Trophy className="ml-2 w-5 h-5" /></>
                )}
              </Button>
            ) : (
              <div className="h-14 flex items-center justify-center text-muted-foreground text-sm">
                Complete all sets to continue
              </div>
            )}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => { setShowEarlyExit(true); setEarlyExitReason(""); }}
                className="flex-1 py-2 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                Finish early
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 py-2 text-xs text-muted-foreground/60 hover:text-destructive transition-colors"
              >
                Cancel workout
              </button>
            </div>
          </div>
          </div>{/* /inner animated page */}
        </div>{/* /outer clip */}

        {/* ── Early exit reason modal ── */}
        {showEarlyExit && (
          <div className="fixed inset-0 bg-background z-[70] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-6 pb-2">
              <h2 className="text-2xl font-black">Finishing early?</h2>
              <button
                onClick={() => setShowEarlyExit(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 text-sm text-muted-foreground mb-5">
              Let your coach know why you're ending the workout early.
            </p>

            {/* Reason textarea */}
            <div className="px-4 flex-1">
              <Textarea
                placeholder="e.g. Ran out of time, feeling sore today..."
                value={earlyExitReason}
                onChange={e => setEarlyExitReason(e.target.value)}
                className="min-h-40 text-base resize-none leading-relaxed"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="px-4 pb-16 pt-5 space-y-3">
              <Button
                size="lg"
                className={cn(
                  "w-full h-14 text-base font-bold transition-all duration-200",
                  earlyExitReason.trim()
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "opacity-35 cursor-not-allowed"
                )}
                disabled={!earlyExitReason.trim()}
                onClick={handleEarlyExitSubmit}
              >
                Submit &amp; finish early
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full h-12 text-muted-foreground"
                onClick={() => setShowEarlyExit(false)}
              >
                Back to workout
              </Button>
            </div>
          </div>
        )}

        {/* Cancel workout confirmation sheet */}
        <>
          <div
            className={cn(
              "fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300",
              showCancelConfirm ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setShowCancelConfirm(false)}
          />
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-3xl px-6 pt-4 pb-10 transition-transform duration-300 ease-out shadow-2xl",
              showCancelConfirm ? "translate-y-0" : "translate-y-full pointer-events-none"
            )}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />
            <h2 className="text-xl font-bold text-center">Cancel workout?</h2>
            <p className="text-sm text-muted-foreground text-center mt-2 mb-8">
              Your progress won't be saved and your coach won't see a log for today.
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-13 text-base font-semibold"
                onClick={handleCancelWorkout}
              >
                Yes, cancel workout
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full h-12 text-muted-foreground"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep going
              </Button>
            </div>
          </div>
        </>
      </>
    );
  }

  // ── SELECT SCREEN ────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="text-sm text-muted-foreground mt-1">{assignment?.programName}</p>
      </div>

      {days.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>This program has no days yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {days.map((d, i) => {
          const isSelected = selectedDayIdx === i;
          const isToday = i === todayAutoIdx;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDayIdx(i)}
              className={cn(
                "w-full p-4 rounded-2xl border text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{d.name}</p>
                      {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Day {d.dayNumber}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
              {d.exercises && d.exercises.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {d.exercises.map(ex => (
                    <span key={ex.id} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {ex.exerciseName}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold"
          onClick={() => setMode("checkin")}
          disabled={!selectedDay}
        >
          Start {selectedDay.name}
        </Button>
      )}

      <div className="pt-2">
        <Link href="/workouts">
          <Button variant="ghost" className="w-full text-muted-foreground" size="sm">
            View History
          </Button>
        </Link>
      </div>
    </div>
  );
}
