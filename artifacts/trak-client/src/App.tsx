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

import { MessagesPage } from "@/pages/messages";
import { StatsPage } from "@/pages/stats";
import { SoundsPage } from "@/pages/sounds";
import { ExercisesPage } from "@/pages/exercises";
import { SettingsPage } from "@/pages/settings";
import { DataImportPage } from "@/pages/data-import";
import { GoalHistoryPage } from "@/pages/goal-history";
import { TasksPage } from "@/pages/tasks";
import { CalendarPage } from "@/pages/calendar";
import NotFound from "@/pages/not-found";
import { LoginPage } from "@/pages/login";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { ResetPasswordPage } from "@/pages/reset-password";
import { VerifyEmailPage } from "@/pages/verify-email";
import { InviteRegistrationPage } from "@/pages/invite-registration";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Native Capacitor builds use a relative asset base ("./"), but Wouter route
// bases must be URL paths. Treat that asset-only value as the root route.
const basePath = import.meta.env.BASE_URL === "./"
  ? ""
  : import.meta.env.BASE_URL.replace(/\/$/, "");

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
  if (!user) {
    const returnTo = window.location.pathname.replace(basePath, "") + window.location.search;
    const encoded = encodeURIComponent(returnTo);
    return <Redirect to={`/login?returnTo=${encoded}`} />;
  }
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

function ForgotPasswordGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/" />;
  return <ForgotPasswordPage />;
}

function ResetPasswordGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/" />;
  return <ResetPasswordPage />;
}

function VerifyEmailGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/" />;
  return <VerifyEmailPage />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginGate} />
      <Route path="/forgot-password" component={ForgotPasswordGate} />
      <Route path="/reset-password" component={ResetPasswordGate} />
      <Route path="/verify-email" component={VerifyEmailGate} />
      <Route path="/" component={HomeGate} />
      <Route path="/join/:token">
        {(params) => <InviteRegistrationPage token={params.token} />}
      </Route>
      <Route path="/workout"><Protected><WorkoutPage /></Protected></Route>
      <Route path="/workouts"><Protected><WorkoutsPage /></Protected></Route>
      <Route path="/workouts/:logId"><Protected><WorkoutLogDetailPage /></Protected></Route>
      <Route path="/measurements"><Protected><MeasurementsPage /></Protected></Route>
      <Route path="/sleep"><Protected><SleepPage /></Protected></Route>
      <Route path="/nutrition"><Protected><NutritionPage /></Protected></Route>
      <Route path="/photos"><Redirect to="/stats" /></Route>
      <Route path="/progress"><Redirect to="/stats" /></Route>
      <Route path="/stats"><Protected><StatsPage /></Protected></Route>

      <Route path="/messages"><Protected><MessagesPage /></Protected></Route>
      <Route path="/sounds"><Protected><SoundsPage /></Protected></Route>
      <Route path="/exercises"><Protected><ExercisesPage /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
      <Route path="/data-import"><Protected><DataImportPage /></Protected></Route>
      <Route path="/goal-history"><Protected><GoalHistoryPage /></Protected></Route>
      <Route path="/assignments"><Redirect to="/tasks" /></Route>
      <Route path="/tasks"><Protected><TasksPage /></Protected></Route>
      <Route path="/calendar"><Protected><CalendarPage /></Protected></Route>
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
