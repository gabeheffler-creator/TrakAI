import { useState } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import {
  useListMeasurements, getListMeasurementsQueryKey,
  useLogMeasurement,
  useListWorkoutLogs, getListWorkoutLogsQueryKey,
  useListProgressPhotos, getListProgressPhotosQueryKey,
  useCreateProgressPhoto,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { Plus, Camera, TrendingUp, Dumbbell, Ruler } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QueryErrorState } from "@/components/query-error-state";
import { cn } from "@/lib/utils";

type Tab = "training" | "body" | "photos";

const BODY_PARTS = ["chest", "waist", "hips", "left_arm", "right_arm", "left_thigh", "right_thigh", "left_calf", "right_calf", "neck"];
const BODY_PART_LABELS: Record<string, string> = {
  chest: "Chest", waist: "Waist", hips: "Hips",
  left_arm: "L Arm", right_arm: "R Arm",
  left_thigh: "L Thigh", right_thigh: "R Thigh",
  left_calf: "L Calf", right_calf: "R Calf", neck: "Neck",
};

export function StatsPage() {
  const { clientId } = useClientId();
  const { units, weightLabel, lengthLabel } = useUnitSystem();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("training");
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureForm, setMeasureForm] = useState<Record<string, string>>({ date: new Date().toISOString().split("T")[0], weight: "" });
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split("T")[0]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: measurements, isLoading: measLoading, isError: measError, refetch: refetchMeas, isFetching: measFetching } =
    useListMeasurements(clientId!, {
      query: { enabled: !!clientId, queryKey: getListMeasurementsQueryKey(clientId!) },
    });

  const { data: workoutLogs, isLoading: logsLoading, isError: logsError, refetch: refetchLogs, isFetching: logsFetching } =
    useListWorkoutLogs(clientId!, {
      query: { enabled: !!clientId, queryKey: getListWorkoutLogsQueryKey(clientId!) },
    });

  const { data: photos, isLoading: photosLoading, isError: photosError, refetch: refetchPhotos } =
    useListProgressPhotos(clientId!, {
      query: { enabled: !!clientId && tab === "photos", queryKey: getListProgressPhotosQueryKey(clientId!) },
    });

  const createMeasurement = useLogMeasurement();
  const createPhoto = useCreateProgressPhoto();

  const sortedMeasurements = [...(measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const weightHistory = sortedMeasurements
    .filter(m => m.weight)
    .slice(0, 20)
    .reverse()
    .map(m => {
      let w = Number(m.weight);
      const stored = m.unit === "metric" ? "metric" : "imperial";
      if (stored !== units) {
        w = units === "imperial" ? w * 2.20462 : w * 0.453592;
      }
      return { date: m.date, weight: Math.round(w * 10) / 10 };
    });

  const sortedLogs = [...(workoutLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const logsThisWeek = sortedLogs.filter(l => {
    const d = parseISO(l.date);
    return d >= subDays(new Date(), 7);
  }).length;
  const logsThisMonth = sortedLogs.filter(l => {
    const d = parseISO(l.date);
    return d >= subDays(new Date(), 30);
  }).length;

  // Workouts per week chart (last 8 weeks)
  const weeklyWorkouts = (() => {
    const weeks: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = subDays(new Date(), i * 7 + 7);
      const end = subDays(new Date(), i * 7);
      const count = sortedLogs.filter(l => {
        const d = parseISO(l.date);
        return d >= start && d < end;
      }).length;
      weeks.push({ week: format(end, "MMM d"), count });
    }
    return weeks;
  })();

  const handleMeasureSave = () => {
    if (!clientId || !measureForm.date) {
      toast({ title: "Please enter a date", variant: "destructive" });
      return;
    }
    const data: Record<string, unknown> = { date: measureForm.date, unit: units };
    if (measureForm.weight) data.weight = parseFloat(measureForm.weight);
    BODY_PARTS.forEach(p => { if (measureForm[p]) data[p] = parseFloat(measureForm[p]); });

    createMeasurement.mutate(
      { clientId, data: data as any },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMeasurementsQueryKey(clientId!) });
          setMeasureOpen(false);
          setMeasureForm({ date: new Date().toISOString().split("T")[0], weight: "" });
          toast({ title: "Measurement saved!" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const uploadRes = await fetch("/api/nutrition/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { imageUrl } = await uploadRes.json();
      await createPhoto.mutateAsync({ clientId, data: { date: photoDate, imageUrl: imageUrl as string } });
      qc.invalidateQueries({ queryKey: getListProgressPhotosQueryKey(clientId!) });
      setPhotoOpen(false);
      toast({ title: "Photo saved!" });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "training", label: "Training", icon: <Dumbbell className="w-4 h-4" /> },
    { id: "body", label: "Body", icon: <Ruler className="w-4 h-4" /> },
    { id: "photos", label: "Photos", icon: <Camera className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Stats</h1>
        </div>
        {tab === "body" && (
          <Button size="sm" onClick={() => setMeasureOpen(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Log
          </Button>
        )}
        {tab === "photos" && (
          <Button size="sm" onClick={() => setPhotoOpen(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Camera className="w-4 h-4" /> Add Photo
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors",
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Training tab */}
      {tab === "training" && (
        <div className="space-y-4">
          {logsError ? (
            <QueryErrorState message="Couldn't load workout history." onRetry={() => refetchLogs()} isRetrying={logsFetching} className="pt-10" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="text-2xl font-bold text-primary">{logsThisWeek}</p>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="text-2xl font-bold">{logsThisMonth}</p>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>
              </div>

              {weeklyWorkouts.some(w => w.count > 0) && (
                <Card>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-medium">Weekly Volume</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={weeklyWorkouts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                        <Tooltip formatter={(v) => [v, "Workouts"]} />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Sessions</h2>
                {logsLoading ? (
                  [1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)
                ) : sortedLogs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">No workouts logged yet.</div>
                ) : (
                  sortedLogs.slice(0, 10).map(log => (
                    <Card key={log.id}>
                      <CardContent className="pt-2.5 pb-2.5 px-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{log.programDayName ?? "Free workout"}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(log.date), "EEE, MMM d")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Body tab */}
      {tab === "body" && (
        <div className="space-y-4">
          {measError ? (
            <QueryErrorState message="Couldn't load measurements." onRetry={() => refetchMeas()} isRetrying={measFetching} className="pt-10" />
          ) : (
            <>
              {weightHistory.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-medium">Weight ({weightLabel})</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={weightHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v) => [`${v} ${weightLabel}`, "Weight"]} labelFormatter={(d) => format(parseISO(d), "MMM d")} />
                        <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
                {measLoading ? (
                  [1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />)
                ) : sortedMeasurements.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground">No measurements yet.</p>
                    <Button size="sm" className="mt-3 bg-primary hover:bg-primary/90" onClick={() => setMeasureOpen(true)}>
                      <Plus className="w-4 h-4 mr-1.5" /> Log First Measurement
                    </Button>
                  </div>
                ) : (
                  sortedMeasurements.slice(0, 12).map(m => {
                    let w = m.weight ? Number(m.weight) : null;
                    if (w !== null) {
                      const stored = m.unit === "metric" ? "metric" : "imperial";
                      if (stored !== units) w = Math.round((units === "imperial" ? w * 2.20462 : w * 0.453592) * 10) / 10;
                    }
                    return (
                      <Card key={m.id}>
                        <CardContent className="pt-3 pb-3 px-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-semibold">{format(parseISO(m.date), "EEE, MMM d yyyy")}</p>
                            {w !== null && <p className="text-sm font-bold text-primary">{w} {weightLabel}</p>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {BODY_PARTS.filter(p => (m as any)[p]).map(p => (
                              <span key={p} className="text-xs text-muted-foreground">
                                {BODY_PART_LABELS[p]}: {(m as any)[p]} {lengthLabel}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (
        <div className="space-y-4">
          {photosError ? (
            <QueryErrorState message="Couldn't load photos." onRetry={() => refetchPhotos()} isRetrying={false} className="pt-10" />
          ) : photosLoading ? (
            <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse" />)}</div>
          ) : !photos || photos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <Camera className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No progress photos yet.</p>
              <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={() => setPhotoOpen(true)}>
                <Camera className="w-4 h-4" /> Add First Photo
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[...photos].sort((a, b) => b.date.localeCompare(a.date)).map((photo) => (
                  <button key={photo.id} onClick={() => setSelectedPhoto((photo as any).url ?? (photo as any).imageUrl ?? "")} className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors">
                    <img src={(photo as any).url ?? (photo as any).imageUrl} alt={photo.date} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {/* Full-screen photo viewer */}
              {selectedPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPhoto(null)}>
                  <img src={selectedPhoto} alt="Progress photo" className="max-w-full max-h-full object-contain rounded-xl" />
                  <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" onClick={() => setSelectedPhoto(null)}>
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Measurement dialog */}
      <Dialog open={measureOpen} onOpenChange={setMeasureOpen}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Measurement</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={measureForm.date} onChange={e => setMeasureForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight ({weightLabel})</Label>
              <Input type="number" inputMode="decimal" step="0.1" placeholder={units === "metric" ? "70.5" : "155.5"} value={measureForm.weight ?? ""} onChange={e => setMeasureForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            {BODY_PARTS.map(part => (
              <div key={part} className="space-y-1.5">
                <Label>{BODY_PART_LABELS[part]} ({lengthLabel})</Label>
                <Input type="number" inputMode="decimal" step="0.1" placeholder="0.0" value={measureForm[part] ?? ""} onChange={e => setMeasureForm(f => ({ ...f, [part]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleMeasureSave} disabled={createMeasurement.isPending} className="w-full bg-primary hover:bg-primary/90">
              {createMeasurement.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo upload dialog */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl">
          <DialogHeader><DialogTitle>Add Progress Photo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer bg-muted/20 transition-colors">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{photoUploading ? "Uploading…" : "Tap to choose photo"}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={photoUploading} onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
