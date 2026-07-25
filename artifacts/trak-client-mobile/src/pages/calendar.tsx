import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListWorkoutLogs, getListWorkoutLogsQueryKey,
  useListSleepLogs, getListSleepLogsQueryKey,
  useListNutritionLogs, getListNutritionLogsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Dumbbell, Moon, Utensils, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, subMonths, addMonths, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DayData {
  workout: boolean;
  sleep: boolean;
  nutrition: boolean;
  workoutName?: string;
  sleepHours?: number;
  nutritionCals?: number;
}

export function CalendarPage() {
  const { clientId } = useClientId();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: workoutLogs, isLoading: wLoading, isError: wError, refetch: wRefetch, isFetching: wFetching } =
    useListWorkoutLogs(clientId!, {
      query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!), staleTime: 30_000 },
    });

  const { data: sleepLogs, isLoading: sLoading, isError: sError, refetch: sRefetch, isFetching: sFetching } =
    useListSleepLogs(clientId!, {
      query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!), staleTime: 30_000 },
    });

  const { data: nutritionLogs, isLoading: nLoading, isError: nError, refetch: nRefetch, isFetching: nFetching } =
    useListNutritionLogs(clientId!, {
      query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!), staleTime: 30_000 },
    });

  const isLoading = wLoading || sLoading || nLoading;
  const isError = wError || sError || nError;

  // Build a map of date → data
  const dayMap = new Map<string, DayData>();

  (workoutLogs ?? []).forEach(log => {
    const d = dayMap.get(log.date) ?? { workout: false, sleep: false, nutrition: false };
    d.workout = true;
    d.workoutName = log.programDayName ?? "Workout";
    dayMap.set(log.date, d);
  });

  (sleepLogs ?? []).forEach(log => {
    const d = dayMap.get(log.date) ?? { workout: false, sleep: false, nutrition: false };
    d.sleep = true;
    d.sleepHours = Number(log.hoursSlept);
    dayMap.set(log.date, d);
  });

  (nutritionLogs ?? []).filter(l => l.imageUrl !== "water_only").forEach(log => {
    const d = dayMap.get(log.date) ?? { workout: false, sleep: false, nutrition: false };
    d.nutrition = true;
    d.nutritionCals = (d.nutritionCals ?? 0) + (log.calories ?? 0);
    dayMap.set(log.date, d);
  });

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0 = Sunday
  const today = new Date();

  const selectedISO = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedData = selectedISO ? dayMap.get(selectedISO) : null;

  if (isError) {
    return (
      <QueryErrorState
        message="Couldn't load calendar data."
        onRetry={() => { wRefetch(); sRefetch(); nRefetch(); }}
        isRetrying={wFetching || sFetching || nFetching}
        className="pt-16"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Calendar</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-base font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-px">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Leading empty cells */}
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}

          {days.map(day => {
            const iso = format(day, "yyyy-MM-dd");
            const data = dayMap.get(iso);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const hasAny = data?.workout || data?.sleep || data?.nutrition;

            return (
              <button
                key={iso}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                className={cn(
                  "relative flex flex-col items-center py-1.5 rounded-xl transition-colors aspect-square justify-center gap-0.5",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/60"
                )}
              >
                <span className={cn(
                  "text-xs font-semibold leading-none",
                  isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>

                {/* Dot indicators */}
                {hasAny && (
                  <div className="flex gap-0.5 justify-center">
                    {data?.workout && (
                      <span className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-emerald-500")} />
                    )}
                    {data?.sleep && (
                      <span className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-blue-400")} />
                    )}
                    {data?.nutrition && (
                      <span className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-amber-400")} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Workout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs text-muted-foreground">Sleep</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs text-muted-foreground">Nutrition</span>
        </div>
      </div>

      {/* Day detail */}
      {selectedDay && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold">
              {format(selectedDay, "EEEE, MMMM d")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {!selectedData ? (
              <p className="text-sm text-muted-foreground/70 italic">Nothing logged on this day</p>
            ) : (
              <>
                {selectedData.workout && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{selectedData.workoutName}</span>
                  </div>
                )}
                {selectedData.sleep && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Moon className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className="font-medium text-blue-700 dark:text-blue-400">{selectedData.sleepHours}h sleep</span>
                  </div>
                )}
                {selectedData.nutrition && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Utensils className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {selectedData.nutritionCals ? `${selectedData.nutritionCals.toLocaleString()} kcal` : "Nutrition logged"}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly summary */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-medium">{format(currentMonth, "MMMM")} Summary</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold text-emerald-500">
              {days.filter(d => dayMap.get(format(d, "yyyy-MM-dd"))?.workout).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Workouts</p>
          </div>
          <div>
            <p className="text-xl font-bold text-blue-400">
              {days.filter(d => dayMap.get(format(d, "yyyy-MM-dd"))?.sleep).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Sleep logs</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-400">
              {days.filter(d => dayMap.get(format(d, "yyyy-MM-dd"))?.nutrition).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Nutrition logs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
