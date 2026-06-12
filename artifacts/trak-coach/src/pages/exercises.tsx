import { useState } from "react";
import { useListExercises, useCreateExercise, getListExercisesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().min(1),
  description: z.string().optional(),
});

const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Traps",
  "Legs", "Glutes", "Core", "Full Body", "Cardio", "HIIT", "Mobility",
];

const GROUP_ORDER: Record<string, number> = {
  "Chest": 1, "Back": 2, "Shoulders": 3, "Biceps": 4, "Triceps": 5, "Traps": 6,
  "Legs": 7, "Glutes": 8, "Core": 9, "Full Body": 10,
  "Cardio": 97, "HIIT": 98, "Mobility": 99,
};
function groupOrder(g: string) { return GROUP_ORDER[g] ?? 50; }

export function Exercises() {
  const { data: exercises, isLoading } = useListExercises();
  const createExercise = useCreateExercise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof exerciseSchema>>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { name: "", muscleGroup: "", description: "" },
  });

  const onSubmit = (values: z.infer<typeof exerciseSchema>) => {
    createExercise.mutate({ data: { name: values.name, muscleGroup: values.muscleGroup, description: values.description || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        setDialogOpen(false);
        form.reset();
        toast({ title: "Exercise created" });
      },
    });
  };

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscleGroup.toLowerCase().includes(search.toLowerCase())
  );

  type Exercise = NonNullable<typeof exercises>[number];
  const grouped = filtered?.reduce((acc, e) => {
    if (!acc[e.muscleGroup]) acc[e.muscleGroup] = [];
    acc[e.muscleGroup].push(e);
    return acc;
  }, {} as Record<string, Exercise[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercise Library</h1>
          <p className="text-muted-foreground mt-1">{exercises?.length ?? 0} exercises</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exercise"><Plus className="w-4 h-4 mr-2" /> Add Exercise</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-exercise-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="muscleGroup" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Muscle Group</FormLabel>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {MUSCLE_GROUPS.map(mg => (
                        <button
                          key={mg}
                          type="button"
                          onClick={() => form.setValue("muscleGroup", mg)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${field.value === mg ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        >
                          {mg}
                        </button>
                      ))}
                    </div>
                    <FormControl><Input {...field} placeholder="Or type custom group" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createExercise.isPending}>Add</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="pl-9"
          data-testid="input-search-exercise"
        />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {grouped && Object.entries(grouped).sort(([a], [b]) => groupOrder(a) - groupOrder(b)).map(([group, exs]) => (
        <div key={group}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {exs.map(e => (
              <Card key={e.id} data-testid={`card-exercise-${e.id}`} className="border-2 border-purple-500/40 hover:border-purple-500/70 transition-colors">
                <CardContent className="pt-4 pb-4 px-5">
                  <p className="font-semibold text-base">{e.name}</p>
                  {e.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filtered?.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-8">No exercises match your search.</p>
      )}
    </div>
  );
}
