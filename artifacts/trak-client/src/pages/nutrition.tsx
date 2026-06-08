import { useState, useRef } from "react";
import { useClientId } from "@/hooks/use-client-id";
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
import { Camera, Plus, Minus, Loader2, Pencil, Check, X, UtensilsCrossed, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
            <span className="text-xs text-muted-foreground">kcal</span>
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
                    { label: "Cal", val: aiResult.calories, unit: "kcal" },
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

  const [diarySlot, setDiarySlot] = useState<MealSlot>(makeSlot("MFP Diary Overview"));
  const [mealSlots, setMealSlots] = useState<MealSlot[]>([
    makeSlot("Meal 1"),
    makeSlot("Meal 2"),
    makeSlot("Meal 3"),
  ]);
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>({});
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload your MFP screenshots for today</p>
      </div>

      {/* Diary Overview slot */}
      <PhotoBox
        slot={diarySlot}
        aiResult={aiResults[diarySlot.id] ?? null}
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

      {/* Past logs */}
      {(logs?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Past Logs</h2>
          <div className="space-y-2">
            {logs?.slice().reverse().map(n => {
              const isWaterOnly = n.imageUrl === "water_only";
              return (
              <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                {isWaterOnly ? (
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-2xl">
                    💧
                  </div>
                ) : n.imageUrl && n.imageUrl !== "cant_track" ? (
                  <img src={n.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.notes ?? n.date}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {n.calories && <span className="text-xs text-muted-foreground">{n.calories} kcal</span>}
                    {n.protein && <span className="text-xs text-muted-foreground">P: {n.protein}g</span>}
                    {n.carbs && <span className="text-xs text-muted-foreground">C: {n.carbs}g</span>}
                    {n.fat && <span className="text-xs text-muted-foreground">F: {n.fat}g</span>}
                    {n.sodium && <span className="text-xs text-muted-foreground">Na: {n.sodium}mg</span>}
                    {n.waterMl && <span className="text-xs text-muted-foreground">{Math.round(n.waterMl / ML_PER_OZ)} oz water</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteNutritionLog.mutate({ clientId: clientId!, nutritionId: n.id }, {
                    onSuccess: () => qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) })
                  })}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
