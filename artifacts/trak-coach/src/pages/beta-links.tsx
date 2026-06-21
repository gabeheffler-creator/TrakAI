import { useState } from "react";
import { Copy, Check } from "lucide-react";

const BASE = "https://89721f86-c002-40f6-9c52-d2942aaac485-00-2nhv1zd8uyoub.riker.replit.dev";

const LINKS = [
  {
    label: "Coach App",
    description: "Full coach dashboard — clients, programs, messages",
    url: `${BASE}/`,
    color: "bg-violet-600",
  },
  {
    label: "Client App",
    description: "Logs in as Alex Johnson — no invite code needed",
    url: `${BASE}/client/join/b80a93d09ed4e8df303210c9c7f94033?auto=1`,
    color: "bg-blue-600",
  },
];

function CopyLinkCard({ label, description, url, color }: typeof LINKS[0]) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
        <p className="text-xs text-muted-foreground font-mono flex-1 truncate">{url}</p>
      </div>

      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
          copied
            ? "bg-green-600 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {copied ? (
          <><Check className="w-4 h-4" /> Copied!</>
        ) : (
          <><Copy className="w-4 h-4" /> Copy Link</>
        )}
      </button>
    </div>
  );
}

export function BetaLinksPage() {
  return (
    <div className="max-w-md mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Beta Access Links</h1>
        <p className="text-sm text-muted-foreground mt-1">Share these with your beta testers. Each link opens the app directly — no signup needed.</p>
      </div>

      <div className="space-y-4">
        {LINKS.map(l => <CopyLinkCard key={l.label} {...l} />)}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        These links give full access to the beta version of TrakAI.
      </p>
    </div>
  );
}
