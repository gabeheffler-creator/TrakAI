import { useClientId } from "@/hooks/use-client-id";
import { useListWorkoutLogs, getListWorkoutLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, ChevronLeft, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useUnitSystem } from "@/hooks/use-unit-system";

function convertWeight(value: number, storedUnit: string, targetSystem: "imperial" | "metric"): { value: number; unit: string } {
  if (targetSystem === "metric" && storedUnit === "lbs") {
    return { value: Math.round(value * 0.453592 * 10) / 10, unit: "kg" };
  }
  if (targetSystem === "imperial" && storedUnit === "kg") {
    return { value: Math.round(value * 2.20462 * 10) / 10, unit: "lbs" };
  }
  return { value, unit: storedUnit };
}

export function WorkoutsPage() {
  const { clientId } = useClientId();
  const { units: unitSystem } = useUnitSystem();
  const [, setLocation] = useLocation();
  const { data: logs, isLoading } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) }
  });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/workout">
          <button className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold">Workout History</h1>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(logs?.length ?? 0) === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No workouts logged yet. Start your first one!</p>
        </div>
      )}

      <div className="space-y-3">
        {logs?.slice().reverse().map(log => {
          const isOpen = expanded[log.id] ?? false;
          // Group sets by exercise
          const sets = (log as unknown as { sets?: { exerciseName: string; setNumber: number; reps: number; weight: number | null; weightUnit: string | null }[] }).sets ?? [];
          const byExercise = sets.reduce<Record<string, typeof sets>>((acc, s) => {
            (acc[s.exerciseName] ??= []).push(s);
            return acc;
          }, {});
          const hasDetail = sets.length > 0;

          return (
            <Card key={log.id} data-testid={`card-workout-${log.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/workouts/${log.id}`)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{log.programDayName ?? "Free workout"}</p>
                      <Badge variant={log.status === "completed" ? "default" : "secondary"} className="text-xs">
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.date}
                      {log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {hasDetail && (
                      <button onClick={e => { e.stopPropagation(); toggle(log.id); }} className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </div>

                {isOpen && hasDetail && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {Object.entries(byExercise).map(([name, exSets]) => (
                      <div key={name}>
                        <p className="text-sm font-medium mb-1">{name}</p>
                        <div className="space-y-1">
                          {exSets.map(s => (
                            <div key={s.setNumber} className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="w-12 text-right font-mono">Set {s.setNumber}</span>
                              <span>{s.reps} reps</span>
                              {s.weight != null && (() => {
                                const converted = convertWeight(s.weight, s.weightUnit ?? "lbs", unitSystem);
                                return <span className="font-medium text-foreground">{converted.value} {converted.unit}</span>;
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!hasDetail && !isOpen && (
                  <p className="text-xs text-muted-foreground mt-1 italic">No sets recorded</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(logs?.length ?? 0) > 0 && (
        <Link href="/workout">
          <Button variant="ghost" className="w-full text-muted-foreground" size="sm">← Back to Workout</Button>
        </Link>
      )}
    </div>
  );
}
