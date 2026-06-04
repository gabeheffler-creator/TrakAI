import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Plus, Dumbbell } from "lucide-react";
import { useLocation } from "wouter";

interface SetEntry {
  reps: string;
  weight: string;
  logged: boolean;
}

export function WorkoutPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [setEntries, setSetEntries] = useState<Record<string, SetEntry[]>>({});
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [isStarted, setIsStarted] = useState(false);

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

  const getExerciseKey = (exId: number) => String(exId);

  const initSets = (dayIdx: number) => {
    const day = days[dayIdx];
    if (!day) return;
    const entries: Record<string, SetEntry[]> = {};
    day.exercises?.forEach(ex => {
      entries[getExerciseKey(ex.id)] = Array.from({ length: ex.sets }, () => ({
        reps: ex.reps.includes("-") ? ex.reps.split("-")[1] : ex.reps,
        weight: ex.weight ?? "",
        logged: false,
      }));
    });
    setSetEntries(entries);
  };

  const handleStart = async () => {
    if (!clientId) return;
    createWorkoutLog.mutate({
      clientId,
      data: {
        programDayId: selectedDay?.id,
        date: today,
      }
    }, {
      onSuccess: (log) => {
        setWorkoutLogId(log.id);
        setIsStarted(true);
        initSets(selectedDayIdx);
        toast({ title: "Workout started!" });
      }
    });
  };

  const handleLogSet = (exerciseId: number, exerciseName: string, setIdx: number) => {
    if (!workoutLogId || !clientId) return;
    const key = getExerciseKey(exerciseId);
    const entry = setEntries[key]?.[setIdx];
    if (!entry) return;

    logSet.mutate({
      clientId,
      logId: workoutLogId,
      data: {
        exerciseId,
        setNumber: setIdx + 1,
        reps: parseInt(entry.reps) || 0,
        weight: parseFloat(entry.weight) || undefined,
        weightUnit: entry.weight ? "lbs" : undefined,
      }
    }, {
      onSuccess: () => {
        setSetEntries(prev => ({
          ...prev,
          [key]: prev[key].map((s, i) => i === setIdx ? { ...s, logged: true } : s)
        }));
      }
    });
  };

  const updateSet = (exerciseId: number, setIdx: number, field: "reps" | "weight", value: string) => {
    const key = getExerciseKey(exerciseId);
    setSetEntries(prev => ({
      ...prev,
      [key]: prev[key]?.map((s, i) => i === setIdx ? { ...s, [field]: value } : s) ?? []
    }));
  };

  const handleFinish = () => {
    qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
    toast({ title: "Workout complete!" });
    setLocation("/workouts");
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  if (!assignment) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Workout</h1>
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
            <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No program assigned yet. Ask your coach to assign one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Today's Workout</h1>
        <p className="text-sm text-muted-foreground mt-1">{assignment.programName} · {today}</p>
      </div>

      {/* Day selector */}
      {!isStarted && days.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Select Day</p>
          <div className="grid grid-cols-2 gap-2">
            {days.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setSelectedDayIdx(i)}
                className={`p-3 rounded-lg border text-left transition-colors ${selectedDayIdx === i ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"}`}
                data-testid={`button-select-day-${d.id}`}
              >
                <p className="text-sm font-semibold">Day {d.dayNumber}</p>
                <p className={`text-xs mt-0.5 ${selectedDayIdx === i ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{d.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isStarted && selectedDay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{selectedDay.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedDay.exercises?.map(ex => (
              <div key={ex.id} className="flex items-center justify-between text-sm">
                <span>{ex.exerciseName}</span>
                <Badge variant="outline">{ex.sets} × {ex.reps}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isStarted && (
        <Button className="w-full" size="lg" onClick={handleStart} disabled={!selectedDay || createWorkoutLog.isPending} data-testid="button-start-workout">
          Start Workout
        </Button>
      )}

      {isStarted && selectedDay && (
        <div className="space-y-4">
          {selectedDay.exercises?.map(ex => {
            const key = getExerciseKey(ex.id);
            const sets = setEntries[key] ?? [];
            const allLogged = sets.every(s => s.logged);
            return (
              <Card key={ex.id} className={allLogged ? "border-primary/50" : ""} data-testid={`card-exercise-${ex.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{ex.exerciseName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ex.muscleGroup}</Badge>
                      {allLogged && <CheckCircle className="w-4 h-4 text-primary" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{ex.sets} sets × {ex.reps} reps{ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ""}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sets.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${s.logged ? "bg-primary/10" : "bg-muted/50"}`} data-testid={`set-row-${ex.id}-${i}`}>
                      <span className="text-xs text-muted-foreground w-12 text-center">Set {i + 1}</span>
                      <Input
                        type="number"
                        value={s.reps}
                        onChange={e => updateSet(ex.id, i, "reps", e.target.value)}
                        placeholder="Reps"
                        className="h-8 text-sm text-center"
                        disabled={s.logged}
                        data-testid={`input-reps-${ex.id}-${i}`}
                      />
                      <Input
                        type="number"
                        value={s.weight}
                        onChange={e => updateSet(ex.id, i, "weight", e.target.value)}
                        placeholder="lbs"
                        className="h-8 text-sm text-center"
                        disabled={s.logged}
                        data-testid={`input-weight-${ex.id}-${i}`}
                      />
                      <Button
                        size="sm"
                        variant={s.logged ? "secondary" : "default"}
                        onClick={() => handleLogSet(ex.exerciseId, ex.exerciseName, i)}
                        disabled={s.logged}
                        className="h-8 px-3"
                        data-testid={`button-log-set-${ex.id}-${i}`}
                      >
                        {s.logged ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          <Button className="w-full" variant="default" onClick={handleFinish} data-testid="button-finish-workout">
            Finish Workout
          </Button>
        </div>
      )}
    </div>
  );
}
