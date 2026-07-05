import { useState } from "react";
import {
  useListPrograms,
  useCreateProgram,
  useDeleteProgram,
  useUpdateProgram,
  useListProgramTemplates,
  useInstantiateProgramTemplate,
  getListProgramsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronRight, Dumbbell, Pencil, LayoutGrid, List, Sparkles, Calendar, Layers } from "lucide-react";

const TEMPLATE_FOCUS_ICONS: Record<string, string> = {
  Strength: "🏋️",
  Hypertrophy: "💪",
  "Functional Training": "🤸",
  Symmetry: "⚖️",
  "Athletic Performance": "⚡",
};

const programSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  durationWeeks: z.coerce.number().optional(),
});
type ProgramFormValues = z.infer<typeof programSchema>;

type EditTarget = { id: number; name: string; description?: string | null; durationWeeks?: number | null };

export function Programs() {
  const { data: programs, isLoading } = useListPrograms();
  const createProgram = useCreateProgram();
  const deleteProgram = useDeleteProgram();
  const updateProgram = useUpdateProgram();
  const { data: templates, isLoading: templatesLoading } = useListProgramTemplates();
  const instantiateTemplate = useInstantiateProgramTemplate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: { name: "", description: "", durationWeeks: undefined },
  });

  const editForm = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: { name: "", description: "", durationWeeks: undefined },
  });

  const onSubmit = (values: ProgramFormValues) => {
    createProgram.mutate({ data: { name: values.name, description: values.description || undefined, durationWeeks: values.durationWeeks || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setSheetOpen(false);
        form.reset();
        toast({ title: "Program created" });
      },
    });
  };

  const onEditSubmit = (values: ProgramFormValues) => {
    if (!editTarget) return;
    updateProgram.mutate({ programId: editTarget.id, data: { name: values.name, description: values.description || undefined, durationWeeks: values.durationWeeks || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setEditTarget(null);
        toast({ title: "Program updated" });
      },
      onError: () => toast({ title: "Failed to update program", variant: "destructive" }),
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

  const handleUseTemplate = (key: string) => {
    instantiateTemplate.mutate({ key }, {
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        setTemplatesOpen(false);
        toast({ title: "Program created from template" });
        navigate(`/programs/${result.programId}`);
      },
      onError: () => toast({ title: "Failed to create program from template", variant: "destructive" }),
    });
  };

  const handleEdit = (p: EditTarget, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTarget(p);
    editForm.reset({
      name: p.name,
      description: p.description ?? "",
      durationWeeks: p.durationWeeks ?? undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground mt-1">Build and manage workout programs</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={v => setViewMode(v as "list" | "grid")}>
            <SelectTrigger className="h-9 w-[100px]" data-testid="select-programs-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list"><span className="flex items-center gap-1.5"><List className="w-3.5 h-3.5" /> List</span></SelectItem>
              <SelectItem value="grid"><span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> Grid</span></SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            data-testid="button-browse-templates"
            onClick={() => setTemplatesOpen(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" /> Browse Templates
          </Button>
          <Button data-testid="button-create-program" onClick={() => { form.reset(); setSheetOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Program
          </Button>
        </div>
      </div>

      {/* Program Templates Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pre-Built Programs</DialogTitle>
            <DialogDescription>
              Start from a ready-made program with phases and workouts already filled in. You can fully edit it after assigning it.
            </DialogDescription>
          </DialogHeader>
          {templatesLoading && <p className="text-muted-foreground text-sm py-4">Loading templates...</p>}
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            {templates?.map(t => (
              <Card key={t.key} data-testid={`card-template-${t.key}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span aria-hidden="true">{TEMPLATE_FOCUS_ICONS[t.focus] ?? "🏆"}</span>
                      {t.name}
                    </CardTitle>
                    <Badge variant="secondary">{t.focus}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {t.durationWeeks} weeks</span>
                    <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {t.phaseCount} phases</span>
                    <span className="flex items-center gap-1"><Dumbbell className="w-3.5 h-3.5" /> {t.daysPerWeek}x/week</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    data-testid={`button-use-template-${t.key}`}
                    disabled={instantiateTemplate.isPending}
                    onClick={() => handleUseTemplate(t.key)}
                  >
                    {instantiateTemplate.isPending ? "Creating…" : "Use This Template"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto bg-background">
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

      {/* Edit Sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto bg-background">
          <SheetHeader className="mb-4">
            <SheetTitle>Edit Program</SheetTitle>
          </SheetHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pb-8">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. 12-Week Strength Builder" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description <span className="text-muted-foreground">(Optional)</span></FormLabel><FormControl><Textarea placeholder="What is this program designed to achieve?" {...field} rows={3} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="durationWeeks" render={({ field }) => (
                <FormItem><FormLabel>Duration in weeks <span className="text-muted-foreground">(Optional)</span></FormLabel><FormControl><Input type="number" placeholder="e.g. 12" {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={updateProgram.isPending}>
                {updateProgram.isPending ? "Saving…" : "Save Changes"}
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

      <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
        {programs?.map(p => (
          <Link key={p.id} href={`/programs/${p.id}`} data-testid={`card-program-${p.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              {viewMode === "grid" ? (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEdit(p, e)}
                          className="text-muted-foreground hover:text-primary p-1 transition-colors"
                          data-testid={`button-edit-program-${p.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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
                </>
              ) : (
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.description && <p className="text-sm text-muted-foreground truncate">{p.description}</p>}
                  </div>
                  {p.durationWeeks && <p className="text-xs text-muted-foreground whitespace-nowrap">{p.durationWeeks} weeks</p>}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEdit(p, e)}
                      className="text-muted-foreground hover:text-primary p-1 transition-colors"
                      data-testid={`button-edit-program-${p.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                      data-testid={`button-delete-program-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
