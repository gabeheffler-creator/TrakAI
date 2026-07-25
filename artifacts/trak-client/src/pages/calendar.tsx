import { useMemo, useRef, useEffect, useState, useCallback } from "react";
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
  useListMeasurements,
  getListMeasurementsQueryKey,
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
  Measurement,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  ChevronLeft,
  X,
  CalendarDays,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/** Format a local Date as YYYY-MM-DD without UTC conversion (avoids day-shift in positive-offset timezones). */
function localDateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns all ISO dates in a given month grid (including padding days from prev/next month). */
function getMonthGridDates(year: number, month: number): string[] {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const dates: string[] = [];

  // Pad start (days from previous month)
  for (let i = startDow - 1; i >= 0; i--) {
    dates.push(localDateToISO(new Date(year, month, -i)));
  }
  // Days in current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    dates.push(localDateToISO(new Date(year, month, d)));
  }
  // Pad end to complete the last week
  const remaining = 7 - (dates.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      dates.push(localDateToISO(new Date(year, month + 1, i)));
    }
  }
  return dates;
}

// ─── Workout schedule helper ──────────────────────────────────────────────────

function getScheduledProgramDay(
  program: ProgramDetail,
  assignment: ProgramAssignment,
  date: string
): ProgramDayDetail | null {
  const dayIndex = daysBetween(assignment.startDate, date);
  if (dayIndex < 0) return null;
  const totalDays = program.days.length;
  if (totalDays === 0) return null;
  const cycleDayNumber = (dayIndex % totalDays) + 1;
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

// ─── DayBlock type ────────────────────────────────────────────────────────────

interface DayBlock {
  id: string;
  done: boolean;
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  pulse?: boolean;
  isCallBlock?: boolean;
  blockType?: "workout" | "nutrition" | "sleep" | "assignment" | "task" | "call" | "measurement";
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface DayCardProps {
  date: string;
  today: string;
  blocks: DayBlock[];
  isToday: boolean;
  isFuture: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}

function DayCard({ date, today, blocks, isToday, isFuture, cardRef }: DayCardProps) {
  const isPast = date < today;
  const checkableBlocks = blocks.filter(b => !b.isCallBlock);
  const allDone = checkableBlocks.length > 0 && checkableBlocks.every(b => b.done);

  const [userToggled, setUserToggled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const derivedOpen = isToday || isFuture || !allDone;
  const open = userToggled ? manualOpen : derivedOpen;

  const label = formatDayLabel(date, today);
  const dateShort = formatDateShort(date);

  const doneCount = blocks.filter(b => !b.isCallBlock && b.done).length;
  const totalCount = blocks.filter(b => !b.isCallBlock).length;

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-2xl border overflow-hidden transition-colors",
        isToday
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-card"
      )}
      data-testid={isToday ? "card-calendar-today" : `card-calendar-${date}`}
    >
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
            <span className="text-xs text-muted-foreground">
              {totalCount} item{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-0.5">
          {blocks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nothing scheduled</p>
          )}
          {blocks.map(block => (
            <BlockRow
              key={block.id}
              done={block.done}
              label={block.label}
              sublabel={block.sublabel}
              href={block.href}
              badge={block.badge}
              pulse={block.pulse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full Calendar Overlay ────────────────────────────────────────────────────

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface BlockDots {
  workout: boolean;
  workoutDone: boolean;
  nutrition: boolean;
  nutritionDone: boolean;
  sleep: boolean;
  sleepDone: boolean;
  assignments: number;
  assignmentsDone: number;
}

function getBlockDots(blocks: DayBlock[]): BlockDots {
  const workout = blocks.find(b => b.blockType === "workout");
  const nutrition = blocks.find(b => b.blockType === "nutrition");
  const sleep = blocks.find(b => b.blockType === "sleep");
  const assignmentBlocks = blocks.filter(b => b.blockType === "assignment");

  return {
    workout: !!workout,
    workoutDone: workout?.done ?? false,
    nutrition: !!nutrition,
    nutritionDone: nutrition?.done ?? false,
    sleep: !!sleep,
    sleepDone: sleep?.done ?? false,
    assignments: assignmentBlocks.length,
    assignmentsDone: assignmentBlocks.filter(b => b.done).length,
  };
}

interface FullCalendarOverlayProps {
  today: string;
  buildBlocks: (date: string) => DayBlock[];
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

function FullCalendarOverlay({ today, buildBlocks, onClose, onSelectDate }: FullCalendarOverlayProps) {
  const todayDate = new Date(today + "T12:00:00");
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) nextMonth();
    else prevMonth();
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    setSlideDir("right");
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    setSlideDir("left");
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function goToToday() {
    const targetYear = todayDate.getFullYear();
    const targetMonth = todayDate.getMonth();
    const isAfter = year > targetYear || (year === targetYear && month > targetMonth);
    setSlideDir(isAfter ? "right" : month === targetMonth && year === targetYear ? null : "left");
    setYear(targetYear);
    setMonth(targetMonth);
  }

  const isViewingCurrentMonth =
    year === todayDate.getFullYear() && month === todayDate.getMonth();

  const isCurrentMonth = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            disabled={isViewingCurrentMonth}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors",
              isViewingCurrentMonth
                ? "text-muted-foreground/40 cursor-default"
                : "text-primary hover:bg-primary/10"
            )}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close calendar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 flex-shrink-0">
        {DOW_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <style>{`
        @keyframes trak-slide-in-left {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes trak-slide-in-right {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={`${year}-${month}`}
          style={{
            animation: slideDir === "left"
              ? "trak-slide-in-left 250ms ease-out"
              : slideDir === "right"
              ? "trak-slide-in-right 250ms ease-out"
              : undefined,
          }}
          className="grid grid-cols-7 divide-x divide-y divide-border border-b border-border"
        >
          {gridDates.map(date => {
            const inMonth = isCurrentMonth(date);
            const isToday = date === today;
            const blocks = inMonth ? buildBlocks(date) : [];
            const dots = getBlockDots(blocks);
            const checkable = blocks.filter(b => !b.isCallBlock);
            const allDone = checkable.length > 0 && checkable.every(b => b.done);
            const dayNum = new Date(date + "T12:00:00").getDate();

            return (
              <button
                key={date}
                onClick={() => inMonth && onSelectDate(date)}
                disabled={!inMonth}
                className={cn(
                  "min-h-[72px] flex flex-col items-center gap-1 p-1.5 text-left transition-colors",
                  inMonth ? "hover:bg-muted/60 cursor-pointer" : "opacity-25 cursor-default",
                  isToday && "bg-primary/10",
                  allDone && inMonth && !isToday && "bg-emerald-500/5"
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {dayNum}
                </span>

                {/* Block dots */}
                {inMonth && (
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {dots.workout && (
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        dots.workoutDone ? "bg-primary" : "bg-primary/30"
                      )} title="Workout" />
                    )}
                    {dots.nutrition && (
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        dots.nutritionDone ? "bg-emerald-500" : "bg-emerald-500/30"
                      )} title="Nutrition" />
                    )}
                    {dots.sleep && (
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        dots.sleepDone ? "bg-blue-500" : "bg-blue-500/30"
                      )} title="Sleep" />
                    )}
                    {Array.from({ length: Math.min(dots.assignments, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          i < dots.assignmentsDone ? "bg-orange-400" : "bg-orange-400/30"
                        )}
                        title="Assignment"
                      />
                    ))}
                  </div>
                )}

                {/* All-done check */}
                {allDone && inMonth && (
                  <span className="text-[9px] text-emerald-600 font-bold leading-none">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-border bg-card flex-shrink-0 flex-wrap">
        {[
          { color: "bg-primary", label: "Workout" },
          { color: "bg-emerald-500", label: "Nutrition" },
          { color: "bg-blue-500", label: "Sleep" },
          { color: "bg-orange-400", label: "Assignment" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────

type ViewMode = "list" | "grid";

const VIEW_STORAGE_KEY = "trak-calendar-view";

export function CalendarPage() {
  const { clientId } = useClientId();
  const today = getTodayISO();

  // View mode persisted in localStorage
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });

  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const callActive = useVideoCallStatus(clientId);

  // Ref map for scrolling to a specific date card
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((date: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(date, el);
    else cardRefs.current.delete(date);
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    const todayEl = cardRefs.current.get(today);
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [today]);

  // Persist view change
  function handleViewChange(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch {}
  }

  // Date range: 14 days back through 14 days ahead
  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -14; i <= 14; i++) arr.push(addDays(today, i));
    return arr;
  }, [today]);

  // Fetch everything in parallel
  const { data: assignment, isLoading: assignmentLoading } = useGetClientProgramAssignment(clientId!, {
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

  const { data: measurements } = useListMeasurements(clientId!, {
    query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) },
  });

  // Lookup maps
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

  const measurementsByDate = useMemo(() => {
    const map = new Map<string, Measurement>();
    for (const m of measurements ?? []) {
      if (!map.has(m.date)) map.set(m.date, m);
    }
    return map;
  }, [measurements]);

  // Build blocks for a given date
  const buildBlocks = useCallback((date: string): DayBlock[] => {
    const isToday = date === today;
    const isPast = date < today;
    const blocks: DayBlock[] = [];

    // Workout
    if (program && assignment) {
      const scheduledDay = getScheduledProgramDay(program, assignment, date);
      const workoutDone = (workoutLogsByDate.get(date)?.length ?? 0) > 0;

      if (scheduledDay) {
        const exerciseCount = scheduledDay.exercises?.length ?? 0;
        blocks.push({
          id: "workout",
          blockType: "workout",
          done: workoutDone,
          label: scheduledDay.name,
          sublabel: exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? "s" : ""}` : undefined,
          href: isToday || !isPast ? "/workout" : "/workouts",
        });
      }
    }

    // Nutrition
    const nutLogs = nutritionLogsByDate.get(date) ?? [];
    const nutDone = nutLogs.length > 0;
    const totalCal = nutLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
    blocks.push({
      id: "nutrition",
      blockType: "nutrition",
      done: nutDone,
      label: "Nutrition",
      sublabel: nutDone ? `${totalCal} cal logged` : "Nothing logged yet",
      href: date === today ? "/nutrition" : `/nutrition?date=${date}`,
    });

    // Sleep
    const sleepLog = sleepLogsByDate.get(date);
    const sleepDone = !!sleepLog;
    blocks.push({
      id: "sleep",
      blockType: "sleep",
      done: sleepDone,
      label: "Sleep",
      sublabel: sleepDone ? `${sleepLog!.hoursSlept}h logged` : "Not logged yet",
      href: "/sleep",
    });

    // Assignments
    for (const a of assignmentsByDate.get(date) ?? []) {
      blocks.push({
        id: `assignment-${a.id}`,
        blockType: "assignment",
        done: a.status === "completed",
        label: a.title,
        href: "/assignments",
        badge: a.type,
      });
    }

    // Coach tasks (today only)
    if (isToday && activeTasks && activeTasks.length > 0) {
      for (const task of activeTasks as ClientTask[]) {
        const taskLabel =
          task.altStatus === "accepted" && task.alternativeText
            ? task.alternativeText
            : task.text;
        blocks.push({
          id: `task-${task.id}`,
          blockType: "task",
          done: task.status === "completed",
          label: taskLabel,
          href: "/tasks",
          badge: "coach task",
        });
      }
    }

    // Measurements
    const measurement = measurementsByDate.get(date);
    if (measurement) {
      const parts: string[] = [];
      if (measurement.weight != null) parts.push(`${measurement.weight} ${measurement.unit === "metric" ? "kg" : "lbs"}`);
      if (measurement.bodyFat != null) parts.push(`${measurement.bodyFat}% BF`);
      blocks.push({
        id: "measurement",
        blockType: "measurement",
        done: true,
        label: "Measurements",
        sublabel: parts.length > 0 ? parts.join(" · ") : "Logged",
        href: "/",
      });
    }

    // Coaching call (today only)
    if (isToday && callActive) {
      blocks.push({
        id: "call",
        blockType: "call",
        done: false,
        label: "Coaching call active — Join",
        sublabel: "Your coach is waiting",
        href: "/",
        pulse: true,
        isCallBlock: true,
      });
    }

    return blocks;
  }, [
    today, program, assignment, workoutLogsByDate, nutritionLogsByDate,
    sleepLogsByDate, assignmentsByDate, activeTasks, callActive, measurementsByDate,
  ]);

  // Tap a full-calendar cell → close overlay, scroll to list card
  function handleSelectDate(date: string) {
    setShowFullCalendar(false);
    setTimeout(() => {
      const el = cardRefs.current.get(date);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  if (!clientId) {
    return <div className="p-4 text-muted-foreground">Not logged in.</div>;
  }

  return (
    <>
      {/* Full calendar overlay */}
      {showFullCalendar && (
        <FullCalendarOverlay
          today={today}
          buildBlocks={buildBlocks}
          onClose={() => setShowFullCalendar(false)}
          onSelectDate={handleSelectDate}
        />
      )}

      <div className="max-w-lg mx-auto pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-2xl font-bold">Calendar</h1>

          <div className="flex items-center gap-2">
            {/* View full calendar button */}
            <button
              onClick={() => setShowFullCalendar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Full calendar</span>
            </button>

            {/* List / Grid view toggle */}
            <Select value={view} onValueChange={v => handleViewChange(v as ViewMode)}>
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">
                  <span className="flex items-center gap-1.5">
                    <LayoutList className="w-3.5 h-3.5" /> List
                  </span>
                </SelectItem>
                <SelectItem value="grid">
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5" /> Grid
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* No program banner */}
        {!assignmentLoading && !assignment && (
          <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No training program assigned yet — your coach will set one up for you.
          </div>
        )}

        {/* Day cards */}
        <div
          className={cn(
            view === "grid"
              ? "grid grid-cols-2 gap-3"
              : "space-y-3"
          )}
        >
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
                cardRef={setCardRef(date)}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
