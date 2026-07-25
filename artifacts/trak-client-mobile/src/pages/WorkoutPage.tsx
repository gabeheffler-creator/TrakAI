import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExerciseCue {
  id: number;
  exerciseId: number;
  note: string;
}

interface ProgramExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  sets: number;
  reps: string;
  weight?: number | null;
  restSeconds?: number | null;
  muscleGroup: string;
}

interface ProgramDay {
  id: number;
  name: string;
  weekNumber: number;
  dayOfWeek: number;
  exercises: ProgramExercise[];
}

interface ProgramAssignment {
  programId: number;
  startDate: string;
}

interface SetEntry {
  reps: string;
  weight: string;
  logged: boolean;
}

interface WorkoutPageProps {
  clientId: number;
  clientName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function buildSets(exercises: ProgramExercise[]): SetEntry[][] {
  return exercises.map(ex =>
    Array.from({ length: ex.sets }, () => ({
      reps: ex.reps,
      weight: ex.weight ? String(ex.weight) : "",
      logged: false,
    }))
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    padding: "16px 20px 12px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 },
  subtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  scroll: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 20px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  exCard: {
    background: "#1e293b",
    borderRadius: 14,
    overflow: "hidden" as const,
    border: "1px solid #334155",
  },
  exHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  exDot: (done: boolean) => ({
    width: 8, height: 8, borderRadius: "50%",
    background: done ? "#22c55e" : "#475569",
    flexShrink: 0,
  }),
  exName: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", flex: 1 },
  exMeta: { fontSize: 11, color: "#64748b", marginTop: 1 },
  cueBox: {
    display: "flex",
    gap: 8,
    background: "#451a03",
    borderTop: "1px solid #92400e",
    padding: "10px 14px",
  },
  cueIcon: { fontSize: 13, flexShrink: 0, marginTop: 1 },
  cueText: { fontSize: 12, color: "#fed7aa", lineHeight: 1.5 },
  setsWrap: { padding: "12px 16px", display: "flex", flexDirection: "column" as const, gap: 10 },
  setRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  setLabel: { width: 28, fontSize: 12, color: "#64748b", fontWeight: 600, flexShrink: 0 },
  input: (logged: boolean) => ({
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${logged ? "#16a34a" : "#334155"}`,
    background: logged ? "#14532d" : "#0f172a",
    color: logged ? "#86efac" : "#f1f5f9",
    fontSize: 14,
    outline: "none",
    minWidth: 0,
  }),
  logBtn: (logged: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    background: logged ? "#16a34a" : "#334155",
    color: logged ? "#fff" : "#94a3b8",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  footer: {
    padding: "14px 20px",
    background: "#1e293b",
    borderTop: "1px solid #334155",
    flexShrink: 0,
  },
  primaryBtn: (disabled: boolean) => ({
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: disabled ? "#334155" : "#6d28d9",
    color: disabled ? "#64748b" : "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  badge: (color: string) => ({
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 99,
    background: color === "green" ? "#14532d" : color === "purple" ? "#2e1065" : "#1e293b",
    color: color === "green" ? "#86efac" : color === "purple" ? "#c4b5fd" : "#94a3b8",
    border: `1px solid ${color === "green" ? "#16a34a" : color === "purple" ? "#6d28d9" : "#334155"}`,
  }),
  dayCard: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: selected ? "#2e1065" : "#1e293b",
    border: `1px solid ${selected ? "#6d28d9" : "#334155"}`,
    borderRadius: 14,
    padding: "14px 18px",
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
    outline: "none",
  }),
};

// ─── WorkoutPage component ────────────────────────────────────────────────────

export default function WorkoutPage({ clientId, clientName }: WorkoutPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState<ProgramDay | null>(null);
  const [cues, setCues] = useState<ExerciseCue[]>([]);
  const [sets, setSets] = useState<SetEntry[][]>([]);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [allDays, setAllDays] = useState<ProgramDay[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch assignment, cues, and today's workout log in parallel
      const [assignment, cuesData, logsData]: [ProgramAssignment, ExerciseCue[], { id: number; programDayId: number; date: string }[]] = await Promise.all([
        apiFetch<ProgramAssignment>(`/api/clients/${clientId}/program-assignment`),
        apiFetch<ExerciseCue[]>(`/api/clients/${clientId}/exercise-cues`),
        apiFetch<{ id: number; programDayId: number; date: string }[]>(`/api/clients/${clientId}/workout-logs?limit=5`),
      ]);

      setCues(cuesData);

      // Fetch full program detail
      const program = await apiFetch<{
        phases: { days: ProgramDay[] }[];
      }>(`/api/clients/${clientId}/program`);

      const allDays = program.phases.flatMap(p => p.days);
      setAllDays(allDays);

      // Calculate today's program day
      const start = new Date(assignment.startDate);
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
      const weekNum = Math.floor(daysSinceStart / 7) + 1;
      const dow = (daysSinceStart % 7) + 1;

      const todayDay = allDays.find(d => d.weekNumber === weekNum && d.dayOfWeek === dow) ?? null;
      setToday(todayDay);

      if (todayDay) {
        setSets(buildSets(todayDay.exercises));

        // Check if there's already a workout log for today's day
        const todayStr = new Date().toISOString().split("T")[0];
        const existing = logsData.find(l => l.programDayId === todayDay.id && l.date === todayStr);
        if (existing) setWorkoutLogId(existing.id);
      }
    } catch (e) {
      setError("Couldn't load today's workout. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const updateSet = (exIdx: number, setIdx: number, field: keyof SetEntry, value: string | boolean) => {
    setSets(prev => prev.map((ex, i) =>
      i === exIdx ? ex.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) : ex
    ));
  };

  const toggleSet = (exIdx: number, setIdx: number) => {
    setSets(prev => prev.map((ex, i) =>
      i === exIdx ? ex.map((s, j) => j === setIdx ? { ...s, logged: !s.logged } : s) : ex
    ));
  };

  const handleFinish = async () => {
    if (!today) return;
    setSaving(true);
    try {
      let logId = workoutLogId;
      if (!logId) {
        const log = await apiFetch<{ id: number }>(`/api/clients/${clientId}/workout-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programDayId: today.id, date: new Date().toISOString().split("T")[0] }),
        });
        logId = log.id;
        setWorkoutLogId(log.id);
      }

      // Log all checked sets
      const setPromises: Promise<unknown>[] = [];
      today.exercises.forEach((ex, exIdx) => {
        sets[exIdx].forEach((s, setIdx) => {
          if (s.logged) {
            setPromises.push(apiFetch(`/api/workout-logs/${logId}/sets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                programExerciseId: ex.id,
                setNumber: setIdx + 1,
                reps: parseInt(s.reps) || 0,
                weight: parseFloat(s.weight) || null,
                isLogged: true,
              }),
            }));
          }
        });
      });

      await Promise.allSettled(setPromises);
      setDone(true);
    } catch {
      // Silently continue — sets may have partially saved
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  const loggedCount = sets.reduce((total, ex) => total + ex.filter(s => s.logged).length, 0);
  const totalSets = sets.reduce((total, ex) => total + ex.length, 0);
  const cuesByExId: Record<number, ExerciseCue[]> = {};
  cues.forEach(c => { (cuesByExId[c.exerciseId] ??= []).push(c); });

  if (loading) {
    return (
      <div style={{ ...S.page, alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "3px solid #334155", borderTopColor: "#6d28d9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ ...S.page, alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Workout logged!</div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>{loggedCount} of {totalSets} sets completed</div>
        <button onClick={() => { setDone(false); load(); }} style={S.primaryBtn(false)}>Back to workout</button>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={S.title}>{today ? today.name : "Workout"}</p>
            <p style={S.subtitle}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              {today && ` · ${today.exercises.length} exercises`}
            </p>
          </div>
          {today && (
            <span style={S.badge(loggedCount === totalSets ? "green" : "purple")}>
              {loggedCount}/{totalSets} sets
            </span>
          )}
        </div>
        {error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{error}</p>}
      </div>

      {/* Day selector — shown when no workout auto-scheduled today */}
      {!today && !loading && (
        <div style={S.scroll}>
          {allDays.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏋️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8" }}>No program assigned yet</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Your coach hasn't set up a program yet.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                Choose a day to train
              </div>
              {allDays.map(day => (
                <button
                  key={day.id}
                  style={S.dayCard(false)}
                  onClick={() => { setToday(day); setSets(buildSets(day.exercises)); }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{day.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {day.exercises.length} exercise{day.exercises.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{ color: "#6d28d9", fontSize: 18 }}>›</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Exercise list */}
      {today && (
        <div style={S.scroll}>
          {today.exercises.map((ex, exIdx) => {
            const exCues = cuesByExId[ex.exerciseId] ?? [];
            const exSets = sets[exIdx] ?? [];
            const exDone = exSets.length > 0 && exSets.every(s => s.logged);
            return (
              <div key={ex.id} style={S.exCard}>
                {/* Exercise header */}
                <div style={S.exHeader}>
                  <div style={S.exDot(exDone)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.exName}>{ex.exerciseName}</div>
                    <div style={S.exMeta}>
                      {ex.sets} sets × {ex.reps} reps
                      {ex.weight ? ` · ${ex.weight} kg` : ""}
                      {ex.muscleGroup ? ` · ${ex.muscleGroup}` : ""}
                    </div>
                  </div>
                  {exDone && <span style={{ fontSize: 16 }}>✅</span>}
                </div>

                {/* Coach cues */}
                {exCues.map(cue => (
                  <div key={cue.id} style={S.cueBox}>
                    <span style={S.cueIcon}>📋</span>
                    <span style={S.cueText}>{cue.note}</span>
                  </div>
                ))}

                {/* Sets */}
                <div style={S.setsWrap}>
                  {exSets.map((s, setIdx) => (
                    <div key={setIdx} style={S.setRow}>
                      <span style={S.setLabel}>S{setIdx + 1}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="kg"
                        value={s.weight}
                        onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)}
                        style={{ ...S.input(s.logged), maxWidth: 68 }}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={ex.reps}
                        value={s.reps !== ex.reps ? s.reps : ""}
                        onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                        style={{ ...S.input(s.logged), maxWidth: 68 }}
                      />
                      <button
                        style={S.logBtn(s.logged)}
                        onClick={() => toggleSet(exIdx, setIdx)}
                        title={s.logged ? "Undo" : "Done"}
                      >
                        {s.logged ? "✓" : "○"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {today && (
        <div style={S.footer}>
          <button
            style={S.primaryBtn(saving || loggedCount === 0)}
            disabled={saving || loggedCount === 0}
            onClick={handleFinish}
          >
            {saving ? "Saving…" : loggedCount === 0 ? "Log at least one set to finish" : `Finish — ${loggedCount}/${totalSets} sets done`}
          </button>
        </div>
      )}
    </div>
  );
}
