import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { WorkoutPage } from "@/pages/workout";
import { CalendarPage } from "@/pages/calendar";
import { ExercisesPage } from "@/pages/exercises";
import { NutritionPage } from "@/pages/nutrition";
import { StatsPage } from "@/pages/stats";
import { SleepPage } from "@/pages/sleep";
import { MessagesPage } from "@/pages/messages";
import { SettingsPage } from "@/pages/settings";
import { TasksPage } from "@/pages/tasks";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const queryClient = new QueryClient();

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

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginGate} />
      <Route path="/" component={HomeGate} />
      <Route path="/workout"><Protected><WorkoutPage /></Protected></Route>
      <Route path="/calendar"><Protected><CalendarPage /></Protected></Route>
      <Route path="/exercises"><Protected><ExercisesPage /></Protected></Route>
      <Route path="/nutrition"><Protected><NutritionPage /></Protected></Route>
      <Route path="/stats"><Protected><StatsPage /></Protected></Route>
      <Route path="/sleep"><Protected><SleepPage /></Protected></Route>
      <Route path="/messages"><Protected><MessagesPage /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
      <Route path="/tasks"><Protected><TasksPage /></Protected></Route>
      <Route><Protected><NotFound /></Protected></Route>
    </Switch>
  );
}

function AppInner() {
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

// ─── Phone shell wrapper ──────────────────────────────────────────────────────

export default function App() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a14",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: 390,
          height: "min(844px, 96dvh)",
          borderRadius: 44,
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.03)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "hsl(var(--background))",
          position: "relative",
        }}
      >
        <WouterRouter base={basePath}>
          <AppInner />
        </WouterRouter>
      </div>
    </div>
  );
}
