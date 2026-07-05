import { useState, useMemo } from "react";
import { useListExercises } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";

const GROUP_ORDER: Record<string, number> = {
  "Chest": 1, "Back": 2, "Shoulders": 3, "Biceps": 4, "Triceps": 5, "Traps": 6,
  "Legs": 7, "Glutes": 8, "Core": 9, "Full Body": 10,
  "Cardio": 97, "HIIT": 98, "Mobility": 99,
};
function groupOrder(g: string) { return GROUP_ORDER[g] ?? 50; }

export function ExercisesPage() {
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading, isError, refetch, isFetching } = useListExercises();

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    return exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.muscleGroup.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q)
    );
  }, [exercises, search]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
      (acc[e.muscleGroup] ??= []).push(e);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exercise Library</h1>
        <p className="text-muted-foreground text-sm mt-1">{exercises?.length ?? 0} exercises</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="pl-9"
        />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {isError && (
        <QueryErrorState
          message="Couldn't load exercises. This is usually temporary."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-exercises"
        />
      )}

      {!isError && Object.entries(grouped).sort(([a], [b]) => groupOrder(a) - groupOrder(b)).map(([group, exs]) => (
        <div key={group}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {exs.map(e => (
              <Card key={e.id} className="border-2 border-purple-500/40 hover:border-purple-500/70 transition-colors">
                <CardContent className="pt-4 pb-4 px-5">
                  <p className="font-semibold text-base">{e.name}</p>
                  {e.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && !isLoading && !isError && (
        <p className="text-muted-foreground text-sm text-center py-8">No exercises match your search.</p>
      )}
    </div>
  );
}
