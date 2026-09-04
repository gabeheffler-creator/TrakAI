import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { ClientList } from "@/pages/clients";
import { ClientProfile } from "@/pages/client-profile";
import { GoalHistoryPage } from "@/pages/goal-history";
import { Programs } from "@/pages/programs";
import { ProgramBuilder } from "@/pages/program-builder";
import { Exercises } from "@/pages/exercises";
import { Messages } from "@/pages/messages";
import { SettingsPage } from "@/pages/settings";
import { LoginPage } from "@/pages/login";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { ResetPasswordPage } from "@/pages/reset-password";
import { VerifyEmailPage } from "@/pages/verify-email";
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
      <Route path="/clients"><Protected><ClientList /></Protected></Route>
      <Route path="/clients/:clientId/goal-history"><Protected><GoalHistoryPage /></Protected></Route>
      <Route path="/clients/:clientId"><Protected><ClientProfile /></Protected></Route>
      <Route path="/programs"><Protected><Programs /></Protected></Route>
      <Route path="/programs/:programId"><Protected><ProgramBuilder /></Protected></Route>
      <Route path="/exercises"><Protected><Exercises /></Protected></Route>
      <Route path="/messages"><Protected><Messages /></Protected></Route>
      <Route path="/messages/:clientId"><Protected><Messages /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
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
