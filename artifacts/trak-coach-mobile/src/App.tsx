import { useState, useEffect } from "react";

type AuthState = "loading" | "unauthenticated" | "authenticated";

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
      const res = await fetch("/api/auth/coach/login", {
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px", gap: 24, background: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed", letterSpacing: "-0.5px", marginBottom: 4 }}>TrakCoach</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 2 }}>Coach Login</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Sign in to manage your clients</div>
      </div>
      <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }}
        />
        {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", borderRadius: 10, background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div style={{ width: "100%", background: "#f9fafb", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #e5e7eb" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Demo credentials</div>
        <button
          type="button"
          onClick={() => fill("coach", "coach")}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
        >
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>coach / coach</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>tap to fill</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setAuth(d?.role === "coach" ? "authenticated" : "unauthenticated"))
      .catch(() => setAuth("unauthenticated"));
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0e17" }}>
      <div style={{ width: 390, height: "min(844px, 96dvh)", borderRadius: 44, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)", background: "#fff", flexShrink: 0 }}>
        {auth === "loading" && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <div style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {auth === "unauthenticated" && (
          <LoginScreen onLogin={() => setAuth("authenticated")} />
        )}
        {auth === "authenticated" && (
          <iframe
            src="/?mobile=1"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Trak Coach"
          />
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
