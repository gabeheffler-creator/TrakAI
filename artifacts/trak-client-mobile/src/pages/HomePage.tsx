import { useState, useEffect, useCallback } from "react";
import type { TabId } from "../App";

interface ProgramDay {
  id: number;
  name: string;
  weekNumber: number;
  dayOfWeek: number;
  exercises: { id: number; exerciseName: string }[];
}

interface Assignment {
  programId: number;
  programName?: string;
  startDate: string;
}

interface WorkoutLog {
  id: number;
  programDayId: number | null;
  date: string;
  sets: { id: number }[];
}

interface HomePageProps {
  clientId: number;
  clientName: string;
  onNavigate: (tab: TabId) => void;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
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
    padding: "20px 20px 16px",
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
    gap: 14,
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
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function HomePage({ clientId, clientName, onNavigate }: HomePageProps) {
  const [loading, setLoading] = useState(true);
  const [todayDay, setTodayDay] = useState<ProgramDay | null>(null);
  const [programName, setProgramName] = useState("");
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [allDays, setAllDays] = useState<ProgramDay[]>([]);
  const [noProgram, setNoProgram] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logs] = await Promise.all([
        apiFetch<WorkoutLog[]>(`/api/clients/${clientId}/workout-logs?limit=3`),
      ]);
      const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
      setRecentLogs(sorted.slice(0, 3));

      // Try to load program assignment
      try {
        const [assignment, program] = await Promise.all([
          apiFetch<Assignment>(`/api/clients/${clientId}/program-assignment`),
          apiFetch<{ phases: { days: ProgramDay[] }[]; name?: string }>(`/api/clients/${clientId}/program`),
        ]);

        const days = program.phases.flatMap(p => p.days);
        setAllDays(days);
        setProgramName((program as any).name ?? "Training Program");

        const start = new Date(assignment.startDate);
        start.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const daysSince = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
        const weekNum = Math.floor(daysSince / 7) + 1;
        const dow = (daysSince % 7) + 1;

        const today = days.find(d => d.weekNumber === weekNum && d.dayOfWeek === dow) ?? null;
        setTodayDay(today);
        setNoProgram(false);
      } catch {
        setNoProgram(true);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const dayNameById = (id: number | null) => {
    if (!id) return "Workout";
    return allDays.find(d => d.id === id)?.name ?? "Workout";
  };

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>{todayStr}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
          {getGreeting()}, {clientName.split(" ")[0]} 👋
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 24, height: 24, border: "3px solid #334155", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <div style={S.scroll}>
          {/* Today's workout card */}
          <div>
            <div style={S.label}>Today's Workout</div>
            {noProgram ? (
              <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏋️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>No program assigned yet</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Your coach will set one up soon.</div>
              </div>
            ) : todayDay ? (
              <button
                onClick={() => onNavigate("workout")}
                style={{
                  ...S.card,
                  width: "100%",
                  cursor: "pointer",
                  textAlign: "left",
                  border: "1px solid #6d28d9",
                  background: "linear-gradient(135deg, #2e1065 0%, #1e293b 100%)",
                  outline: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{todayDay.name}</div>
                    <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 2 }}>{programName}</div>
                  </div>
                  <div style={{
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                  }}>
                    {todayDay.exercises.length} exercises
                  </div>
                </div>
                {todayDay.exercises.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {todayDay.exercises.slice(0, 4).map(ex => (
                      <span key={ex.id} style={{ fontSize: 11, background: "#0f172a", color: "#94a3b8", borderRadius: 99, padding: "2px 8px", border: "1px solid #334155" }}>
                        {ex.exerciseName}
                      </span>
                    ))}
                    {todayDay.exercises.length > 4 && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>+{todayDay.exercises.length - 4} more</span>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a78bfa", fontSize: 13, fontWeight: 600 }}>
                  <span>Start workout</span>
                  <span>›</span>
                </div>
              </button>
            ) : (
              <div style={{ ...S.card, textAlign: "center", padding: "20px 18px" }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No workout scheduled for today</div>
                <button
                  onClick={() => onNavigate("workout")}
                  style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "#a78bfa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Choose a day manually ›
                </button>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <div style={S.label}>Quick Log</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => onNavigate("sleep")}
                style={{ flex: 1, ...S.card, cursor: "pointer", border: "1px solid #334155", outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px" }}
              >
                <span style={{ fontSize: 22 }}>🌙</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Log Sleep</span>
              </button>
              <button
                onClick={() => onNavigate("nutrition")}
                style={{ flex: 1, ...S.card, cursor: "pointer", border: "1px solid #334155", outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px" }}
              >
                <span style={{ fontSize: 22 }}>🍽️</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Log Meal</span>
              </button>
              <button
                onClick={() => onNavigate("messages")}
                style={{ flex: 1, ...S.card, cursor: "pointer", border: "1px solid #334155", outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px" }}
              >
                <span style={{ fontSize: 22 }}>💬</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Messages</span>
              </button>
            </div>
          </div>

          {/* Recent sessions */}
          <div>
            <div style={S.label}>Recent Sessions</div>
            {recentLogs.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "20px 18px" }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>No workouts logged yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentLogs.map(log => (
                  <div key={log.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{dayNameById(log.programDayId)}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{formatDate(log.date)}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", background: "#0f172a", border: "1px solid #334155", borderRadius: 99, padding: "3px 10px" }}>
                      {log.sets.length} sets
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
