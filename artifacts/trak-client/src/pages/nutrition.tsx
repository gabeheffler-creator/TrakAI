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
import { Camera, Plus, Minus, Loader2, Pencil, Check, ChevronLeft, ChevronRight, UtensilsCrossed, Trash2, Target, X, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { QueryErrorState } from "@/components/query-error-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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
  uploadedUrl: string | null;
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
    uploadedUrl: null,
    cantTrack: false,
    cantTrackNote: "",
    calorieGuess: "",
    uploading: false,
  };
}

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function stepDate(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function NutritionPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [coachGoals, setCoachGoals] = useState<NutritionGoals | null>(null);
  const [isTrainingDay, setIsTrainingDay] = useState<boolean | null>(null);
  const [goalDayType, setGoalDayType] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const date = new URLSearchParams(window.location.search).get("date") ?? new Date().toISOString().split("T")[0];
    fetch(`/api/clients/${clientId}/nutrition-goal?date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(g => {
        if (g) {
          setCoachGoals(g);
          if (typeof g.isTrainingDay === "boolean") setIsTrainingDay(g.isTrainingDay);
          if (typeof g.dayType === "string") setGoalDayType(g.dayType);
        }
      })
      .catch(() => {});
  }, [clientId]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const param = new URLSearchParams(window.location.search).get("date");
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
    return getTodayISO();
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = getTodayISO();
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const isPast = selectedDate < today;

  const goToPrev = () => setSelectedDate(d => stepDate(d, -1));
  const goToNext = () => setSelectedDate(d => stepDate(d, 1));

  const DRAFT_KEY = (date: string) => `trak_nutrition_draft_${date}`;

  const [diarySlot, setDiarySlot] = useState<MealSlot>(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(selectedDate));
      if (raw) { const s = JSON.parse(raw); if (s.diarySlot) return s.diarySlot; }
    } catch {}
    return makeSlot("MFP Diary Overview");
  });
  const [mealSlots, setMealSlots] = useState<MealSlot[]>(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(selectedDate));
      if (raw) { const s = JSON.parse(raw); if (s.mealSlots?.length > 0) return s.mealSlots; }
    } catch {}
    return [makeSlot("Meal 1"), makeSlot("Meal 2"), makeSlot("Meal 3")];
  });
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(selectedDate));
      if (raw) { const s = JSON.parse(raw); if (s.aiResults) return s.aiResults; }
    } catch {}
    return {};
  });
  const [waterGlasses, setWaterGlasses] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(selectedDate));
      if (raw) { const s = JSON.parse(raw); if (s.waterGlasses != null) return s.waterGlasses; }
    } catch {}
    return 0;
  });

  // Track the current date via ref so the save effect doesn't re-run on date change
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  // Restore draft when switching dates
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(selectedDate));
      if (raw) {
        const s = JSON.parse(raw);
        if (s.mealSlots?.length > 0) setMealSlots(s.mealSlots);
        if (s.diarySlot) setDiarySlot(s.diarySlot);
        if (s.waterGlasses != null) setWaterGlasses(s.waterGlasses);
        if (s.aiResults) setAiResults(s.aiResults);
      } else {
        setMealSlots([makeSlot("Meal 1"), makeSlot("Meal 2"), makeSlot("Meal 3")]);
        setDiarySlot(makeSlot("MFP Diary Overview"));
        setWaterGlasses(0);
        setAiResults({});
      }
    } catch {}
  }, [selectedDate]);

  // Persist draft whenever form content changes (File/previewUrl excluded — not serialisable)
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY(selectedDateRef.current), JSON.stringify({
        mealSlots: mealSlots.map(s => ({ ...s, file: null, previewUrl: null })),
        diarySlot: { ...diarySlot, file: null, previewUrl: null },
        waterGlasses,
        aiResults,
      }));
    } catch {}
  }, [mealSlots, diarySlot, waterGlasses, aiResults]);
  const [submitting, setSubmitting] = useState(false);

  // Entry edit/delete state
  const [editingEntry, setEditingEntry] = useState<{ id: number; imageUrl: string; notes: string | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null>(null);
  const [editEntryName, setEditEntryName] = useState("");
  const [editEntryCals, setEditEntryCals] = useState("");
  const [editEntryProtein, setEditEntryProtein] = useState("");
  const [editEntryCarbs, setEditEntryCarbs] = useState("");
  const [editEntryFat, setEditEntryFat] = useState("");
  const [editEntrySaving, setEditEntrySaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [copying, setCopying] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddCals, setQuickAddCals] = useState("");
  const [quickAddProtein, setQuickAddProtein] = useState("");
  const [quickAddCarbs, setQuickAddCarbs] = useState("");
  const [quickAddFat, setQuickAddFat] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const { data: logs, isLoading, isError, refetch, isFetching } = useListNutritionLogs(clientId!, {
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
            const r = await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
            resolve(`/api/storage${data.objectPath}`);
          } catch {
            toast({ title: "Photo upload failed", description: "Please try again.", variant: "destructive" });
            resolve(null);
          }
        },
        onError: () => {
          toast({ title: "Photo upload failed", description: "Please try again.", variant: "destructive" });
          resolve(null);
        },
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
      const setUploaded = (s: MealSlot) => s.id === slotId ? { ...s, uploadedUrl: url } : s;
      if (isDiary) {
        setDiarySlot(s => ({ ...s, uploadedUrl: url }));
      } else {
        setMealSlots(prev => prev.map(setUploaded));
      }
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

    const allSlots = [{ slot: diarySlot, isDiary: true }, ...mealSlots.map(s => ({ slot: s, isDiary: false }))];
    for (const { slot } of allSlots) {
      if (slot.cantTrack) {
        await new Promise<void>(resolve => {
          createNutritionLog.mutate({
            clientId,
            data: {
              date: selectedDate,
              imageUrl: "cant_track",
              notes: `${slot.label}: ${slot.cantTrackNote}`,
              calories: slot.calorieGuess ? parseInt(slot.calorieGuess) : undefined,
            }
          }, { onSuccess: () => resolve(), onError: () => resolve() });
        });
      } else if (slot.uploadedUrl) {
        const ai = aiResults[slot.id];
        await new Promise<void>(resolve => {
          createNutritionLog.mutate({
            clientId,
            data: {
              date: selectedDate,
              imageUrl: slot.uploadedUrl!,
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
            date: selectedDate,
            imageUrl: "water_only",
            notes: `Water: ${waterGlasses} glass${waterGlasses !== 1 ? "es" : ""} (${waterGlasses * OZ_PER_GLASS} oz)`,
            waterMl: waterGlasses * GLASS_ML,
          }
        }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }

    qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
    setSubmitting(false);
    toast({ title: isToday ? "Nutrition logged for today!" : `Nutrition logged for ${formatDateLabel(selectedDate)}!` });
    try { sessionStorage.removeItem(DRAFT_KEY(selectedDate)); } catch {}
    setDiarySlot(makeSlot("MFP Diary Overview"));
    setMealSlots([makeSlot("Meal 1"), makeSlot("Meal 2"), makeSlot("Meal 3")]);
    setAiResults({});
    setWaterGlasses(0);
  };

  const handleOpenEditEntry = (entry: { id: number; imageUrl: string; notes: string | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }) => {
    setEditingEntry(entry);
    setEditEntryName(entry.notes ?? "");
    setEditEntryCals(entry.calories != null ? String(entry.calories) : "");
    setEditEntryProtein(entry.protein != null ? String(Math.round(entry.protein)) : "");
    setEditEntryCarbs(entry.carbs != null ? String(Math.round(entry.carbs)) : "");
    setEditEntryFat(entry.fat != null ? String(Math.round(entry.fat)) : "");
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntry || !clientId) return;
    setEditEntrySaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/nutrition/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: editEntryName.trim() || null,
          calories: editEntryCals ? parseInt(editEntryCals, 10) : null,
          protein: editEntryProtein ? parseFloat(editEntryProtein) : null,
          carbs: editEntryCarbs ? parseFloat(editEntryCarbs) : null,
          fat: editEntryFat ? parseFloat(editEntryFat) : null,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
      setEditingEntry(null);
      toast({ title: "Entry updated!" });
    } catch {
      toast({ title: "Failed to update entry", variant: "destructive" });
    } finally {
      setEditEntrySaving(false);
    }
  };

  const handleDeleteEntry = (id: number) => {
    deleteNutritionLog.mutate({ clientId: clientId!, nutritionId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId!) });
        setConfirmDeleteId(null);
        toast({ title: "Entry removed" });
      },
    });
  };

  const handleCopyFromYesterday = async (yesterdayMeals: typeof selectedLogs) => {
    if (!clientId || !yesterdayMeals.length) return;
    setCopying(true);
    for (const entry of yesterdayMeals) {
      await new Promise<void>(resolve => {
        createNutritionLog.mutate({
          clientId,
          data: {
            date: selectedDate,
            imageUrl: entry.imageUrl ?? "manual_entry",
            notes: entry.notes ?? undefined,
            calories: entry.calories ?? undefined,
            protein: entry.protein != null ? Number(entry.protein) : undefined,
            carbs: entry.carbs != null ? Number(entry.carbs) : undefined,
            fat: entry.fat != null ? Number(entry.fat) : undefined,
          },
        }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
    setCopying(false);
    toast({ title: `${yesterdayMeals.length} meal${yesterdayMeals.length !== 1 ? "s" : ""} copied!` });
  };

  const handleQuickAdd = async () => {
    if (!clientId) return;
    const cals = parseInt(quickAddCals, 10);
    if (!quickAddName.trim() || isNaN(cals) || cals <= 0) return;
    setQuickAddSaving(true);
    await new Promise<void>(resolve => {
      createNutritionLog.mutate({
        clientId,
        data: {
          date: selectedDate,
          imageUrl: "manual_entry",
          notes: quickAddName.trim(),
          calories: cals,
          protein: quickAddProtein ? parseFloat(quickAddProtein) : undefined,
          carbs: quickAddCarbs ? parseFloat(quickAddCarbs) : undefined,
          fat: quickAddFat ? parseFloat(quickAddFat) : undefined,
        },
      }, { onSuccess: () => resolve(), onError: () => resolve() });
    });
    qc.invalidateQueries({ queryKey: getListNutritionLogsQueryKey(clientId) });
    setQuickAddSaving(false);
    setQuickAddOpen(false);
    setQuickAddName("");
    setQuickAddCals("");
    setQuickAddProtein("");
    setQuickAddCarbs("");
    setQuickAddFat("");
    toast({ title: "Meal added!" });
  };

  const { units } = useUnitSystem();
  const calLabel = units === "imperial" ? "cal" : "kcal";

  if (!clientId) return <div className="p-4 text-muted-foreground">Please join via an invite link first.</div>;

  const selectedLogs = logs?.filter(n => n.date === selectedDate && n.imageUrl !== "water_only") ?? [];
  const selectedWater = logs?.find(n => n.date === selectedDate && n.imageUrl === "water_only");

  const yesterdayDate = stepDate(selectedDate, -1);
  const yesterdayMeals = (logs ?? []).filter(
    n => n.date === yesterdayDate && n.imageUrl !== "water_only" && n.imageUrl !== "cant_track"
  );
  const showCopyFromYesterday = yesterdayMeals.length > 0 && selectedLogs.length < yesterdayMeals.length;

  const totalCal  = selectedLogs.reduce((s, n) => s + (n.calories ?? 0), 0);
  const totalPro  = selectedLogs.reduce((s, n) => s + Number(n.protein ?? 0), 0);
  const totalCarb = selectedLogs.reduce((s, n) => s + Number(n.carbs   ?? 0), 0);
  const totalFat  = selectedLogs.reduce((s, n) => s + Number(n.fat     ?? 0), 0);
  const hasSelectedData = selectedLogs.length > 0;

  const showForm = isToday || isFuture;

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isToday ? "Upload your MFP screenshots for today" : isFuture ? "Log nutrition for an upcoming day" : "Viewing a past day"}
        </p>
      </div>

      {/* ── Date Navigator ───────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={goToPrev}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:bg-muted/60 transition-colors text-muted-foreground"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl hover:bg-muted/60 transition-colors">
              <span className="text-sm font-semibold">
                {isToday ? "Today" : formatDateLabel(selectedDate)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={new Date(selectedDate + "T12:00:00")}
              onSelect={d => {
                if (d) {
                  setSelectedDate(d.toISOString().split("T")[0]);
                  setCalendarOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <button
          onClick={goToNext}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:bg-muted/60 transition-colors text-muted-foreground"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isError && (
        <QueryErrorState
          message="Couldn't load your nutrition logs. Totals below may be incomplete."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          testId="button-retry-nutrition"
        />
      )}

      {/* ── Day Summary ───────────────────── */}
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
            <div className="text-right pb-0.5">
              <p className="text-xs text-muted-foreground leading-none">goal</p>
              <p className="text-lg font-semibold tabular-nums leading-tight text-muted-foreground/40">
                ––
                <span className="text-xs font-normal ml-0.5">{calLabel}</span>
              </p>
            </div>
          )}
        </div>

        {/* Calorie progress bar */}
        {coachGoals && (coachGoals.calories ?? 0) > 0 ? (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", totalCal > (coachGoals.calories ?? 0) ? "bg-destructive" : "bg-primary")}
                style={{ width: `${Math.min(100, (totalCal / (coachGoals.calories ?? 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {(coachGoals.calories ?? 0) - totalCal > 0
                ? `${((coachGoals.calories ?? 0) - totalCal).toLocaleString()} ${calLabel} remaining`
                : `${(totalCal - (coachGoals.calories ?? 0)).toLocaleString()} ${calLabel} over goal`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="h-2 rounded-full border border-dashed border-muted-foreground/30 overflow-hidden" />
            <p className="text-xs text-muted-foreground/50 text-right italic">No goal set — your coach will add one</p>
          </div>
        )}

        {/* Macro row */}
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
        {selectedWater ? (
          <p className="text-xs text-muted-foreground">
            💧 {Math.round((selectedWater.waterMl ?? 0) / ML_PER_OZ)} oz water logged
          </p>
        ) : !hasSelectedData ? (
          <p className="text-xs text-muted-foreground italic">
            {isFuture ? "No entries yet — you can log ahead of time below." : "No entries logged yet — submit below to see your totals."}
          </p>
        ) : null}
      </div>

      {/* ── Copy from yesterday ───────────────────── */}
      {showCopyFromYesterday && (
        <button
          onClick={() => handleCopyFromYesterday(yesterdayMeals)}
          disabled={copying}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-left disabled:opacity-60 group"
        >
          <div className="flex items-center gap-3">
            {copying
              ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
              : <span className="text-base flex-shrink-0">📋</span>
            }
            <div>
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {copying ? "Copying…" : "Copy from yesterday"}
              </p>
              <p className="text-xs text-muted-foreground">
                {yesterdayMeals.length} meal{yesterdayMeals.length !== 1 ? "s" : ""} logged {formatDateLabel(yesterdayDate)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
        </button>
      )}

      {/* ── Logged entries (all days with data) ───────────────────── */}
      {hasSelectedData && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {isPast ? "Logged entries" : "Today's entries"}
          </p>
          {selectedLogs.map(entry => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              {entry.imageUrl && entry.imageUrl !== "cant_track" && entry.imageUrl !== "manual_entry" ? (
                <img
                  src={entry.imageUrl}
                  alt="log"
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-muted"
                />
              ) : entry.imageUrl === "manual_entry" ? (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <PenLine className="w-5 h-5 text-primary/60" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.notes ?? "—"}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {entry.calories != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">{entry.calories} {calLabel}</span>
                  )}
                  {entry.protein != null && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">P {Math.round(Number(entry.protein))}g</span>
                  )}
                  {entry.carbs != null && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 tabular-nums">C {Math.round(Number(entry.carbs))}g</span>
                  )}
                  {entry.fat != null && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 tabular-nums">F {Math.round(Number(entry.fat))}g</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleOpenEditEntry({ id: entry.id, imageUrl: entry.imageUrl ?? "", notes: entry.notes ?? null, calories: entry.calories ?? null, protein: entry.protein != null ? Number(entry.protein) : null, carbs: entry.carbs != null ? Number(entry.carbs) : null, fat: entry.fat != null ? Number(entry.fat) : null })}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Edit entry"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors"
                  title="Delete entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Submission form (today + future, or past with no entries) ───────────────────── */}
      {showForm && (
        <>
          {/* Quick Add — type a meal directly without a photo */}
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-left"
          >
            <PenLine className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Quick Add</p>
              <p className="text-xs text-muted-foreground">Type in a meal name and macros — no photo needed</p>
            </div>
          </button>

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
            {submitting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              : isToday
                ? "Submit Today's Nutrition"
                : `Submit Nutrition for ${formatDateLabel(selectedDate)}`}
          </Button>
        </>
      )}

      {/* Edit Entry Sheet */}
      <Sheet open={editingEntry !== null} onOpenChange={open => { if (!open) setEditingEntry(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Edit Entry</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name / description</label>
              <Input
                placeholder="e.g. Chicken & rice"
                value={editEntryName}
                onChange={e => setEditEntryName(e.target.value)}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Calories <span className="normal-case font-normal text-muted-foreground/70">({calLabel})</span>
              </label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 520"
                value={editEntryCals}
                onChange={e => setEditEntryCals(e.target.value)}
                className="mt-1.5"
                min={0}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Macros <span className="normal-case font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: "Protein (g)", value: editEntryProtein, setter: setEditEntryProtein },
                  { label: "Carbs (g)",   value: editEntryCarbs,   setter: setEditEntryCarbs   },
                  { label: "Fat (g)",     value: editEntryFat,     setter: setEditEntryFat     },
                ] as const).map(m => (
                  <div key={m.label}>
                    <label className="text-[11px] text-muted-foreground">{m.label}</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={m.value}
                      onChange={e => m.setter(e.target.value)}
                      className="mt-0.5 h-9 text-sm"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6 flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditingEntry(null)} disabled={editEntrySaving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveEditEntry} disabled={editEntrySaving}>
              {editEntrySaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the entry and update your day totals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId !== null && handleDeleteEntry(confirmDeleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Sheet */}
      <Sheet open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Quick Add Meal</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meal name *</label>
              <Input
                placeholder="e.g. Chicken & rice, Oats with banana"
                value={quickAddName}
                onChange={e => setQuickAddName(e.target.value)}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Calories * <span className="normal-case font-normal text-muted-foreground/70">({calLabel})</span>
              </label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 520"
                value={quickAddCals}
                onChange={e => setQuickAddCals(e.target.value)}
                className="mt-1.5"
                min={1}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Macros <span className="normal-case font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: "Protein (g)", value: quickAddProtein, setter: setQuickAddProtein },
                  { label: "Carbs (g)",   value: quickAddCarbs,   setter: setQuickAddCarbs   },
                  { label: "Fat (g)",     value: quickAddFat,     setter: setQuickAddFat     },
                ] as const).map(m => (
                  <div key={m.label}>
                    <label className="text-[11px] text-muted-foreground">{m.label}</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={m.value}
                      onChange={e => m.setter(e.target.value)}
                      className="mt-0.5 h-9 text-sm"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6 flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setQuickAddOpen(false)} disabled={quickAddSaving}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleQuickAdd}
              disabled={quickAddSaving || !quickAddName.trim() || !quickAddCals || parseInt(quickAddCals, 10) <= 0}
            >
              {quickAddSaving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                : "Add Meal"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
