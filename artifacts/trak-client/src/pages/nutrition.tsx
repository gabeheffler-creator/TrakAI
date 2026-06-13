import { useState, useRef, useMemo, useEffect } from "react";
import { useClientId } from "@/hooks/use-client-id";
import { useUnitSystem } from "@/hooks/use-unit-system";
import {
  useListNutritionLogs,
  useCreateNutritionLog,
  useDeleteNutritionLog,
  useGetUploadUrl,
  getListNutritionLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, Minus, Loader2, Pencil, Check, ChevronDown, ChevronUp, UtensilsCrossed, Trash2, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterOz: number;
}


function GoalBar({ label, actual, goal, color }: { label: string; actual: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
  const over = actual > goal && goal > 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold tabular-nums", over ? "text-destructive" : "text-foreground")}>
          {actual}<span className="text-muted-foreground font-normal">/{goal}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color, over && "bg-destructive")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface MealSlot {
  id: string;
  label: string;
  file: File | null;
  previewUrl: string | null;
  cantTrack: boolean;
  cantTrackNote: string;
  calorieGuess: string;
  uploading: boolean;
}

interface AiResult {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sodium: number | null;
  editing: boolean;
}

const OZ_PER_GLASS = 8;
const ML_PER_OZ = 29.5735;
const GLASS_ML = Math.round(OZ_PER_GLASS * ML_PER_OZ); // 237

function PhotoBox({
  slot,
  aiResult,
  calLabel,
  onFileChange,
  onCantTrackToggle,
  onNoteChange,
  onCalorieGuessChange,
  onAiEdit,
  onAiSave,
  onAiFieldChange,
}: {
  slot: MealSlot;
  aiResult: AiResult | null;
  calLabel: string;
  onFileChange: (file: File, url: string) => void;
  onCantTrackToggle: () => void;
  onNoteChange: (v: string) => void;
  onCalorieGuessChange: (v: string) => void;
  onAiEdit: () => void;
  onAiSave: () => void;
  onAiFieldChange: (field: keyof Omit<AiResult, "editing">, value: string) => void;
  onSodiumChange?: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{slot.label}</span>
        <button
          onClick={onCantTrackToggle}
          className={cn(
            "text-xs px-2 py-1 rounded-full border transition-colors",
            slot.cantTrack
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          {slot.cantTrack ? "Can't track ✓" : "Can't track?"}
        </button>
      </div>

      {slot.cantTrack ? (
        <div className="px-4 pb-4 space-y-2">
          <Textarea
            placeholder="What happened? (missed meal, ate out, forgot to log…)"
            value={slot.cantTrackNote}
            onChange={e => onNoteChange(e.target.value)}
            className="text-sm resize-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Calorie guess:</span>
            <Input
              type="number"
              placeholder="e.g. 600"
              value={slot.calorieGuess}
              onChange={e => onCalorieGuessChange(e.target.value)}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">{calLabel}</span>
          </div>
        </div>
      ) : (
        <>
          <div
            className="mx-4 mb-3 aspect-[4/3] rounded-xl bg-muted/60 border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors relative overflow-hidden"
            onClick={() => inputRef.current?.click()}
          >
            {slot.uploading ? (
              <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin" />
            ) : slot.previewUrl ? (
              <img src={slot.previewUrl} alt="MFP screenshot" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-10 h-10 text-muted-foreground/30" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground/50 mt-2">Tap to upload screenshot</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFileChange(f, URL.createObjectURL(f));
              }}
            />
          </div>

          {aiResult && (
            <div className="mx-4 mb-4 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-primary">AI Extracted Macros</span>
                {aiResult.editing ? (
                  <button onClick={onAiSave} className="text-xs text-primary flex items-center gap-1">
                    <Check className="w-3 h-3" /> Save
                  </button>
                ) : (
                  <button onClick={onAiEdit} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              {aiResult.editing ? (
                <div className="grid grid-cols-2 gap-2">
                  {(["calories", "protein", "carbs", "fat", "sodium"] as const).map(field => (
                    <div key={field}>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{field}</label>
                      <Input
                        type="number"
                        value={aiResult[field] ?? ""}
                        onChange={e => onAiFieldChange(field, e.target.value)}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1 text-center">
                  {([
                    { label: "Cal", val: aiResult.calories, unit: calLabel },
                    { label: "Protein", val: aiResult.protein, unit: "g" },
                    { label: "Carbs", val: aiResult.carbs, unit: "g" },
                    { label: "Fat", val: aiResult.fat, unit: "g" },
                    { label: "Sodium", val: aiResult.sodium, unit: "mg" },
                  ] as const).map(m => (
                    <div key={m.label}>
                      <p className="text-xs font-bold text-foreground">{m.val ?? "–"}</p>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function makeSlot(label: string): MealSlot {
  return {
    id: Math.random().toString(36).slice(2),
    label,
    file: null,
    previewUrl: null,
    cantTrack: false,
    cantTrackNote: "",
    calorieGuess: "",
    uploading: false,
  };
}

export function NutritionPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [coachGoals, setCoachGoals] = useState<NutritionGoals | null>(null);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/clients/${clientId}/nutrition-goal`)
      .then(r => r.ok ? r.json() : null)
      .then(g => { if (g) setCoachGoals(g); })
      .catch(() => {});
  }, [clientId]);

  const [diarySlot, setDiarySlot] = useState<MealSlot>(makeSlot("MFP Diary Overview"));
  const [mealSlots, setMealSlots] = useState<MealSlot[]>([
    makeSlot("Meal 1"),
    makeSlot("Meal 2"),
    makeSlot("Meal 3"),
  ]);
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>({});
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPastLogs, setShowPastLogs] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: logs, isLoading } = useListNutritionLogs(clientId!, {
    query: { enabled: !!clientId, queryKey: getListNutritionLogsQueryKey(clientId!) }
  });
  const createNutritionLog = useCreateNutritionLog();
  const deleteNutritionLog = useDeleteNutritionLog();
  const getUploadUrl = useGetUploadUrl();

  const addMeal = () => {
    setMealSlots(prev => [...prev, makeSlot(`Meal ${prev.length + 1}`)]);
  };

  const removeMeal = () => {
    if (mealSlots.length <= 1) return;
    const removed = mealSlots[mealSlots.length - 1];
    setMealSlots(prev => prev.slice(0, -1));
    setAiResults(prev => {
      const next = { ...prev };
      delete next[removed.id];
      return next;
    });
  };

  const extractMacrosFromImage = async (imageUrl: string, slotId: string) => {
    try {
      const res = await fetch("/api/nutrition/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) throw new Error("AI extraction failed");
      const data = await res.json();
      setAiResults(prev => ({
        ...prev,
        [slotId]: {
          calories: data.calories ?? null,
          protein: data.protein ?? null,
          carbs: data.carbs ?? null,
          fat: data.fat ?? null,
          sodium: data.sodium ?? null,
          editing: false,
        },
      }));
    } catch {
      // silently fail — user can still see photo
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    return new Promise(resolve => {
      getUploadUrl.mutate({ data: { filename: file.name, contentType: file.type } }, {
        onSuccess: async (data) => {
          try {
            await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          } catch { /* ignore */ }
          resolve(data.publicUrl ?? null);
        },
        onError: () => resolve(null),
      });
    });
  };

  const handleFileChange = async (slotId: string, isDiary: boolean, file: File, previewUrl: string) => {
    const update = (s: MealSlot) => s.id === slotId ? { ...s, file, previewUrl, uploading: true } : s;
    if (isDiary) {
      setDiarySlot(s => ({ ...s, file, previewUrl, uploading: true }));
    } else {
      setMealSlots(prev => prev.map(update));
    }

    const url = await uploadFile(file);
    const done = (s: MealSlot) => s.id === slotId ? { ...s, uploading: false } : s;
    if (isDiary) {
      setDiarySlot(s => ({ ...s, uploading: false }));
    } else {
      setMealSlots(prev => prev.map(done));
    }

    if (url) {
      extractMacrosFromImage(url, slotId);
    }
  };

  const updateSlot = (id: string, isDiary: boolean, patch: Partial<MealSlot>) => {
    if (isDiary) {
      setDiarySlot(s => ({ ...s, ...patch }));
    } else {
      setMealSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    }
  };

  const handleSubmitDay = async () => {
    if (!clientId) return;
    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];

    const allSlots = [{ slot: diarySlot, isDiary: true }, ...mealSlots.map(s => ({ slot: s, isDiary: false }))];
    for (const { slot } of allSlots) {
      if (slot.cantTrack) {
        await new Promise<void>(resolve => {
          createNutritionLog.mutate({
            clientId,
            data: {
              date: today,
              imageUrl: "cant_track",
              notes: `${slot.label}: ${slot.cantTrackNote}`,
              calories: slot.calorieGuess ? parseInt(slot.calorieGuess) : undefined,
            }
          }, { onSuccess: () => resolve(), onError: () => resolve() });
        });
      } else if (slot.previewUrl) {
        const ai = aiResults[slot.id];
        await new Promise<void>(resolve => {
          createNutritionLog.mutate({
            clientId,
            data: {
              date: today,
              imageUrl: slot.previewUrl!,
              notes: slot.label,
              calories: ai?.calories ?? undefined,
              protein: ai?.protein ?? undefined,
              carbs: ai?.carbs ?? undefined,
              fat: ai?.fat ?? undefined,
              sodium: ai?.sodium ?? undefined,
            }
          }, { onSuccess: () => resolve(), onError: () => resolve() });
        });
      }
    }

    // Log a water entry if any glasses recorded
    if (waterGlasses > 0) {
      await new Promise<void>(resolve => {
        createNutritionLog.mutate({
          clientId,
          data: {
            date: today,
            imageUrl: "water_only",
            notes: `Water: ${waterGlasses} glass${waterGlasses !== 1 ? "es" : ""} (${waterGlasses * OZ_PER_GLASS} oz)`,
            waterMl: waterGlasses * GLASS_ML,
          }
        }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }

    qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
    setSubmitting(false);
    toast({ title: "Nutrition logged for today!" });
    setDiarySlot(makeSlot("MFP Diary Overview"));
    setMealSlots([makeSlot("Meal 1"), makeSlot("Meal 2"), makeSlot("Meal 3")]);
    setAiResults({});
    setWaterGlasses(0);
  };

  const pastLogsByDate = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const past = (logs ?? []).filter(n => n.date !== today);
    const grouped: Record<string, typeof past> = {};
    for (const n of past) {
      if (!grouped[n.date]) grouped[n.date] = [];
      grouped[n.date].push(n);
    }
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  const { units } = useUnitSystem();
  const calLabel = units === "imperial" ? "cal" : "kcal";

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs?.filter(n => n.date === today && n.imageUrl !== "water_only") ?? [];
  const todayWater = logs?.find(n => n.date === today && n.imageUrl === "water_only");

  const totalCal  = todayLogs.reduce((s, n) => s + (n.calories ?? 0), 0);
  const totalPro  = todayLogs.reduce((s, n) => s + Number(n.protein ?? 0), 0);
  const totalCarb = todayLogs.reduce((s, n) => s + Number(n.carbs   ?? 0), 0);
  const totalFat  = todayLogs.reduce((s, n) => s + Number(n.fat     ?? 0), 0);
  const hasTodayData = todayLogs.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload your MFP screenshots for today</p>
      </div>

      {/* ── Today's Summary ───────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {/* Calories row — always visible */}
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-bold tabular-nums leading-none">{totalCal.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground pb-0.5">{calLabel}</span>
          </div>
          {coachGoals && (coachGoals.calories ?? 0) > 0 ? (
            <div className="text-right pb-0.5">
              <p className="text-xs text-muted-foreground leading-none">goal</p>
              <p className="text-lg font-semibold tabular-nums leading-tight">
                {(coachGoals.calories ?? 0).toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">{calLabel}</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pb-0.5 self-end">Today</p>
          )}
        </div>

        {/* Calorie progress bar — always shown if goal set */}
        {coachGoals && (coachGoals.calories ?? 0) > 0 && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", totalCal > (coachGoals.calories ?? 0) ? "bg-destructive" : "bg-primary")}
                style={{ width: `${Math.min(100, (coachGoals.calories ?? 0) > 0 ? (totalCal / (coachGoals.calories ?? 1)) * 100 : 0)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {(coachGoals.calories ?? 0) - totalCal > 0
                ? `${((coachGoals.calories ?? 0) - totalCal).toLocaleString()} ${calLabel} remaining`
                : `${(totalCal - (coachGoals.calories ?? 0)).toLocaleString()} ${calLabel} over goal`}
            </p>
          </div>
        )}

        {/* Macro row — always visible, shows 0 until logged */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Protein", val: Math.round(totalPro),  goal: coachGoals?.protein,  unit: "g", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
            { label: "Carbs",   val: Math.round(totalCarb), goal: coachGoals?.carbs,     unit: "g", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
            { label: "Fat",     val: Math.round(totalFat),  goal: coachGoals?.fat,       unit: "g", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
          ].map(m => (
            <div key={m.label} className={`rounded-xl px-3 py-2 text-center ${m.color}`}>
              <p className="text-lg font-bold tabular-nums leading-none">
                {m.val}
                {m.goal ? <span className="text-[10px] font-normal opacity-60">/{m.goal}</span> : null}
                <span className="text-xs font-normal ml-0.5">{m.unit}</span>
              </p>
              <p className="text-[11px] mt-0.5 opacity-70">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Water or empty-state note */}
        {todayWater ? (
          <p className="text-xs text-muted-foreground">
            💧 {Math.round((todayWater.waterMl ?? 0) / ML_PER_OZ)} oz water logged
          </p>
        ) : !hasTodayData ? (
          <p className="text-xs text-muted-foreground italic">No entries logged yet — submit below to see your totals.</p>
        ) : null}
      </div>

      {/* Diary Overview slot */}
      <PhotoBox
        slot={diarySlot}
        aiResult={aiResults[diarySlot.id] ?? null}
        calLabel={calLabel}
        onFileChange={(f, u) => handleFileChange(diarySlot.id, true, f, u)}
        onCantTrackToggle={() => updateSlot(diarySlot.id, true, { cantTrack: !diarySlot.cantTrack })}
        onNoteChange={v => updateSlot(diarySlot.id, true, { cantTrackNote: v })}
        onCalorieGuessChange={v => updateSlot(diarySlot.id, true, { calorieGuess: v })}
        onAiEdit={() => setAiResults(p => ({ ...p, [diarySlot.id]: { ...p[diarySlot.id], editing: true } }))}
        onAiSave={() => setAiResults(p => ({ ...p, [diarySlot.id]: { ...p[diarySlot.id], editing: false } }))}
        onAiFieldChange={(field, val) => setAiResults(p => ({
          ...p,
          [diarySlot.id]: { ...p[diarySlot.id], [field]: val === "" ? null : Number(val) }
        }))}
      />

      {/* Meal slots */}
      <div className="space-y-3">
        {mealSlots.map((slot) => (
          <PhotoBox
            key={slot.id}
            slot={slot}
            aiResult={aiResults[slot.id] ?? null}
            calLabel={calLabel}
            onFileChange={(f, u) => handleFileChange(slot.id, false, f, u)}
            onCantTrackToggle={() => updateSlot(slot.id, false, { cantTrack: !slot.cantTrack })}
            onNoteChange={v => updateSlot(slot.id, false, { cantTrackNote: v })}
            onCalorieGuessChange={v => updateSlot(slot.id, false, { calorieGuess: v })}
            onAiEdit={() => setAiResults(p => ({ ...p, [slot.id]: { ...p[slot.id], editing: true } }))}
            onAiSave={() => setAiResults(p => ({ ...p, [slot.id]: { ...p[slot.id], editing: false } }))}
            onAiFieldChange={(field, val) => setAiResults(p => ({
              ...p,
              [slot.id]: { ...p[slot.id], [field]: val === "" ? null : Number(val) }
            }))}
          />
        ))}
      </div>

      {/* Add/Remove meal buttons */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={addMeal} className="flex-1 gap-1">
          <Plus className="w-4 h-4" /> Add meal
        </Button>
        <Button variant="outline" size="sm" onClick={removeMeal} disabled={mealSlots.length <= 1} className="flex-1 gap-1">
          <Minus className="w-4 h-4" /> Remove meal
        </Button>
      </div>

      {/* Water intake */}
      <div className="border border-border rounded-2xl bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Water intake</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {waterGlasses === 0
                ? "How many glasses today?"
                : `${waterGlasses} × 8 oz = ${waterGlasses * OZ_PER_GLASS} oz`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWaterGlasses(g => Math.max(0, g - 1))}
              disabled={waterGlasses === 0}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 disabled:opacity-30 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xl font-bold w-6 text-center">{waterGlasses}</span>
            <button
              onClick={() => setWaterGlasses(g => g + 1)}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        {waterGlasses > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {Array.from({ length: waterGlasses }).map((_, i) => (
              <span key={i} className="text-lg">💧</span>
            ))}
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="w-full h-13 font-semibold"
        onClick={handleSubmitDay}
        disabled={submitting}
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Submit Today's Nutrition"}
      </Button>

      {/* Past logs — daily totals */}
      {pastLogsByDate.length > 0 && (
        <div>
          <button
            onClick={() => setShowPastLogs(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-semibold">Past Logs</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {pastLogsByDate.length} day{pastLogsByDate.length !== 1 ? "s" : ""}
              {showPastLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showPastLogs && (
            <div className="mt-2 space-y-2">
              {pastLogsByDate.map(([date, entries]) => {
                const food = entries.filter(n => n.imageUrl !== "water_only");
                const water = entries.find(n => n.imageUrl === "water_only");
                const dayCal  = food.reduce((s, n) => s + (n.calories ?? 0), 0);
                const dayPro  = food.reduce((s, n) => s + Number(n.protein ?? 0), 0);
                const dayCarb = food.reduce((s, n) => s + Number(n.carbs   ?? 0), 0);
                const dayFat  = food.reduce((s, n) => s + Number(n.fat     ?? 0), 0);
                const goalCal = coachGoals?.calories ?? 0;
                const pct = goalCal > 0 ? Math.min(100, (dayCal / goalCal) * 100) : 0;
                const over = goalCal > 0 && dayCal > goalCal;
                return (
                  <div key={date} className="p-3 rounded-xl border border-border bg-card space-y-2">
                    {/* Date + calorie total */}
                    <div className="flex items-end justify-between">
                      <p className="text-sm font-semibold">
                        {new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <div className="text-right">
                        <span className="text-base font-bold tabular-nums">{dayCal.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">{calLabel}</span>
                        {goalCal > 0 && (
                          <span className={cn("text-xs ml-1", over ? "text-destructive" : "text-muted-foreground")}>
                            / {goalCal.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar if goal set */}
                    {goalCal > 0 && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    {/* Macro row */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        P <span className="tabular-nums">{Math.round(dayPro)}g</span>
                      </span>
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                        C <span className="tabular-nums">{Math.round(dayCarb)}g</span>
                      </span>
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        F <span className="tabular-nums">{Math.round(dayFat)}g</span>
                      </span>
                      {water && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          💧 {Math.round((water.waterMl ?? 0) / ML_PER_OZ)} oz
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
