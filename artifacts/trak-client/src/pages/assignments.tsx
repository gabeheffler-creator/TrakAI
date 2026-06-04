import { useClientId } from "@/hooks/use-client-id";
import {
  useListAssignments,
  useCompleteAssignment,
  getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Circle, ClipboardList } from "lucide-react";

const typeColors: Record<string, string> = {
  task: "bg-blue-100 text-blue-800",
  nutrition: "bg-green-100 text-green-800",
  mobility: "bg-yellow-100 text-yellow-800",
  habit: "bg-purple-100 text-purple-800",
  note: "bg-gray-100 text-gray-800",
};

export function AssignmentsPage() {
  const { clientId } = useClientId();
  const qc = useQueryClient();
  const { data: assignments, isLoading } = useListAssignments(clientId!, {
    query: { enabled: !!clientId, queryKey: getListAssignmentsQueryKey(clientId!) }
  });
  const completeAssignment = useCompleteAssignment();

  const handleComplete = (id: number) => {
    completeAssignment.mutate({ clientId: clientId!, assignmentId: id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey(clientId!) })
    });
  };

  const pending = assignments?.filter(a => a.status === "pending") ?? [];
  const completed = assignments?.filter(a => a.status === "completed") ?? [];

  if (!clientId) return <div className="p-4 text-muted-foreground">Not logged in.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Assignments</h1>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pending {pending.length > 0 && <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {isLoading && <p className="text-muted-foreground">Loading...</p>}
          {pending.length === 0 && !isLoading && (
            <div className="text-center py-10 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>All caught up! No pending assignments.</p>
            </div>
          )}
          {pending.map(a => (
            <Card key={a.id} className="overflow-hidden" data-testid={`card-assignment-${a.id}`}>
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <button
                  onClick={() => handleComplete(a.id)}
                  className="mt-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                  data-testid={`button-complete-assignment-${a.id}`}
                >
                  <Circle className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <p className="font-medium">{a.title}</p>
                  {a.body && <p className="text-sm text-muted-foreground mt-1">{a.body}</p>}
                  {a.targetValue && (
                    <p className="text-sm text-muted-foreground mt-1">Target: <span className="font-medium text-foreground">{a.targetValue}</span></p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[a.type] ?? ""}`}>{a.type}</span>
                    {a.dueDate && <span className="text-xs text-muted-foreground">Due {a.dueDate}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No completed assignments yet.</p>
          )}
          {completed.map(a => (
            <Card key={a.id} className="opacity-60" data-testid={`card-completed-${a.id}`}>
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium line-through">{a.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[a.type] ?? ""}`}>{a.type}</span>
                    {a.completedAt && <span className="text-xs text-muted-foreground">Done {new Date(a.completedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
