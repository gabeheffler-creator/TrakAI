import { useState, useEffect, useCallback } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useGetClientProgramAssignment,
  useGetProgram,
  useCreateWorkoutLog,
  useLogSet,
  getGetClientProgramAssignmentQueryKey,
  getGetProgramQueryKey,
  getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronRight, Dumbbell, X, Trophy, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type Mode = "select" | "active" | "done";

interface SetState {
  targetReps: string;
  weight: string;
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

function RpePicker({ onSelect, onCancel }: { onSelect: (rpe: number) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6">
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </button>
      <h2 className="text-2xl font-bold mb-2">How hard was that?</h2>
      <p className="text-muted-foreground mb-8 text-sm">Rate of Perceived Exertion (1–10)</p>
      <div className="grid grid-cols-5 gap-3 w-full max-w-xs">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const color =
            n <= 3 ? "bg-emerald-500 hover:bg-emerald-600 text-white" :
            n <= 6 ? "bg-yellow-500 hover:bg-yellow-600 text-white" :
            n <= 8 ? "bg-orange-500 hover:bg-orange-600 text-white" :
            "bg-red-600 hover:bg-red-700 text-white";
          return (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className={cn(
                "h-14 rounded-xl text-xl font-bold transition-transform active:scale-95",
                color
              )}
              data-testid={`rpe-${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between w-full max-w-xs mt-4 text-xs text-muted-foreground">
        <span>Easy</span>
        <span>Max effort</span>
      </div>
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
  const [allDone, setAllDone] = useState(false);

  const { data: assignment } = useGetClientProgramAssignment(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId!) }
  });

  const { data: program } = useGetProgram(assignment?.programId ?? 0, {
    query: { enabled: !!assignment?.programId, queryKey: getGetProgramQueryKey(assignment?.programId ?? 0) }
  });

  const createWorkoutLog = useCreateWorkoutLog();
  const logSet = useLogSet();

  const today = new Date().toISOString().split("T")[0];
  const days = program?.days ?? [];
  const selectedDay = days[selectedDayIdx];
  const exercises = selectedDay?.exercises ?? [];
  const currentEx = exercises[currentExIdx];
  const currentSets = sets[currentExIdx] ?? [];

  const initSets = useCallback((dayIdx: number, dayExercises: typeof exercises) => {
    const initial: SetState[][] = dayExercises.map(ex => {
      const reps = ex.reps.includes("-") ? ex.reps.split("-")[1] : ex.reps;
      return Array.from({ length: ex.sets }, () => ({
        targetReps: reps,
        weight: ex.weight ?? "",
        logged: false,
        rpe: null,
      }));
    });
    setSets(initial);
  }, []);

  const handleStart = () => {
    if (!clientId || !selectedDay) return;
    createWorkoutLog.mutate({
      clientId,
      data: { programDayId: selectedDay.id, date: today }
    }, {
      onSuccess: (log) => {
        setWorkoutLogId(log.id);
        setCurrentExIdx(0);
        setAllDone(false);
        initSets(selectedDayIdx, exercises);
        setMode("active");
      },
      onError: () => toast({ title: "Failed to start workout", variant: "destructive" })
    });
  };

  const handleCheckSet = (setIdx: number) => {
    const s = currentSets[setIdx];
    if (!s || s.logged) return;
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
        reps: parseInt(s.targetReps) || 0,
        weight: s.weight ? parseFloat(s.weight) : undefined,
        weightUnit: s.weight ? "lbs" : undefined,
        notes: `RPE: ${rpe}`,
      }
    });

    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[exIdx] = next[exIdx].map((item, i) =>
        i === setIdx ? { ...item, logged: true, rpe } : item
      );
      return next;
    });
    setRpeModal(null);
  };

  const handleRpeCancel = () => setRpeModal(null);

  const updateWeight = (setIdx: number, value: string) => {
    setSets(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentExIdx] = next[currentExIdx].map((s, i) =>
        i === setIdx ? { ...s, weight: value } : s
      );
      return next;
    });
  };

  const allCurrentSetsLogged = currentSets.length > 0 && currentSets.every(s => s.logged);

  const handleNextExercise = () => {
    if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(i => i + 1);
    } else {
      qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
      setMode("done");
    }
  };

  const totalSetsLogged = sets.flat().filter(s => s.logged).length;
  const totalSets = sets.flat().length;

  // — No client ID
  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  // — No program assigned
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

  // ── DONE SCREEN ────────────────────────────────────────────────────────────
  if (mode === "done") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center z-40">
        <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
        <h1 className="text-3xl font-black mb-2">Workout Complete!</h1>
        <p className="text-muted-foreground mb-2">{selectedDay?.name}</p>
        <p className="text-lg font-semibold mb-8">{exercises.length} exercises · {totalSetsLogged} sets logged</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => setLocation("/workouts")} className="w-full">
            View History
          </Button>
          <Button size="lg" variant="outline" onClick={() => { setMode("select"); setCurrentExIdx(0); setSets([]); }} className="w-full">
            Do Another Workout
          </Button>
        </div>
      </div>
    );
  }

  // ── ACTIVE WORKOUT ─────────────────────────────────────────────────────────
  if (mode === "active" && currentEx) {
    return (
      <>
        {rpeModal && <RpePicker onSelect={handleRpeSelect} onCancel={handleRpeCancel} />}

        <div className="fixed inset-0 bg-background flex flex-col z-40 overflow-hidden">
          {/* Header with progress */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { setMode("select"); setCurrentExIdx(0); setSets([]); }}
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
            {/* Exercise title */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">{currentEx.muscleGroup}</Badge>
                {currentEx.restSeconds && (
                  <Badge variant="outline" className="text-xs">{currentEx.restSeconds}s rest</Badge>
                )}
              </div>
              <h1 className="text-3xl font-black leading-tight">{currentEx.exerciseName}</h1>
              <p className="text-muted-foreground mt-1">
                {currentEx.sets} sets × {currentEx.reps} reps
              </p>
            </div>

            {/* Sets */}
            <div className="space-y-3">
              {currentSets.map((s, i) => {
                const isNext = !s.logged && currentSets.slice(0, i).every(prev => prev.logged);
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl p-4 transition-all duration-200",
                      s.logged
                        ? "bg-primary/10 border border-primary/30"
                        : isNext
                        ? "bg-card border-2 border-primary shadow-sm"
                        : "bg-muted/50 border border-transparent opacity-60"
                    )}
                    data-testid={`set-row-${currentEx.id}-${i}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Set number */}
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                        s.logged ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {s.logged ? <CheckCircle className="w-5 h-5" /> : i + 1}
                      </div>

                      {/* Reps */}
                      <div className="flex-1">
                        <p className={cn("font-semibold", s.logged ? "text-muted-foreground line-through" : "")}>
                          {s.targetReps} reps
                        </p>
                        {s.logged && s.rpe != null && (
                          <p className="text-xs text-muted-foreground">RPE {s.rpe}</p>
                        )}
                      </div>

                      {/* Weight input */}
                      {!s.logged && (
                        <Input
                          type="number"
                          value={s.weight}
                          onChange={e => updateWeight(i, e.target.value)}
                          placeholder="lbs"
                          className="w-20 h-10 text-center text-sm"
                          data-testid={`input-weight-${currentEx.id}-${i}`}
                        />
                      )}
                      {s.logged && s.weight && (
                        <span className="text-sm text-muted-foreground">{s.weight} lbs</span>
                      )}

                      {/* Complete button */}
                      <button
                        onClick={() => handleCheckSet(i)}
                        disabled={s.logged || (!isNext && i !== 0)}
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0",
                          s.logged
                            ? "bg-primary/20 text-primary cursor-default"
                            : isNext || i === 0
                            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                        data-testid={`button-check-set-${currentEx.id}-${i}`}
                      >
                        {s.logged ? <CheckCircle className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom action */}
          <div className="px-4 pb-6 pt-3 border-t border-border bg-background">
            {allCurrentSetsLogged ? (
              <Button
                size="lg"
                className="w-full text-base font-bold h-14"
                onClick={handleNextExercise}
                data-testid="button-next-exercise"
              >
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

  // ── SELECT SCREEN ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Start Workout</h1>
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
              data-testid={`button-select-day-${d.id}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Day {d.dayNumber}</p>
                </div>
                {isSelected && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                </div>}
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
          onClick={handleStart}
          disabled={!selectedDay || createWorkoutLog.isPending}
          data-testid="button-start-workout"
        >
          {createWorkoutLog.isPending ? "Starting…" : `Start ${selectedDay.name}`}
        </Button>
      )}
    </div>
  );
}
