import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";

export function EnterCodePage() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError("Code not recognised. Double-check with your coach and try again.");
        return;
      }
      setLocation(`/join/${encodeURIComponent(trimmed)}`);
    } catch {
      setError("Unable to verify the code. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-baseline gap-0 mb-4">
            <span className="text-3xl font-black tracking-tight text-foreground leading-none">Trak</span>
            <span className="text-3xl font-light tracking-tight text-violet-500 leading-none">AI</span>
          </div>
          <h1 className="text-2xl font-bold">Enter your access code</h1>
          <p className="text-sm text-muted-foreground">
            Your coach will share this code with you when they add you to TrakAI.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">Access Code</Label>
            <Input
              id="code"
              value={code}
              onChange={e => setCode(e.target.value.toLowerCase())}
              placeholder="Paste your code here"
              className="h-12 font-mono text-base tracking-wider"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 font-bold"
            disabled={!code.trim() || loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Join TrakAI <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Don't have a code?{" "}
          <span className="text-foreground font-medium">Ask your coach to add you.</span>
        </p>
      </div>
    </div>
  );
}
