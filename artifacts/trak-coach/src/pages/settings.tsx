import { useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Moon, Sun, Bug, MessageSquare, ChevronRight, CheckCircle, Palette, Save } from "lucide-react";

const BRAND_KEY = "trak_coach_brand";
interface BrandSettings { name: string; tagline: string; primaryColor: string; }
function readBrand(): BrandSettings {
  try { return JSON.parse(localStorage.getItem(BRAND_KEY) ?? "{}"); } catch { return { name: "", tagline: "", primaryColor: "" }; }
}
function saveBrand(b: BrandSettings) { localStorage.setItem(BRAND_KEY, JSON.stringify(b)); }

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

async function submitFeedback(type: "bug" | "feedback", content: string, from: "coach" | "client") {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, content, from }),
  });
  if (!res.ok) throw new Error("Failed to send");
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  const { toast } = useToast();

  const [brand, setBrand] = useState<BrandSettings>(() => {
    const saved = readBrand();
    return { name: saved.name ?? "", tagline: saved.tagline ?? "", primaryColor: saved.primaryColor ?? "" };
  });
  const [brandSaved, setBrandSaved] = useState(false);

  const handleSaveBrand = () => {
    saveBrand(brand);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2000);
  };

  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const [bugText, setBugText] = useState("");
  const [bugPending, setBugPending] = useState(false);
  const [bugSubmitted, setBugSubmitted] = useState(false);

  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleOpenBug = () => { setBugText(""); setBugSubmitted(false); setBugSheetOpen(true); };
  const handleOpenFeedback = () => { setFeedbackText(""); setFeedbackSubmitted(false); setFeedbackSheetOpen(true); };

  const handleSubmitBug = async () => {
    if (!bugText.trim()) return;
    setBugPending(true);
    try {
      await submitFeedback("bug", bugText.trim(), "coach");
      setBugSubmitted(true);
      setBugText("");
      setTimeout(() => { setBugSheetOpen(false); setBugSubmitted(false); }, 1800);
    } catch {
      toast({ title: "Failed to send report", variant: "destructive" });
    } finally {
      setBugPending(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackPending(true);
    try {
      await submitFeedback("feedback", feedbackText.trim(), "coach");
      setFeedbackSubmitted(true);
      setFeedbackText("");
      setTimeout(() => { setFeedbackSheetOpen(false); setFeedbackSubmitted(false); }, 1800);
    } catch {
      toast({ title: "Failed to send feedback", variant: "destructive" });
    } finally {
      setFeedbackPending(false);
    }
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

      {/* ── White Labeling ─────────────────────────── */}
      <SectionHeader title="White Labeling" />
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs text-muted-foreground">Customize how your brand appears to clients.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Brand Name</label>
            <Input
              placeholder="e.g. Alex's Coaching"
              value={brand.name}
              onChange={e => setBrand(b => ({ ...b, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Tagline</label>
            <Input
              placeholder="e.g. Train harder. Live better."
              value={brand.tagline}
              onChange={e => setBrand(b => ({ ...b, tagline: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Brand Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brand.primaryColor || "#000000"}
                onChange={e => setBrand(b => ({ ...b, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <Input
                placeholder="#3b82f6"
                value={brand.primaryColor}
                onChange={e => setBrand(b => ({ ...b, primaryColor: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleSaveBrand}
          variant={brandSaved ? "outline" : "default"}
        >
          {brandSaved ? (
            <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Brand Settings</>
          )}
        </Button>
      </div>

      {/* ── Support ────────────────────────────────── */}
      <SectionHeader title="Support" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="Send feedback"
            description="Share ideas or suggestions with us"
            onClick={handleOpenFeedback}
          />
        </div>
        <div className="px-4">
          <SettingRow
            icon={<Bug className="w-4 h-4" />}
            label="Report a bug"
            description="Something not working? Let us know"
            onClick={handleOpenBug}
          />
        </div>
      </div>

      {/* ── Feedback sheet ────────────────────────── */}
      <Sheet open={feedbackSheetOpen} onOpenChange={open => { if (!open) setFeedbackSheetOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Send feedback</SheetTitle>
          </SheetHeader>

          {feedbackSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-primary" />
              <p className="font-semibold text-sm">Thanks for the feedback!</p>
              <p className="text-xs text-muted-foreground">We'll take a look.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Got an idea or suggestion? We'd love to hear it.
              </p>
              <Textarea
                placeholder="e.g. It would be helpful to bulk-assign programs to multiple clients…"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setFeedbackSheetOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!feedbackText.trim() || feedbackPending} onClick={handleSubmitFeedback}>
                  {feedbackPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Bug report sheet ──────────────────────── */}
      <Sheet open={bugSheetOpen} onOpenChange={open => { if (!open) setBugSheetOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Report a bug</SheetTitle>
          </SheetHeader>

          {bugSubmitted ? (
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
                <Button variant="ghost" size="sm" onClick={() => setBugSheetOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!bugText.trim() || bugPending} onClick={handleSubmitBug}>
                  {bugPending ? "Sending…" : "Send report"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
