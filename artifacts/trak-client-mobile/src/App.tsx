import { useState, useEffect, useCallback } from "react";
import WorkoutPage from "./pages/WorkoutPage";

type AuthState = "loading" | "unauthenticated" | "authenticated";
type Tab = "home" | "workout" | "nutrition" | "sleep";
interface ClientInfo { id: number; name: string; }

const DEMO_CLIENTS = [
  { username: "alex", password: "alex", label: "Alex Johnson" },
  { username: "sam", password: "sam", label: "Sam Williams" },
  { username: "jordan", password: "jordan", label: "Jordan Rivera" },
];

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fill = (u: string, p: string) => { setUsername(u); setPassword(p); setError(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Invalid credentials");
      } else {
        onLogin();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px", gap: 24, background: "#fff", overflowY: "auto" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed", letterSpacing: "-0.5px", marginBottom: 4 }}>TrakClient</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 2 }}>Client Login</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Sign in to track your training</div>
      </div>
      <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required
          style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
          style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
        {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ padding: "12px", borderRadius: 10, background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div style={{ width: "100%", background: "#f9fafb", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #e5e7eb" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Demo accounts — tap to fill</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {DEMO_CLIENTS.map(c => (
            <button key={c.username} type="button" onClick={() => fill(c.username, c.password)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{c.label}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{c.username} / {c.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ────────────────────────────────────────────────────────────────

function HomeTab({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [dashboard, setDashboard] = useState<{
    workoutsThisWeek?: number;
    currentStreak?: number;
    goal?: string;
    goalTargetDate?: string;
  } | null>(null);

  useEffect(() => {
    apiFetch<{ workoutsThisWeek?: number; currentStreak?: number; goal?: string; goalTargetDate?: string }>(
      `/api/clients/${clientId}/dashboard`
    ).then(setDashboard).catch(() => {});
  }, [clientId]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ flex: 1, overflowY: "auto" as const, background: "#0f172a", color: "#f1f5f9", padding: "20px 20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }}>
      {/* Greeting */}
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Hey, {clientName.split(" ")[0]} 👋</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{today}</div>
      </div>

      {/* Stats row */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard label="This week" value={`${dashboard.workoutsThisWeek ?? 0}`} unit="workouts" icon="🏋️" />
          <StatCard label="Streak" value={`${dashboard.currentStreak ?? 0}`} unit="days" icon="🔥" />
        </div>
      )}

      {/* Goal */}
      {dashboard?.goal && (
        <div style={{ background: "#1e293b", borderRadius: 14, padding: "16px", border: "1px solid #334155" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Current goal</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.4 }}>{dashboard.goal}</div>
          {dashboard.goalTargetDate && (
            <div style={{ fontSize: 12, color: "#6d28d9", marginTop: 6 }}>
              🎯 Target: {new Date(dashboard.goalTargetDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div style={{ background: "#1e293b", borderRadius: 14, border: "1px solid #334155", overflow: "hidden" as const }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 1, padding: "14px 16px 8px" }}>Quick actions</div>
        {[
          { label: "Log today's workout", icon: "💪", tab: "workout" as Tab },
          { label: "Log nutrition", icon: "🥗", tab: "nutrition" as Tab },
          { label: "Log sleep", icon: "😴", tab: "sleep" as Tab },
        ].map(({ label, icon }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid #334155" }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 14, color: "#cbd5e1" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 14, padding: "14px 16px", border: "1px solid #334155" }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{unit}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ─── Nutrition Tab ───────────────────────────────────────────────────────────

function NutritionTab({ clientId }: { clientId: number }) {
  const today = new Date().toISOString().split("T")[0];
  const [log, setLog] = useState<{ calories?: number; protein?: number; carbs?: number; fat?: number } | null>(null);
  const [form, setForm] = useState({ calories: "", protein: "", carbs: "", fat: "", mealName: "Breakfast" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ calories?: number; protein?: number; carbs?: number; fat?: number }[]>(
      `/api/clients/${clientId}/nutrition-logs?date=${today}`
    ).then(logs => {
      if (logs.length > 0) setLog(logs[0]);
    }).catch(() => {});
  }, [clientId, today]);

  const handleSave = async () => {
    if (!form.calories) return;
    setSaving(true);
    try {
      await apiFetch(`/api/clients/${clientId}/nutrition-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          mealName: form.mealName,
          calories: Number(form.calories) || null,
          protein: Number(form.protein) || null,
          carbs: Number(form.carbs) || null,
          fat: Number(form.fat) || null,
        }),
      });
      setSaved(true);
      setForm({ calories: "", protein: "", carbs: "", fat: "", mealName: "Breakfast" });
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const inputStyle = {
    flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 15, outline: "none", minWidth: 0,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto" as const, background: "#0f172a", color: "#f1f5f9", padding: "20px 20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Nutrition</div>

      {log && (
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, border: "1px solid #334155" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>Today's log</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["🔥 Calories", log.calories], ["💪 Protein", log.protein], ["🍞 Carbs", log.carbs], ["🧈 Fat", log.fat]].map(([label, val]) => (
              <div key={String(label)} style={{ background: "#0f172a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{val ?? "—"}{val ? (String(label).includes("Cal") ? " kcal" : "g") : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, border: "1px solid #334155", display: "flex", flexDirection: "column" as const, gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Log a meal</div>
        <select value={form.mealName} onChange={e => setForm(f => ({ ...f, mealName: e.target.value }))}
          style={{ ...inputStyle, flex: "none" }}>
          {["Breakfast", "Lunch", "Dinner", "Snack"].map(m => <option key={m}>{m}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["calories", "protein", "carbs", "fat"] as const).map(field => (
            <div key={field}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "capitalize" as const }}>{field}</div>
              <input type="number" inputMode="numeric" placeholder={field === "calories" ? "kcal" : "g"}
                value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                style={inputStyle} />
            </div>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving || !form.calories}
          style={{ padding: "13px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15, cursor: saving || !form.calories ? "not-allowed" : "pointer", background: saving || !form.calories ? "#334155" : "#6d28d9", color: saving || !form.calories ? "#64748b" : "#fff" }}>
          {saved ? "✓ Saved!" : saving ? "Saving…" : "Save meal"}
        </button>
      </div>
    </div>
  );
}

// ─── Sleep Tab ───────────────────────────────────────────────────────────────

function SleepTab({ clientId }: { clientId: number }) {
  const today = new Date().toISOString().split("T")[0];
  const [existing, setExisting] = useState<{ id: number; hoursSlept: number; quality: number } | null>(null);
  const [hours, setHours] = useState("7");
  const [quality, setQuality] = useState("3");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const logs = await apiFetch<{ id: number; date: string; hoursSlept: number; quality: number }[]>(
        `/api/clients/${clientId}/sleep-logs?limit=5`
      );
      const todayLog = logs.find(l => l.date === today);
      if (todayLog) { setExisting(todayLog); setHours(String(todayLog.hoursSlept)); setQuality(String(todayLog.quality)); }
    } catch { /* ignore */ }
  }, [clientId, today]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existing) {
        await apiFetch(`/api/clients/${clientId}/sleep-logs/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hoursSlept: Number(hours), quality: Number(quality) }),
        });
      } else {
        await apiFetch(`/api/clients/${clientId}/sleep-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, hoursSlept: Number(hours), quality: Number(quality) }),
        });
      }
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const qualityLabels: Record<number, string> = { 1: "😴 Poor", 2: "😐 Fair", 3: "🙂 Good", 4: "😊 Great", 5: "🤩 Excellent" };

  return (
    <div style={{ flex: 1, overflowY: "auto" as const, background: "#0f172a", color: "#f1f5f9", padding: "20px 20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Sleep</div>

      <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, border: "1px solid #334155", display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{existing ? "Today's sleep (tap to update)" : "Log last night's sleep"}</div>

        {/* Hours slider */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Hours slept</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#c4b5fd" }}>{hours}h</span>
          </div>
          <input type="range" min="3" max="12" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
            style={{ width: "100%", accentColor: "#6d28d9" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
            <span>3h</span><span>12h</span>
          </div>
        </div>

        {/* Quality */}
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>Sleep quality</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(q => (
              <button key={q} onClick={() => setQuality(String(q))}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${Number(quality) === q ? "#6d28d9" : "#334155"}`, background: Number(quality) === q ? "#2e1065" : "#0f172a", color: Number(quality) === q ? "#c4b5fd" : "#64748b", fontSize: 18, cursor: "pointer" }}>
                {["😴", "😐", "🙂", "😊", "🤩"][q - 1]}
              </button>
            ))}
          </div>
          <div style={{ textAlign: "center" as const, fontSize: 13, color: "#94a3b8", marginTop: 8 }}>{qualityLabels[Number(quality)]}</div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: "13px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", background: saving ? "#334155" : "#6d28d9", color: saving ? "#64748b" : "#fff" }}>
          {saved ? "✓ Saved!" : saving ? "Saving…" : existing ? "Update sleep" : "Save sleep log"}
        </button>
      </div>
    </div>
  );
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: "home", label: "Home", icon: "🏠" },
  { tab: "workout", label: "Workout", icon: "💪" },
  { tab: "nutrition", label: "Nutrition", icon: "🥗" },
  { tab: "sleep", label: "Sleep", icon: "😴" },
];

function BottomNav({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", background: "#1e293b", borderTop: "1px solid #334155", flexShrink: 0 }}>
      {NAV_ITEMS.map(({ tab, label, icon }) => (
        <button key={tab} onClick={() => onSelect(tab)}
          style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "10px 4px 12px", gap: 3, border: "none", background: "transparent", cursor: "pointer" }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: active === tab ? 700 : 400, color: active === tab ? "#a78bfa" : "#475569" }}>{label}</span>
          {active === tab && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6d28d9", marginTop: 1 }} />}
        </button>
      ))}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.role === "client") {
          setClient({ id: d.id, name: d.name ?? "Client" });
          setAuth("authenticated");
        } else {
          setAuth("unauthenticated");
        }
      })
      .catch(() => setAuth("unauthenticated"));
  }, []);

  const shellBg = auth === "authenticated" ? "#0f172a" : "#fff";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0e17" }}>
      <div style={{ width: 390, height: "min(844px, 96dvh)", borderRadius: 44, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)", background: shellBg, flexShrink: 0, display: "flex", flexDirection: "column" as const }}>
        {auth === "loading" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <div style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {auth === "unauthenticated" && (
          <LoginScreen onLogin={() => {
            fetch("/api/auth/me", { credentials: "include" })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.role === "client") { setClient({ id: d.id, name: d.name ?? "Client" }); setAuth("authenticated"); } })
              .catch(() => {});
          }} />
        )}
        {auth === "authenticated" && client && (
          <>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, minHeight: 0 }}>
              {tab === "home"      && <HomeTab      clientId={client.id} clientName={client.name} />}
              {tab === "workout"   && <WorkoutPage  clientId={client.id} clientName={client.name} />}
              {tab === "nutrition" && <NutritionTab clientId={client.id} />}
              {tab === "sleep"     && <SleepTab     clientId={client.id} />}
            </div>
            <BottomNav active={tab} onSelect={setTab} />
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
