import { useMemo, useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useClientId } from "@/hooks/use-client-id";
import { useVideoCallStatus } from "@/hooks/use-video-call-status";
import {
  useGetClientProgram,
  useGetClientProgramAssignment,
  getGetClientProgramQueryKey,
  getGetClientProgramAssignmentQueryKey,
  useListWorkoutLogs,
  getListWorkoutLogsQueryKey,
  useListNutritionLogs,
  getListNutritionLogsQueryKey,
  useListSleepLogs,
  getListSleepLogsQueryKey,
  useListAssignments,
  getListAssignmentsQueryKey,
  useListActiveTasks,
  getListActiveTasksQueryKey,
} from "@workspace/api-client-react";
import type {
  ProgramDetail,
  ProgramDayDetail,
  ProgramAssignment,
  WorkoutLog,
  NutritionLog,
  SleepLog,
  Assignment,
  ClientTask,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Video } from "lucide-react";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((db - da) / 86_400_000);
}

function formatDayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Workout schedule helper ──────────────────────────────────────────────────

function getScheduledProgramDay(
  program: ProgramDetail,
  assignment: ProgramAssignment,
  date: string
): ProgramDayDetail | null {
  const dayIndex = daysBetween(assignment.startDate, date);
  if (dayIndex < 0) return null; // before program started
  const totalDays = program.days.length;
  if (totalDays === 0) return null;
  const cycleDayNumber = (dayIndex % totalDays) + 1; // 1-based
  return program.days.find(d => d.dayNumber === cycleDayNumber) ?? null;
}

// ─── BlockRow ─────────────────────────────────────────────────────────────────

interface BlockRowProps {
  done: boolean;
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  pulse?: boolean;
}

