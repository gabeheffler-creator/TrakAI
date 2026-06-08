import { useState, useEffect, useCallback } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useGetClientProgramAssignment,
  useGetProgram,
  useCreateWorkoutLog,
  useLogSet,
  useListExercises,
  getListExercisesQueryKey,
  getGetClientProgramAssignmentQueryKey,
  getGetProgramQueryKey,
  getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronRight, Dumbbell, X, Trophy, ArrowRight, RefreshCw, Upload, FolderOpen, ImageIcon } from "lucide-react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import type { Exercise } from "@workspace/api-client-react";

type Mode = "select" | "checkin" | "overview" | "active" | "upload" | "done";

interface SetState {
  targetReps: string;
  weight: string;
  reps: string;
  logged: boolean;
  rpe: number | null;
}

interface RpeModal {
  exIdx: number;
  setIdx: number;
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Exercise {value} of {total}</span>
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
    const t = ctx.currentTime;
    const dur = 0.32;
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    // Upper body: airy mid sweep 1200 → 120 Hz
    const src1 = ctx.createBufferSource(); src1.buffer = buf;
    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass"; bp1.Q.value = 1.4;
    bp1.frequency.setValueAtTime(1200, t);
    bp1.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.5, t + 0.018);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Low body: sub thump 350 → 55 Hz, peaks slightly later for weight
    const src2 = ctx.createBufferSource(); src2.buffer = buf;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass"; bp2.Q.value = 1.0;
    bp2.frequency.setValueAtTime(350, t);
    bp2.frequency.exponentialRampToValueAtTime(55, t + dur);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.6, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src1.connect(bp1); bp1.connect(g1); g1.connect(ctx.destination);
    src2.connect(bp2); bp2.connect(g2); g2.connect(ctx.destination);
    src1.start(t); src2.start(t);
    setTimeout(() => ctx.close(), 700);
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

function RpeBottomSheet({ open, onSelect, onCancel }: { open: boolean; onSelect: (rpe: number) => void; onCancel: () => void }) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onCancel}
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl px-6 pt-4 pb-10 transition-transform duration-300 ease-out shadow-2xl",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />
        <h2 className="text-xl font-bold mb-1 text-center">How hard was that?</h2>
        <p className="text-muted-foreground mb-6 text-sm text-center">Rate of Perceived Exertion (1–10)</p>
        <div className="grid grid-cols-5 gap-3 w-full max-w-xs mx-auto">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const color =
              n <= 3 ? "bg-emerald-500 hover:bg-emerald-600 text-white" :
              n <= 6 ? "bg-yellow-500 hover:bg-yellow-600 text-white" :
              n <= 8 ? "bg-orange-500 hover:bg-orange-600 text-white" :
              "bg-red-600 hover:bg-red-700 text-white";
            return (
              <button key={n} onClick={() => onSelect(n)} className={cn("h-14 rounded-xl text-xl font-bold transition-transform active:scale-95", color)}>
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between w-full max-w-xs mx-auto mt-4 text-xs text-muted-foreground">
          <span>Easy</span><span>Max effort</span>
        </div>
        <button onClick={onCancel} className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </>
  );
}

