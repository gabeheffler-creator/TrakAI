import { useState } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import {
  useGetWorkoutLog,
  getGetWorkoutLogQueryKey,
  useLogSet,
  getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import { useClientId } from "@/hooks/use-client-id";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { ArrowLeft, Pencil, Check, X, Dumbbell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SetLog, SetLogInputWeightUnit } from "@workspace/api-client-react";
import { QueryErrorState } from "@/components/query-error-state";

function convertWeight(
  value: number,
  storedUnit: string,
  targetSystem: "imperial" | "metric"
): { value: number; unit: string } {
  if (targetSystem === "metric" && storedUnit === "lbs")
    return { value: Math.round(value * 0.453592 * 10) / 10, unit: "kg" };
  if (targetSystem === "imperial" && storedUnit === "kg")
    return { value: Math.round(value * 2.20462 * 10) / 10, unit: "lbs" };
  return { value, unit: storedUnit };
}

interface EditState {
  reps: string;
  weight: string;
}

function SetRow({
  s,
  clientId,
  logId,
  unitSystem,
  onSaved,
}: {
  s: SetLog;
  clientId: number;
  logId: number;
  unitSystem: "imperial" | "metric";
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const logSet = useLogSet();

  const displayed = s.weight != null
    ? convertWeight(s.weight, s.weightUnit ?? "lbs", unitSystem)
    : null;

  const [edit, setEdit] = useState<EditState>({
    reps: String(s.reps),
    weight: displayed != null ? String(displayed.value) : "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const weightVal = edit.weight !== "" ? Number(edit.weight) : undefined;
      const storedUnit: SetLogInputWeightUnit = unitSystem === "metric" ? "kg" : "lbs";
      await logSet.mutateAsync({
        clientId,
        logId,
        data: {
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: Number(edit.reps) || s.reps,
          weight: weightVal,
          weightUnit: storedUnit,
          rpe: s.rpe ?? undefined,
          notes: s.notes ?? undefined,
        },
      });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-primary/5 border border-primary/20">
        <span className="w-14 text-xs font-mono text-muted-foreground text-right flex-shrink-0">
          Set {s.setNumber}
        </span>
        <div className="flex items-center gap-1.5 flex-1">
          <Input
            className="h-8 w-16 text-center text-sm px-1"
            value={edit.reps}
            onChange={e => setEdit(p => ({ ...p, reps: e.target.value }))}
            placeholder="reps"
            type="number"
            min={0}
          />
          <span className="text-xs text-muted-foreground">reps ×</span>
          <Input
            className="h-8 w-20 text-center text-sm px-1"
            value={edit.weight}
            onChange={e => setEdit(p => ({ ...p, weight: e.target.value }))}
            placeholder="weight"
            type="number"
            min={0}
            step={0.5}
          />
          <span className="text-xs text-muted-foreground">{unitSystem === "metric" ? "kg" : "lbs"}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-xl hover:bg-accent transition-colors group"
    >
      <span className="w-14 text-xs font-mono text-muted-foreground text-right flex-shrink-0">
        Set {s.setNumber}
      </span>
      <span className="text-sm flex-1">
        {s.reps} reps
        {displayed != null && (
          <span className="font-semibold ml-2">
            {displayed.value} {displayed.unit}
          </span>
        )}
        {s.rpe != null && (
          <span className="text-xs text-muted-foreground ml-2">RPE {s.rpe}</span>
        )}
      </span>
      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}

export function WorkoutLogDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const logIdNum = Number(logId);
  const { clientId } = useClientId();
  const { units: unitSystem } = useUnitSystem();
  const qc = useQueryClient();

  const { data: log, isLoading, isError, isFetching, refetch } = useGetWorkoutLog(clientId!, logIdNum, {
    query: {
      enabled: !!clientId && !!logIdNum,
      queryKey: getGetWorkoutLogQueryKey(clientId!, logIdNum),
    },
  });

  const handleSaved = () => {
    refetch();
    qc.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey(clientId!) });
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load this workout. This is usually temporary."
        onRetry={() => refetch()}
        isRetrying={isFetching}
        testId="button-retry-workout-log"
        className="p-8"
      />
    );
  }

  if (!log) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Link href="/workouts">
          <button
            className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Back to workouts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <p className="text-muted-foreground">Workout not found.</p>
      </div>
    );
  }

  const byExercise = log.sets.reduce<Record<string, typeof log.sets>>((acc, s) => {
    (acc[s.exerciseName] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/workouts">
          <button
            className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Back to workouts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{log.programDayName ?? "Free Workout"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {log.date}
            {log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}
          </p>
        </div>
        <Badge variant={log.status === "completed" ? "default" : "secondary"} className="flex-shrink-0">
          {log.status}
        </Badge>
      </div>

      {log.sets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No sets recorded for this session.</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byExercise).map(([name, exSets]) => (
          <div key={name} className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <p className="font-semibold text-sm mb-2">{name}</p>
            {exSets
              .slice()
              .sort((a, b) => a.setNumber - b.setNumber)
              .map(s => (
                <SetRow
                  key={s.id}
                  s={s}
                  clientId={clientId!}
                  logId={logIdNum}
                  unitSystem={unitSystem}
                  onSaved={handleSaved}
                />
              ))}
          </div>
        ))}
      </div>

      {log.notes && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Notes</p>
          <p className="text-sm">{log.notes}</p>
        </div>
      )}
    </div>
  );
}
