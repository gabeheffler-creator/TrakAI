import { useGetCoachDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, ActivitySquare, AlertCircle, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow, parseISO } from "date-fns";

export function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetCoachDashboard();

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error || !dashboard) {
    return <div className="p-8 text-destructive">Failed to load dashboard</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">Welcome back, Coach.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalClients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.activePrograms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.clientSummaries?.reduce((acc, c) => acc + (c.assignmentsDue || 0) + (c.unreadMessages || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.clientSummaries?.map((client) => (
                <Link
                  key={client.clientId}
                  href={`/clients/${client.clientId}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{client.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Last active: {client.lastWorkout ? formatDistanceToNow(parseISO(client.lastWorkout), { addSuffix: true }) : 'Never'}
                    </span>
                  </div>
                  <div className="flex space-x-3">
                    {client.assignmentsDue > 0 && (
                      <div className="flex items-center text-orange-500 text-sm">
                        <ActivitySquare className="w-4 h-4 mr-1" /> {client.assignmentsDue}
                      </div>
                    )}
                    {client.unreadMessages && client.unreadMessages > 0 && (
                      <div className="flex items-center text-blue-500 text-sm">
                        <MessageSquare className="w-4 h-4 mr-1" /> {client.unreadMessages}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {(!dashboard.clientSummaries || dashboard.clientSummaries.length === 0) && (
                <div className="text-sm text-muted-foreground">No clients found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentActivity?.map((activity, idx) => (
                <div key={idx} className="flex flex-col border-b last:border-0 pb-3 last:pb-0">
                  <span className="text-sm font-medium">{activity.clientName}</span>
                  <span className="text-sm text-muted-foreground">{activity.description}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
              {(!dashboard.recentActivity || dashboard.recentActivity.length === 0) && (
                <div className="text-sm text-muted-foreground">No recent activity.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
