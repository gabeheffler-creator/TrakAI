import { useState, useEffect, useCallback } from "react";

interface NutritionLog {
  id: number;
  date: string;
  calories: number | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  notes: string | null;
  imageUrl: string | null;
  createdAt: string;
}

interface NutritionPageProps {
  clientId: number;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const S = {
  page: {
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    background: "#0f172a",
    color: "#f1f5f9",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    padding: "18px 20px 14px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 20px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: "16px 18px",
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  fieldLabel: { fontSize: 13, color: "#94a3b8", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1.5px solid #334155",
    background: "#0f172a",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  primaryBtn: (disabled: boolean) => ({
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: disabled ? "#334155" : "#7c3aed",
    color: disabled ? "#64748b" : "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
};

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function NutritionPage({ clientId }: NutritionPageProps) {
  const todayISO = new Date().toISOString().split("T")[0];

  const [allLogs, setAllLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  // Form
  const [date, setDate] = useState(todayISO);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<NutritionLog[]>(`/api/clients/${clientId}/nutrition`);
      const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
      setAllLogs(sorted);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const todayLogs = allLogs.filter(l => l.date === todayISO && l.imageUrl !== "water_only");
  const totalCalories = todayLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const totalProtein  = todayLogs.reduce((s, l) => s + parseFloat(l.protein  ?? "0"), 0);
  const totalCarbs    = todayLogs.reduce((s, l) => s + parseFloat(l.carbs    ?? "0"), 0);
  const totalFat      = todayLogs.reduce((s, l) => s + parseFloat(l.fat      ?? "0"), 0);

  const resetForm = () => {
    setDate(todayISO); setCalories(""); setProtein(""); setCarbs(""); setFat(""); setNotes(""); setErr("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/api/clients/${clientId}/nutrition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          imageUrl: "manual_entry",
          calories: calories ? parseInt(calories) : null,
          protein:  protein  ? parseFloat(protein)  : null,
          carbs:    carbs    ? parseFloat(carbs)    : null,
          fat:      fat      ? parseFloat(fat)      : null,
          notes: notes || null,
        }),
      });
      setSuccess(true);
      resetForm();
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setErr("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>Nutrition</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Track your meals & macros</div>
      </div>

      <div style={S.scroll}>
        {/* Today's totals */}
        <div>
          <div style={S.label}>Today's Totals</div>
          <div style={S.card}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <StatPill label="kcal"   value={totalCalories ? String(Math.round(totalCalories)) : "—"} color="#f1f5f9" />
              <StatPill label="Protein" value={totalProtein ? `${Math.round(totalProtein)}g` : "—"} color="#60a5fa" />
              <StatPill label="Carbs"  value={totalCarbs    ? `${Math.round(totalCarbs)}g`    : "—"} color="#fb923c" />
              <StatPill label="Fat"    value={totalFat      ? `${Math.round(totalFat)}g`      : "—"} color="#facc15" />
            </div>
            {success && <div style={{ color: "#4ade80", fontSize: 13, textAlign: "center", marginBottom: 8 }}>✓ Meal logged!</div>}
            <button
              onClick={() => { resetForm(); setShowForm(v => !v); }}
              style={{
                width: "100%", padding: "11px", borderRadius: 10, border: "1.5px solid #4c1d95",
                background: showForm ? "#1e293b" : "#2e1065", color: "#a78bfa", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              {showForm ? "Cancel" : "+ Log a Meal"}
            </button>
          </div>
        </div>

        {/* Log form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={S.card}>
              <div style={S.label}>Meal Details</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={S.fieldLabel}>Date</div>
                  <input type="date" value={date} max={todayISO} onChange={e => setDate(e.target.value)} style={{ ...S.input, fontSize: 13, colorScheme: "dark" }} />
                </div>
                <div>
                  <div style={S.fieldLabel}>Calories</div>
                  <input type="number" inputMode="numeric" placeholder="kcal" value={calories} onChange={e => setCalories(e.target.value)} style={{ ...S.input, fontSize: 13 }} />
                </div>
                <div>
                  <div style={S.fieldLabel}>Protein (g)</div>
                  <input type="number" inputMode="decimal" placeholder="0" value={protein} onChange={e => setProtein(e.target.value)} style={{ ...S.input, fontSize: 13 }} />
                </div>
                <div>
                  <div style={S.fieldLabel}>Carbs (g)</div>
                  <input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={e => setCarbs(e.target.value)} style={{ ...S.input, fontSize: 13 }} />
                </div>
                <div>
                  <div style={S.fieldLabel}>Fat (g)</div>
                  <input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={e => setFat(e.target.value)} style={{ ...S.input, fontSize: 13 }} />
                </div>
              </div>

              <div>
                <div style={S.fieldLabel}>Notes (optional)</div>
                <input type="text" placeholder="e.g. Chicken & rice" value={notes} onChange={e => setNotes(e.target.value)} style={S.input} />
              </div>

              {err && <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>

            <button type="submit" style={S.primaryBtn(saving)} disabled={saving}>
              {saving ? "Saving…" : "Save Meal"}
            </button>
          </form>
        )}

        {/* Today's meals */}
        {todayLogs.length > 0 && (
          <div>
            <div style={S.label}>Today's Meals</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayLogs.map(log => (
                <div key={log.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                      {log.notes || "Meal"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {[
                        log.calories ? `${log.calories} kcal` : null,
                        log.protein  ? `${log.protein}g P` : null,
                        log.carbs    ? `${log.carbs}g C` : null,
                        log.fat      ? `${log.fat}g F` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past logs (non-today) */}
        {(() => {
          const past = allLogs.filter(l => l.date !== todayISO && l.imageUrl !== "water_only").slice(0, 5);
          if (!past.length) return null;
          return (
            <div>
              <div style={S.label}>Past Logs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {past.map(log => (
                  <div key={log.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{formatDate(log.date)}</div>
                      {log.notes && <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{log.notes}</div>}
                    </div>
                    {log.calories != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{log.calories} kcal</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {loading && (
          <div style={{ textAlign: "center", padding: "12px 0", color: "#64748b", fontSize: 13 }}>Loading…</div>
        )}
      </div>
    </div>
  );
}
