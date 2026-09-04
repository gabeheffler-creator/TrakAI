import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";
import { useRequestPasswordReset } from "@workspace/api-client-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const resetMutation = useRequestPasswordReset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      await resetMutation.mutateAsync({ data: { email } });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to request password reset.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link</p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-600 dark:text-green-400">
                If an account exists for that email, a password reset link has been sent. Please check your inbox.
              </p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">Return to login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Sending..." : "Send reset link"}
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
