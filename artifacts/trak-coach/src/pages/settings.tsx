import { useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Moon, Sun, Bug, ChevronRight, CheckCircle } from "lucide-react";

function SettingRow({
  icon,
  label,
  description,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
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
      <div className="flex-shrink-0 flex items-center gap-1">
        {children}
        {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left hover:bg-muted/30 transition-colors rounded-xl">
        {inner}
      </button>
    );
  }

  return inner;
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
  const { toast } = useToast();

  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugText, setBugText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleOpenBug = () => {
    setBugText("");
    setSubmitted(false);
    setBugDialogOpen(true);
  };

  const handleSubmitBug = () => {
    if (!bugText.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setBugText("");
      setTimeout(() => {
        setBugDialogOpen(false);
        setSubmitted(false);
      }, 1800);
    }, 600);
  };

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

      {/* ── Support ────────────────────────────────── */}
      <SectionHeader title="Support" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Bug className="w-4 h-4" />}
            label="Report a bug"
            description="Something not working? Let us know"
            onClick={handleOpenBug}
          />
        </div>
      </div>

      {/* ── Bug report dialog ─────────────────────── */}
      <Dialog open={bugDialogOpen} onOpenChange={open => { if (!open) setBugDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report a bug</DialogTitle>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the report!</p>
              <p className="text-xs text-muted-foreground">We'll look into it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe what happened and what you expected to happen.
              </p>
              <Textarea
                placeholder="e.g. The program builder doesn't save when I click Save…"
                value={bugText}
                onChange={e => setBugText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setBugDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!bugText.trim() || submitting}
                  onClick={handleSubmitBug}
                >
                  {submitting ? "Sending…" : "Send report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