function SwapModal({
  currentExercise,
  allExercises,
  onSelect,
  onCancel,
}: {
  currentExercise: { exerciseName: string; muscleGroup: string };
  allExercises: Exercise[];
  onSelect: (ex: Exercise) => void;
  onCancel: () => void;
}) {
  const isCompoundName = (name: string) => {
    const compounds = ["squat", "deadlift", "bench press", "bent over row", "overhead press", "pull-up", "chin-up"];
    const lower = name.toLowerCase();
    return compounds.some(c => lower.includes(c));
  };

  const currentIsCompound = isCompoundName(currentExercise.exerciseName);
  const currentBase = currentExercise.exerciseName.toLowerCase()
    .replace(/barbell|dumbbell|incline|decline|flat|sumo|romanian|conventional|front|back|close grip|wide grip/g, "")
    .trim();

  const swappable = allExercises.filter(ex => {
    if (ex.name === currentExercise.exerciseName) return false;
    if (currentIsCompound) {
      // Only show variations of the same lift
      const exBase = ex.name.toLowerCase()
        .replace(/barbell|dumbbell|incline|decline|flat|sumo|romanian|conventional|front|back|close grip|wide grip/g, "")
        .trim();
      return exBase.split(" ").some(word => currentBase.split(" ").includes(word) && word.length > 3);
    }
    // For accessories, show same muscle group
    return ex.muscleGroup === currentExercise.muscleGroup;
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold">Swap Exercise</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentIsCompound ? "Showing variations of this lift" : `Showing ${currentExercise.muscleGroup} exercises`}
          </p>
        </div>
        <button onClick={onCancel} className="p-2 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {swappable.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No alternatives found in your exercise library.</p>
        ) : swappable.map(ex => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex)}
            className="w-full p-4 rounded-2xl border border-border bg-card text-left hover:border-primary/50 hover:bg-accent transition-colors"
          >
            <p className="font-semibold text-sm">{ex.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ex.muscleGroup}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function VideoUploadSheet({ onSkip }: { onSkip: () => void }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-40">
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
  const [swappedExercises, setSwappedExercises] = useState<Record<number, { exerciseName: string; muscleGroup: string; exerciseId: number }>>({});

  // Pre-workout checkin
  const [sleep, setSleep] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);

  const { data: assignment } = useGetClientProgramAssignment(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId!) }
  });
  const { data: program } = useGetProgram(assignment?.programId ?? 0, {
    query: { enabled: !!assignment?.programId, queryKey: getGetProgramQueryKey(assignment?.programId ?? 0) }
  });
  const { data: allExercises } = useListExercises({ query: { enabled: mode === "active" && swapModal, queryKey: getListExercisesQueryKey() } });

  const createWorkoutLog = useCreateWorkoutLog();
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

  const initSets = useCallback((dayExercises: typeof exercises) => {
    const initial: SetState[][] = dayExercises.map(ex => {
      const reps = ex.reps.includes("-") ? ex.reps.split("-")[1] : ex.reps;
      return Array.from({ length: ex.sets }, () => ({
        targetReps: reps,
        weight: ex.weight ?? "",
        reps,
        logged: false,
        rpe: null,
      }));
    });
    setSets(initial);
  }, []);

  const handleBeginWorkout = () => {
    if (!clientId || !selectedDay) return;
    createWorkoutLog.mutate({
      clientId,
      data: { programDayId: selectedDay.id, date: today }
    }, {
      onSuccess: (log) => {
        setWorkoutLogId(log.id);
        setCurrentExIdx(0);
        setSwappedExercises({});
        initSets(exercises);
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

    logSet.mutate({
      clientId,
      logId: workoutLogId,
      data: {
        exerciseId: ex.exerciseId,
        setNumber: setIdx + 1,
        reps: parseInt(s.reps) || parseInt(s.targetReps) || 0,
        weight: s.weight ? parseFloat(s.weight) : undefined,
        weightUnit: s.weight ? "lbs" : undefined,
        rpe,
      }
    });

    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((item, i) =>
        i === setIdx ? { ...item, logged: true, rpe } : item
      );
      return next;
    });
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

  const allCurrentSetsLogged = currentSets.length > 0 && currentSets.every(s => s.logged);

  const handleNextExercise = () => {
    if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(i => i + 1);
    } else {
      qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
      setMode("upload");
    }
  };

  const handleSwap = (ex: Exercise) => {
    setSwappedExercises(prev => ({
      ...prev,
      [currentExIdx]: { exerciseName: ex.name, muscleGroup: ex.muscleGroup, exerciseId: ex.id },
    }));
    setSwapModal(false);
  };

  const reset = () => { setMode("select"); setCurrentExIdx(0); setSets([]); setSwappedExercises({}); setSleep(""); setEnergy(null); };

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  if (!assignment && mode === "select") {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Workout</h1>
        <div className="text-center py-16 text-muted-foreground">
          <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No program assigned yet.</p>
          <p className="text-sm mt-1">Ask your coach to assign a program.</p>
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

  // ── DONE SCREEN ──────────────────────────────────────────────────────────
  if (mode === "done") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-40">
        <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-black mb-2">Workout Complete!</h1>
        <p className="text-muted-foreground mb-2">{selectedDay?.name}</p>
        <p className="text-lg font-semibold mb-8">{exercises.length} exercises</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => setLocation("/workouts")} className="w-full">View History</Button>
          <Button size="lg" variant="outline" onClick={reset} className="w-full">Do Another Workout</Button>
        </div>
      </div>
    );
  }

  // ── PRE-WORKOUT CHECK-IN ─────────────────────────────────────────────────
  if (mode === "checkin") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-40">
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

          {/* Sleep */}
          <div className="w-full max-w-sm space-y-3">
            <label className="block text-base font-semibold text-center">How much sleep did you get last night?</label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={sleep}
                onChange={e => setSleep(e.target.value)}
                placeholder="e.g. 7.5"
                className="text-center text-lg h-12"
                min={0}
                max={24}
                step={0.5}
              />
              <span className="text-muted-foreground font-medium whitespace-nowrap">hours</span>
            </div>
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
            disabled={!sleep || !energy}
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
      <div className="fixed inset-0 bg-background flex flex-col z-40">
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

  // ── ACTIVE WORKOUT ───────────────────────────────────────────────────────
  if (mode === "active" && currentEx) {
    return (
      <>
        <RpeBottomSheet open={rpeSheetOpen} onSelect={handleRpeConfirm} onCancel={() => { playSwipe(); closeRpeSheet(); }} />
        {swapModal && (
          <SwapModal
            currentExercise={{ exerciseName: currentEx.exerciseName, muscleGroup: currentEx.muscleGroup }}
            allExercises={allExercises ?? []}
            onSelect={handleSwap}
            onCancel={() => setSwapModal(false)}
          />
        )}

        <div className="fixed inset-0 bg-background flex flex-col z-40 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={reset}
                className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Exit
              </button>
              <span className="text-xs text-muted-foreground font-medium">{selectedDay?.name}</span>
              <div className="w-16" />
            </div>
            <ProgressBar value={currentExIdx} total={exercises.length} />
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
            </div>

            {/* Set rows */}
            <div className="space-y-3 mb-6">
              {currentSets.map((s, i) => {
                const isNext = !s.logged && currentSets.slice(0, i).every(prev => prev.logged);
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl border transition-all duration-200",
                      s.logged
                        ? "bg-primary/8 border-primary/20"
                        : isNext
                        ? "bg-card border-2 border-primary shadow-sm"
                        : "bg-muted/40 border-transparent opacity-60"
                    )}
                  >
                    {/* Set label row */}
                    <div className="px-4 pt-3 pb-1">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", s.logged ? "text-primary" : "text-muted-foreground")}>
                        Set {i + 1}
                        {s.logged && s.rpe != null && ` · RPE ${s.rpe}`}
                      </span>
                    </div>

                    {/* Weight + Reps boxes */}
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
                            placeholder="lbs"
                            className="h-12 text-center text-base font-semibold rounded-xl"
                          />
                        )}
                      </div>

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
                            placeholder={s.targetReps}
                            className="h-12 text-center text-base font-semibold rounded-xl"
                          />
                        )}
                      </div>

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
          </div>
        </div>
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
