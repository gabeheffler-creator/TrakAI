import { useMemo } from "react";
import { useGetClientActivityHeatmap } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 53;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
};

export function ActivityHeatmap({ clientId }: { clientId: number }) {
  const { data, isLoading, error } = useGetClientActivityHeatmap(clientId);

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of data ?? []) {
      map.set(entry.date, entry.count);
    }
    return map;
  }, [data]);

  const { weeks, monthMarkers, totalDays, activeDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align the grid end to the end of this week (Saturday) so columns are full weeks.
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));

    const days: { date: string; count: number; inRange: boolean }[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const d = new Date(t);
      const dateStr = format(d, "yyyy-MM-dd");
      days.push({ date: dateStr, count: countsByDate.get(dateStr) ?? 0, inRange: d.getTime() <= today.getTime() });
    }

    const weeksArr: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    const markers: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    weeksArr.forEach((week, idx) => {
      const firstDay = parseISO(week[0].date);
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        markers.push({ weekIndex: idx, label: MONTH_LABELS[month] });
        lastMonth = month;
      }
    });

    const total = days.filter(d => d.inRange).length;
    const active = days.filter(d => d.inRange && d.count > 0).length;

    return { weeks: weeksArr, monthMarkers: markers, totalDays: total, activeDays: active };
  }, [countsByDate]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading activity...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive py-6 text-center">Failed to load activity data.</div>;
  }

  return (
    <div data-testid="activity-heatmap">
      <p className="text-sm text-muted-foreground mb-3">
        {activeDays} of the last {totalDays} days with logged data
      </p>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex gap-[3px] mb-1 pl-0" style={{ paddingLeft: 0 }}>
            {weeks.map((_, weekIdx) => {
              const marker = monthMarkers.find(m => m.weekIndex === weekIdx);
              return (
                <div key={weekIdx} className="w-[11px] text-[10px] text-muted-foreground leading-none">
                  {marker ? marker.label : ""}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    data-testid={`heatmap-day-${day.date}`}
                    title={`${format(parseISO(day.date), "MMM d, yyyy")}: ${day.count} log${day.count === 1 ? "" : "s"}`}
                    className={`w-[11px] h-[11px] rounded-sm ${day.inRange ? LEVEL_CLASSES[levelForCount(day.count)] : "bg-transparent"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <div key={level} className={`w-[11px] h-[11px] rounded-sm ${LEVEL_CLASSES[level]}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
