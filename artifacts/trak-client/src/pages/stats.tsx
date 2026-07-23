import { useState, useMemo } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem, type UnitSystem } from "@/hooks/use-unit-system";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMeasurements,
  useListWorkoutLogs,
  useListSleepLogs,
  useListProgressPhotos,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
  useGetUploadUrl,
  getListMeasurementsQueryKey,
  getListWorkoutLogsQueryKey,
  getListSleepLogsQueryKey,
  getListProgressPhotosQueryKey,
} from "@workspace/api-client-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Trophy, Dumbbell, Camera,
  Plus, Trash2, Upload, ImageOff, ArrowUp, ArrowDown, Maximize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { startOfWeek, format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";

// ─── Example / demo data (shown when the client has no real data yet) ────────

const EXAMPLE_VOLUME_DATA = [
  { week: "May 5",  reps: 148 },
  { week: "May 12", reps: 172 },
  { week: "May 19", reps: 165 },
  { week: "May 26", reps: 210 },
  { week: "Jun 2",  reps: 195 },
  { week: "Jun 9",  reps: 238 },
  { week: "Jun 16", reps: 254 },
  { week: "Jun 23", reps: 270 },
];

const EXAMPLE_SETS_DATA = [
  { week: "May 5",  sets: 18 },
  { week: "May 12", sets: 21 },
  { week: "May 19", sets: 20 },
  { week: "May 26", sets: 25 },
  { week: "Jun 2",  sets: 24 },
  { week: "Jun 9",  sets: 28 },
  { week: "Jun 16", sets: 30 },
  { week: "Jun 23", sets: 32 },
];

const EXAMPLE_PRS = [
  { name: "Barbell Squat",         weight: 225, unit: "lbs", reps: 5, date: "Jun 23" },
  { name: "Conventional Deadlift", weight: 315, unit: "lbs", reps: 3, date: "Jun 16" },
  { name: "Bench Press",           weight: 185, unit: "lbs", reps: 5, date: "Jun 23" },
  { name: "Overhead Press",        weight: 115, unit: "lbs", reps: 5, date: "Jun 9"  },
  { name: "Barbell Row",           weight: 155, unit: "lbs", reps: 8, date: "Jun 2"  },
];

const EXAMPLE_BODY_DATA: ChartData[] = [
  { date: "2026-04-07", weight: 185.2, body_fat: 22.1, waist: 36.0 },
  { date: "2026-04-21", weight: 183.8, body_fat: 21.6, waist: 35.5 },
  { date: "2026-05-05", weight: 182.4, body_fat: 21.0, waist: 35.0 },
  { date: "2026-05-19", weight: 181.1, body_fat: 20.5, waist: 34.6 },
  { date: "2026-06-02", weight: 180.0, body_fat: 20.1, waist: 34.2 },
  { date: "2026-06-16", weight: 179.0, body_fat: 19.6, waist: 33.8 },
  { date: "2026-06-30", weight: 178.2, body_fat: 19.1, waist: 33.4 },
];

const EXAMPLE_SLEEP_DATA: ChartData[] = [
  { date: "2026-04-07", hours: 6.5 },
  { date: "2026-04-14", hours: 7.0 },
  { date: "2026-04-21", hours: 6.8 },
  { date: "2026-05-05", hours: 7.2 },
  { date: "2026-05-19", hours: 7.0 },
  { date: "2026-06-02", hours: 7.5 },
  { date: "2026-06-16", hours: 7.3 },
  { date: "2026-06-30", hours: 7.6 },
];

function ExampleBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
      <span className="font-semibold shrink-0">Example data</span>
      <span className="text-amber-700 dark:text-amber-400">— start logging to see your own stats here.</span>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartData = { date: string; [key: string]: number | string | null };
type MeasurementEntry = ChartData & { date: string };
type Timeframe = "1w" | "1m" | "3m" | "6m" | "1y" | "all" | "custom";

interface SetEntry {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number | null;
  weightUnit: string | null;
  rpe?: number | null;
}
interface WorkoutLogWithSets {
  id: number;
  date: string;
  programDayName?: string | null;
  sets?: SetEntry[];
}

type FullscreenChart = {
  label: string;
  color: string;
  unit: string;
  lowerIsBetter: boolean;
  data: ChartData[];
  dataKey: string;
  lwDelta: number | null;
  lastVal: number | null;
};

// ─── Unit conversion ─────────────────────────────────────────────────────────

function toDisplayWeight(val: number, stored: string | null | undefined, display: UnitSystem): number {
  const s = stored === "metric" ? "metric" : "imperial";
  if (s === display) return val;
  const converted = s === "imperial" ? val * 0.453592 : val * 2.20462;
  return Math.round(converted * 10) / 10;
}
function toDisplayLength(val: number, stored: string | null | undefined, display: UnitSystem): number {
  const s = stored === "metric" ? "metric" : "imperial";
  if (s === display) return val;
  const converted = s === "imperial" ? val * 2.54 : val / 2.54;
  return Math.round(converted * 10) / 10;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastWeekDelta(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = new Date(last.date).getTime() - 5 * 24 * 60 * 60 * 1000;
  const prior = [...points].reverse().find(p => new Date(p.date).getTime() <= cutoff);
  if (!prior) return null;
  return Number((last.value - prior.value).toFixed(2));
}

function filterByTf<T extends { date: string }>(
  items: T[],
  tf: Timeframe,
  customStart?: string | null,
  customEnd?: string | null,
): T[] {
  if (tf === "custom") {
    if (!customStart || !customEnd) return items;
    return items.filter(i => i.date >= customStart && i.date <= customEnd);
  }
  if (tf === "all") return items;
  const days = tf === "1w" ? 7 : tf === "1m" ? 30 : tf === "3m" ? 90 : tf === "6m" ? 180 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return items.filter(i => i.date >= cutoffStr);
}

// ─── Chart config ─────────────────────────────────────────────────────────────

function getMeasurementCharts(weightUnit: string, lengthUnit: string) {
  return [
    { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: weightUnit, lowerIsBetter: true  },
    { key: "body_fat",    label: "Body Fat %",   color: "hsl(15,85%,55%)",  unit: "%",         lowerIsBetter: true  },
    { key: "chest",       label: "Chest",        color: "hsl(340,75%,55%)", unit: lengthUnit                       },
    { key: "waist",       label: "Waist",        color: "hsl(200,70%,50%)", unit: lengthUnit,  lowerIsBetter: true  },
    { key: "hips",        label: "Hips",         color: "hsl(38,92%,50%)",  unit: lengthUnit,  lowerIsBetter: true  },
    { key: "left_arm",    label: "Left Arm",     color: "hsl(158,64%,38%)", unit: lengthUnit                       },
    { key: "right_arm",   label: "Right Arm",    color: "hsl(158,64%,50%)", unit: lengthUnit                       },
    { key: "left_thigh",  label: "Left Thigh",   color: "hsl(28,85%,50%)",  unit: lengthUnit                       },
    { key: "right_thigh", label: "Right Thigh",  color: "hsl(28,85%,60%)",  unit: lengthUnit                       },
    { key: "left_calf",   label: "Left Calf",    color: "hsl(260,50%,55%)", unit: lengthUnit                       },
    { key: "right_calf",  label: "Right Calf",   color: "hsl(260,50%,65%)", unit: lengthUnit                       },
  ];
}

// ─── Small UI components ──────────────────────────────────────────────────────

function LastWeekChip({ delta, unit, lowerIsBetter = false }: { delta: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 0.01) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> no change this week</span>;
  }
  const positive = delta > 0;
  const good = lowerIsBetter ? !positive : positive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? "text-emerald-500" : "text-red-400"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{delta} {unit} this week
    </span>
  );
}

