import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  useGetInvite,
  getGetInviteQueryKey,
  useAcceptInvite,
  getGetMyClientQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const queryClient = useQueryClient();

  const { data: invite, isLoading, error } = useGetInvite(token, {
    query: { enabled: !!token, queryKey: getGetInviteQueryKey(token), retry: false },
  });

  const acceptInvite = useAcceptInvite({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyClientQueryKey() });
        setLocation("/");
      },
    },
  });

  useEffect(() => {
    if (isSignedIn && invite && token && acceptInvite.isIdle) {
      acceptInvite.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, invite, token]);

  if (isLoading || !isLoaded) {
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

  if (isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            {acceptInvite.isError ? (
              <>
                <p className="text-2xl">Couldn't Join</p>
                <p className="text-muted-foreground text-sm">
                  This invite is for {invite.clientEmail}. Sign out and sign in
                  with that email address to accept it.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">Joining your coach's program…</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const redirectUrl = `${window.location.origin}${basePath}/join/${token}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="text-3xl font-black text-violet-600 mb-2">Trak</div>
          <CardTitle className="text-xl">Welcome to Trak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            Your coach has invited you to join Trak. You'll be able to log workouts, track your progress, and stay connected.
          </p>
          <div className="bg-accent rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Joining as</p>
            <p className="text-xl font-bold text-accent-foreground mt-1">{invite.clientName}</p>
            <p className="text-xs text-muted-foreground mt-1">{invite.clientEmail}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Create an account or sign in with <span className="font-medium">{invite.clientEmail}</span> to continue.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full" size="lg" data-testid="button-join-signup">
              <a href={`${basePath}/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}>Create account</a>
            </Button>
            <Button asChild className="w-full" size="lg" variant="outline" data-testid="button-join-signin">
              <a href={`${basePath}/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}>I already have an account</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
