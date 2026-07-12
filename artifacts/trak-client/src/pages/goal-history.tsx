import { useClientId } from "@/hooks/use-client-id";
import { useListClientGoalHistory, getListClientGoalHistoryQueryKey, useGetMyClient, getGetMyClientQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Target, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export function GoalHistoryPage() {
  const { clientId } = useClientId();

  const { data: client } = useGetMyClient({
    query: { enabled: !!clientId, queryKey: getGetMyClientQueryKey() },
  });

  const { data: history, isLoading, isError } = useListClientGoalHistory(clientId!, {
    query: { enabled: !!clientId, queryKey: getListClientGoalHistoryQueryKey(clientId!) },
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Goal History</h1>
      </div>

      {/* Active goal */}
      {client?.goal && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Current Goal</p>
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{client.goal}</p>
                {client.goalTargetDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due {format(new Date(client.goalTargetDate), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Past goals */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Past Goals</p>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {isError && (
          <p className="text-sm text-destructive">Failed to load goal history.</p>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
              <Target className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No past goals yet.</p>
              <p className="text-xs text-muted-foreground">Previous goals will appear here once you set a new one.</p>
            </CardContent>
          </Card>
        )}

        {history && history.length > 0 && (
          <div className="space-y-2">
            {history.map((entry) => (
              <Card key={entry.id} className="opacity-80">
                <CardContent className="pt-4 pb-4 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm">{entry.goal}</p>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {entry.goalTargetDate && (
                        <p className="text-xs text-muted-foreground">
                          Target: {format(new Date(entry.goalTargetDate), "MMM d, yyyy")}
                        </p>
                      )}
                      {entry.archivedAt && (
                        <p className="text-xs text-muted-foreground">
                          Replaced {format(new Date(entry.archivedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
