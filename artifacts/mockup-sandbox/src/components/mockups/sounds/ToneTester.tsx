import { useState } from "react";

type SoundId =
  | "ding" | "bell" | "chime" | "ping"
  | "clap" | "snap" | "click" | "knock"
  | "pop"  | "blip" | "whoosh" | "beep";

interface Sound {
  id: SoundId;
  label: string;
  emoji: string;
  description: string;
}

const SOUNDS: Sound[] = [
  { id: "ding",   label: "Ding",   emoji: "🔔", description: "Soft bell tone" },
  { id: "bell",   label: "Bell",   emoji: "🎵", description: "Rich, sustaining bell" },
  { id: "chime",  label: "Chime",  emoji: "✨", description: "Airy double-note chime" },
  { id: "ping",   label: "Ping",   emoji: "📡", description: "Sharp, short ping" },
  { id: "clap",   label: "Clap",   emoji: "👏", description: "Hand clap noise burst" },
  { id: "snap",   label: "Snap",   emoji: "🫰", description: "Finger snap click" },
  { id: "click",  label: "Click",  emoji: "🖱️", description: "Clean UI click" },
  { id: "knock",  label: "Knock",  emoji: "🚪", description: "Soft low thud" },
  { id: "pop",    label: "Pop",    emoji: "🫧", description: "Bubble pop sweep" },
  { id: "blip",   label: "Blip",   emoji: "👾", description: "Retro game blip" },
  { id: "whoosh", label: "Whoosh", emoji: "💨", description: "Airy whoosh sweep" },
  { id: "beep",   label: "Beep",   emoji: "📟", description: "Clean sine beep" },
];

function playSound(id: SoundId) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    switch (id) {
      case "ding": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 1760;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        osc.start(t); osc.stop(t + 1.2);
        break;
      }
      case "bell": {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 880;
        osc2.type = "sine"; osc2.frequency.value = 1108;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        osc.start(t); osc.stop(t + 2);
        osc2.start(t); osc2.stop(t + 2);
        break;
      }
      case "chime": {
        const play = (freq: number, when: number, vol: number) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.type = "sine"; osc.frequency.value = freq;
          g.gain.setValueAtTime(vol, when);
          g.gain.exponentialRampToValueAtTime(0.001, when + 1.2);
          osc.start(when); osc.stop(when + 1.3);
        };
        play(1760, t, 0.3);
        play(1319, t + 0.18, 0.25);
        break;
      }
      case "ping": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 2400;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
        break;
      }
      case "clap": {
        const bufLen = ctx.sampleRate * 0.08;
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = buf;
        filter.type = "bandpass"; filter.frequency.value = 1200; filter.Q.value = 0.8;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.start(t);
        break;
      }
      case "snap": {
        const bufLen = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = buf;
        filter.type = "highpass"; filter.frequency.value = 2000;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.start(t);
        break;
      }
      case "click": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square"; osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.05);
        break;
      }
      case "knock": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.2);
        break;
      }
      case "pop": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.15);
        break;
      }
      case "blip": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square"; osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t); osc.stop(t + 0.12);
        break;
      }
      case "whoosh": {
        const bufLen = Math.floor(ctx.sampleRate * 0.3);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = buf;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
        filter.Q.value = 2;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.setValueAtTime(0.25, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        src.start(t);
        break;
      }
      case "beep": {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.setValueAtTime(0.25, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.2);
        break;
      }
    }
    setTimeout(() => ctx.close(), 2500);
  } catch {}
}

function playWorkoutComplete() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const bell = (fundamental: number, partial: number, start: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
      osc1.type = "sine"; osc1.frequency.value = fundamental;
      osc2.type = "sine"; osc2.frequency.value = partial;
      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.8);
      osc1.start(start); osc1.stop(start + 2);
      osc2.start(start); osc2.stop(start + 2);
    };
    bell(880, 1108, t);
    bell(988, 1244, t + 0.35);
    setTimeout(() => ctx.close(), 2500);
  } catch {}
}

function SoundCard({
  sound,
  selected,
  onTap,
}: {
  sound: Sound;
  selected: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "12px 8px",
        borderRadius: 14,
        border: selected ? "2px solid #7c3aed" : "2px solid #e2e8f0",
        background: selected ? "#ede9fe" : "#f8fafc",
        cursor: "pointer",
        transition: "all 0.12s",
        minWidth: 68,
        flex: "1 1 68px",
      }}
    >
      <span style={{ fontSize: 22 }}>{sound.emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? "#7c3aed" : "#334155" }}>
        {sound.label}
      </span>
      <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", lineHeight: 1.3 }}>
        {sound.description}
      </span>
    </button>
  );
}

export function ToneTester() {
  const [setComplete, setSetComplete] = useState<SoundId>("ding");
  const [rpeConfirm, setRpeConfirm]   = useState<SoundId>("chime");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "32px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 24 }}>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>Sound Tester</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Click any sound to hear it — pick one for each event</div>
        </div>

        {/* Set complete */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Set complete</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Plays when you finish a set</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SOUNDS.map(s => (
              <SoundCard key={s.id} sound={s} selected={setComplete === s.id}
                onTap={() => { setSetComplete(s.id); playSound(s.id); }} />
            ))}
          </div>
        </div>

        {/* RPE confirm */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>RPE confirmed</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Plays when you lock in your RPE rating</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SOUNDS.map(s => (
              <SoundCard key={s.id} sound={s} selected={rpeConfirm === s.id}
                onTap={() => { setRpeConfirm(s.id); playSound(s.id); }} />
            ))}
          </div>
        </div>

        {/* Workout complete */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Workout complete</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Bell × 2 — ascending whole tone (A5 → B5)</div>
          <button
            onClick={playWorkoutComplete}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background: "#7c3aed",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>🏆</span> Preview workout complete
          </button>
        </div>

        <div style={{ background: "#f1f5f9", borderRadius: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Tell me what to hardcode</div>
          <div style={{ fontSize: 13, color: "#475569", fontFamily: "monospace" }}>
            Set complete: <strong>{setComplete}</strong><br />
            RPE confirmed: <strong>{rpeConfirm}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
