import { useState, useEffect, useCallback } from "react";

interface SleepLog {
  id: number;
  date: string;
  hoursSlept: number;
  quality: string | null;
  notes: string | null;
  createdAt: string;
}

interface SleepPageProps {
  clientId: number;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const QUALITY_OPTIONS = [
  { value: "poor",  label: "Poor",  color: "#f87171", bg: "#450a0a" },
  { value: "fair",  label: "Fair",  color: "#fb923c", bg: "#431407" },
  { value: "good",  label: "Good",  color: "#4ade80", bg: "#052e16" },
  { value: "great", label: "Great", color: "#a78bfa", bg: "#2e1065" },
];

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

function qualityChip(q: string | null) {
  const opt = QUALITY_OPTIONS.find(o => o.value === q);
  if (!opt) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: opt.bg, color: opt.color, border: `1px solid ${opt.color}40` }}>
      {opt.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function SleepPage({ clientId }: SleepPageProps) {
  const todayISO = new Date().toISOString().split("T")[0];

  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  // Form state
  const [date, setDate] = useState(todayISO);
  const [quality, setQuality] = useState<string | null>(null);
  const [hours, setHours] = useState(7.5);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SleepLog[]>(`/api/clients/${clientId}/sleep`);
      const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
      setLogs(sorted.slice(0, 7));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quality) { setErr("Please select a sleep quality."); return; }
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/api/clients/${clientId}/sleep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hoursSlept: hours, quality }),
      });
      setSuccess(true);
      setQuality(null);
      setHours(7.5);
      setDate(todayISO);
      load();
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setErr("Failed to save sleep log. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>Sleep</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Track your rest & recovery</div>
      </div>

      <div style={S.scroll}>
        {/* Log form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={S.card}>
            <div style={S.label}>Log Sleep</div>

            {/* Date */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Date</div>
              <input
                type="date"
                value={date}
                max={todayISO}
                onChange={e => setDate(e.target.value)}
                style={{ ...S.input, colorScheme: "dark" }}
              />
            </div>

            {/* Quality */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>How did you sleep?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {QUALITY_OPTIONS.map(opt => {
                  const selected = quality === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuality(opt.value)}
                      style={{
                        flex: 1,
                        padding: "10px 4px",
                        borderRadius: 10,
                        border: `1.5px solid ${selected ? opt.color : "#334155"}`,
                        background: selected ? opt.bg : "#0f172a",
                        color: selected ? opt.color : "#64748b",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours slider */}
            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                Hours slept: <strong style={{ color: "#f1f5f9" }}>{hours.toFixed(1)}h</strong>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                step={0.5}
                value={hours}
                onChange={e => setHours(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#7c3aed" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569" }}>
                <span>3h</span><span>12h</span>
              </div>
            </div>

            {err && <div style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{err}</div>}
            {success && <div style={{ color: "#4ade80", fontSize: 13, marginTop: 10 }}>✓ Sleep logged!</div>}
          </div>

          <button type="submit" style={S.primaryBtn(saving || !quality)} disabled={saving || !quality}>
            {saving ? "Saving…" : "Log Sleep"}
          </button>
        </form>

        {/* History */}
        <div>
          <div style={S.label}>Recent Sleep</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", fontSize: 13 }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", fontSize: 13 }}>No sleep logs yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map(log => (
                <div key={log.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{formatDate(log.date)}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{log.hoursSlept}h slept</div>
                  </div>
                  {qualityChip(log.quality)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
