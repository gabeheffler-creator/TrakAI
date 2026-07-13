import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetClient,
  useUpdateClient,
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

  useGetClientProgramAssignment,
  useGetProgram,
  useListPrograms,
  useAssignProgram,
  useSyncProgramFromTemplate,
  useListExercises,
  useAddExerciseToDay,
  useUpdateProgramExercise,
  useDeleteProgramExercise,
  useGetWorkoutLog,
  useListCoachNotes,
  useCreateCoachNote,
  useUpdateCoachNote,
  useDeleteCoachNote,
  useListCallLogs,
  useCreateCallLog,
  useDeleteCallLog,
  useGenerateInviteLink,
  useCreateClientGoal,
  useListClientGoalHistory,
  useListClientProgramAssignmentHistory,
  getGetWorkoutLogQueryKey,
  getGetClientQueryKey,
  getListAssignmentsQueryKey,
  getListMessagesQueryKey,
  getGetClientDashboardQueryKey,
  getGetClientProgramAssignmentQueryKey,
  getGetProgramQueryKey,
  getListWorkoutLogsQueryKey,
  getListExercisesQueryKey,
  getListCoachNotesQueryKey,
  getListCallLogsQueryKey,
  getListClientGoalHistoryQueryKey,
  getListClientProgramAssignmentHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Copy, Send, Plus, CheckCircle, Circle, Trash2, ArrowLeft, ChevronDown, ChevronRight, Dumbbell, Pencil, X, Check, Phone, StickyNote, Clock, Video, Target } from "lucide-react";
import { Link as WLink } from "wouter";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";
import { VideoCall } from "@/components/video-call";

// ── Vertical drum / scroll picker ────────────────────────────
const ITEM_H = 40;
const VISIBLE = 5; // must be odd; center = selected

function DrumDial({
  label, pct, onChange, color, grams,
}: {
  label: string; pct: number; onChange: (p: number) => void;
  color: string; grams: number | null;
}) {
  const containerH = ITEM_H * VISIBLE;
  const startRef = useRef<{ y: number; pct: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { y: e.clientY, pct };
  }, [pct]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || e.buttons === 0) return;
    const delta = startRef.current.y - e.clientY;   // drag up = increase
    const next = Math.round(startRef.current.pct + delta / ITEM_H);
    onChange(Math.max(0, Math.min(100, next)));
  }, [onChange]);

  const handlePointerUp = useCallback(() => { startRef.current = null; }, []);

  // translateY so selected item sits in the middle slot
  const translateY = -pct * ITEM_H + (VISIBLE - 1) / 2 * ITEM_H;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Drum container */}
      <div
        className="relative overflow-hidden cursor-ns-resize touch-none"
        style={{ height: containerH, width: 72 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Center highlight band */}
        <div
          className="absolute inset-x-0 pointer-events-none z-10 rounded-lg border border-border/60"
          style={{ top: (VISIBLE - 1) / 2 * ITEM_H, height: ITEM_H, background: `${color}18` }}
        />

        {/* Scrolling list — show only nearby values for perf */}
        <div
          className="absolute w-full"
          style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}
        >
          {Array.from({ length: 101 }, (_, v) => {
            const dist = Math.abs(v - pct);
            const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.25 : 0.08;
            const scale  = dist === 0 ? 1 : dist === 1 ? 0.88 : 0.78;
            return (
              <div
                key={v}
                className="flex items-center justify-center font-semibold tabular-nums"
                style={{ height: ITEM_H, fontSize: 15, opacity, transform: `scale(${scale})`, color: dist === 0 ? color : undefined, transition: "opacity 80ms, transform 80ms" }}
              >
                {v}%
              </div>
            );
          })}
        </div>

        {/* Fade top */}
        <div className="absolute inset-x-0 top-0 pointer-events-none z-20" style={{ height: ITEM_H * 2, background: "linear-gradient(to bottom, var(--background) 30%, transparent)" }} />
        {/* Fade bottom */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20" style={{ height: ITEM_H * 2, background: "linear-gradient(to top, var(--background) 30%, transparent)" }} />
      </div>

      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <p className="text-xs text-muted-foreground">{grams !== null ? `${grams}g` : "—"}</p>
    </div>
  );
}

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

