import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, useSearch, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { JoinPage } from "@/pages/join";
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
import NotFound from "@/pages/not-found";
import { TrakLogo } from "@/components/trak-logo";

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var, leave
// publishableKey undefined, or replace publishableKeyFromHost with anything else.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV — the empty dev value
// is intentional, and any branching breaks the prod proxy.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const queryClient = new QueryClient();

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#7c3aed",
    colorForeground: "#1f1147",
    colorMutedForeground: "#6b6280",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#1f1147",
    colorNeutral: "#e4e0f5",
    fontFamily: "inherit",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-xl font-bold text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButtonText: "text-sm font-medium text-foreground",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "text-violet-600 hover:text-violet-700 font-medium",
    footerActionText: "text-sm text-muted-foreground",
    dividerText: "text-xs text-muted-foreground",
    identityPreviewEditButton: "text-violet-600",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm text-destructive",
    logoBox: "mb-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-border hover:bg-accent",
    formButtonPrimary: "bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold",
    formFieldInput: "border border-input bg-background text-foreground",
    footerAction: "text-sm",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border border-destructive/30",
    otpCodeFieldInput: "border border-input bg-background text-foreground",
    formFieldRow: "",
    main: "gap-4",
  },
};

function useRedirectUrlParam(): string | undefined {
  const search = useSearch();
  const redirect = new URLSearchParams(search).get("redirect_url");
  return redirect ?? undefined;
}

function SignInPage() {
  const redirectUrl = useRedirectUrlParam();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={redirectUrl ?? (basePath || "/")}
      />
    </div>
  );
}

function SignUpPage() {
  const redirectUrl = useRedirectUrlParam();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={redirectUrl ?? (basePath || "/")}
      />
    </div>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const { signOut } = useClerk();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => signOut({ redirectUrl: basePath || "/" })}
      data-testid="button-logout"
    >
      Log out
    </Button>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClientLanding() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 gap-8 text-center">
      <TrakLogo />
      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">Your training, always in reach</h1>
        <p className="text-muted-foreground">
          Log workouts, track your progress, and stay connected with your coach on TrakAI.
        </p>
      </div>
      <p className="text-sm text-muted-foreground max-w-sm">
        Ask your coach for an invite link to get started, or sign in if you already
        have an account.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <a href={`${basePath}/sign-in`}>Sign in</a>
        </Button>
      </div>
    </div>
  );
}

function HomeGate() {
  return (
    <>
      <Show when="signed-in">
        <Layout><Dashboard /></Layout>
      </Show>
      <Show when="signed-out">
        <ClientLanding />
      </Show>
    </>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeGate} />
      {/* REQUIRED — copy "/sign-in/*?" and "/sign-up/*?" verbatim. */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/join/:token" component={JoinPage} />
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
      <Route><Protected><NotFound /></Protected></Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Trak account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join your coach on TrakAI",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
