import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrakLogo } from "@/components/trak-logo";
import { useGetInvite, useRegisterInvite, getGetInviteQueryKey } from "@workspace/api-client-react";

export function InviteRegistrationPage({ token }: { token: string }) {
  const { data: invite, isLoading, isError, error: inviteError } = useGetInvite(token, {
    query: {
      queryKey: getGetInviteQueryKey(token),
      retry: false,
    }
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const registerMutation = useRegisterInvite();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      await registerMutation.mutateAsync({ token, data: { username, password } });
      setSuccess(true);
    } catch (err: any) {
      setFormError(err?.data?.error ?? "Failed to register. The username may already be taken.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <TrakLogo />
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 mt-6">
            <p className="text-sm text-destructive">
              {(inviteError as any)?.data?.error || "This invitation is invalid or has already been used."}
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="w-full">Return to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Welcome, {invite.clientName}!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invite.coachName} has invited you to Trak.
            </p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-600 dark:text-green-400 font-semibold mb-1">
                Account created successfully!
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-400/80">
                A verification email has been sent to your email address. Please check your inbox and verify your email before logging in.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Go to login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Choose a Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. john_doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white mt-2"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
