import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetClient,
  useGetClientDashboard,
  useListWorkoutLogs,
  useListMeasurements,
  useListSleepLogs,
  useListNutritionLogs,
  useListProgressPhotos,
  useListAssignments,
  useListMessages,
  useSendMessage,
  useCreateAssignment,
  useDeleteAssignment,
  useUpdateAssignment,
  useGenerateInviteLink,
  useGetClientProgramAssignment,
  useGetProgram,
  useListPrograms,
  useAssignProgram,
  useListExercises,
  useAddExerciseToDay,
  useUpdateProgramExercise,
  useDeleteProgramExercise,
  getGetClientQueryKey,
  getListAssignmentsQueryKey,
  getListMessagesQueryKey,
  getGetClientDashboardQueryKey,
  getGetClientProgramAssignmentQueryKey,
  getGetProgramQueryKey,
  getListWorkoutLogsQueryKey,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Copy, Send, Plus, CheckCircle, Circle, Trash2, Link, ArrowLeft, ChevronDown, ChevronRight, Dumbbell, Pencil, X, Check } from "lucide-react";
import { Link as WLink } from "wouter";
import { format, parseISO } from "date-fns";

const messageSchema = z.object({ content: z.string().min(1) });
const assignmentSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["task", "nutrition", "mobility", "habit", "note"]),
  body: z.string().optional(),
  targetValue: z.string().optional(),
  dueDate: z.string().optional(),
});
const assignProgramSchema = z.object({
  programId: z.coerce.number().min(1),
  startDate: z.string().min(1),
});

type DayExercise = { id: number; exerciseName: string; muscleGroup: string; sets: number; reps: string; restSeconds?: number | null; weight?: string | null };
type ProgramDay = { id: number; name: string; notes?: string | null; exercises: DayExercise[] };

