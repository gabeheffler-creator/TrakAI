import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";
import { useConfirmPasswordReset } from "@workspace/api-client-react";

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const resetMutation = useConfirmPasswordReset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    try {
      await resetMutation.mutateAsync({ data: { token, password } });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to reset password. The link may have expired.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a new password for your account</p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-600 dark:text-green-400">
                Your password has been successfully reset.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Continue to login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Saving..." : "Reset password"}
            </Button>
            <div className="text-center mt-4">
              <Link href="/login">
                <Button variant="link" className="text-xs text-muted-foreground hover:text-foreground">
                  Back to login
                </Button>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
