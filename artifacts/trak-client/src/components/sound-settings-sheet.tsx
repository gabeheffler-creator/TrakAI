import { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";

export const NOTES = [
  { label: "C5",  freq: 523  },
  { label: "D5",  freq: 587  },
  { label: "E5",  freq: 659  },
  { label: "G5",  freq: 784  },
  { label: "A5",  freq: 880  },
  { label: "B5",  freq: 988  },
  { label: "C6",  freq: 1047 },
  { label: "D6",  freq: 1175 },
  { label: "E6",  freq: 1319 },
  { label: "G6",  freq: 1568 },
  { label: "A6",  freq: 1760 },
  { label: "B6",  freq: 1976 },
  { label: "C7",  freq: 2093 },
];

const KEY_RING  = "trak_sound_ring";
const KEY_DING1 = "trak_sound_ding1";
const KEY_DING2 = "trak_sound_ding2";

export function readSoundSettings() {
  return {
    ring:  parseInt(localStorage.getItem(KEY_RING)  ?? "1760"),
    ding1: parseInt(localStorage.getItem(KEY_DING1) ?? "1760"),
    ding2: parseInt(localStorage.getItem(KEY_DING2) ?? "1319"),
  };
}

function saveSoundSettings(ring: number, ding1: number, ding2: number) {
  localStorage.setItem(KEY_RING,  String(ring));
  localStorage.setItem(KEY_DING1, String(ding1));
  localStorage.setItem(KEY_DING2, String(ding2));
}

function singleDing(freq: number, volume = 0.38, decay = 1.2) {
  try {
    const ctx = new AudioContext();
    const t   = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.start(t);
    osc.stop(t + decay);
    osc.onended = () => ctx.close();
  } catch {}
}

export function playRingSetting()  { singleDing(readSoundSettings().ring); }

export function playConfirmSetting() {
  try {
    const { ding1, ding2 } = readSoundSettings();
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    const mk = (freq: number, start: number, vol: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
      osc.start(start);
      osc.stop(start + 0.9);
    };

    mk(ding1, t,        0.28);
    mk(ding2, t + 0.18, 0.24);
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

function NoteGrid({
  selected,
  onChange,
  accent,
}: {
  selected: number;
  onChange: (freq: number) => void;
  accent: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTES.map(n => {
        const isSelected = n.freq === selected;
        return (
          <button
            key={n.freq}
            onClick={() => {
              onChange(n.freq);
              singleDing(n.freq, 0.28, 0.9);
            }}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95",
              isSelected
                ? cn("border-transparent text-white", accent)
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            {n.label}
          </button>
        );
      })}
    </div>
  );
}

export function SoundSettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [ring,  setRing ] = useState(() => readSoundSettings().ring);
  const [ding1, setDing1] = useState(() => readSoundSettings().ding1);
  const [ding2, setDing2] = useState(() => readSoundSettings().ding2);

  const handleDone = () => {
    saveSoundSettings(ring, ding1, ding2);
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleDone}
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl px-6 pt-4 pb-10 transition-transform duration-300 ease-out shadow-2xl overflow-y-auto max-h-[90dvh]",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-2 mb-6">
          <Volume2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Sound Settings</h2>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold mb-1">Set complete</p>
            <p className="text-xs text-muted-foreground mb-2">Single ding when you log a set</p>
            <NoteGrid selected={ring} onChange={setRing} accent="bg-primary" />
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">RPE confirmed — 1st ding</p>
            <p className="text-xs text-muted-foreground mb-2">Higher note</p>
            <NoteGrid selected={ding1} onChange={setDing1} accent="bg-violet-600" />
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">RPE confirmed — 2nd ding</p>
            <p className="text-xs text-muted-foreground mb-2">Lower note (plays 180ms after first)</p>
            <NoteGrid selected={ding2} onChange={setDing2} accent="bg-violet-400" />
          </div>
        </div>

        <button
          className="mt-6 w-full py-3 rounded-2xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors active:scale-[0.98]"
          onClick={() => {
            const ctx = new AudioContext();
            const t = ctx.currentTime;
            const mk = (freq: number, start: number, vol: number) => {
              const osc  = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, start);
              gain.gain.setValueAtTime(vol, start);
              gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
              osc.start(start);
              osc.stop(start + 0.9);
            };
            mk(ding1, t, 0.28);
            mk(ding2, t + 0.18, 0.24);
            setTimeout(() => ctx.close(), 1200);
          }}
        >
          ▶ Preview RPE chime
        </button>

        <button
          onClick={handleDone}
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Done
        </button>
      </div>
    </>
  );
}
