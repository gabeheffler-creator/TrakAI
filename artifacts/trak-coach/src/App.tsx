import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { ClientList } from "@/pages/clients";
import { ClientProfile } from "@/pages/client-profile";
import { Programs } from "@/pages/programs";
import { ProgramBuilder } from "@/pages/program-builder";
import { Exercises } from "@/pages/exercises";
import { Messages } from "@/pages/messages";
import { SettingsPage } from "@/pages/settings";
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

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
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

function CoachLanding() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 gap-8 text-center">
      <TrakLogo />
      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">Coach your clients, all in one place</h1>
        <p className="text-muted-foreground">
          Build programs, message clients, and track their progress with TrakAI.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <a href={`${basePath}/sign-in`}>Sign in</a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={`${basePath}/sign-up`}>Create account</a>
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
        <CoachLanding />
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
      <Route path="/clients"><Protected><ClientList /></Protected></Route>
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
            title: "Welcome back, coach",
            subtitle: "Sign in to manage your clients",
          },
        },
        signUp: {
          start: {
            title: "Create your coach account",
            subtitle: "Start coaching with TrakAI",
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
