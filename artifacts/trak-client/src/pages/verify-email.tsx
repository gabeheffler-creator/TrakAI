import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TrakLogo } from "@/components/trak-logo";
import { useConfirmEmailVerification } from "@workspace/api-client-react";

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");
  
  const verifyMutation = useConfirmEmailVerification();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        await verifyMutation.mutateAsync({ data: { token } });
        setStatus("success");
      } catch (err: any) {
        setStatus("error");
        setError(err?.data?.error ?? "Failed to verify email. The link may have expired.");
      }
    };
    verify();
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <TrakLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Email Verification</h1>
          </div>
        </div>

        {status === "loading" && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Verifying your email address...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-600 dark:text-green-400">
                Your email has been successfully verified! You can now sign in to your account.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white">Continue to login</Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">Return to login</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
