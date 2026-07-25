import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();

  const login = async (u: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/coach/login", {
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
      setUser({ id: data.id, name: data.name, role: "coach" });
      setLocation("/");
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Coach Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your clients</p>
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
              placeholder="coach"
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
            Demo credentials
          </p>
          <button
            type="button"
            onClick={() => login("coach", "coach")}
            disabled={loading}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-background border border-border hover:border-violet-400 hover:bg-violet-50/50 transition-colors text-left disabled:opacity-50"
          >
            <span>
              <span className="font-mono font-semibold text-foreground">coach</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="font-mono font-semibold text-foreground">coach</span>
            </span>
            <span className="text-xs text-muted-foreground">tap to sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
}
