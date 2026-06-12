import { useState } from "react";
import {
  useListPrograms,
  useCreateProgram,
  useDeleteProgram,
  getListProgramsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronRight, Dumbbell } from "lucide-react";

const programSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  durationWeeks: z.coerce.number().optional(),
});

export function Programs() {
  const { data: programs, isLoading } = useListPrograms();
  const createProgram = useCreateProgram();
  const deleteProgram = useDeleteProgram();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const form = useForm<z.infer<typeof programSchema>>({
    resolver: zodResolver(programSchema),
    defaultValues: { name: "", description: "", durationWeeks: undefined },
  });

  const onSubmit = (values: z.infer<typeof programSchema>) => {
    createProgram.mutate({ data: { name: values.name, description: values.description || undefined, durationWeeks: values.durationWeeks || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setSheetOpen(false);
        form.reset();
        toast({ title: "Program created" });
      },
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteProgram.mutate({ programId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        toast({ title: "Program deleted" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground mt-1">Build and manage workout programs</p>
        </div>
        <Button data-testid="button-create-program" onClick={() => { form.reset(); setSheetOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Program
        </Button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Create Program</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. 12-Week Strength Builder" {...field} data-testid="input-program-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description <span className="text-muted-foreground">(Optional)</span></FormLabel><FormControl><Textarea placeholder="What is this program designed to achieve?" {...field} rows={3} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="durationWeeks" render={({ field }) => (
                <FormItem><FormLabel>Duration in weeks <span className="text-muted-foreground">(Optional)</span></FormLabel><FormControl><Input type="number" placeholder="e.g. 12" {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createProgram.isPending}>
                {createProgram.isPending ? "Creating…" : "Create Program"}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {(programs?.length ?? 0) === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No programs yet. Create your first one.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {programs?.map(p => (
          <Link key={p.id} href={`/programs/${p.id}`} data-testid={`card-program-${p.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                      data-testid={`button-delete-program-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                {p.durationWeeks && <p className="text-xs text-muted-foreground mt-2">{p.durationWeeks} weeks</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