function MiniLineChart({ data, dataKey, color, unit, fullHeight = false }: {
  data: ChartData[];
  dataKey: string;
  color: string;
  unit?: string;
  fullHeight?: boolean;
}) {
  return (
    <div className={fullHeight ? "h-full w-full" : "h-28 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: fullHeight ? 11 : 9, fill: "var(--color-muted-foreground)" }}
            tickFormatter={v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }}
          />
          <YAxis
            tick={{ fontSize: fullHeight ? 11 : 9, fill: "var(--color-muted-foreground)" }}
            domain={["auto", "auto"]}
            unit={unit ? ` ${unit}` : ""}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => new Date(v).toLocaleDateString()}
            formatter={(val: number) => [`${val}${unit ? ` ${unit}` : ""}`, ""]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={fullHeight ? 2.5 : 2}
            dot={{ r: fullHeight ? 4 : 3, fill: color }}
            activeDot={{ r: fullHeight ? 6 : 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function HistoryList({ entries, charts, photosByDate }: {
  entries: MeasurementEntry[];
  charts: ReturnType<typeof getMeasurementCharts>;
  photosByDate?: Record<string, string>;
}) {
  const newest = [...entries].reverse();
  return (
    <div className="space-y-3">
      {newest.map((entry, revIdx) => {
        const origIdx = entries.length - 1 - revIdx;
        const prev = origIdx > 0 ? entries[origIdx - 1] : null;
        const presentMetrics = charts.filter(({ key }) => entry[key] != null);
        if (presentMetrics.length === 0) return null;
        const photoUrl = photosByDate?.[entry.date as string];
        return (
          <Card key={entry.date}>
            <CardContent className="pt-3 pb-3 px-4">
              <div className="flex items-start gap-3">
                {photoUrl && (
                  <img src={photoUrl} alt="Progress" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-2">{format(parseISO(entry.date as string), "MMM d, yyyy")}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {presentMetrics.map(({ key, label, unit, lowerIsBetter }) => {
                      const val = entry[key] as number;
                      const prevVal = prev?.[key] as number | null | undefined;
                      const delta = prevVal != null ? Number((val - prevVal).toFixed(2)) : null;
                      const showDelta = delta != null && Math.abs(delta) > 0.01;
                      const good = showDelta && (lowerIsBetter ? delta! < 0 : delta! > 0);
                      return (
                        <div key={key} className="flex items-baseline justify-between text-xs gap-1">
                          <span className="text-muted-foreground truncate">{label}</span>
                          <span className="font-medium shrink-0">
                            {val} {unit}
                            {showDelta && <span className={`ml-1 ${good ? "text-emerald-500" : "text-red-400"}`}>{delta! > 0 ? "+" : ""}{delta}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Photo helpers ────────────────────────────────────────────────────────────

const isLegacyUrl = (url: string) => url.startsWith("https://storage.example.com");

function BrokenPhotoPlaceholder() {
  return (
    <div className="w-full aspect-[3/4] bg-muted flex flex-col items-center justify-center gap-1">
      <ImageOff className="w-5 h-5 text-muted-foreground opacity-40" />
      <p className="text-[10px] text-muted-foreground text-center px-2 leading-tight opacity-60">Photo unavailable</p>
    </div>
  );
}

function UploadDialog({ trigger, onSave }: { trigger: React.ReactNode; onSave: (file: File, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const handleSave = () => {
    if (!selectedFile) return;
    onSave(selectedFile, notes);
    setOpen(false); setSelectedFile(null); setPreviewUrl(null); setNotes("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Progress Photo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Tap to choose a photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); } }} />
            </label>
          )}
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Front view, week 8" className="mt-1" />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={!selectedFile}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "training" | "body" | "photos";

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "training", label: "Training" },
    { id: "body",     label: "Body"     },
    { id: "photos",   label: "Photos"   },
  ];
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StatsPage() {
  const [tab, setTab] = useState<Tab>("training");
  const [bodyView, setBodyView] = useState<"charts" | "history">("charts");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [fullscreenChart, setFullscreenChart] = useState<FullscreenChart | null>(null);
  const { clientId } = useClientId();
  const { units, weightLabel, lengthLabel } = useUnitSystem();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: logs, isError: logsError, refetch: refetchLogs, isFetching: logsFetching } =
    useListWorkoutLogs(clientId!, { query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) } });

  const { data: measurements, isError: measurementsError, refetch: refetchMeasurements, isFetching: measurementsFetching } =
    useListMeasurements(clientId!, { query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) } });

  const { data: sleepLogs, isError: sleepError, refetch: refetchSleep, isFetching: sleepFetching } =
    useListSleepLogs(clientId!, { query: { enabled: !!clientId, queryKey: getListSleepLogsQueryKey(clientId!) } });

  const { data: photos, isError: photosError, refetch: refetchPhotos, isFetching: photosFetching } =
    useListProgressPhotos(clientId!, { query: { enabled: !!clientId, queryKey: getListProgressPhotosQueryKey(clientId!) } });

  const createPhoto = useCreateProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();
  const getUploadUrl = useGetUploadUrl();

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handleSavePhoto = (file: File, notes: string) => {
    getUploadUrl.mutate({ data: { filename: file.name, contentType: file.type } }, {
      onSuccess: async (data) => {
        try {
          const r = await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (!r.ok) throw new Error();
          const url = `/api/storage${data.objectPath}`;
          createPhoto.mutate({ clientId: clientId!, data: { date: new Date().toISOString().split("T")[0], imageUrl: url, notes: notes || undefined } }, {
            onSuccess: () => { qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) }); toast({ title: "Progress photo saved!" }); },
          });
        } catch { toast({ title: "Upload failed", variant: "destructive" }); }
      },
      onError: () => toast({ title: "Upload failed", variant: "destructive" }),
    });
  };

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  // ── Training data (for Training tab) ──────────────────────────────────────
  const allLogs = (logs ?? []) as WorkoutLogWithSets[];
  const isValidPrRpe = (rpe: number | null | undefined) => rpe == null || (rpe >= 7 && rpe <= 8);
  const prMap: Record<string, { weight: number; unit: string; date: string; reps: number; rpe?: number | null }> = {};
  for (const log of allLogs) {
    for (const s of log.sets ?? []) {
      if (s.weight == null || !isValidPrRpe(s.rpe)) continue;
      const existing = prMap[s.exerciseName];
      if (!existing || s.weight > existing.weight) {
        prMap[s.exerciseName] = { weight: s.weight, unit: s.weightUnit ?? "lbs", date: log.date, reps: s.reps, rpe: s.rpe };
      }
    }
  }
  const prs = Object.entries(prMap).sort((a, b) => b[1].weight - a[1].weight).slice(0, 20);

  const weekMap: Record<string, number> = {};
  for (const log of allLogs) {
    const wk = format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), "MMM d");
    weekMap[wk] = (weekMap[wk] ?? 0) + (log.sets ?? []).reduce((s, ss) => s + ss.reps, 0);
  }
  const volumeData = Object.entries(weekMap).sort((a, b) => {
    const al = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === a[0]);
    const bl = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === b[0]);
    return (al?.date ?? "").localeCompare(bl?.date ?? "");
  }).map(([week, reps]) => ({ week, reps }));

  const setsWeekMap: Record<string, number> = {};
  for (const log of allLogs) {
    const wk = format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), "MMM d");
    setsWeekMap[wk] = (setsWeekMap[wk] ?? 0) + (log.sets?.length ?? 0);
  }
  const setsData = Object.entries(setsWeekMap).sort((a, b) => {
    const al = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === a[0]);
    const bl = allLogs.find(l => format(startOfWeek(parseISO(l.date), { weekStartsOn: 1 }), "MMM d") === b[0]);
    return (al?.date ?? "").localeCompare(bl?.date ?? "");
  }).map(([week, sets]) => ({ week, sets }));

  const totalWorkouts = allLogs.length;
  const totalSets = allLogs.reduce((s, l) => s + (l.sets?.length ?? 0), 0);

  // ── Body data (for Body tab) ───────────────────────────────────────────────
  const MEASUREMENT_CHARTS = getMeasurementCharts(weightLabel, lengthLabel);
  const sorted = filterByTf(
    (measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    timeframe,
    customStart || null,
    customEnd || null,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstWeightDisplay = first?.weight != null ? toDisplayWeight(Number(first.weight), first.unit, units) : null;
  const lastWeightDisplay = last?.weight != null ? toDisplayWeight(Number(last.weight), last.unit, units) : null;
  const weightDelta = firstWeightDisplay != null && lastWeightDisplay != null ? Number((lastWeightDisplay - firstWeightDisplay).toFixed(1)) : null;
  const hasMeasurements = sorted.length > 0;

  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? toDisplayWeight(Number(m.weight),     m.unit, units) : null,
    body_fat:     m.bodyFat     != null ? Number(m.bodyFat)                                    : null,
    chest:        m.chest       != null ? toDisplayLength(Number(m.chest),      m.unit, units) : null,
    waist:        m.waist       != null ? toDisplayLength(Number(m.waist),      m.unit, units) : null,
    hips:         m.hips        != null ? toDisplayLength(Number(m.hips),       m.unit, units) : null,
    left_arm:     m.leftArm     != null ? toDisplayLength(Number(m.leftArm),    m.unit, units) : null,
    right_arm:    m.rightArm    != null ? toDisplayLength(Number(m.rightArm),   m.unit, units) : null,
    left_thigh:   m.leftThigh   != null ? toDisplayLength(Number(m.leftThigh),  m.unit, units) : null,
    right_thigh:  m.rightThigh  != null ? toDisplayLength(Number(m.rightThigh), m.unit, units) : null,
    left_calf:    m.leftCalf    != null ? toDisplayLength(Number(m.leftCalf),   m.unit, units) : null,
    right_calf:   m.rightCalf   != null ? toDisplayLength(Number(m.rightCalf),  m.unit, units) : null,
  }));

  const sortedSleep = filterByTf(
    (sleepLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    timeframe,
    customStart || null,
    customEnd || null,
  );
  const sleepData: ChartData[] = sortedSleep.map(s => ({ date: s.date, hours: s.hoursSlept }));
  const sleepPoints = sortedSleep.map(s => ({ date: s.date, value: Number(s.hoursSlept) }));
  const hasSleep = sortedSleep.length > 0;

  // ── Photos data ────────────────────────────────────────────────────────────
  const photosByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of photos ?? []) {
      if (!map[p.date] && !isLegacyUrl(p.imageUrl)) map[p.date] = p.imageUrl;
    }
    return map;
  }, [photos]);

  const measurementByDate = useMemo(() => {
    const map: Record<string, ChartData> = {};
    for (const m of measurementData) map[m.date as string] = m;
    return map;
  }, [measurementData]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Stats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Training, body & photos</p>
        </div>
        <TabBar tab={tab} onChange={setTab} />
      </div>

      {/* ═══ TRAINING TAB ═══════════════════════════════════════════════════ */}
      {tab === "training" && (() => {
        const isExample = totalWorkouts === 0 && !logsError;
        const displayVolume = isExample ? EXAMPLE_VOLUME_DATA : volumeData;
        const displaySets  = isExample ? EXAMPLE_SETS_DATA  : setsData;
        const displayPrCount = isExample ? EXAMPLE_PRS.length : prs.length;
        const displayWorkouts = isExample ? 32 : totalWorkouts;
        const displayTotalSets = isExample ? 480 : totalSets;
        return (
          <>
            {logsError && (
              <QueryErrorState message="Couldn't load your stats." onRetry={() => refetchLogs()} isRetrying={logsFetching} testId="button-retry-stats" />
            )}
            {isExample && <ExampleBanner />}

            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Dumbbell className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-2xl font-bold">{displayWorkouts}</p>
                  <p className="text-xs text-muted-foreground">Workouts</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-2xl font-bold">{displayTotalSets}</p>
                  <p className="text-xs text-muted-foreground">Total sets</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Trophy className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                  <p className="text-2xl font-bold">{displayPrCount}</p>
                  <p className="text-xs text-muted-foreground">PRs tracked</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Rep Volume by Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={displayVolume} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} reps`, "Volume"]} />
                    <Bar dataKey="reps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Dumbbell className="w-4 h-4 text-primary" />Sets per Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={displaySets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} sets`, "Sets"]} />
                    <Bar dataKey="sets" fill="hsl(var(--chart-2, 139 100% 40%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Personal Records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {isExample
                  ? EXAMPLE_PRS.map((pr, i) => (
                      <div key={pr.name} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{pr.name}</p>
                          <p className="text-xs text-muted-foreground">{pr.date}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold">{pr.weight} {pr.unit}</p>
                          <p className="text-xs text-muted-foreground">{pr.reps} reps</p>
                        </div>
                        {i === 0 && <Badge className="flex-shrink-0 text-xs">Top</Badge>}
                      </div>
                    ))
                  : prs.map(([name, pr], i) => (
                      <div key={name} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">{pr.date}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold">{pr.weight} {pr.unit}</p>
                          <p className="text-xs text-muted-foreground">{pr.reps} reps</p>
                        </div>
                        {i === 0 && <Badge className="flex-shrink-0 text-xs">Top</Badge>}
                      </div>
                    ))
                }
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* ═══ BODY TAB ═══════════════════════════════════════════════════════ */}
      {tab === "body" && (
        <>
          {(measurementsError || sleepError) && (
            <QueryErrorState message="Couldn't load your progress data." onRetry={() => { refetchMeasurements(); refetchSleep(); }} isRetrying={measurementsFetching || sleepFetching} testId="button-retry-progress" />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1w">Week</SelectItem>
                <SelectItem value="1m">Month</SelectItem>
                <SelectItem value="3m">3 Months</SelectItem>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="1y">Year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {hasMeasurements && (
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button onClick={() => setBodyView("charts")} className={`px-3 py-1.5 transition-colors ${bodyView === "charts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Charts</button>
                <button onClick={() => setBodyView("history")} className={`px-3 py-1.5 transition-colors ${bodyView === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>History</button>
              </div>
            )}
          </div>

          {timeframe === "custom" && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs w-[140px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs w-[140px]" />
              </div>
            </div>
          )}

          {(() => {
            const isBodyExample = !hasMeasurements && !hasSleep && !measurementsError && !sleepError;
            const bodyData = isBodyExample ? EXAMPLE_BODY_DATA : measurementData;
            const exSleepData = isBodyExample ? EXAMPLE_SLEEP_DATA : sleepData;
            const exSleepPoints = isBodyExample
              ? EXAMPLE_SLEEP_DATA.map(d => ({ date: d.date as string, value: d.hours as number }))
              : sleepPoints;
            const showMeasurements = isBodyExample || hasMeasurements;
            const showSleep = isBodyExample || (hasSleep && exSleepData.length >= 2);

            const exFirst = bodyData[0];
            const exLast  = bodyData[bodyData.length - 1];
            const exFirstWeight = exFirst?.weight != null ? Number(exFirst.weight) : null;
            const exLastWeight  = exLast?.weight  != null ? Number(exLast.weight)  : null;
            const exDelta = exFirstWeight != null && exLastWeight != null
              ? Number((exLastWeight - exFirstWeight).toFixed(1)) : null;

            // Unified weight delta: real data delta when available, fall back to example delta
            const effectiveDelta = isBodyExample ? exDelta : (weightDelta ?? exDelta);

            return (
              <>
                {isBodyExample && <ExampleBanner />}

                {showMeasurements && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      title="Starting Weight"
                      value={exFirstWeight != null ? `${isBodyExample ? exFirstWeight : firstWeightDisplay} ${weightLabel}` : "—"}
                      sub={exFirst?.date as string | undefined}
                    />
                    <StatCard
                      title="Current Weight"
                      value={exLastWeight != null ? `${isBodyExample ? exLastWeight : lastWeightDisplay} ${weightLabel}` : "—"}
                      sub={exLast?.date as string | undefined}
                    />
                    <Card>
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Change</p>
                        <div className="flex items-center justify-center gap-1">
                          {effectiveDelta != null && effectiveDelta < 0 && <ArrowDown className="w-5 h-5 text-emerald-500 shrink-0" />}
                          {effectiveDelta != null && effectiveDelta > 0 && <ArrowUp className="w-5 h-5 text-red-400 shrink-0" />}
                          {effectiveDelta != null && effectiveDelta === 0 && <Minus className="w-5 h-5 text-muted-foreground shrink-0" />}
                          <p className="text-2xl font-bold">
                            {effectiveDelta != null ? `${Math.abs(effectiveDelta)} ${weightLabel}` : "—"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {bodyView === "history" && showMeasurements && (
                  <div className="space-y-4">
                    <h2 className="text-base font-semibold">Measurement entries</h2>
                    <HistoryList entries={bodyData as MeasurementEntry[]} charts={MEASUREMENT_CHARTS} photosByDate={isBodyExample ? {} : photosByDate} />
                  </div>
                )}

                {bodyView === "charts" && (
                  <>
                    {showMeasurements && bodyData.length >= 2 && (
                      <div>
                        <h2 className="text-base font-semibold mb-4">Body Measurements</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {MEASUREMENT_CHARTS.map(({ key, label, color, unit, lowerIsBetter }) => {
                            const points = bodyData.filter(d => d[key] != null).map(d => ({ date: d.date as string, value: d[key] as number }));
                            if (points.length === 0) return null;
                            const lastVal = points[points.length - 1].value;
                            const firstVal = points[0].value;
                            const diff = lastVal - firstVal;
                            const lwDelta = lastWeekDelta(points);
                            return (
                              <Card key={key}>
                                <CardHeader className="pb-0 pt-3 px-4">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-bold">{lastVal} {unit}</span>
                                        {Math.abs(diff) > 0.05 && (
                                          <span className={`text-xs font-medium ${lowerIsBetter ? diff < 0 ? "text-emerald-500" : "text-red-400" : diff > 0 ? "text-emerald-500" : "text-red-400"}`}>
                                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setFullscreenChart({ label, color, unit, lowerIsBetter: lowerIsBetter ?? false, data: bodyData, dataKey: key, lwDelta, lastVal })}
                                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label={`View ${label} fullscreen`}
                                      >
                                        <Maximize2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-1">
                                    <LastWeekChip delta={lwDelta} unit={unit} lowerIsBetter={lowerIsBetter} />
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-2 pb-3 px-2">
                                  <MiniLineChart data={bodyData} dataKey={key} color={color} unit={unit} />
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showSleep && (
                      <div>
                        <h2 className="text-base font-semibold mb-3">Sleep</h2>
                        <Card>
                          <CardHeader className="pb-0 pt-3 px-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-semibold">Hours slept</CardTitle>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold">{Number(exSleepData[exSleepData.length - 1]?.hours).toFixed(1)} hrs</span>
                                <button
                                  onClick={() => setFullscreenChart({
                                    label: "Hours Slept",
                                    color: "hsl(200,70%,50%)",
                                    unit: "hrs",
                                    lowerIsBetter: false,
                                    data: exSleepData,
                                    dataKey: "hours",
                                    lwDelta: lastWeekDelta(exSleepPoints),
                                    lastVal: Number(exSleepData[exSleepData.length - 1]?.hours),
                                  })}
                                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label="View sleep fullscreen"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-1">
                              <LastWeekChip delta={lastWeekDelta(exSleepPoints)} unit="hrs" lowerIsBetter={false} />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-2 pb-3 px-2">
                            <MiniLineChart data={exSleepData} dataKey="hours" color="hsl(200,70%,50%)" unit="hrs" />
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ═══ PHOTOS TAB ═════════════════════════════════════════════════════ */}
      {tab === "photos" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Document your physique over time</p>
            <UploadDialog
              trigger={
                <Button size="sm" className="gap-1">
                  <Camera className="w-4 h-4" />Add photo
                </Button>
              }
              onSave={handleSavePhoto}
            />
          </div>

          {photosError && (
            <QueryErrorState message="Couldn't load your photos." onRetry={() => refetchPhotos()} isRetrying={photosFetching} testId="button-retry-photos" />
          )}

          {!photosError && (photos ?? []).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No photos yet. Add your first progress photo!</p>
            </div>
          )}

          {(photos ?? []).length > 0 && (() => {
            const grouped: Record<string, typeof photos> = {};
            for (const p of photos ?? []) {
              if (!grouped[p.date]) grouped[p.date] = [];
              grouped[p.date]!.push(p);
            }
            const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

            return (
              <div className="space-y-6">
                {dates.map(date => {
                  const dayPhotos = grouped[date]!;
                  const dayMeasurement = measurementByDate[date];
                  const weightVal = dayMeasurement?.weight != null ? Number(dayMeasurement.weight) : null;

                  return (
                    <div key={date}>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-sm font-semibold">{format(parseISO(date), "MMM d, yyyy")}</h3>
                        {weightVal != null && (
                          <span className="text-xs text-muted-foreground">{weightVal} {weightLabel}</span>
                        )}
                        <UploadDialog
                          trigger={
                            <button className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="Add photo">
                              <Plus className="w-4 h-4" />
                            </button>
                          }
                          onSave={handleSavePhoto}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {dayPhotos.map(photo => (
                          <div key={photo.id} className="relative group rounded-lg overflow-hidden">
                            {isLegacyUrl(photo.imageUrl) ? (
                              <BrokenPhotoPlaceholder />
                            ) : (
                              <img
                                src={photo.imageUrl}
                                alt={photo.notes ?? "Progress photo"}
                                className="w-full aspect-[3/4] object-cover"
                                onError={e => {
                                  const parent = (e.target as HTMLImageElement).parentElement;
                                  if (parent) parent.innerHTML = '<div class="w-full aspect-[3/4] bg-muted flex items-center justify-center"><svg class="w-5 h-5 text-muted-foreground opacity-40" ...></svg></div>';
                                }}
                              />
                            )}
                            <button
                              onClick={() => {
                                deletePhoto.mutate({ photoId: photo.id, clientId: clientId! }, {
                                  onSuccess: () => qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) }),
                                });
                              }}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Delete photo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {photo.notes && (
                              <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] text-white bg-black/50 truncate">{photo.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {/* ═══ FULLSCREEN CHART DIALOG ════════════════════════════════════════ */}
      <Dialog open={!!fullscreenChart} onOpenChange={open => !open && setFullscreenChart(null)}>
        <DialogContent className="max-w-full w-[95vw] h-[85vh] flex flex-col p-4 gap-2">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-6">
              <DialogTitle>{fullscreenChart?.label}</DialogTitle>
              {fullscreenChart && (
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold">
                    {fullscreenChart.lastVal != null ? `${fullscreenChart.lastVal} ${fullscreenChart.unit}` : "—"}
                  </span>
                  <LastWeekChip delta={fullscreenChart.lwDelta} unit={fullscreenChart.unit} lowerIsBetter={fullscreenChart.lowerIsBetter} />
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {fullscreenChart && (
              <MiniLineChart
                data={fullscreenChart.data}
                dataKey={fullscreenChart.dataKey}
                color={fullscreenChart.color}
                unit={fullscreenChart.unit}
                fullHeight
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
