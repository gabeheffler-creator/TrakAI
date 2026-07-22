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
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Trophy, Dumbbell, Camera,
  Plus, Trash2, Upload, ImageOff,
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

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartData = { date: string; [key: string]: number | string | null };
type MeasurementEntry = ChartData & { date: string };
type Timeframe = "1m" | "6m" | "1y" | "all";

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

// ─── Math helpers ─────────────────────────────────────────────────────────────

function weeklyRate(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map(p => (new Date(p.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 7));
  const ys = points.map(p => p.value);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

function rolling7dDeltas(points: { date: string; value: number }[]): { date: string; delta: number }[] {
  if (points.length < 2) return [];
  const result: { date: string; delta: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const curTime = new Date(cur.date).getTime();
    const cutoff = curTime - 5 * 24 * 60 * 60 * 1000;
    let best: { date: string; value: number } | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (new Date(points[j].date).getTime() <= cutoff) { best = points[j]; break; }
    }
    if (best) {
      result.push({ date: format(parseISO(cur.date), "MMM d"), delta: Number((cur.value - best.value).toFixed(2)) });
    }
  }
  return result;
}

function lastWeekDelta(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = new Date(last.date).getTime() - 5 * 24 * 60 * 60 * 1000;
  const prior = [...points].reverse().find(p => new Date(p.date).getTime() <= cutoff);
  if (!prior) return null;
  return Number((last.value - prior.value).toFixed(2));
}

function filterByTf<T extends { date: string }>(items: T[], tf: Timeframe): T[] {
  if (tf === "all") return items;
  const days = tf === "1m" ? 30 : tf === "6m" ? 180 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return items.filter(i => i.date >= cutoffStr);
}

// ─── Chart config ─────────────────────────────────────────────────────────────

function getMeasurementCharts(weightUnit: string, lengthUnit: string) {
  return [
    { key: "weight",      label: "Body Weight",  color: "hsl(271,70%,56%)", unit: weightUnit, lowerIsBetter: true },
    { key: "body_fat",    label: "Body Fat %",   color: "hsl(15,85%,55%)",  unit: "%",         lowerIsBetter: true },
    { key: "chest",       label: "Chest",        color: "hsl(340,75%,55%)", unit: lengthUnit },
    { key: "waist",       label: "Waist",        color: "hsl(200,70%,50%)", unit: lengthUnit,  lowerIsBetter: true },
    { key: "hips",        label: "Hips",         color: "hsl(38,92%,50%)",  unit: lengthUnit,  lowerIsBetter: true },
    { key: "left_arm",    label: "Left Arm",     color: "hsl(158,64%,38%)", unit: lengthUnit },
    { key: "right_arm",   label: "Right Arm",    color: "hsl(158,64%,50%)", unit: lengthUnit },
    { key: "left_thigh",  label: "Left Thigh",   color: "hsl(28,85%,50%)",  unit: lengthUnit },
    { key: "right_thigh", label: "Right Thigh",  color: "hsl(28,85%,60%)",  unit: lengthUnit },
    { key: "left_calf",   label: "Left Calf",    color: "hsl(260,50%,55%)", unit: lengthUnit },
    { key: "right_calf",  label: "Right Calf",   color: "hsl(260,50%,65%)", unit: lengthUnit },
  ];
}

// ─── Small UI components ──────────────────────────────────────────────────────

function RateChip({ rate, unit, lowerIsBetter = false }: { rate: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (rate == null || Math.abs(rate) < 0.001) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> stable avg</span>;
  }
  const positive = rate > 0;
  const good = lowerIsBetter ? !positive : positive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? "text-emerald-500" : "text-red-400"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{rate.toFixed(2)} {unit}/wk avg
    </span>
  );
}

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

