import { useState, useEffect } from "react";
import WorkoutPage from "./pages/WorkoutPage";
import HomePage from "./pages/HomePage";
import SleepPage from "./pages/SleepPage";
import NutritionPage from "./pages/NutritionPage";
import MessagesPage from "./pages/MessagesPage";

export type TabId = "home" | "workout" | "sleep" | "nutrition" | "messages";
type AuthState = "loading" | "unauthenticated" | "authenticated";
interface ClientInfo { id: number; name: string; }

const DEMO_CLIENTS = [
  { username: "alex", password: "alex", label: "Alex Johnson" },
  { username: "sam", password: "sam", label: "Sam Williams" },
  { username: "jordan", password: "jordan", label: "Jordan Rivera" },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "#a78bfa" : "#64748b";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DumbbellIcon({ active }: { active: boolean }) {
  const c = active ? "#a78bfa" : "#64748b";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6.5" y1="12" x2="17.5" y2="12" />
      <rect x="5" y="8" width="2.5" height="8" rx="1.25" fill={c} stroke="none" />
      <rect x="16.5" y="8" width="2.5" height="8" rx="1.25" fill={c} stroke="none" />
      <rect x="2" y="9.5" width="3" height="5" rx="1" fill={c} stroke="none" />
      <rect x="19" y="9.5" width="3" height="5" rx="1" fill={c} stroke="none" />
    </svg>
  );
}

function MoonIcon({ active }: { active: boolean }) {
  const c = active ? "#a78bfa" : "#64748b";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#a78bfa" : "none"} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ForkIcon({ active }: { active: boolean }) {
  const c = active ? "#a78bfa" : "#64748b";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}

function ChatIcon({ active, unread }: { active: boolean; unread: number }) {
  const c = active ? "#a78bfa" : "#64748b";
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#a78bfa" : "none"} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unread > 0 && (
        <div style={{
          position: "absolute", top: -5, right: -7,
          minWidth: 16, height: 16, background: "#ef4444", borderRadius: 99,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800, color: "#fff", padding: "0 3px",
          border: "1.5px solid #1e293b",
        }}>
          {unread > 9 ? "9+" : unread}
        </div>
      )}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f172a", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px", gap: 28 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#a78bfa", letterSpacing: "-1px", marginBottom: 6 }}>Trak</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Sign in to track your training</div>
        </div>

        <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ padding: "13px 16px", borderRadius: 12, border: "1.5px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: "13px 16px", borderRadius: 12, border: "1.5px solid #334155", background: "#1e293b", color: "#f1f5f9", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          {error && <div style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "14px", borderRadius: 12, background: loading ? "#4c1d95" : "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ width: "100%", background: "#1e293b", borderRadius: 14, padding: "14px 16px", border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
            Demo accounts — tap to fill
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DEMO_CLIENTS.map(c => (
              <button
                key={c.username}
                type="button"
                onClick={() => fill(c.username, c.password)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
              >
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{c.label}</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#a78bfa" }}>{c.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "home",      label: "Home" },
  { id: "workout",   label: "Workout" },
  { id: "sleep",     label: "Sleep" },
  { id: "nutrition", label: "Nutrition" },
  { id: "messages",  label: "Messages" },
];

function TabBar({ active, onSelect, unread }: { active: TabId; onSelect: (t: TabId) => void; unread: number }) {
  return (
    <div style={{
      display: "flex",
      background: "#1e293b",
      borderTop: "1px solid #334155",
      flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "10px 4px 10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderTop: `2px solid ${isActive ? "#7c3aed" : "transparent"}`,
            }}
          >
            {tab.id === "home"      && <HomeIcon active={isActive} />}
            {tab.id === "workout"   && <DumbbellIcon active={isActive} />}
            {tab.id === "sleep"     && <MoonIcon active={isActive} />}
            {tab.id === "nutrition" && <ForkIcon active={isActive} />}
            {tab.id === "messages"  && <ChatIcon active={isActive} unread={unread} />}
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? "#a78bfa" : "#64748b" }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [tab, setTab] = useState<TabId>("home");
  const [unread, setUnread] = useState(0);

  const checkAuth = () => {
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
  };

  useEffect(() => { checkAuth(); }, []);

  // Poll unread message count
  useEffect(() => {
    if (!client) return;
    const fetchUnread = () => {
      fetch(`/api/clients/${client.id}/messages`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then((msgs: { sender: string; readAt: string | null }[]) => {
          setUnread(msgs.filter(m => m.sender === "coach" && !m.readAt).length);
        })
        .catch(() => {});
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 10_000);
    return () => clearInterval(iv);
  }, [client]);

  const handleTabSelect = (t: TabId) => {
    setTab(t);
    if (t === "messages") setUnread(0); // optimistic clear on open
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a14" }}>
      <div style={{
        width: 390,
        height: "min(844px, 96dvh)",
        borderRadius: 44,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.03)",
        background: "#0f172a",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {auth === "loading" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 28, height: 28, border: "3px solid #1e293b", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {auth === "unauthenticated" && <LoginScreen onLogin={checkAuth} />}

        {auth === "authenticated" && client && (
          <>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {tab === "home"      && <HomePage clientId={client.id} clientName={client.name} onNavigate={handleTabSelect} />}
              {tab === "workout"   && <WorkoutPage clientId={client.id} clientName={client.name} onNavigate={handleTabSelect} />}
              {tab === "sleep"     && <SleepPage clientId={client.id} />}
              {tab === "nutrition" && <NutritionPage clientId={client.id} />}
              {tab === "messages"  && <MessagesPage clientId={client.id} clientName={client.name} />}
            </div>
            <TabBar active={tab} onSelect={handleTabSelect} unread={unread} />
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
