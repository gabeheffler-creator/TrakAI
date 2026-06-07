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
  getGetClientQueryKey,
  getListAssignmentsQueryKey,
  getListMessagesQueryKey,
  getGetClientDashboardQueryKey,
  getGetClientProgramAssignmentQueryKey,
  getGetProgramQueryKey,
  getListWorkoutLogsQueryKey,
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
import { Copy, Send, Plus, CheckCircle, Circle, Trash2, Link, ArrowLeft, ChevronDown, ChevronRight, Dumbbell } from "lucide-react";
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

function ProgramDayCard({ day, dayNumber }: { day: { id: number; name: string; notes?: string | null; exercises: Array<{ id: number; exerciseName: string; muscleGroup: string; sets: number; reps: string; restSeconds?: number | null; weight?: string | null }> }; dayNumber: number }) {
  const [open, setOpen] = useState(false);
  const muscleGroups = [...new Set(day.exercises.map(e => e.muscleGroup))];
  return (
    <Card>
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
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
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {day.notes && <p className="text-xs text-muted-foreground mb-3 italic">{day.notes}</p>}
          {day.exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ex.exerciseName}</p>
                <p className="text-xs text-muted-foreground">{ex.muscleGroup}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold">{ex.sets}×{ex.reps}</p>
                {ex.restSeconds && <p className="text-xs text-muted-foreground">{ex.restSeconds}s rest</p>}
              </div>
            </div>
          ))}
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
                  <ProgramDayCard key={day.id} day={day} dayNumber={idx + 1} />
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
