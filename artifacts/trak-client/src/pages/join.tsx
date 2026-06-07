import { useEffect, useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useGetInvite, getGetInviteQueryKey } from "@workspace/api-client-react";
import { useClientId } from "@/hooks/use-client-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearch();
  const auto = new URLSearchParams(search).get("auto") === "1";
  const [, setLocation] = useLocation();
  const { clientId, setClientId } = useClientId();
  const [joining, setJoining] = useState(false);

  const { data: invite, isLoading, error } = useGetInvite(token, {
    query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) }
  });

  // Already logged in as this client → skip straight home
  useEffect(() => {
    if (invite && clientId === invite.clientId) {
      setLocation("/");
    }
  }, [invite, clientId, setLocation]);

  // Auto-login mode (dev shortcut — ?auto=1)
  useEffect(() => {
    if (auto && invite && clientId !== invite.clientId) {
      setClientId(invite.clientId);
      setLocation("/");
    }
  }, [auto, invite, clientId, setClientId, setLocation]);

  const handleJoin = async () => {
    if (!invite) return;
    setJoining(true);
    try {
      await fetch(`/api/invite/${token}/accept`, { method: "POST" });
    } catch {
      // non-fatal
    }
    setClientId(invite.clientId);
    setLocation("/");
  };

  if (isLoading || (auto && invite)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-2xl">Invalid Link</p>
            <p className="text-muted-foreground text-sm">
              This invite link is invalid or has expired. Ask your coach for a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="text-3xl font-black text-violet-600 mb-2">tRak</div>
          <CardTitle className="text-xl">Welcome to tRak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            Your coach has invited you to join tRak. You'll be able to log workouts, track your progress, and stay connected.
          </p>
          <div className="bg-accent rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Joining as</p>
            <p className="text-xl font-bold text-accent-foreground mt-1">{invite.clientName}</p>
          </div>
          <Button className="w-full" size="lg" onClick={handleJoin} disabled={joining} data-testid="button-join">
            {joining ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining…</> : "Get Started"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
