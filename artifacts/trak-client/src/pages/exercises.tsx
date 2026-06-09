import { useState, useMemo } from "react";
import { useListExercises } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

export function ExercisesPage() {
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading } = useListExercises();

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

      {Object.entries(grouped).sort().map(([group, exs]) => (
        <div key={group}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{group}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {exs.map(e => (
              <Card key={e.id}>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{e.name}</p>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{e.muscleGroup}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No exercises match your search.</p>
      )}
    </div>
  );
}