function EditableExerciseRow({
  ex,
  programId,
  dayId,
  onDeleted,
  onUpdated,
}: {
  ex: DayExercise;
  programId: number;
  dayId: number;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(String(ex.sets));
  const [reps, setReps] = useState(ex.reps);
  const [rest, setRest] = useState(ex.restSeconds != null ? String(ex.restSeconds) : "");
  const updateEx = useUpdateProgramExercise();
  const deleteEx = useDeleteProgramExercise();
  const { toast } = useToast();

  const handleSave = () => {
    updateEx.mutate(
      { programId, dayId, peId: ex.id, data: { sets: Number(sets) || ex.sets, reps: reps || ex.reps, restSeconds: rest ? Number(rest) : null } },
      {
        onSuccess: () => { setEditing(false); onUpdated(); },
        onError: () => toast({ title: "Failed to update exercise", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteEx.mutate(
      { programId, dayId, peId: ex.id },
      {
        onSuccess: onDeleted,
        onError: () => toast({ title: "Failed to remove exercise", variant: "destructive" }),
      }
    );
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{ex.exerciseName}</p>
          <div className="flex gap-1.5 mt-1.5">
            <input
              className="w-12 text-xs border border-border rounded px-1.5 py-1 bg-background text-center"
              value={sets}
              onChange={e => setSets(e.target.value)}
              placeholder="sets"
              type="number"
              min={1}
            />
            <span className="text-xs text-muted-foreground self-center">×</span>
            <input
              className="w-16 text-xs border border-border rounded px-1.5 py-1 bg-background text-center"
              value={reps}
              onChange={e => setReps(e.target.value)}
              placeholder="reps"
            />
            <input
              className="w-14 text-xs border border-border rounded px-1.5 py-1 bg-background text-center"
              value={rest}
              onChange={e => setRest(e.target.value)}
              placeholder="rest s"
              type="number"
              min={0}
            />
          </div>
        </div>
        <button onClick={handleSave} disabled={updateEx.isPending} className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{ex.exerciseName}</p>
        <p className="text-xs text-muted-foreground">{ex.muscleGroup}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold">{ex.sets}×{ex.reps}</p>
        {ex.restSeconds && <p className="text-xs text-muted-foreground">{ex.restSeconds}s rest</p>}
      </div>
      <button onClick={() => setEditing(true)} className="p-1.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={handleDelete} disabled={deleteEx.isPending} className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddExerciseRow({
  programId,
  dayId,
  currentCount,
  allExercises,
  onAdded,
}: {
  programId: number;
  dayId: number;
  currentCount: number;
  allExercises: { id: number; name: string; muscleGroup: string }[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10-12");
  const [rest, setRest] = useState("90");
  const [search, setSearch] = useState("");
  const addEx = useAddExerciseToDay();
  const { toast } = useToast();

  const filtered = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!selectedId) return;
    addEx.mutate(
      { programId, dayId, data: { exerciseId: Number(selectedId), sets: Number(sets) || 3, reps: reps || "10-12", order: currentCount + 1, restSeconds: rest ? Number(rest) : undefined } },
      {
        onSuccess: () => { setOpen(false); setSelectedId(""); setSearch(""); onAdded(); },
        onError: () => toast({ title: "Failed to add exercise", variant: "destructive" }),
      }
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 py-2 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add exercise
      </button>
    );
  }

  return (
    <div className="pt-2 space-y-2 border-t border-border/50">
      <input
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
        placeholder="Search exercises…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/50">
        {filtered.slice(0, 30).map(ex => (
          <button
            key={ex.id}
            onClick={() => setSelectedId(String(ex.id))}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedId === String(ex.id) ? "bg-primary/10 text-primary font-medium" : ""}`}
          >
            {ex.name} <span className="text-xs text-muted-foreground ml-1">{ex.muscleGroup}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3">No exercises found</p>}
      </div>
      {selectedId && (
        <div className="flex gap-2 items-center">
          <input className="w-14 text-xs border border-border rounded px-2 py-1.5 bg-background text-center" value={sets} onChange={e => setSets(e.target.value)} placeholder="sets" type="number" min={1} />
          <span className="text-xs text-muted-foreground">sets ×</span>
          <input className="w-20 text-xs border border-border rounded px-2 py-1.5 bg-background text-center" value={reps} onChange={e => setReps(e.target.value)} placeholder="e.g. 8-10" />
          <span className="text-xs text-muted-foreground">reps</span>
          <input className="w-16 text-xs border border-border rounded px-2 py-1.5 bg-background text-center" value={rest} onChange={e => setRest(e.target.value)} placeholder="rest" type="number" min={0} />
          <span className="text-xs text-muted-foreground">s rest</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={!selectedId || addEx.isPending} className="flex-1">
          {addEx.isPending ? "Adding…" : "Add"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setSelectedId(""); setSearch(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ProgramDayCard({ day, dayNumber, programId, onChanged }: { day: ProgramDay; dayNumber: number; programId: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: allExercises } = useListExercises({ query: { enabled: open, queryKey: getListExercisesQueryKey() } });
  const muscleGroups = [...new Set(day.exercises.map(e => e.muscleGroup))];

  return (
    <Card>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {dayNumber}
              </div>
              <div>
                <p className="font-semibold text-sm">{day.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {day.exercises.length} exercises · {muscleGroups.slice(0, 3).join(", ")}
                </p>
              </div>
            </div>
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {day.notes && <p className="text-xs text-muted-foreground mb-3 italic">{day.notes}</p>}
          <div className="space-y-0">
            {day.exercises.map(ex => (
              <EditableExerciseRow
                key={ex.id}
                ex={ex}
                programId={programId}
                dayId={day.id}
                onDeleted={onChanged}
                onUpdated={onChanged}
              />
            ))}
          </div>
          <AddExerciseRow
            programId={programId}
            dayId={day.id}
            currentCount={day.exercises.length}
            allExercises={allExercises ?? []}
            onAdded={onChanged}
          />
        </div>
      )}
    </Card>
  );
}

export function ClientProfile() {
  const { clientId: clientIdStr } = useParams<{ clientId: string }>();
  const clientId = Number(clientIdStr);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [msgInput, setMsgInput] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);

  const { data: client } = useGetClient(clientId, { query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) } });
  const { data: dashboard } = useGetClientDashboard(clientId, { query: { enabled: !!clientId, queryKey: getGetClientDashboardQueryKey(clientId) } });
  const { data: workoutLogs } = useListWorkoutLogs(clientId, { query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId) } });
  const { data: measurements } = useListMeasurements(clientId, { query: { enabled: !!clientId, queryKey: ["measurements", clientId] } });
  const { data: sleepLogs } = useListSleepLogs(clientId, { query: { enabled: !!clientId, queryKey: ["sleep", clientId] } });
  const { data: nutritionLogs } = useListNutritionLogs(clientId, { query: { enabled: !!clientId, queryKey: ["nutrition", clientId] } });
  const { data: progressPhotos } = useListProgressPhotos(clientId, { query: { enabled: !!clientId, queryKey: ["photos", clientId] } });
  const { data: assignments } = useListAssignments(clientId, { query: { enabled: !!clientId, queryKey: getListAssignmentsQueryKey(clientId) } });
  const { data: messages } = useListMessages(clientId, { query: { enabled: !!clientId, queryKey: getListMessagesQueryKey(clientId) } });
  const { data: programAssignment } = useGetClientProgramAssignment(clientId, { query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId) } });
  const { data: fullProgram } = useGetProgram(programAssignment?.programId ?? 0, { query: { enabled: !!programAssignment?.programId, queryKey: getGetProgramQueryKey(programAssignment?.programId ?? 0) } });
  const { data: programs } = useListPrograms();

  const sendMsg = useSendMessage();
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const updateAssignment = useUpdateAssignment();
  const generateInvite = useGenerateInviteLink();
  const assignProgram = useAssignProgram();

  const msgForm = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });
  const assignForm = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { title: "", type: "task", body: "", targetValue: "", dueDate: "" },
  });
  const programForm = useForm<z.infer<typeof assignProgramSchema>>({
    resolver: zodResolver(assignProgramSchema),
    defaultValues: { programId: 0, startDate: new Date().toISOString().split("T")[0] },
  });

  const handleSend = (values: z.infer<typeof messageSchema>) => {
    sendMsg.mutate({ clientId, data: { sender: "coach", content: values.content } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey(clientId) });
        msgForm.reset();
      },
    });
  };

  const handleCreateAssignment = (values: z.infer<typeof assignmentSchema>) => {
    createAssignment.mutate({ clientId, data: { title: values.title, type: values.type, body: values.body || undefined, targetValue: values.targetValue || undefined, dueDate: values.dueDate || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey(clientId) });
        setAssignDialogOpen(false);
        assignForm.reset();
        toast({ title: "Assignment created" });
      },
    });
  };

  const handleDeleteAssignment = (id: number) => {
    deleteAssignment.mutate({ clientId, assignmentId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey(clientId) }),
    });
  };

  const handleToggleAssignment = (id: number, status: string) => {
    updateAssignment.mutate({ clientId, assignmentId: id, data: { status: status === "pending" ? "completed" : "pending" } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey(clientId) }),
    });
  };

  const handleCopyInvite = () => {
    generateInvite.mutate({ clientId }, {
      onSuccess: (data) => {
        const url = `${window.location.origin}/client/join/${data.token}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Invite link copied!" });
      },
    });
  };

  const handleAssignProgram = (values: z.infer<typeof assignProgramSchema>) => {
    assignProgram.mutate({ clientId, data: { programId: values.programId, startDate: values.startDate } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClientProgramAssignmentQueryKey(clientId) });
        setProgramDialogOpen(false);
        toast({ title: "Program assigned" });
      },
    });
  };

  if (!client) return <div className="p-8 text-muted-foreground">Loading client...</div>;

  const pending = assignments?.filter(a => a.status === "pending") ?? [];
  const completed = assignments?.filter(a => a.status === "completed") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <WLink href="/clients" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </WLink>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground text-sm">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyInvite} data-testid="button-copy-invite">
          <Link className="w-4 h-4 mr-2" /> Copy Invite
        </Button>
      </div>

      {client.goal && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm"><span className="font-medium">Goal: </span>{client.goal}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full md:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="workouts">Workouts</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{dashboard?.workoutsThisWeek ?? 0}</p><p className="text-xs text-muted-foreground">workouts</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{dashboard?.pendingAssignments ?? 0}</p><p className="text-xs text-muted-foreground">assignments</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Program</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm font-semibold">{programAssignment?.programName ?? "None assigned"}</p>
                <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-1">Assign program</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Assign Program</DialogTitle></DialogHeader>
                    <Form {...programForm}>
                      <form onSubmit={programForm.handleSubmit(handleAssignProgram)} className="space-y-4">
                        <FormField control={programForm.control} name="programId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Program</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {programs?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={programForm.control} name="startDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={assignProgram.isPending}>Assign</Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          {(dashboard?.weightHistory?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Weight Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dashboard?.weightHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {dashboard?.latestMeasurement && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Latest Measurements</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {(["weight", "chest", "waist", "hips", "arms", "thighs", "calves"] as const).map(k => {
                    const val = dashboard.latestMeasurement?.[k];
                    if (!val) return null;
                    return (
                      <div key={k} className="text-center">
                        <p className="text-xs text-muted-foreground capitalize">{k}</p>
                        <p className="text-lg font-bold">{val}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Program */}
        <TabsContent value="program" className="mt-4 space-y-4">
          {!programAssignment ? (
            <div className="text-center py-16 text-muted-foreground">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No program assigned yet.</p>
              <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="mt-4">Assign a Program</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign Program</DialogTitle></DialogHeader>
                  <Form {...programForm}>
                    <form onSubmit={programForm.handleSubmit(handleAssignProgram)} className="space-y-4">
                      <FormField control={programForm.control} name="programId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Program</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {programs?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={programForm.control} name="startDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={assignProgram.isPending}>Assign</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-lg">{fullProgram?.name ?? programAssignment.programName}</p>
                      {fullProgram?.description && <p className="text-sm text-muted-foreground mt-0.5">{fullProgram.description}</p>}
                      <div className="flex gap-4 mt-2">
                        {fullProgram?.durationWeeks && <p className="text-xs text-muted-foreground">{fullProgram.durationWeeks} weeks</p>}
                        <p className="text-xs text-muted-foreground">Started {programAssignment.startDate}</p>
                        {fullProgram?.days && <p className="text-xs text-muted-foreground">{fullProgram.days.length} days</p>}
                      </div>
                    </div>
                    <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Assign Program</DialogTitle></DialogHeader>
                        <Form {...programForm}>
                          <form onSubmit={programForm.handleSubmit(handleAssignProgram)} className="space-y-4">
                            <FormField control={programForm.control} name="programId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Program</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {programs?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={programForm.control} name="startDate" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={assignProgram.isPending}>Assign</Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {fullProgram?.days?.map((day, idx) => (
                  <ProgramDayCard key={day.id} day={day} dayNumber={idx + 1} programId={programAssignment!.programId} onChanged={() => qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programAssignment!.programId) })} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Workouts */}
        <TabsContent value="workouts" className="mt-4 space-y-3">
          {(workoutLogs?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No workouts logged yet.</p>}
          {workoutLogs?.slice().reverse().map(log => (
            <Card key={log.id} data-testid={`card-workout-${log.id}`}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.programDayName ?? "Free workout"}</p>
                  <p className="text-xs text-muted-foreground">{log.date}{log.durationMinutes ? ` · ${log.durationMinutes}min` : ""}</p>
                </div>
                <Badge variant="secondary">{log.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Measurements */}
        <TabsContent value="measurements" className="mt-4 space-y-3">
          {(measurements?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No measurements logged.</p>}
          {measurements?.slice().reverse().map(m => (
            <Card key={m.id} data-testid={`card-measurement-${m.id}`}>
              <CardContent className="pt-4 pb-4">
                <p className="font-medium text-sm mb-2">{m.date}</p>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  {(["weight", "chest", "waist", "hips", "arms", "thighs", "calves"] as const).map(k => {
                    const val = m[k];
                    if (!val) return null;
                    return (
                      <div key={k} className="text-center">
                        <p className="text-xs text-muted-foreground capitalize">{k}</p>
                        <p className="font-bold">{val}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Sleep */}
        <TabsContent value="sleep" className="mt-4 space-y-3">
          {(sleepLogs?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No sleep logs.</p>}
          {sleepLogs?.slice().reverse().map(s => (
            <Card key={s.id} data-testid={`card-sleep-${s.id}`}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.date}</p>
                  <p className="text-xs text-muted-foreground">{s.notes}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{s.hoursSlept}h</p>
                  {s.quality && <Badge variant="outline">{s.quality}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Nutrition */}
        <TabsContent value="nutrition" className="mt-4">
          {(nutritionLogs?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No nutrition logs.</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {nutritionLogs?.slice().reverse().map(n => (
              <Card key={n.id} data-testid={`card-nutrition-${n.id}`} className="overflow-hidden">
                <img src={n.imageUrl} alt="Nutrition" className="w-full aspect-square object-cover" />
                <CardContent className="p-2">
                  <p className="text-xs font-medium">{n.date}</p>
                  {n.calories && <p className="text-xs text-muted-foreground">{n.calories} kcal</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Photos */}
        <TabsContent value="photos" className="mt-4">
          {(progressPhotos?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No progress photos.</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {progressPhotos?.slice().reverse().map(p => (
              <Card key={p.id} data-testid={`card-photo-${p.id}`} className="overflow-hidden">
                <img src={p.imageUrl} alt="Progress" className="w-full aspect-square object-cover" />
                <CardContent className="p-2">
                  <p className="text-xs font-medium">{p.date}</p>
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Assignments */}
        <TabsContent value="assignments" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-assignment"><Plus className="w-4 h-4 mr-1" /> New Assignment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
                <Form {...assignForm}>
                  <form onSubmit={assignForm.handleSubmit(handleCreateAssignment)} className="space-y-4">
                    <FormField control={assignForm.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={assignForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="task">Task</SelectItem>
                            <SelectItem value="nutrition">Nutrition</SelectItem>
                            <SelectItem value="mobility">Mobility</SelectItem>
                            <SelectItem value="habit">Habit</SelectItem>
                            <SelectItem value="note">Note</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={assignForm.control} name="body" render={({ field }) => (
                      <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
                    )} />
                    <FormField control={assignForm.control} name="targetValue" render={({ field }) => (
                      <FormItem><FormLabel>Target</FormLabel><FormControl><Input {...field} placeholder="e.g. 8000 steps" /></FormControl></FormItem>
                    )} />
                    <FormField control={assignForm.control} name="dueDate" render={({ field }) => (
                      <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createAssignment.isPending}>Create</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending ({pending.length})</p>
              {pending.map(a => (
                <Card key={a.id} data-testid={`card-assignment-${a.id}`}>
                  <CardContent className="pt-4 pb-4 flex items-start gap-3">
                    <button onClick={() => handleToggleAssignment(a.id, a.status)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <p className="font-medium">{a.title}</p>
                      {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{a.type}</Badge>
                        {a.dueDate && <span className="text-xs text-muted-foreground">Due {a.dueDate}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAssignment(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Completed ({completed.length})</p>
              {completed.map(a => (
                <Card key={a.id} className="opacity-60" data-testid={`card-assignment-done-${a.id}`}>
                  <CardContent className="pt-4 pb-4 flex items-start gap-3">
                    <button onClick={() => handleToggleAssignment(a.id, a.status)} className="mt-0.5 text-primary">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <p className="font-medium line-through">{a.title}</p>
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                    </div>
                    <button onClick={() => handleDeleteAssignment(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {assignments?.length === 0 && <p className="text-muted-foreground text-sm">No assignments yet.</p>}
        </TabsContent>

        {/* Messages */}
        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardContent className="p-4 flex flex-col gap-4" style={{ height: "500px" }}>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {(messages?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm text-center mt-8">No messages yet. Start the conversation.</p>}
                {messages?.map(m => (
                  <div key={m.id} data-testid={`msg-${m.id}`} className={`flex ${m.sender === "coach" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.sender === "coach" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p>{m.content}</p>
                      <p className={`text-xs mt-1 ${m.sender === "coach" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {format(parseISO(m.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Form {...msgForm}>
                <form onSubmit={msgForm.handleSubmit(handleSend)} className="flex gap-2">
                  <FormField control={msgForm.control} name="content" render={({ field }) => (
                    <FormItem className="flex-1 mb-0">
                      <FormControl>
                        <Input placeholder="Write a message..." {...field} data-testid="input-message" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" size="icon" disabled={sendMsg.isPending} data-testid="button-send-message">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
