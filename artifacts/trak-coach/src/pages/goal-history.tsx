import { useParams, useLocation } from "wouter";
import { useListClientGoalHistory, getListClientGoalHistoryQueryKey, useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Target } from "lucide-react";
import { format } from "date-fns";

export function GoalHistoryPage() {
  const { clientId: clientIdStr } = useParams<{ clientId: string }>();
  const clientId = Number(clientIdStr);
  const [, setLocation] = useLocation();

  const { data: client } = useGetClient(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) },
  });

  const { data: history, isLoading, error } = useListClientGoalHistory(clientId, {
    query: { enabled: !!clientId, queryKey: getListClientGoalHistoryQueryKey(clientId) },
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/clients/${clientId}`)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Goal History</h1>
        {client && (
          <p className="text-muted-foreground text-sm mt-0.5">{client.name}</p>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading goal history…</div>
      )}

      {error && (
        <p className="text-sm text-destructive">Failed to load goal history. Please try again.</p>
      )}

      {!isLoading && !error && history?.length === 0 && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
            <Target className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No goal history yet.</p>
            <p className="text-muted-foreground text-xs">
              Previous goals will appear here when a new goal is set.
            </p>
          </CardContent>
        </Card>
      )}

      {history && history.length > 0 && (
        <div className="space-y-3">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="py-4 px-4">
                <p className="text-sm font-medium">{entry.goal}</p>
                {entry.goalTargetDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Target date: {format(new Date(entry.goalTargetDate), "MMM d, yyyy")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Archived {format(new Date(entry.archivedAt), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
