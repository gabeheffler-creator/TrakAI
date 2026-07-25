import { useState, useRef } from "react";
import { useClientId } from "@/hooks/use-client-id";
import {
  useListNutritionLogs, getListNutritionLogsQueryKey,
  useCreateNutritionLog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Utensils, Camera, Loader2, Droplets, TrendingUp } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { QueryErrorState } from "@/components/query-error-state";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface MacroBarProps { label: string; value: number; color: string }
function MacroBar({ label, value, color }: MacroBarProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-bold" style={{ color }}>{value}g</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function NutritionPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: logs, isLoading, isError, refetch, isFetching } =
    useListNutritionLogs(clientId!, {
      query: {
        enabled: !!clientId,
        queryKey: getListNutritionLogsQueryKey(clientId!),
      },
    });

  const create = useCreateNutritionLog();

  const [open, setOpen] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    notes: "",
    imageUrl: "",
  });
  const [waterMode, setWaterMode] = useState(false);
  const [waterGlasses, setWaterGlasses] = useState(8);

  const sorted = [...(logs ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const todayISO = new Date().toISOString().split("T")[0];
  const todayMeals = sorted.filter((l) => l.date === todayISO && l.imageUrl !== "water_only");
  const todayWater = sorted.filter((l) => l.date === todayISO && l.imageUrl === "water_only");
  const todayCals = todayMeals.reduce((s, l) => s + (l.calories ?? 0), 0);
  const todayProtein = todayMeals.reduce((s, l) => s + (l.protein ?? 0), 0);
  const todayCarbs = todayMeals.reduce((s, l) => s + (l.carbs ?? 0), 0);
  const todayFat = todayMeals.reduce((s, l) => s + (l.fat ?? 0), 0);
  const todayWaterGlasses = todayWater.reduce((s, l) => s + (l.calories ?? 0), 0);

  // Weekly chart
  const weekChart = (() => {
    const days: { date: string; cals: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const cals = (logs ?? [])
        .filter((l) => l.date === iso && l.imageUrl !== "water_only")
        .reduce((s, l) => s + (l.calories ?? 0), 0);
      days.push({ date: iso, cals });
    }
    return days;
  })();

  const analyzeImage = async (file: File) => {
    setAiProcessing(true);
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
      const { imageUrl, analysis } = await uploadRes.json();
      setForm((f) => ({
        ...f,
        imageUrl: imageUrl ?? "",
        calories: String(analysis?.calories ?? ""),
        protein: String(analysis?.protein ?? ""),
        carbs: String(analysis?.carbs ?? ""),
        fat: String(analysis?.fat ?? ""),
        notes: analysis?.description ?? "",
      }));
    } catch {
      toast({ title: "AI analysis failed — fill in manually", variant: "destructive" });
    } finally {
      setAiProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeImage(file);
  };

  const handleSubmit = () => {
    if (!clientId) return;
    const cals = parseInt(form.calories);
    if (!form.date || isNaN(cals) || cals < 0) {
      toast({ title: "Please enter at least a date and calories", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        clientId,
        data: {
          date: form.date,
          imageUrl: form.imageUrl || "manual_entry",
          calories: cals,
          protein: form.protein ? Number(form.protein) : undefined,
          carbs: form.carbs ? Number(form.carbs) : undefined,
          fat: form.fat ? Number(form.fat) : undefined,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) });
          setOpen(false);
          setForm({ date: new Date().toISOString().split("T")[0], calories: "", protein: "", carbs: "", fat: "", notes: "", imageUrl: "" });
          toast({ title: "Meal logged!" });
        },
        onError: () => toast({ title: "Failed to log meal", variant: "destructive" }),
      }
    );
  };

  const handleWaterLog = () => {
    if (!clientId) return;
    create.mutate(
      {
        clientId,
        data: { date: todayISO, imageUrl: "water_only", calories: waterGlasses },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) });
          setWaterMode(false);
          toast({ title: `Logged ${waterGlasses} glasses of water!` });
        },
        onError: () => toast({ title: "Failed to log water", variant: "destructive" }),
      }
    );
  };

  const isImageUrl = (url: string) =>
    url && url !== "water_only" && url !== "manual_entry" && (url.startsWith("http") || url.startsWith("/"));

  if (isLoading) return <div className="space-y-3 mt-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  if (isError) return <QueryErrorState message="Couldn't load nutrition data." onRetry={() => refetch()} isRetrying={isFetching} className="pt-16" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Nutrition</h1>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setWaterMode(true)} className="gap-1 h-8 px-2.5 text-xs">
            <Droplets className="w-3.5 h-3.5 text-blue-500" /> Water
          </Button>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1 h-8 px-2.5 text-xs bg-primary hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Log
          </Button>
        </div>
      </div>

      {todayMeals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex items-end gap-1 mb-3">
              <span className="text-3xl font-bold text-primary">{todayCals.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground mb-1">kcal</span>
            </div>
            <div className="flex justify-around">
              <MacroBar label="Protein" value={todayProtein} color="#7c3aed" />
              <MacroBar label="Carbs" value={todayCarbs} color="#0ea5e9" />
              <MacroBar label="Fat" value={todayFat} color="#f59e0b" />
              {todayWaterGlasses > 0 && <MacroBar label="Water 🥛" value={todayWaterGlasses} color="#3b82f6" />}
            </div>
          </CardContent>
        </Card>
      )}

      {weekChart.some((d) => d.cals > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" /> This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weekChart} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => [`${v} kcal`, "Calories"]}
                  labelFormatter={(d) => format(parseISO(d), "MMM d")}
                />
                <Bar dataKey="cals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {weekChart.map((entry, i) => (
                    <Cell key={i} fill={entry.date === todayISO ? "hsl(var(--primary))" : "hsl(var(--primary)/0.5)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Meals</h2>
        {sorted.filter((l) => l.imageUrl !== "water_only").length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-10 text-center">
            <Utensils className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No meals logged yet.</p>
          </div>
        ) : (
          sorted.filter((l) => l.imageUrl !== "water_only").slice(0, 20).map((log) => (
            <Card key={log.id}>
              <CardContent className="px-4 py-3 flex items-center gap-3">
                {isImageUrl(log.imageUrl) ? (
                  <img src={log.imageUrl} alt="Meal" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Utensils className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Meal</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(log.date), "MMM d")}</p>
                  </div>
                  <p className="font-bold text-primary text-sm">{log.calories} kcal</p>
                  {(log.protein || log.carbs || log.fat) && (
                    <p className="text-xs text-muted-foreground">{log.protein}g P · {log.carbs}g C · {log.fat}g F</p>
                  )}
                  {log.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{log.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Meal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="default" className="flex-1">
                Manual
              </Button>
              <Button
                type="button" size="sm" variant="outline" className="flex-1 gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5" /> AI Photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </div>

            {aiProcessing && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analysing photo…</span>
              </div>
            )}

            {!aiProcessing && (
              <>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Calories *</Label>
                  <Input type="number" inputMode="numeric" placeholder="500" value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "protein", label: "Protein (g)", placeholder: "30" },
                    { key: "carbs", label: "Carbs (g)", placeholder: "60" },
                    { key: "fat", label: "Fat (g)", placeholder: "15" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number" inputMode="decimal" placeholder={placeholder}
                        value={(form as any)[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input placeholder="Grilled chicken salad…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={create.isPending || aiProcessing} className="w-full bg-primary hover:bg-primary/90">
              {create.isPending ? "Saving…" : "Save Meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waterMode} onOpenChange={setWaterMode}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl">
          <DialogHeader><DialogTitle>Log Water</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 justify-center">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setWaterGlasses((g) => Math.max(1, g - 1))}>−</Button>
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-500">{waterGlasses}</p>
                <p className="text-xs text-muted-foreground">glasses (8 fl oz each)</p>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setWaterGlasses((g) => Math.min(20, g + 1))}>+</Button>
            </div>
            {todayWaterGlasses > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                Already logged {todayWaterGlasses} glasses today
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleWaterLog} disabled={create.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              {create.isPending ? "Saving…" : "Log Water"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
