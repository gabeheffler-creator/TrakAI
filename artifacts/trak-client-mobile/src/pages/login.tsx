import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";

const DEMO_CLIENTS = [
  { username: "alex", password: "alex", label: "Alex Johnson" },
  { username: "sam", password: "sam", label: "Sam Williams" },
  { username: "jordan", password: "jordan", label: "Jordan Rivera" },
];

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");

  const login = async (u: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      setUser({ id: data.id, name: data.name, role: "client" });
      setLocation(returnTo && returnTo.startsWith("/") ? returnTo : "/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(username, password);
  };

  return (
    <div className="flex h-full items-center justify-center bg-background px-5 overflow-y-auto phone-scroll">
      <div className="w-full max-w-sm space-y-7 py-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Client Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to track your training</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="alex"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Demo accounts — tap to sign in
          </p>
          <div className="space-y-2">
            {DEMO_CLIENTS.map((c) => (
              <button
                key={c.username}
                type="button"
                onClick={() => login(c.username, c.password)}
                disabled={loading}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-background border border-border hover:border-violet-400 hover:bg-violet-50/50 transition-colors text-left disabled:opacity-50"
              >
                <span className="text-muted-foreground text-xs">{c.label}</span>
                <span>
                  <span className="font-mono font-semibold text-foreground">{c.username}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="font-mono font-semibold text-foreground">{c.password}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
