import { useState, useEffect, useRef } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useUnitSystem } from "@/hooks/use-unit-system";
import { useCallPrefs } from "@/hooks/use-call-prefs";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Moon, Sun, Bug, MessageSquare, ChevronRight, CheckCircle,
  Save, Ruler, ClipboardList, FileText, Upload, Loader2, ImageIcon, Timer,
  Bell, MessageCircle, ClipboardCheck, Dumbbell, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BRAND_KEY = "trak_coach_brand";
interface BrandSettings { name: string; tagline: string; primaryColor: string; logoPath?: string; }

function readBrand(): BrandSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRAND_KEY) ?? "{}");
    return {
      name: parsed.name ?? "",
      tagline: parsed.tagline ?? "",
      primaryColor: parsed.primaryColor ?? "",
      logoPath: parsed.logoPath,
    };
  } catch { return { name: "", tagline: "", primaryColor: "" }; }
}
function saveBrand(b: BrandSettings) { localStorage.setItem(BRAND_KEY, JSON.stringify(b)); }

async function fetchAppSettings() {
  const res = await fetch("/api/coach/app-settings");
  if (!res.ok) return {};
  return res.json();
}

async function patchAppSettings(patch: Record<string, unknown>) {
  const res = await fetch("/api/coach/app-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

async function submitFeedback(type: "bug" | "feedback", content: string, from: "coach" | "client") {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, content, from }),
  });
  if (!res.ok) throw new Error("Failed to send");
}

function SettingRow({
  icon, label, description, children, onClick,
}: {
  icon: React.ReactNode; label: string; description?: string; children?: React.ReactNode; onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground dark:text-gray-200 mt-0.5">{description}</p>}
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
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground dark:text-white pt-6 pb-1 first:pt-0">
      {title}
    </p>
  );
}

