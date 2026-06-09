import { useDarkMode } from "@/hooks/use-dark-mode";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useWorkoutPrefs } from "@/hooks/use-workout-prefs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Sun, Ruler, Dumbbell, BarChart2 } from "lucide-react";

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-6 pb-1 first:pt-0">
      {title}
    </p>
  );
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  const { units, setUnits } = useUnitSystem();
  const { workoutView, setWorkoutView, showProgressBar, setShowProgressBar } = useWorkoutPrefs();

  return (
    <div className="max-w-lg mx-auto space-y-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your experience</p>
      </div>

      {/* ── Appearance ─────────────────────────────── */}
      <SectionHeader title="Appearance" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            label="Dark mode"
            description="Switch between light and dark theme"
          >
            <Switch checked={dark} onCheckedChange={toggle} />
          </SettingRow>
        </div>
      </div>

      {/* ── Measurements ───────────────────────────── */}
      <SectionHeader title="Measurements" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Ruler className="w-4 h-4" />}
            label="Unit system"
            description="Affects weight and body measurements"
          >
            <Select value={units} onValueChange={v => setUnits(v as "imperial" | "metric")}>
              <SelectTrigger className="w-[120px] text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Imperial</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* ── Workout ────────────────────────────────── */}
      <SectionHeader title="Workout" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Dumbbell className="w-4 h-4" />}
            label="Exercise view"
            description="How exercises are shown during a workout"
          >
            <Select
              value={workoutView}
              onValueChange={v => setWorkoutView(v as "one-at-a-time" | "list")}
            >
              <SelectTrigger className="w-[140px] text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-at-a-time">One at a time</SelectItem>
                <SelectItem value="list">Full list</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<BarChart2 className="w-4 h-4" />}
            label="Progress bar"
            description="Show workout progress bar at the top"
          >
            <Switch checked={showProgressBar} onCheckedChange={setShowProgressBar} />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