function BlockRow({ done, label, sublabel, href, badge, pulse }: BlockRowProps) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(href)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-muted/60",
        done && "opacity-60"
      )}
    >
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-medium leading-snug block truncate",
            done && "line-through text-muted-foreground"
          )}
        >
          {pulse && (
            <span className="inline-flex mr-1.5 relative h-2 w-2 align-middle">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          {label}
        </span>
        {sublabel && (
          <span className="text-xs text-muted-foreground leading-tight block">{sublabel}</span>
        )}
      </div>

      {badge && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
          {badge}
        </span>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
    </button>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface DayBlock {
  id: string;
  done: boolean;
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  pulse?: boolean;
  isRestDay?: boolean;
  isCallBlock?: boolean;
}

interface DayCardProps {
  date: string;
  today: string;
  blocks: DayBlock[];
  isToday: boolean;
  isFuture: boolean;
  todayRef?: React.RefObject<HTMLDivElement | null>;
}

function DayCard({ date, today, blocks, isToday, isFuture, todayRef }: DayCardProps) {
  const isPast = date < today;
  const checkableBlocks = blocks.filter(b => !b.isRestDay && !b.isCallBlock);
  const allDone = checkableBlocks.length > 0 && checkableBlocks.every(b => b.done);

  // Derive open state from data until the user manually toggles.
  // Past days with everything checked collapse; today/future stay open.
  const [userToggled, setUserToggled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const derivedOpen = isToday || isFuture || !allDone;
  const open = userToggled ? manualOpen : derivedOpen;

  const label = formatDayLabel(date, today);
  const dateShort = formatDateShort(date);

  const doneCount = blocks.filter(b => !b.isRestDay && !b.isCallBlock && b.done).length;
  const totalCount = blocks.filter(b => !b.isRestDay && !b.isCallBlock).length;

  return (
    <div
      ref={isToday ? todayRef : undefined}
      className={cn(
        "rounded-2xl border overflow-hidden transition-colors",
        isToday
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-card"
      )}
      data-testid={isToday ? "card-calendar-today" : `card-calendar-${date}`}
    >
      {/* Header */}
      <button
        onClick={() => { setUserToggled(true); setManualOpen(!open); }}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          {isToday && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
              Today
            </span>
          )}
          <span className={cn("font-semibold text-sm", isToday && "text-primary")}>
            {isToday ? dateShort : label}
          </span>
          {isPast && (
            <span className="text-xs text-muted-foreground">
              {allDone || totalCount === 0 ? "✓ All done" : `${doneCount}/${totalCount} done`}
            </span>
          )}
          {isFuture && totalCount > 0 && (
            <span className="text-xs text-muted-foreground">{totalCount} item{totalCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="px-2 pb-2 space-y-0.5">
          {blocks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nothing scheduled</p>
          )}

          {blocks.map(block => {
            if (block.isRestDay) {
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground"
                >
                  <span className="text-lg">😴</span>
                  <span className="text-sm">Rest day</span>
                </div>
              );
            }

            if (block.isCallBlock) {
              return (
                <BlockRow
                  key={block.id}
                  done={false}
                  label={block.label}
                  sublabel={block.sublabel}
                  href={block.href}
                  pulse={block.pulse}
                />
              );
            }

            return (
              <BlockRow
                key={block.id}
                done={block.done}
                label={block.label}
                sublabel={block.sublabel}
                href={block.href}
                badge={block.badge}
                pulse={block.pulse}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { clientId } = useClientId();
  const today = getTodayISO();
  const todayRef = useRef<HTMLDivElement>(null);
  const callActive = useVideoCallStatus(clientId);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Date range: 14 days back through 14 days ahead
  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -14; i <= 14; i++) {
      arr.push(addDays(today, i));
    }
    return arr;
  }, [today]);

  // Fetch everything in parallel
  const { data: assignment } = useGetClientProgramAssignment(clientId!, {
    query: { enabled: !!clientId, queryKey: getGetClientProgramAssignmentQueryKey(clientId!) },
  });

  const { data: program } = useGetClientProgram(clientId!, {
    query: { enabled: !!clientId && !!assignment, queryKey: getGetClientProgramQueryKey(clientId!) },
  });

  const { data: workoutLogs } = useListWorkoutLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) },
  });

  const { data: nutritionLogs } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) },
  });

  const { data: sleepLogs } = useListSleepLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) },
  });

  const { data: assignments } = useListAssignments(clientId!, {
    query: { enabled: !!clientId, queryKey: getListAssignmentsQueryKey(clientId!) },
  });

  const { data: activeTasks } = useListActiveTasks(clientId!, {
    query: { enabled: !!clientId, queryKey: getListActiveTasksQueryKey(clientId!) },
  });

  // Build lookup maps for O(1) access
  const workoutLogsByDate = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const log of workoutLogs ?? []) {
      const arr = map.get(log.date) ?? [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return map;
  }, [workoutLogs]);

  const nutritionLogsByDate = useMemo(() => {
    const map = new Map<string, NutritionLog[]>();
    for (const log of nutritionLogs ?? []) {
      if (log.imageUrl === "water_only") continue;
      const arr = map.get(log.date) ?? [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return map;
  }, [nutritionLogs]);

  const sleepLogsByDate = useMemo(() => {
    const map = new Map<string, SleepLog>();
    for (const log of sleepLogs ?? []) {
      if (!map.has(log.date)) map.set(log.date, log);
    }
    return map;
  }, [sleepLogs]);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments ?? []) {
      if (!a.dueDate) continue;
      const arr = map.get(a.dueDate) ?? [];
      arr.push(a);
      map.set(a.dueDate, arr);
    }
    return map;
  }, [assignments]);

  // Build blocks for a given date
  function buildBlocks(date: string): DayBlock[] {
    const isToday = date === today;
    const isPast = date < today;
    const blocks: DayBlock[] = [];

    // ── Workout block ─────────────────────────────────────────────────────
    if (program && assignment) {
      const scheduledDay = getScheduledProgramDay(program, assignment, date);
      const workoutDone = (workoutLogsByDate.get(date)?.length ?? 0) > 0;

      if (scheduledDay) {
        const exerciseCount = scheduledDay.exercises?.length ?? 0;
        blocks.push({
          id: "workout",
          done: workoutDone,
          label: scheduledDay.name,
          sublabel: exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}` : undefined,
          href: isToday || !isPast ? "/workout" : "/workouts",
        });
      } else if (daysBetween(assignment.startDate, date) >= 0) {
        // Program started but this slot is a rest day
        blocks.push({
          id: "rest",
          done: true,
          label: "Rest day",
          href: "/workout",
          isRestDay: true,
        });
      }
    }

    // ── Nutrition block ───────────────────────────────────────────────────
    const nutLogs = nutritionLogsByDate.get(date) ?? [];
    const nutDone = nutLogs.length > 0;
    const totalCal = nutLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
    blocks.push({
      id: "nutrition",
      done: nutDone,
      label: "Nutrition",
      sublabel: nutDone ? `${totalCal} cal logged` : "Nothing logged yet",
      href: date === today ? "/nutrition" : `/nutrition?date=${date}`,
    });

    // ── Sleep block ───────────────────────────────────────────────────────
    const sleepLog = sleepLogsByDate.get(date);
    const sleepDone = !!sleepLog;
    blocks.push({
      id: "sleep",
      done: sleepDone,
      label: "Sleep",
      sublabel: sleepDone ? `${sleepLog!.hoursSlept}h logged` : "Not logged yet",
      href: "/sleep",
    });

    // ── Assignment blocks ─────────────────────────────────────────────────
    const dayAssignments = assignmentsByDate.get(date) ?? [];
    for (const a of dayAssignments) {
      blocks.push({
        id: `assignment-${a.id}`,
        done: a.status === "completed",
        label: a.title,
        href: "/assignments",
        badge: a.type,
      });
    }

    // ── Coach task blocks (today only) ────────────────────────────────────
    if (isToday && activeTasks && activeTasks.length > 0) {
      for (const task of activeTasks as ClientTask[]) {
        const taskLabel = task.altStatus === "accepted" && task.alternativeText
          ? task.alternativeText
          : task.text;
        blocks.push({
          id: `task-${task.id}`,
          done: task.status === "completed",
          label: taskLabel,
          href: "/tasks",
          badge: "coach task",
        });
      }
    }

    // ── Coaching call block (today only, when active) ─────────────────────
    if (isToday && callActive) {
      blocks.push({
        id: "call",
        done: false,
        label: "Coaching call active — Join",
        sublabel: "Your coach is waiting",
        href: "/",
        pulse: true,
        isCallBlock: true,
      });
    }

    return blocks;
  }

  if (!clientId) {
    return <div className="p-4 text-muted-foreground">Not logged in.</div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-3 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-xs text-muted-foreground">14 days each way</p>
      </div>

      {dates.map(date => {
        const blocks = buildBlocks(date);
        return (
          <DayCard
            key={date}
            date={date}
            today={today}
            blocks={blocks}
            isToday={date === today}
            isFuture={date > today}
            todayRef={todayRef}
          />
        );
      })}
    </div>
  );
}