function ExpandableWorkoutCard({ log, clientId }: { log: { id: number; date: string; programDayName?: string | null; durationMinutes?: number | null; status: string; notes?: string | null }; clientId: number }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useGetWorkoutLog(clientId, log.id, {
    query: { enabled: open, queryKey: getGetWorkoutLogQueryKey(clientId, log.id) }
  });

  const byExercise = (detail?.sets ?? []).reduce<Record<string, NonNullable<typeof detail>["sets"]>>((acc, s) => {
    (acc[s.exerciseName] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Card data-testid={`card-workout-${log.id}`}>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{log.programDayName ?? "Free workout"}</p>
                <Badge
                  variant={log.status === "completed" ? "default" : log.status === "early_exit" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {log.status === "early_exit" ? "Finished early" : log.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{log.date}{log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}</p>
            </div>
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {log.status === "early_exit" && log.notes && (
            <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs font-medium text-destructive mb-0.5">Reason for finishing early</p>
              <p className="text-xs text-foreground">{log.notes}</p>
            </div>
          )}
          {isLoading && <p className="text-xs text-muted-foreground">Loading sets…</p>}
          {!isLoading && (detail?.sets ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">No sets recorded</p>
          )}
          {!isLoading && Object.entries(byExercise).map(([name, sets]) => (
            <div key={name} className="mb-3 last:mb-0">
              <p className="text-sm font-medium mb-1.5">{name}</p>
              <div className="space-y-1">
                {sets.map(s => (
                  <div key={s.setNumber} className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground w-10 font-mono">Set {s.setNumber}</span>
                    <span className="text-muted-foreground">{s.reps} reps</span>
                    {s.weight != null && (
                      <span className="font-semibold text-foreground">{s.weight} {s.weightUnit ?? "lbs"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [msgInput, setMsgInput] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [clientGoalEditOpen, setClientGoalEditOpen] = useState(false);
  const [clientGoalValue, setClientGoalValue] = useState("");
  const [clientGoalTargetDate, setClientGoalTargetDate] = useState("");
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState("");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("");
  const [nutritionGoal, setNutritionGoal] = useState<Record<string, number | null> | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalInputs, setGoalInputs] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const generateInvite = useGenerateInviteLink();

  const handleCopyInviteLink = () => {
    generateInvite.mutate({ clientId }, {
      onSuccess: (inv) => {
        // The invite link points to the Trak Client app, not this (coach) app,
        // so it uses the client app's base path, not this app's BASE_URL.
        const url = `${window.location.origin}/client/join/${inv.token}`;
        setInviteLink(url);
        navigator.clipboard?.writeText(url).catch(() => {});
        toast({ title: "Invite link copied to clipboard" });
      },
      onError: () => toast({ title: "Failed to generate invite link", variant: "destructive" }),
    });
  };

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/clients/${clientId}/nutrition-goal`)
      .then(r => r.ok ? r.json() : null)
      .then(g => { if (g) { setNutritionGoal(g); setGoalInputs({ calories: String(g.calories ?? ""), protein: String(g.protein ?? ""), carbs: String(g.carbs ?? ""), fat: String(g.fat ?? "") }); } })
      .catch(() => {});
  }, [clientId]);

  const handleSetGoal = async () => {
    try {
      const body = {
        calories: goalInputs.calories ? Number(goalInputs.calories) : undefined,
        protein: goalInputs.protein ? Number(goalInputs.protein) : undefined,
        carbs: goalInputs.carbs ? Number(goalInputs.carbs) : undefined,
        fat: goalInputs.fat ? Number(goalInputs.fat) : undefined,
        periodType: "day",
      };
      const res = await fetch(`/api/clients/${clientId}/nutrition-goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const g = await res.json();
        setNutritionGoal(g);
        setGoalDialogOpen(false);
        toast({ title: "Nutrition goal saved!" });
      }
    } catch { toast({ title: "Failed to save goal", variant: "destructive" }); }
  };

  const { data: client, isError: clientError, refetch: refetchClient, isFetching: clientFetching } = useGetClient(clientId, { query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) } });
  const { data: dashboard } = useGetClientDashboard(clientId, { query: { enabled: !!clientId, queryKey: getGetClientDashboardQueryKey(clientId) } });
  const { data: goalHistory } = useListClientGoalHistory(clientId, { query: { enabled: !!clientId, queryKey: getListClientGoalHistoryQueryKey(clientId) } });
  const { data: workoutLogs } = useListWorkoutLogs(clientId, { query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId) } });
  const { data: measurements } = useListMeasurements(clientId, { query: { enabled: !!clientId, queryKey: ["measurements", clientId] } });
  const { data: sleepLogs } = useListSleepLogs(clientId, { query: { enabled: !!clientId, queryKey: ["sleep", clientId] } });
  const { data: nutritionLogs } = useListNutritionLogs(clientId, { query: { enabled: !!clientId, queryKey: ["nutrition", clientId] } });
  const { data: progressPhotos } = useListProgressPhotos(clientId, { query: { enabled: !!clientId, queryKey: ["photos", clientId] } });
  const { data: assignments } = useListAssignments(clientId, { query: { enabled: !!clientId, queryKey: getListAssignmentsQueryKey(clientId) } });
  const { data: messages } = useListMessages(clientId, { query: { enabled: !!clientId, queryKey: getListMessagesQueryKey(clientId) } });
  const { data: programAssignment } = useGetClientProgramAssignment(clientId, { query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId) } });
  const { data: coachNotes, refetch: refetchNotes } = useListCoachNotes(clientId, { query: { enabled: !!clientId, queryKey: getListCoachNotesQueryKey(clientId) } });
  const { data: callLogs, refetch: refetchCallLogs } = useListCallLogs(clientId, { query: { enabled: !!clientId, queryKey: getListCallLogsQueryKey(clientId) } });
  const { data: fullProgram } = useGetProgram(programAssignment?.programId ?? 0, { query: { enabled: !!programAssignment?.programId, queryKey: getGetProgramQueryKey(programAssignment?.programId ?? 0) } });
  const { data: programs } = useListPrograms();
  const { data: programHistory } = useListClientProgramAssignmentHistory(clientId, { query: { enabled: !!clientId, queryKey: getListClientProgramAssignmentHistoryQueryKey(clientId) } });

  const sendMsg = useSendMessage();
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const updateClientMutation = useUpdateClient();
  const createGoalMutation = useCreateClientGoal();
  const updateAssignment = useUpdateAssignment();

  const assignProgram = useAssignProgram();
  const syncFromTemplate = useSyncProgramFromTemplate();
  const createNote = useCreateCoachNote();
  const updateNote = useUpdateCoachNote();
  const deleteNote = useDeleteCoachNote();
  const createCall = useCreateCallLog();
  const deleteCall = useDeleteCallLog();

  // Coach notes state
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Call log state
  const [callDate, setCallDate] = useState(new Date().toISOString().split("T")[0]);
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");

  // Video call state
  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const handleStartVideoCall = async () => {
    try { await fetch(`/api/clients/${clientId}/video-call/start`, { method: "POST" }); } catch { /* ignore */ }
    setVideoCallOpen(true);
  };

  const handleEndVideoCall = async () => {
    try { await fetch(`/api/clients/${clientId}/video-call/end`, { method: "POST" }); } catch { /* ignore */ }
    setVideoCallOpen(false);
  };

  const handleCreateNote = () => {
    if (!noteContent.trim()) return;
    createNote.mutate({ clientId, data: { content: noteContent.trim() } }, {
      onSuccess: () => { refetchNotes(); setNoteContent(""); },
      onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
    });
  };

  const handleUpdateNote = (noteId: number) => {
    if (!editingNoteContent.trim()) return;
    updateNote.mutate({ clientId, noteId, data: { content: editingNoteContent.trim() } }, {
      onSuccess: () => { refetchNotes(); setEditingNoteId(null); },
      onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
    });
  };

  const handleDeleteNote = (noteId: number) => {
    deleteNote.mutate({ clientId, noteId }, {
      onSuccess: () => refetchNotes(),
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };

  const handleLogCall = () => {
    if (!callDate) return;
    createCall.mutate({ clientId, data: { date: callDate, durationMinutes: callDuration ? Number(callDuration) : undefined, notes: callNotes || undefined } }, {
      onSuccess: () => { refetchCallLogs(); setCallDuration(""); setCallNotes(""); },
      onError: () => toast({ title: "Failed to log call", variant: "destructive" }),
    });
  };

  const handleDeleteCall = (callId: number) => {
    deleteCall.mutate({ clientId, callId }, {
      onSuccess: () => refetchCallLogs(),
      onError: () => toast({ title: "Failed to delete call", variant: "destructive" }),
    });
  };

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

  const handleAssignProgram = (values: z.infer<typeof assignProgramSchema>) => {
    assignProgram.mutate({ clientId, data: { programId: values.programId, startDate: values.startDate } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClientProgramAssignmentQueryKey(clientId) });
        qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programAssignment?.programId ?? 0) });
        qc.invalidateQueries({ queryKey: getListClientProgramAssignmentHistoryQueryKey(clientId) });
        setProgramDialogOpen(false);
        toast({ title: "Program assigned" });
      },
    });
  };

  const handleSyncFromTemplate = () => {
    syncFromTemplate.mutate({ clientId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClientProgramAssignmentQueryKey(clientId) });
        qc.invalidateQueries({ queryKey: getGetProgramQueryKey(programAssignment?.programId ?? 0) });
        qc.invalidateQueries({ queryKey: getListClientProgramAssignmentHistoryQueryKey(clientId) });
        toast({ title: "Program synced from template" });
      },
      onError: () => toast({ title: "Failed to sync program", variant: "destructive" }),
    });
  };

  if (clientError) {
    return (
      <QueryErrorState
        message="Couldn't load this client. This is usually temporary."
        onRetry={() => refetchClient()}
        isRetrying={clientFetching}
        testId="button-retry-client"
        className="p-8"
      />
    );
  }

  if (!client) return <div className="p-8 text-muted-foreground">Loading client...</div>;

  const pending = assignments?.filter(a => a.status === "pending") ?? [];
  const completed = assignments?.filter(a => a.status === "completed") ?? [];

  const videoRoomName = `trak-coaching-${clientId}`;

  return (
    <div className="space-y-6">
      {videoCallOpen && (
        <VideoCall
          roomName={videoRoomName}
          displayName="Coach"
          onClose={handleEndVideoCall}
        />
      )}

      <div className="flex items-center gap-4">
        <WLink href="/clients" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </WLink>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground text-sm">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyInviteLink}
          disabled={generateInvite.isPending}
          data-testid="button-copy-invite-link"
        >
          <Copy className="w-4 h-4 mr-2" /> {generateInvite.isPending ? "Generating…" : "Copy Invite Link"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleStartVideoCall}>
          <Video className="w-4 h-4 mr-2" /> Video Call
        </Button>
      </div>

      {inviteLink && (
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
            <p className="text-sm break-all" data-testid="text-invite-link">{inviteLink}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          {client.goal ? (
            <div className="min-w-0">
              <p className="text-sm"><span className="font-medium">Goal: </span>{client.goal}</p>
              {client.goalTargetDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Due {format(new Date(client.goalTargetDate), "MMM d, yyyy")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No goal set</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {client.goal ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setClientGoalValue(client.goal ?? ""); setClientGoalTargetDate(client.goalTargetDate ?? ""); setClientGoalEditOpen(true); }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Change goal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setNewGoalValue(""); setNewGoalTargetDate(""); setNewGoalOpen(true); }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New goal
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNewGoalValue(""); setNewGoalTargetDate(""); setNewGoalOpen(true); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New goal
              </Button>
            )}
            {(goalHistory && goalHistory.length > 0) && (
              <button
                onClick={() => setLocation(`/clients/${clientId}/goal-history`)}
                className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
              >
                View goal history
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change goal dialog — edits current goal in place */}
      <Dialog open={clientGoalEditOpen} onOpenChange={setClientGoalEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Goal</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              updateClientMutation.mutate(
                { clientId, data: { goal: clientGoalValue || null, goalTargetDate: clientGoalTargetDate || null } },
                {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
                    setClientGoalEditOpen(false);
                    toast({ title: "Goal updated" });
                  },
                  onError: () => toast({ title: "Failed to update goal", variant: "destructive" }),
                }
              );
            }}
          >
            <Input
              value={clientGoalValue}
              onChange={e => setClientGoalValue(e.target.value)}
              placeholder="e.g. Lose 15 lbs, build strength"
              autoFocus
            />
            <div>
              <label className="text-sm font-medium">Target date <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                type="date"
                value={clientGoalTargetDate}
                onChange={e => setClientGoalTargetDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* New goal dialog — archives current goal and sets a new one */}
      <Dialog open={newGoalOpen} onOpenChange={setNewGoalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Goal</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              createGoalMutation.mutate(
                { clientId, data: { goal: newGoalValue, goalTargetDate: newGoalTargetDate || null } },
                {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
                    qc.invalidateQueries({ queryKey: getListClientGoalHistoryQueryKey(clientId) });
                    setNewGoalOpen(false);
                    toast({ title: "New goal created" });
                  },
                  onError: () => toast({ title: "Failed to create goal", variant: "destructive" }),
                }
              );
            }}
          >
            <Input
              value={newGoalValue}
              onChange={e => setNewGoalValue(e.target.value)}
              placeholder="e.g. Run a 5K under 30 minutes"
              autoFocus
            />
            <div>
              <label className="text-sm font-medium">Target date <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                type="date"
                value={newGoalTargetDate}
                onChange={e => setNewGoalTargetDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setNewGoalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createGoalMutation.isPending || !newGoalValue.trim()}
              >
                {createGoalMutation.isPending ? "Creating…" : "Create new goal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-none border-b border-border">
          <TabsList className="flex w-max h-auto bg-transparent p-0 gap-0">
            {[
              { value: "overview", label: "Overview" },
              { value: "program", label: "Program" },
              { value: "workouts", label: "Workouts" },
              { value: "measurements", label: "Measurements" },
              { value: "sleep", label: "Sleep" },
              { value: "nutrition", label: "Nutrition" },
              { value: "photos", label: "Photos" },
              { value: "tasks", label: "Tasks" },
              { value: "messages", label: "Messages" },
              { value: "notes", label: "Notes", icon: <StickyNote className="w-3 h-3" /> },
              { value: "calls", label: "Calls", icon: <Phone className="w-3 h-3" /> },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-sm px-4 py-2.5 h-auto rounded-none bg-transparent font-medium text-muted-foreground border-b-2 border-transparent -mb-px data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-foreground whitespace-nowrap"
              >
                {tab.icon}{tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{dashboard?.workoutsThisWeek ?? 0}</p><p className="text-xs text-muted-foreground">workouts</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{dashboard?.pendingAssignments ?? 0}</p><p className="text-xs text-muted-foreground">tasks</p></CardContent>
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
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setLocation(`/programs/${programAssignment!.programId}`)}>Edit Program</Button>
                      {fullProgram?.sourceTemplateId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={syncFromTemplate.isPending}>
                              {syncFromTemplate.isPending ? "Syncing…" : "Sync from template"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sync from template?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will replace the client's current program with a fresh copy of the original template. Any edits made to the client's copy will be lost. Completed workout logs are preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleSyncFromTemplate}>Sync</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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

          {(programHistory?.length ?? 0) > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Previous programs</p>
              <div className="space-y-2">
                {programHistory!.map(entry => (
                  <div key={entry.id} className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{entry.programName}</p>
                        {entry.sourceTemplateName && (
                          <p className="text-xs text-muted-foreground mt-0.5">From template: {entry.sourceTemplateName}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.startDate} → {entry.endDate ?? "ongoing"}
                        </p>
                      </div>
                      {entry.durationWeeks != null && (
                        <Badge variant="secondary" className="shrink-0 text-xs">{entry.durationWeeks}w</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Workouts */}
        <TabsContent value="workouts" className="mt-4 space-y-3">
          {(workoutLogs?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No workouts logged yet.</p>}
          {workoutLogs?.slice().reverse().map(log => (
            <ExpandableWorkoutCard key={log.id} log={log} clientId={clientId} />
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
          {/* Coach-set goal */}
          <div className="mb-4 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Daily Nutrition Goal</p>
                {nutritionGoal ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {nutritionGoal.calories ?? "—"} kcal · P {nutritionGoal.protein ?? "—"}g · C {nutritionGoal.carbs ?? "—"}g · F {nutritionGoal.fat ?? "—"}g
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">No goal set yet</p>
                )}
              </div>
              <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Target className="w-3.5 h-3.5 mr-1.5" /> Set Goal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Set Daily Nutrition Goal</DialogTitle></DialogHeader>
                  {(() => {
                    const cal = Number(goalInputs.calories) || 0;
                    // pct from stored grams
                    const proteinPct = cal > 0 ? Math.min(100, Math.round((Number(goalInputs.protein || 0) * 4 / cal) * 100)) : 0;
                    const carbsPct   = cal > 0 ? Math.min(100, Math.round((Number(goalInputs.carbs   || 0) * 4 / cal) * 100)) : 0;
                    const fatPct     = cal > 0 ? Math.min(100, Math.round((Number(goalInputs.fat     || 0) * 9 / cal) * 100)) : 0;
                    const totalPct   = proteinPct + carbsPct + fatPct;

                    const setDialPct = (macro: "protein" | "carbs" | "fat", pct: number) => {
                      const calsPerG = macro === "fat" ? 9 : 4;
                      const grams = cal > 0 ? Math.round((pct / 100) * cal / calsPerG) : 0;
                      setGoalInputs(p => ({ ...p, [macro]: String(grams) }));
                    };

                    const proteinG = cal > 0 ? Math.round((proteinPct / 100) * cal / 4) : null;
                    const carbsG   = cal > 0 ? Math.round((carbsPct   / 100) * cal / 4) : null;
                    const fatG     = cal > 0 ? Math.round((fatPct     / 100) * cal / 9) : null;

                    return (
                      <div className="space-y-5 mt-2">
                        {/* Calories */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Daily Calories (kcal)</label>
                          <Input
                            type="number" min={0}
                            value={goalInputs.calories}
                            onChange={e => setGoalInputs(p => ({ ...p, calories: e.target.value }))}
                            placeholder="e.g. 2000"
                          />
                        </div>

                        {/* Macro dials */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-3 text-center">Macro Split — scroll each drum up/down</p>
                          <div className="grid grid-cols-3 gap-2 justify-items-center">
                            <DrumDial
                              label="Protein" pct={proteinPct} grams={proteinG}
                              color="#3b82f6"
                              onChange={p => setDialPct("protein", p)}
                            />
                            <DrumDial
                              label="Carbs" pct={carbsPct} grams={carbsG}
                              color="#f97316"
                              onChange={p => setDialPct("carbs", p)}
                            />
                            <DrumDial
                              label="Fat" pct={fatPct} grams={fatG}
                              color="#eab308"
                              onChange={p => setDialPct("fat", p)}
                            />
                          </div>

                          {/* Total % indicator */}
                          <div className="mt-3 flex items-center justify-center gap-1.5">
                            <span className={`text-xs font-medium tabular-nums ${totalPct === 100 ? "text-green-600 dark:text-green-400" : totalPct > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                              Total: {totalPct}%
                            </span>
                            {totalPct === 100 && <Check className="w-3.5 h-3.5 text-green-500" />}
                            {totalPct > 0 && totalPct !== 100 && (
                              <span className="text-xs text-muted-foreground italic">
                                {totalPct < 100 ? `(${100 - totalPct}% unallocated)` : `(${totalPct - 100}% over)`}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button className="w-full" onClick={handleSetGoal}>Save Goal</Button>
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {(nutritionLogs?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No nutrition logs yet.</p>}
          {nutritionLogs && nutritionLogs.length > 0 && (() => {
            // Group by date, most recent first
            const byDate = nutritionLogs.reduce<Record<string, typeof nutritionLogs>>((acc, n) => {
              (acc[n.date] ??= []).push(n);
              return acc;
            }, {});
            const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

            return (
              <div className="space-y-5">
                {sortedDates.map(date => {
                  const entries = byDate[date];
                  const photos = entries.filter(n => n.imageUrl && n.imageUrl !== "cant_track" && n.imageUrl !== "water_only");
                  const cantTrack = entries.filter(n => n.imageUrl === "cant_track");
                  const water = entries.find(n => n.imageUrl === "water_only");
                  const ML_PER_OZ = 29.5735;
                  const OZ_PER_GLASS = 8;

                  // Sum macros across all photo entries that have them
                  const totals = photos.reduce((acc, n) => ({
                    calories: acc.calories + (n.calories ?? 0),
                    protein: acc.protein + (n.protein ?? 0),
                    carbs: acc.carbs + (n.carbs ?? 0),
                    fat: acc.fat + (n.fat ?? 0),
                    sodium: acc.sodium + (n.sodium ?? 0),
                  }), { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 });

                  const hasMacros = totals.calories > 0 || totals.protein > 0;

                  return (
                    <div key={date} className="border border-border rounded-xl overflow-hidden">
                      {/* Date header + macro summary */}
                      <div className="px-4 py-3 bg-muted/40 border-b border-border flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold">{format(parseISO(date), "EEE, MMM d")}</span>
                        {hasMacros && (
                          <div className="flex flex-wrap gap-2 ml-auto">
                            {totals.calories > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {totals.calories} kcal
                              </span>
                            )}
                            {totals.protein > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                P {totals.protein}g
                              </span>
                            )}
                            {totals.carbs > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                                C {totals.carbs}g
                              </span>
                            )}
                            {totals.fat > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
                                F {totals.fat}g
                              </span>
                            )}
                            {totals.sodium > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                Na {totals.sodium}mg
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-3 space-y-3">
                        {/* Screenshot entries */}
                        {photos.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {photos.map(n => (
                              <div key={n.id} className="rounded-lg overflow-hidden border border-border bg-card">
                                <img
                                  src={n.imageUrl}
                                  alt={n.notes ?? "MFP screenshot"}
                                  className="w-full aspect-[3/4] object-cover object-top cursor-pointer"
                                  onClick={() => window.open(n.imageUrl, "_blank")}
                                />
                                <div className="px-2 py-1.5">
                                  {n.notes && <p className="text-[11px] text-muted-foreground truncate">{n.notes}</p>}
                                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                                    {n.calories != null && <span className="text-[11px] font-semibold text-primary">{n.calories} kcal</span>}
                                    {n.protein != null && <span className="text-[11px] text-muted-foreground">P{n.protein}g</span>}
                                    {n.carbs != null && <span className="text-[11px] text-muted-foreground">C{n.carbs}g</span>}
                                    {n.fat != null && <span className="text-[11px] text-muted-foreground">F{n.fat}g</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Water */}
                        {water && water.waterMl && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="text-base">💧</span>
                            <span>{Math.round(water.waterMl / ML_PER_OZ / OZ_PER_GLASS)} glasses ({Math.round(water.waterMl / ML_PER_OZ)} oz)</span>
                          </div>
                        )}

                        {/* Can't track entries */}
                        {cantTrack.map(n => (
                          <div key={n.id} className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                            <span className="text-sm mt-0.5">⚠️</span>
                            <div>
                              <p className="text-xs font-medium text-destructive">Can't track</p>
                              {n.notes && <p className="text-xs text-muted-foreground mt-0.5">{n.notes}</p>}
                              {n.calories != null && <p className="text-xs text-muted-foreground">~{n.calories} kcal</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-assignment"><Plus className="w-4 h-4 mr-1" /> New Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
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

          {assignments?.length === 0 && <p className="text-muted-foreground text-sm">No tasks yet.</p>}
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

        {/* Coach Notes (private) */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Private Notes
                <Badge variant="secondary" className="text-xs font-normal">Visible to coach only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note about this client..."
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  className="resize-none min-h-[80px] flex-1 text-sm"
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreateNote(); }}
                />
              </div>
              <Button onClick={handleCreateNote} disabled={!noteContent.trim() || createNote.isPending} size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
              </Button>
            </CardContent>
          </Card>

          {(coachNotes?.length ?? 0) === 0 && (
            <p className="text-muted-foreground text-sm text-center py-6">No notes yet. Add your first note above.</p>
          )}

          <div className="space-y-3">
            {[...(coachNotes ?? [])].reverse().map(note => (
              <Card key={note.id} className="border-border/60">
                <CardContent className="pt-3 pb-3">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        className="resize-none text-sm min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateNote(note.id)} disabled={updateNote.isPending}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <p className="flex-1 text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(parseISO(note.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Call Log */}
        <TabsContent value="calls" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" /> Log a Call
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={callDate}
                    onChange={e => setCallDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 30"
                    value={callDuration}
                    onChange={e => setCallDuration(e.target.value)}
                    className="text-sm"
                    min={1}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  placeholder="What did you discuss?"
                  value={callNotes}
                  onChange={e => setCallNotes(e.target.value)}
                  className="resize-none min-h-[80px] text-sm"
                />
              </div>
              <Button onClick={handleLogCall} disabled={!callDate || createCall.isPending} size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Call
              </Button>
            </CardContent>
          </Card>

          {(callLogs?.length ?? 0) === 0 && (
            <p className="text-muted-foreground text-sm text-center py-6">No calls logged yet.</p>
          )}

          <div className="space-y-3">
            {[...(callLogs ?? [])].reverse().map(call => (
              <Card key={call.id} className="border-border/60">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{format(parseISO(call.date), "MMM d, yyyy")}</p>
                        {call.durationMinutes != null && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="w-3 h-3" />{call.durationMinutes} min
                          </Badge>
                        )}
                      </div>
                      {call.notes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{call.notes}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteCall(call.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
