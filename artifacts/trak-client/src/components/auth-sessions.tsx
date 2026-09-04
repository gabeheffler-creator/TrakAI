import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListAuthSessions, useRevokeAuthSession, useRevokeAllAuthSessions, getListAuthSessionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Monitor, Smartphone, Trash2, LogOut, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function AuthSessions() {
  const { data: sessions, isLoading, isError, isFetching, refetch } = useListAuthSessions();
  const revokeMutation = useRevokeAuthSession();
  const revokeAllMutation = useRevokeAllAuthSessions();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const sessionToRevokeObj = sessions?.find(s => s.id === sessionToRevoke);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="space-y-2 px-4">
          <p className="text-sm text-destructive">Failed to load active sessions.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {sessions?.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions were found.</p>
          )}
          {sessions?.map((session) => {
            const isCurrent = session.current;
            return (
              <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                    {session.kind === 'native' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center flex-wrap gap-2">
                      <span className="truncate">{session.device_label || (session.kind === 'native' ? 'Mobile App' : 'Web Browser')}</span>
                      {isCurrent && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">Current</span>}
                    </p>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 items-center leading-relaxed">
                      <span>Created: {new Date(session.created_at).toLocaleDateString()}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Active: {new Date(session.last_used_at).toLocaleDateString()}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Expires: {new Date(session.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 ml-2"
                  onClick={() => setSessionToRevoke(session.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}

          <Button
            variant="outline"
            className="w-full mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setRevokeAllOpen(true)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out everywhere
          </Button>
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        </div>
      )}

      {/* Revoke single dialog */}
      <Dialog open={!!sessionToRevoke} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sessionToRevokeObj?.current ? "Sign out of current session?" : "Sign out session"}</DialogTitle>
            <DialogDescription>
              {sessionToRevokeObj?.current
                ? "This is your current active session. If you sign out, you will be immediately redirected to the login page."
                : "This will sign you out of this device. Are you sure?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionToRevoke(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!sessionToRevoke) return;
                const isCurrent = sessionToRevokeObj?.current === true;
                setActionError("");
                try {
                  await revokeMutation.mutateAsync({ sessionId: sessionToRevoke });
                  setSessionToRevoke(null);
                  if (isCurrent) {
                    logout();
                  } else {
                    queryClient.invalidateQueries({ queryKey: getListAuthSessionsQueryKey() });
                  }
                } catch (error: any) {
                  setActionError(error?.data?.error ?? "Could not sign out that session. Please try again.");
                }
              }}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke all dialog */}
      <Dialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out everywhere</DialogTitle>
            <DialogDescription>
              This will sign you out of all devices, including this one. You will need to log back in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeAllOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setActionError("");
                try {
                  await revokeAllMutation.mutateAsync();
                  setRevokeAllOpen(false);
                  logout(); // redirect to login
                } catch (error: any) {
                  setActionError(error?.data?.error ?? "Could not sign out everywhere. Please try again.");
                }
              }}
              disabled={revokeAllMutation.isPending}
            >
              {revokeAllMutation.isPending ? "Signing out..." : "Sign out everywhere"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
