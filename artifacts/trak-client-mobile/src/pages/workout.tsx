import { useState, useEffect, useRef, useCallback } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useWorkoutPrefs } from "@/hooks/use-workout-prefs";
import {
  useGetClientProgramAssignment,
  getGetClientProgramAssignmentQueryKey,
  useGetClientProgram,
  getGetClientProgramQueryKey,
  useListWorkoutLogs,
  useListExerciseCues,
  getListExerciseCuesQueryKey,
  getListWorkoutLogsQueryKey,
  useCreateWorkoutLog,
  useLogSet,
  useUpdateWorkoutLog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryErrorState } from "@/components/query-error-state";
import {
  Dumbbell, CheckCircle2, ChevronRight, ChevronLeft, Timer, X,
  RotateCcw, ArrowRight, Info, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetState {
  weight: string;
  reps: string;
  targetWeight: string;
  targetReps: string;
  rpe: number | null;
  logged: boolean;
}

interface ExerciseState {
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  sets: SetState[];
  restSeconds: number | null;
  isUnilateral: boolean;
  notes: string | null;
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, total, onSkip }: { seconds: number; total: number; onSkip: () => void }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const progress = total > 0 ? seconds / total : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-5">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Rest</p>
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="48" cy="48" r={r} fill="none" stroke="hsl(var(--primary))"
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums">{seconds}</span>
          <span className="text-[10px] text-muted-foreground">sec</span>
        </div>
      </div>
      <Button variant="outline" onClick={onSkip} className="gap-1.5">
        <Timer className="w-4 h-4" /> Skip Rest
      </Button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function WorkoutPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { workoutView, showProgressBar } = useWorkoutPrefs();
  const [, setView] = useState(workoutView);

  // Mode: "select" | "active" | "done"
  const [mode, setMode] = useState<"select" | "active" | "done">("select");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [rpeModal, setRpeModal] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndRef = useRef<number | null>(null);
  const [activeView, setActiveView] = useState<"one-at-a-time" | "list">(workoutView);

  const { data: assignment, isLoading: assignLoading, isError: assignError, refetch: refetchAssign, isFetching: assignFetching } =
    useGetClientProgramAssignment(clientId!, {
      query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId!) },
    });

  const { data: program, isLoading: progLoading, isError: progError, refetch: refetchProg, isFetching: progFetching } =
    useGetClientProgram(clientId!, {
      query: { enabled: !!clientId && !!assignment, queryKey: getGetClientProgramQueryKey(clientId!) },
    });

  const { data: workoutLogs } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) },
  });

  const { data: exerciseCues } = useListExerciseCues(clientId!, {
    query: { enabled: !!clientId, queryKey: getListExerciseCuesQueryKey(clientId!) },
  });

  const createWorkoutLog = useCreateWorkoutLog();
  const logSetMutation = useLogSet();
  const updateWorkoutLog = useUpdateWorkoutLog();

  const days = program?.days ?? [];
  const selectedDay = days[selectedDayIdx] ?? null;
  const dayExercises = selectedDay?.exercises ?? [];

  // Build initial set states from program day exercises
  function buildExercises(dayExs: typeof dayExercises): ExerciseState[] {
    return dayExs.map((ex) => {
      const targetSets = ex.sets ?? 3;
      const targetReps = String(ex.reps ?? "");
      const sets: SetState[] = Array.from({ length: targetSets }, () => ({
        weight: ex.weight ? String(ex.weight) : "",
        reps: "",
        targetWeight: ex.weight ? String(ex.weight) : "",
        targetReps,
        rpe: null,
        logged: false,
      }));
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName ?? "Exercise",
        muscleGroup: ex.muscleGroup ?? "",
        sets,
        restSeconds: ex.restSeconds ?? null,
        isUnilateral: false,
        notes: exerciseCues?.find((c) => c.exerciseId === ex.exerciseId)?.note ?? null,
      };
    });
  }

  // Start workout
  const handleStart = useCallback(async () => {
    if (!clientId || !selectedDay) return;
    try {
      const log = await createWorkoutLog.mutateAsync({
        clientId,
        data: { programDayId: selectedDay.id, date: new Date().toISOString().split("T")[0] },
      });
      setWorkoutLogId(log.id);
      setExercises(buildExercises(dayExercises));
      setCurrentExIdx(0);
      setMode("active");
    } catch {
      toast({ title: "Failed to start workout", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, selectedDay, dayExercises, exerciseCues]);

  // Start rest timer
  function startRest(seconds: number) {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    const endTime = Date.now() + seconds * 1000;
    restEndRef.current = endTime;
    setRestTotal(seconds);
    setRestSeconds(seconds);
    setShowRest(true);
    restIntervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((restEndRef.current! - Date.now()) / 1000));
      setRestSeconds(left);
      if (left <= 0) {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        setShowRest(false);
      }
    }, 300);
  }

  function skipRest() {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setShowRest(false);
  }

  // Log a set
  async function logSet(exIdx: number, setIdx: number, rpe: number) {
    if (!workoutLogId || !clientId) return;
    const ex = exercises[exIdx];
    const s = ex?.sets[setIdx];
    if (!ex || !s) return;

    const weight = parseFloat(s.weight) || 0;
    const reps = parseInt(s.reps) || parseInt(s.targetReps) || 0;

    try {
      await logSetMutation.mutateAsync({
        clientId,
        logId: workoutLogId,
        data: { exerciseId: ex.exerciseId, setNumber: setIdx + 1, weight: weight || undefined, reps, rpe: rpe || undefined },
      });

      setExercises((prev) =>
        prev.map((e, ei) =>
          ei !== exIdx ? e : {
            ...e,
            sets: e.sets.map((ss, si) => si !== setIdx ? ss : { ...ss, logged: true, rpe }),
          }
        )
      );

      // Trigger rest timer
      const restSec = ex.restSeconds ?? 90;
      startRest(restSec);
    } catch {
      toast({ title: "Failed to log set", variant: "destructive" });
    }
  }

  // Compute progress
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const loggedSets = exercises.reduce((s, e) => s + e.sets.filter((ss) => ss.logged).length, 0);
  const progressPct = totalSets > 0 ? Math.round((loggedSets / totalSets) * 100) : 0;

  // Finish workout
  async function finishWorkout() {
    if (!workoutLogId) return;
    try {
      await updateWorkoutLog.mutateAsync({
        clientId: clientId!,
        logId: workoutLogId,
        data: { status: "completed" },
      });
    } catch {}
    qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
    setMode("done");
  }

  const currentEx = exercises[currentExIdx] ?? null;
  const isLoading = assignLoading || progLoading;
  const isError = assignError || progError;

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (mode === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Workout Complete!</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {loggedSets} sets logged · {format(new Date(), "MMMM d")}
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 gap-2"
          onClick={() => { setMode("select"); setWorkoutLogId(null); setExercises([]); setCurrentExIdx(0); }}
        >
          <RotateCcw className="w-4 h-4" /> Back to Workouts
        </Button>
      </div>
    );
  }

  // ── Active workout ────────────────────────────────────────────────────────────
  if (mode === "active") {
    return (
      <div className="space-y-4">
        {showRest && <RestTimer seconds={restSeconds} total={restTotal} onSkip={skipRest} />}

        {/* RPE modal (inline for mobile) */}
        {rpeModal && (
          <div className="fixed inset-0 z-50 flex flex-col items-end justify-end bg-black/40">
            <div className="w-full bg-background rounded-t-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between">
                <p className="font-bold text-base">Rate of Perceived Exertion</p>
                <button onClick={() => setRpeModal(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground">How hard was that set? (1 = very easy, 10 = max effort)</p>
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5,6,7,8,9,10].map((rpe) => (
                  <button
                    key={rpe}
                    className={cn(
                      "py-3 rounded-xl font-bold text-base transition-colors",
                      rpe <= 4 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
                      rpe <= 6 ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                      rpe <= 8 ? "bg-orange-100 text-orange-700 hover:bg-orange-200" :
                      "bg-red-100 text-red-700 hover:bg-red-200"
                    )}
                    onClick={async () => {
                      const m = rpeModal;
                      setRpeModal(null);
                      await logSet(m.exIdx, m.setIdx, rpe);
                    }}
                  >
                    {rpe}
                  </button>
                ))}
              </div>
              <button
                className="w-full py-3 rounded-xl border border-border font-medium text-muted-foreground hover:bg-muted/30"
                onClick={async () => {
                  const m = rpeModal;
                  setRpeModal(null);
                  await logSet(m.exIdx, m.setIdx, 0);
                }}
              >
                Skip RPE
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">{selectedDay?.name ?? "Workout"}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM d")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView(v => v === "list" ? "one-at-a-time" : "list")}
              className="text-xs text-muted-foreground border border-border rounded-lg px-2 py-1 hover:bg-muted/30"
            >
              {activeView === "list" ? "Focus" : "All"}
            </button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={finishWorkout}>
              Finish
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Progress</span><span>{loggedSets}/{totalSets} sets</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* View: one-at-a-time */}
        {activeView === "one-at-a-time" && currentEx && (
          <div className="space-y-4">
            {/* Exercise nav */}
            <div className="flex items-center justify-between">
              <button
                disabled={currentExIdx === 0}
                onClick={() => setCurrentExIdx(i => i - 1)}
                className="p-2 rounded-lg border border-border disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center flex-1 px-2">
                <p className="font-bold text-base leading-tight">{currentEx.exerciseName}</p>
                <p className="text-xs text-muted-foreground">{currentEx.muscleGroup} · {currentExIdx + 1}/{exercises.length}</p>
              </div>
              <button
                disabled={currentExIdx === exercises.length - 1}
                onClick={() => setCurrentExIdx(i => i + 1)}
                className="p-2 rounded-lg border border-border disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Coach cue */}
            {currentEx.notes && (
              <div className="flex items-start gap-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3">
                <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <p className="text-xs text-violet-700 dark:text-violet-300">{currentEx.notes}</p>
              </div>
            )}

            {/* Sets */}
            <div className="space-y-3">
              {currentEx.sets.map((s, setIdx) => (
                <Card key={setIdx} className={cn("border", s.logged ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-border")}>
                  <CardContent className="px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-muted-foreground">Set {setIdx + 1}</p>
                      {s.targetReps && <p className="text-xs text-muted-foreground">Target: {s.targetWeight ? `${s.targetWeight} × ` : ""}{s.targetReps} reps</p>}
                    </div>
                    {!s.logged ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          className="flex-1 text-center h-10"
                          type="number"
                          inputMode="decimal"
                          placeholder="Weight"
                          value={s.weight}
                          onChange={(e) => setExercises(prev => prev.map((ex, ei) => ei !== currentExIdx ? ex : {
                            ...ex, sets: ex.sets.map((ss, si) => si !== setIdx ? ss : { ...ss, weight: e.target.value })
                          }))}
                        />
                        <span className="text-muted-foreground text-sm">×</span>
                        <Input
                          className="flex-1 text-center h-10"
                          type="number"
                          inputMode="numeric"
                          placeholder="Reps"
                          value={s.reps}
                          onChange={(e) => setExercises(prev => prev.map((ex, ei) => ei !== currentExIdx ? ex : {
                            ...ex, sets: ex.sets.map((ss, si) => si !== setIdx ? ss : { ...ss, reps: e.target.value })
                          }))}
                        />
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 px-3 h-10 shrink-0"
                          onClick={() => setRpeModal({ exIdx: currentExIdx, setIdx })}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {s.weight ? `${s.weight} × ` : ""}{s.reps || s.targetReps} reps
                          {s.rpe ? ` · RPE ${s.rpe}` : ""}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Next exercise */}
            {currentExIdx < exercises.length - 1 && (
              <button
                onClick={() => setCurrentExIdx(i => i + 1)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:bg-muted/30 text-sm"
              >
                <span className="text-muted-foreground">Next: {exercises[currentExIdx + 1]?.exerciseName}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Finish CTA */}
            {currentExIdx === exercises.length - 1 && (
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 font-bold text-base gap-2" onClick={finishWorkout}>
                <CheckCircle2 className="w-5 h-5" /> Finish Workout
              </Button>
            )}
          </div>
        )}

        {/* View: list */}
        {activeView === "list" && (
          <div className="space-y-4">
            {exercises.map((ex, exIdx) => {
              const allLogged = ex.sets.every(s => s.logged);
              const someLogged = ex.sets.some(s => s.logged);
              return (
                <Card key={exIdx} className={cn("border", allLogged ? "border-emerald-200 dark:border-emerald-800" : "border-border")}>
                  <CardContent className="pt-3 pb-4 px-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{ex.exerciseName}</p>
                        <p className="text-xs text-muted-foreground">{ex.muscleGroup}</p>
                      </div>
                      {allLogged && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                    </div>
                    {ex.notes && (
                      <div className="flex items-start gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{ex.notes}</span>
                      </div>
                    )}
                    {ex.sets.map((s, setIdx) => (
                      <div key={setIdx} className={cn("flex items-center gap-2", s.logged && "opacity-70")}>
                        <span className="text-xs text-muted-foreground w-5 shrink-0">S{setIdx + 1}</span>
                        <Input
                          className="flex-1 text-center h-8 text-xs"
                          type="number" inputMode="decimal"
                          placeholder="Wt"
                          value={s.weight}
                          disabled={s.logged}
                          onChange={(e) => setExercises(prev => prev.map((exc, ei) => ei !== exIdx ? exc : {
                            ...exc, sets: exc.sets.map((ss, si) => si !== setIdx ? ss : { ...ss, weight: e.target.value })
                          }))}
                        />
                        <span className="text-muted-foreground text-xs">×</span>
                        <Input
                          className="flex-1 text-center h-8 text-xs"
                          type="number" inputMode="numeric"
                          placeholder={s.targetReps || "Reps"}
                          value={s.reps}
                          disabled={s.logged}
                          onChange={(e) => setExercises(prev => prev.map((exc, ei) => ei !== exIdx ? exc : {
                            ...exc, sets: exc.sets.map((ss, si) => si !== setIdx ? ss : { ...ss, reps: e.target.value })
                          }))}
                        />
                        {!s.logged ? (
                          <button
                            className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary/20"
                            onClick={() => setRpeModal({ exIdx, setIdx })}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 font-bold gap-2" onClick={finishWorkout}>
              <CheckCircle2 className="w-5 h-5" /> Finish Workout
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Day selection (mode: select) ──────────────────────────────────────────────
  if (isLoading) {
    return <div className="space-y-3 mt-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  }

  if (isError) {
    return <QueryErrorState message="Couldn't load your workout program." onRetry={() => { refetchAssign(); refetchProg(); }} isRetrying={assignFetching || progFetching} className="pt-16" />;
  }

  if (!assignment || !program || days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 text-center px-4">
        <Dumbbell className="w-12 h-12 text-muted-foreground/30" />
        <p className="font-semibold text-muted-foreground">No program assigned</p>
        <p className="text-sm text-muted-foreground/70">Ask your coach to assign a program to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="text-sm text-muted-foreground">{program.name}</p>
      </div>

      {/* Recent logs */}
      {workoutLogs && workoutLogs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Sessions</h2>
          <div className="space-y-1.5">
            {workoutLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 text-sm">
                <span className="font-medium">{log.programDayName ?? "Free workout"}</span>
                <span className="text-muted-foreground text-xs">{log.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day selector */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Select Day</h2>
        <div className="space-y-2">
          {days.map((day, idx) => {
            const exCount = day.exercises?.length ?? 0;
            const muscles = [...new Set(day.exercises?.map((e) => e.muscleGroup).filter(Boolean) ?? [])].slice(0, 3).join(", ");
            return (
              <button
                key={day.id}
                onClick={() => setSelectedDayIdx(idx)}
                className={cn(
                  "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                  selectedDayIdx === idx
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{day.name}</p>
                  <span className="text-xs text-muted-foreground">{exCount} exercises</span>
                </div>
                {muscles && <p className="text-xs text-muted-foreground mt-0.5">{muscles}</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercises preview */}
      {dayExercises.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {selectedDay?.name ?? "Today"} — Exercises
          </h2>
          <div className="space-y-1.5">
            {dayExercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 bg-background">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ex.exerciseName ?? "Exercise"}</p>
                  <p className="text-xs text-muted-foreground">{ex.sets ?? 3} × {ex.reps ?? "—"} reps</p>
                </div>
                {ex.muscleGroup && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{ex.muscleGroup}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-bold gap-2" onClick={handleStart}>
        <Zap className="w-5 h-5" /> Start Workout
      </Button>
    </div>
  );
}
