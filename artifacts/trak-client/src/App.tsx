import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { JoinPage } from "@/pages/join";
import { Dashboard } from "@/pages/dashboard";
import { WorkoutPage } from "@/pages/workout";
import { WorkoutsPage } from "@/pages/workouts";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/join/:token" component={JoinPage} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/workout" component={WorkoutPage} />
            <Route path="/workouts" component={WorkoutsPage} />
            <Route path="/measurements" component={MeasurementsPage} />
            <Route path="/sleep" component={SleepPage} />
            <Route path="/nutrition" component={NutritionPage} />
            <Route path="/photos" component={PhotosPage} />
            <Route path="/progress" component={ProgressPage} />
            <Route path="/stats" component={StatsPage} />
            <Route path="/assignments" component={AssignmentsPage} />
            <Route path="/messages" component={MessagesPage} />
            <Route path="/sounds" component={SoundsPage} />
            <Route path="/exercises" component={ExercisesPage} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