export function SettingsPage() {
  const { dark, toggle } = useDarkMode();
  const { units, setUnits } = useUnitSystem();
  const { autoCallLog, autoCallNotes, reviewCallNotes, setAutoCallLog, setAutoCallNotes, setReviewCallNotes } = useCallPrefs();
  const { toast } = useToast();

  const [brand, setBrand] = useState<BrandSettings>(() => readBrand());
  const [brandSaved, setBrandSaved] = useState(false);

  const [defaultRestSeconds, setDefaultRestSeconds] = useState<string>("none");
  const [restSaved, setRestSaved] = useState(false);

  // ── Notification preferences ──────────────────────────────────────────────
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifTasks, setNotifTasks]       = useState(true);
  const [notifWorkouts, setNotifWorkouts] = useState(true);
  const [quietStart, setQuietStart]       = useState("");
  const [quietEnd, setQuietEnd]           = useState("");
  const [quietEnabled, setQuietEnabled]   = useState(false);

  useEffect(() => {
    fetchAppSettings().then((s: Record<string, unknown>) => {
      if (s.defaultRestSeconds != null) setDefaultRestSeconds(String(s.defaultRestSeconds));
      if (s.notifMessages === false) setNotifMessages(false);
      if (s.notifTasks    === false) setNotifTasks(false);
      if (s.notifWorkouts === false) setNotifWorkouts(false);
      if (typeof s.quietHoursStart === "string") { setQuietStart(s.quietHoursStart); }
      if (typeof s.quietHoursEnd   === "string") { setQuietEnd(s.quietHoursEnd); }
      if (s.quietHoursStart && s.quietHoursEnd) setQuietEnabled(true);
    }).catch(() => {});
  }, []);

  const saveNotifToggle = async (key: string, value: boolean) => {
    await patchAppSettings({ [key]: value }).catch(() => {
      toast({ title: "Failed to save notification setting", variant: "destructive" });
    });
  };

  const saveQuietHours = async (start: string, end: string, enabled: boolean) => {
    await patchAppSettings({
      quietHoursStart: enabled ? start : null,
      quietHoursEnd:   enabled ? end   : null,
    }).catch(() => {
      toast({ title: "Failed to save quiet hours", variant: "destructive" });
    });
  };

  const handleSaveRestDefault = async () => {
    const value = defaultRestSeconds === "none" ? null : Number(defaultRestSeconds);
    try {
      await patchAppSettings({ defaultRestSeconds: value });
      setRestSaved(true);
      setTimeout(() => setRestSaved(false), 2000);
    } catch {
      toast({ title: "Failed to save rest default", variant: "destructive" });
    }
  };

  const handleSaveBrand = async () => {
    saveBrand(brand);
    try {
      await patchAppSettings({ brandName: brand.name, brandTagline: brand.tagline });
    } catch { /* non-fatal — localStorage already saved */ }
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2000);
  };

  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [logoSelectedFile, setLogoSelectedFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoSelectedFile(file);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleLogoUpload = async () => {
    if (!logoSelectedFile) return;
    setLogoUploading(true);
    try {
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: logoSelectedFile.name, contentType: logoSelectedFile.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, objectPath } = await urlRes.json() as { uploadUrl: string; objectPath: string };

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": logoSelectedFile.type },
        body: logoSelectedFile,
      });

      await patchAppSettings({ logoPath: objectPath });

      const newBrand = { ...brand, logoPath: objectPath };
      saveBrand(newBrand);
      setBrand(newBrand);
      window.dispatchEvent(new Event("trak-logo-updated"));

      setLogoDialogOpen(false);
      setLogoPreviewUrl(null);
      setLogoSelectedFile(null);
      toast({ title: "Logo uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
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
        <p className="text-sm text-muted-foreground dark:text-gray-200 mt-1">Customize your experience</p>
      </div>

      {/* ── Appearance ─────────────────────────────────────────────── */}
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

      {/* ── Measurements ───────────────────────────────────────────── */}
      <SectionHeader title="Measurements" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<Ruler className="w-4 h-4" />}
            label="Unit system"
            description="Affects how weights and measurements are displayed"
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

      {/* ── White Labeling ─────────────────────────────────────────── */}
      <SectionHeader title="White Labeling" />
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs text-muted-foreground dark:text-gray-200">Customize how your brand appears to clients.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground dark:text-gray-200 uppercase tracking-wide mb-1.5 block">Brand Name</label>
            <Input
              placeholder="e.g. Alex's Coaching"
              value={brand.name}
              onChange={e => setBrand(b => ({ ...b, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground dark:text-gray-200 uppercase tracking-wide mb-1.5 block">Tagline</label>
            <Input
              placeholder="e.g. Train harder. Live better."
              value={brand.tagline}
              onChange={e => setBrand(b => ({ ...b, tagline: e.target.value }))}
            />
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground dark:text-gray-200 uppercase tracking-wide block">Coach Logo</label>
          {brand.logoPath && (
            <div className="flex justify-center p-3 bg-muted/40 rounded-xl border border-border">
              <img
                src={`/api/storage${brand.logoPath}`}
                alt="Coach logo"
                className="h-14 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setLogoDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            {brand.logoPath ? "Replace logo" : "Upload logo"}
          </Button>
          <p className="text-xs text-muted-foreground dark:text-gray-200">
            Your logo will appear under the Trak logo in both the coach and client apps.
          </p>
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

      {/* ── Calls ──────────────────────────────────────────────────── */}
      <SectionHeader title="Calls" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<ClipboardList className="w-4 h-4" />}
            label="Auto call log"
            description="Automatically log a record for each video call"
          >
            <Switch checked={autoCallLog} onCheckedChange={setAutoCallLog} />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<FileText className="w-4 h-4" />}
            label="Auto call notes"
            description="Automatically generate notes from each call"
          >
            <Switch checked={autoCallNotes} onCheckedChange={setAutoCallNotes} />
          </SettingRow>
        </div>
        <div className={["px-4", !autoCallNotes && "opacity-50 pointer-events-none"].filter(Boolean).join(" ")}>
          <SettingRow
            icon={<FileText className="w-4 h-4" />}
            label="Review notes before saving"
            description={autoCallNotes ? "Show a review dialog after each call so you can approve, edit, or delete the note" : "Requires Auto call notes"}
          >
            <Switch
              checked={reviewCallNotes && autoCallNotes}
              onCheckedChange={setReviewCallNotes}
              disabled={!autoCallNotes}
            />
          </SettingRow>
        </div>
      </div>

      {/* ── Notifications ─────────────────────────────────────────── */}
      <SectionHeader title="Notifications" />
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="px-4">
          <SettingRow
            icon={<MessageCircle className="w-4 h-4" />}
            label="New client messages"
            description="Push alert when a client sends you a message"
          >
            <Switch
              checked={notifMessages}
              onCheckedChange={v => {
                setNotifMessages(v);
                saveNotifToggle("notifMessages", v);
              }}
            />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<ClipboardCheck className="w-4 h-4" />}
            label="Task submissions"
            description="Push alert when a client submits or resubmits a task"
          >
            <Switch
              checked={notifTasks}
              onCheckedChange={v => {
                setNotifTasks(v);
                saveNotifToggle("notifTasks", v);
              }}
            />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<Dumbbell className="w-4 h-4" />}
            label="Workout check-ins"
            description="Push alert when a client logs a completed workout"
          >
            <Switch
              checked={notifWorkouts}
              onCheckedChange={v => {
                setNotifWorkouts(v);
                saveNotifToggle("notifWorkouts", v);
              }}
            />
          </SettingRow>
        </div>
        <div className="px-4">
          <SettingRow
            icon={<Clock className="w-4 h-4" />}
            label="Quiet hours"
            description="Suppress all push during this window"
          >
            <Switch
              checked={quietEnabled}
              onCheckedChange={v => {
                setQuietEnabled(v);
                const s = quietStart || "22:00";
                const e = quietEnd   || "07:00";
                if (v) { setQuietStart(s); setQuietEnd(e); }
                saveQuietHours(s, e, v);
              }}
            />
          </SettingRow>
        </div>
        {quietEnabled && (
          <div className="px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">From</span>
            <input
              type="time"
              value={quietStart}
              onChange={e => setQuietStart(e.target.value)}
              onBlur={() => saveQuietHours(quietStart, quietEnd, quietEnabled)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="time"
              value={quietEnd}
              onChange={e => setQuietEnd(e.target.value)}
              onBlur={() => saveQuietHours(quietStart, quietEnd, quietEnabled)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* ── Workout Defaults ───────────────────────────────────────── */}
      <SectionHeader title="Workout Defaults" />
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <p className="text-xs text-muted-foreground dark:text-gray-200">
          Applied to exercises that don't have a specific rest time set in the program.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground dark:text-gray-200 uppercase tracking-wide block">
            Default rest between sets
          </label>
          <Select value={defaultRestSeconds} onValueChange={setDefaultRestSeconds}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No default (timer hidden)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default — timer hidden</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="45">45 seconds</SelectItem>
              <SelectItem value="60">60 seconds</SelectItem>
              <SelectItem value="90">90 seconds</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="180">3 minutes</SelectItem>
              <SelectItem value="240">4 minutes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground dark:text-gray-200">
            Clients will see a rest timer with this duration after each set, unless the exercise already has a rest time configured.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleSaveRestDefault}
          variant={restSaved ? "outline" : "default"}
        >
          {restSaved ? (
            <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Saved!</>
          ) : (
            <><Timer className="w-4 h-4 mr-2" /> Save Rest Default</>
          )}
        </Button>
      </div>

      {/* ── Support ────────────────────────────────────────────────── */}
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

      {/* ── Logo upload dialog ──────────────────────────────────────── */}
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoFileSelect}
      />
      <Dialog open={logoDialogOpen} onOpenChange={open => {
        if (!open) { setLogoPreviewUrl(null); setLogoSelectedFile(null); }
        setLogoDialogOpen(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload logo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {logoPreviewUrl ? (
              <div className="flex justify-center p-4 bg-muted/40 rounded-xl border border-border">
                <img src={logoPreviewUrl} alt="Preview" className="h-20 object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-8 bg-muted/30 rounded-xl border border-dashed border-border text-muted-foreground">
                <ImageIcon className="w-8 h-8" />
                <p className="text-xs">No image selected</p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logoFileInputRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {logoPreviewUrl ? "Choose different image" : "Choose image"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              PNG, JPG, or SVG. Will appear under the Trak logo in both apps.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => { setLogoDialogOpen(false); setLogoPreviewUrl(null); setLogoSelectedFile(null); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!logoSelectedFile || logoUploading}
              onClick={handleLogoUpload}
            >
              {logoUploading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Feedback sheet ─────────────────────────────────────────── */}
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
              <p className="text-sm text-muted-foreground">Got an idea or suggestion? We'd love to hear it.</p>
              <Textarea
                placeholder="e.g. It would be helpful to bulk-assign programs to multiple clients…"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setFeedbackSheetOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={!feedbackText.trim() || feedbackPending} onClick={handleSubmitFeedback}>
                  {feedbackPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Bug report sheet ───────────────────────────────────────── */}
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
              <p className="text-sm text-muted-foreground">Describe what happened and what you expected to happen.</p>
              <Textarea
                placeholder="e.g. The program builder doesn't save when I click Save…"
                value={bugText}
                onChange={e => setBugText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setBugSheetOpen(false)}>Cancel</Button>
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
