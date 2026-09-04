import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";
import { useClientLogin, useRequestEmailVerification } from "@workspace/api-client-react";

const DEMO_CLIENTS = [
  { username: "alex", password: "alex", label: "Alex Johnson" },
  { username: "sam", password: "sam", label: "Sam Williams" },
  { username: "jordan", password: "jordan", label: "Jordan Rivera" },
];

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  const { setUser } = useAuth();
  const [, setLocation] = useLocation();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");

  const loginMutation = useClientLogin();
  const resendMutation = useRequestEmailVerification();

  const fill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError("");
    setEmailNotVerified(false);
    setResendSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailNotVerified(false);
    setResendSuccess(false);

    try {
      const data = await loginMutation.mutateAsync({ data: { username, password } });
      setUser({ id: data.id, name: data.name, role: "client" });
      setLocation(returnTo && returnTo.startsWith("/") ? returnTo : "/");
    } catch (err: any) {
      const payload = err?.data;
      if (payload?.code === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
        setError("Your email address has not been verified.");
      } else {
        setError(payload?.error ?? "Login failed. Please check your credentials.");
      }
    }
  };

  const handleResend = async () => {
    if (!verificationEmail) {
      setError("Enter the email address for this account.");
      return;
    }
    try {
      await resendMutation.mutateAsync({ data: { email: verificationEmail, role: "client" } });
      setResendSuccess(true);
      setError("");
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to resend verification email.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Client Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to track your training</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username or Email</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="alex"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password">
                <span className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {resendSuccess && (
            <p className="text-sm text-green-600">Verification email sent! Please check your inbox.</p>
          )}

          {emailNotVerified && !resendSuccess && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="verification-email">Account email</Label>
              <Input
                id="verification-email"
                type="email"
                value={verificationEmail}
                onChange={(event) => setVerificationEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? "Sending..." : "Resend verification email"}
              </Button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === "true" && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Demo accounts — tap to fill
            </p>
            <div className="space-y-2">
              {DEMO_CLIENTS.map((c) => (
                <button
                  key={c.username}
                  type="button"
                  onClick={() => fill(c.username, c.password)}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-background border border-border hover:border-violet-400 hover:bg-violet-50/50 transition-colors text-left"
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
        )}
      </div>
    </div>
  );
}