function MiniLineChart({ data, dataKey, color, unit }: { data: ChartData[]; dataKey: string; color: string; unit?: string }) {
  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} tickFormatter={v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
          <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} domain={["auto", "auto"]} unit={unit ? ` ${unit}` : ""} width={40} />
          <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} labelFormatter={v => new Date(v).toLocaleDateString()} formatter={(val: number) => [`${val}${unit ? ` ${unit}` : ""}`, ""]} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaHistoryChart({ deltas, unit, lowerIsBetter = false }: { deltas: { date: string; delta: number }[]; unit: string; lowerIsBetter?: boolean }) {
  if (deltas.length === 0) return null;
  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <p className="text-[10px] text-muted-foreground mb-1 px-1">Net change vs. prior ~7 days ({unit})</p>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={deltas} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} width={38} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} formatter={(val: number) => { const sign = val > 0 ? "+" : ""; return [`${sign}${val} ${unit}`, "7d change"]; }} />
            <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
              {deltas.map((d, i) => {
                const isGood = lowerIsBetter ? d.delta < 0 : d.delta > 0;
                return <Cell key={i} fill={Math.abs(d.delta) < 0.01 ? "hsl(var(--muted-foreground))" : isGood ? "hsl(142,70%,45%)" : "hsl(0,72%,60%)"} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, delta, deltaUnit = "lbs" }: { title: string; value: string | number; sub?: string; delta?: number | null; deltaUnit?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {delta != null && (
          <p className={`text-xs font-medium mt-1 ${delta < 0 ? "text-emerald-500" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{Math.abs(delta).toFixed(1)} {deltaUnit}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RateRow({ label, rate, unit, lowerIsBetter = false }: { label: string; rate: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (rate == null || Math.abs(rate) < 0.001) return null;
  const positive = rate > 0;
  const good = lowerIsBetter ? !positive : positive;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${good ? "text-emerald-500" : "text-red-400"}`}>
        {positive ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
        {positive ? "+" : ""}{rate.toFixed(2)} {unit}/wk
      </span>
    </div>
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
  const sorted = filterByTf((measurements ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstWeightDisplay = first?.weight != null ? toDisplayWeight(Number(first.weight), first.unit, units) : null;
  const lastWeightDisplay = last?.weight != null ? toDisplayWeight(Number(last.weight), last.unit, units) : null;
  const weightDelta = firstWeightDisplay != null && lastWeightDisplay != null ? Number((lastWeightDisplay - firstWeightDisplay).toFixed(1)) : null;
  const hasMeasurements = sorted.length > 0;

  const measurementData: ChartData[] = sorted.map(m => ({
    date: m.date,
    weight:       m.weight      != null ? toDisplayWeight(Number(m.weight),    m.unit, units) : null,
    body_fat:     m.bodyFat     != null ? Number(m.bodyFat)                                   : null,
    chest:        m.chest       != null ? toDisplayLength(Number(m.chest),     m.unit, units) : null,
    waist:        m.waist       != null ? toDisplayLength(Number(m.waist),     m.unit, units) : null,
    hips:         m.hips        != null ? toDisplayLength(Number(m.hips),      m.unit, units) : null,
    left_arm:     m.leftArm     != null ? toDisplayLength(Number(m.leftArm),   m.unit, units) : null,
    right_arm:    m.rightArm    != null ? toDisplayLength(Number(m.rightArm),  m.unit, units) : null,
    left_thigh:   m.leftThigh   != null ? toDisplayLength(Number(m.leftThigh), m.unit, units) : null,
    right_thigh:  m.rightThigh  != null ? toDisplayLength(Number(m.rightThigh),m.unit, units) : null,
    left_calf:    m.leftCalf    != null ? toDisplayLength(Number(m.leftCalf),  m.unit, units) : null,
    right_calf:   m.rightCalf   != null ? toDisplayLength(Number(m.rightCalf), m.unit, units) : null,
  }));

  const sortedSleep = filterByTf((sleepLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const sleepData: ChartData[] = sortedSleep.map(s => ({ date: s.date, hours: s.hoursSlept }));
  const sleepPoints = sortedSleep.map(s => ({ date: s.date, value: Number(s.hoursSlept) }));
  const hasSleep = sortedSleep.length > 0;

  const sortedWorkouts = filterByTf(allLogs.slice().sort((a, b) => a.date.localeCompare(b.date)), timeframe);
  const hasWorkouts = sortedWorkouts.length > 0;
  const workoutRate = (() => {
    if (sortedWorkouts.length < 2) return null;
    const t0 = new Date(sortedWorkouts[0].date).getTime();
    const tN = new Date(sortedWorkouts[sortedWorkouts.length - 1].date).getTime();
    const weeks = (tN - t0) / (1000 * 60 * 60 * 24 * 7);
    if (weeks < 0.5) return null;
    return sortedWorkouts.length / weeks;
  })();

  const rateRows = MEASUREMENT_CHARTS.map(({ key, label, unit, lowerIsBetter }) => {
    const points = measurementData.filter(d => d[key] != null).map(d => ({ date: d.date as string, value: d[key] as number }));
    return { label, unit, lowerIsBetter, rate: weeklyRate(points) };
  }).filter(r => r.rate != null && Math.abs(r.rate) >= 0.001);

  // ── Photos data ────────────────────────────────────────────────────────────
  // Map: date → first photo url for that date (for History view thumbnails)
  const photosByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of photos ?? []) {
      if (!map[p.date] && !isLegacyUrl(p.imageUrl)) map[p.date] = p.imageUrl;
    }
    return map;
  }, [photos]);

  // Map: date → measurement data for that date (for Photos tab measurement display)
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
      {tab === "training" && (
        <>
          {logsError && (
            <QueryErrorState message="Couldn't load your stats." onRetry={() => refetchLogs()} isRetrying={logsFetching} testId="button-retry-stats" />
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <Dumbbell className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                <p className="text-2xl font-bold">{totalWorkouts}</p>
                <p className="text-xs text-muted-foreground">Workouts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                <p className="text-2xl font-bold">{totalSets}</p>
                <p className="text-xs text-muted-foreground">Total sets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1.5 text-primary" />
                <p className="text-2xl font-bold">{prs.length}</p>
                <p className="text-xs text-muted-foreground">PRs tracked</p>
              </CardContent>
            </Card>
          </div>

          {volumeData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Rep Volume by Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} reps`, "Volume"]} />
                    <Bar dataKey="reps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {setsData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Dumbbell className="w-4 h-4 text-primary" />Sets per Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={setsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} sets`, "Sets"]} />
                    <Bar dataKey="sets" fill="hsl(var(--chart-2, 139 100% 40%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Personal Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {prs.length === 0 && <p className="text-sm text-muted-foreground py-2">No weighted sets logged yet.</p>}
              {prs.map(([name, pr], i) => (
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
              ))}
            </CardContent>
          </Card>

          {totalWorkouts === 0 && !logsError && (
            <div className="text-center py-12 text-muted-foreground">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No workouts yet</p>
              <p className="text-sm mt-1">Log a workout to see your stats here.</p>
            </div>
          )}
        </>
      )}

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
                <SelectItem value="1m">Last month</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            {hasMeasurements && (
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button onClick={() => setBodyView("charts")} className={`px-3 py-1.5 transition-colors ${bodyView === "charts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Charts</button>
                <button onClick={() => setBodyView("history")} className={`px-3 py-1.5 transition-colors ${bodyView === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>History</button>
              </div>
            )}
          </div>

          {!hasMeasurements && !hasSleep && !hasWorkouts && !measurementsError && !sleepError && (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No data yet. Start logging workouts and measurements!</p>
            </div>
          )}

          {hasMeasurements && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard title="Starting Weight" value={firstWeightDisplay != null ? `${firstWeightDisplay} ${weightLabel}` : "—"} sub={first?.date} />
              <StatCard title="Current Weight" value={lastWeightDisplay != null ? `${lastWeightDisplay} ${weightLabel}` : "—"} sub={last?.date} />
              <StatCard title="Total Change" value={weightDelta != null ? `${Math.abs(weightDelta)} ${weightLabel}` : "—"} sub={weightDelta != null ? (weightDelta < 0 ? "lost" : "gained") : undefined} delta={weightDelta} deltaUnit={weightLabel} />
            </div>
          )}

          {bodyView === "history" && hasMeasurements && (
            <div className="space-y-4">
              {rateRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-semibold">Avg rate of change</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3">
                    {rateRows.map(r => <RateRow key={r.label} label={r.label} rate={r.rate} unit={r.unit} lowerIsBetter={r.lowerIsBetter} />)}
                  </CardContent>
                </Card>
              )}
              <h2 className="text-base font-semibold">Measurement entries</h2>
              <HistoryList entries={measurementData as MeasurementEntry[]} charts={MEASUREMENT_CHARTS} photosByDate={photosByDate} />
            </div>
          )}

          {bodyView === "charts" && (
            <>
              {hasMeasurements && measurementData.length >= 2 && (
                <div>
                  <h2 className="text-base font-semibold mb-4">Body Measurements</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {MEASUREMENT_CHARTS.map(({ key, label, color, unit, lowerIsBetter }) => {
                      const points = measurementData.filter(d => d[key] != null).map(d => ({ date: d.date as string, value: d[key] as number }));
                      if (points.length === 0) return null;
                      const firstVal = points[0].value;
                      const lastVal = points[points.length - 1].value;
                      const diff = lastVal - firstVal;
                      const rate = weeklyRate(points);
                      const lwDelta = lastWeekDelta(points);
                      const deltas = rolling7dDeltas(points);
                      return (
                        <Card key={key}>
                          <CardHeader className="pb-0 pt-3 px-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-bold">{lastVal} {unit}</span>
                                {Math.abs(diff) > 0.05 && (
                                  <span className={`text-xs font-medium ${lowerIsBetter ? diff < 0 ? "text-emerald-500" : "text-red-400" : diff > 0 ? "text-emerald-500" : "text-red-400"}`}>
                                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <RateChip rate={rate} unit={unit} lowerIsBetter={lowerIsBetter} />
                              <span className="text-muted-foreground text-xs">·</span>
                              <LastWeekChip delta={lwDelta} unit={unit} lowerIsBetter={lowerIsBetter} />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-2 pb-3 px-2">
                            <MiniLineChart data={measurementData} dataKey={key} color={color} unit={unit} />
                            <DeltaHistoryChart deltas={deltas} unit={unit} lowerIsBetter={lowerIsBetter} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasSleep && sleepData.length >= 2 && (
                <div>
                  <h2 className="text-base font-semibold mb-3">Sleep</h2>
                  <Card>
                    <CardHeader className="pb-0 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Hours slept</CardTitle>
                        <span className="text-sm font-bold">{Number(sleepData[sleepData.length - 1]?.hours).toFixed(1)} hrs</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <RateChip rate={weeklyRate(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                        <span className="text-muted-foreground text-xs">·</span>
                        <LastWeekChip delta={lastWeekDelta(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-3 px-2">
                      <MiniLineChart data={sleepData} dataKey="hours" color="hsl(200,70%,50%)" unit="hrs" />
                      <DeltaHistoryChart deltas={rolling7dDeltas(sleepPoints)} unit="hrs" lowerIsBetter={false} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {hasWorkouts && (
                <div>
                  <h2 className="text-base font-semibold mb-3">Workouts</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard title="Total Sessions" value={sortedWorkouts.length} sub="in timeframe" />
                    <Card>
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Avg Frequency</p>
                        <p className="text-2xl font-bold">{workoutRate != null ? workoutRate.toFixed(1) : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">sessions/week</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
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
                  <Plus className="w-4 h-4" /> Add photo
                </Button>
              }
              onSave={handleSavePhoto}
            />
          </div>

          {photosError && (
            <QueryErrorState message="Couldn't load progress photos." onRetry={() => refetchPhotos()} isRetrying={photosFetching} testId="button-retry-progress-photos" />
          )}

          {!photosError && (photos?.length ?? 0) === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
              <Camera className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No progress photos yet</p>
              <p className="text-sm mt-1">Start documenting your journey!</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!photosError && photos?.slice().reverse().map(p => {
              const mForDate = measurementByDate[p.date];
              const presentMetrics = mForDate
                ? MEASUREMENT_CHARTS.filter(({ key }) => mForDate[key] != null).slice(0, 4)
                : [];
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="relative">
                    {isLegacyUrl(p.imageUrl) ? (
                      <BrokenPhotoPlaceholder />
                    ) : (
                      <img src={p.imageUrl} alt="Progress" className="w-full aspect-[3/4] object-cover" />
                    )}
                    <button
                      onClick={() => deletePhoto.mutate({ clientId: clientId!, photoId: p.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) }) })}
                      className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <CardContent className="p-2 space-y-1">
                    <p className="text-xs font-semibold">{p.date}</p>
                    {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
                    {presentMetrics.length > 0 && (
                      <div className="pt-1 border-t border-border/40 space-y-0.5">
                        {presentMetrics.map(({ key, label, unit }) => (
                          <div key={key} className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">{mForDate[key]} {unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
