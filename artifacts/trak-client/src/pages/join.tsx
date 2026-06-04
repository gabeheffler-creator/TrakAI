import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInvite, getGetInviteQueryKey } from "@workspace/api-client-react";
import { useClientId } from "@/hooks/use-client-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { setClientId } = useClientId();

  const { data: invite, isLoading, error } = useGetInvite(token, {
    query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) }
  });

  const handleJoin = () => {
    if (invite) {
      setClientId(invite.clientId);
      setLocation("/");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking invite link...</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-2xl">Invalid Link</p>
            <p className="text-muted-foreground text-sm">This invite link is invalid or has expired. Ask your coach for a new one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl font-black text-primary mb-2">TRAK</div>
          <CardTitle className="text-xl">Welcome to Trak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            Your coach has invited you to join Trak. You'll be able to log workouts, track your progress, and stay connected.
          </p>
          <div className="bg-accent rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Joining as</p>
            <p className="text-xl font-bold text-accent-foreground mt-1">{invite.clientName}</p>
          </div>
          <Button className="w-full" size="lg" onClick={handleJoin} data-testid="button-join">
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
