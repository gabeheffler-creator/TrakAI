import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { WorkoutPage } from "@/pages/workout";
import { WorkoutsPage } from "@/pages/workouts";
import { WorkoutLogDetailPage } from "@/pages/workout-log-detail";
import { MeasurementsPage } from "@/pages/measurements";
import { SleepPage } from "@/pages/sleep";
import { NutritionPage } from "@/pages/nutrition";
import { PhotosPage } from "@/pages/photos";
import { AssignmentsPage } from "@/pages/assignments";
import { MessagesPage } from "@/pages/messages";
import { ProgressPage } from "@/pages/progress";
import { StatsPage } from "@/pages/stats";
import { SoundsPage } from "@/pages/sounds";
import { ExercisesPage } from "@/pages/exercises";
import { SettingsPage } from "@/pages/settings";
import { DataImportPage } from "@/pages/data-import";
import { GoalHistoryPage } from "@/pages/goal-history";
import NotFound from "@/pages/not-found";
import { LoginPage } from "@/pages/login";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient();

export function LogoutButton({ className }: { className?: string }) {
  const { logout } = useAuth();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={logout}
      data-testid="button-logout"
    >
      Log out
    </Button>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Layout>{children}</Layout>;
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Layout><Dashboard /></Layout>;
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/" />;
  return <LoginPage />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginGate} />
      <Route path="/" component={HomeGate} />
      <Route path="/join/:token"><Redirect to="/login" /></Route>
      <Route path="/workout"><Protected><WorkoutPage /></Protected></Route>
      <Route path="/workouts"><Protected><WorkoutsPage /></Protected></Route>
      <Route path="/workouts/:logId"><Protected><WorkoutLogDetailPage /></Protected></Route>
      <Route path="/measurements"><Protected><MeasurementsPage /></Protected></Route>
      <Route path="/sleep"><Protected><SleepPage /></Protected></Route>
      <Route path="/nutrition"><Protected><NutritionPage /></Protected></Route>
      <Route path="/photos"><Protected><PhotosPage /></Protected></Route>
      <Route path="/progress"><Protected><ProgressPage /></Protected></Route>
      <Route path="/stats"><Protected><StatsPage /></Protected></Route>
      <Route path="/assignments"><Protected><AssignmentsPage /></Protected></Route>
      <Route path="/messages"><Protected><MessagesPage /></Protected></Route>
      <Route path="/sounds"><Protected><SoundsPage /></Protected></Route>
      <Route path="/exercises"><Protected><ExercisesPage /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
      <Route path="/data-import"><Protected><DataImportPage /></Protected></Route>
      <Route path="/goal-history"><Protected><GoalHistoryPage /></Protected></Route>
      <Route><Protected><NotFound /></Protected></Route>
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

function Root() {
  return (
    <WouterRouter base={basePath}>
      <App />
    </WouterRouter>
  );
}

export default Root;
