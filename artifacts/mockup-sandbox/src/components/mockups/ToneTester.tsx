import { useState } from "react";

const NOTES = [
  { label: "C5",  freq: 523  },
  { label: "D5",  freq: 587  },
  { label: "E5",  freq: 659  },
  { label: "F5",  freq: 698  },
  { label: "G5",  freq: 784  },
  { label: "A5",  freq: 880  },
  { label: "B5",  freq: 988  },
  { label: "C6",  freq: 1047 },
  { label: "D6",  freq: 1175 },
  { label: "E6",  freq: 1319 },
  { label: "F6",  freq: 1397 },
  { label: "G6",  freq: 1568 },
  { label: "A6",  freq: 1760 },
  { label: "B6",  freq: 1976 },
  { label: "C7",  freq: 2093 },
];

function ding(freq: number, start: number, ctx: AudioContext, volume = 0.35, decay = 1.1) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
  osc.start(start);
  osc.stop(start + decay);
}

function playSingle(freq: number) {
  try {
    const ctx = new AudioContext();
    ding(freq, ctx.currentTime, ctx);
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function playChime(freq1: number, freq2: number) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    ding(freq1, t,        ctx, 0.35, 1.1);
    ding(freq2, t + 0.18, ctx, 0.28, 1.1);
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function NoteButton({
  note,
  selected,
  color,
  onTap,
}: {
  note: { label: string; freq: number };
  selected: boolean;
  color: string;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: selected ? "2px solid transparent" : "2px solid #e2e8f0",
        background: selected ? color : "#f8fafc",
        color: selected ? "#fff" : "#1e293b",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {note.label}
    </button>
  );
}

export function ToneTester() {
  const [ringNote,  setRingNote ] = useState(NOTES.find(n => n.freq === 1760)!);
  const [chime1,    setChime1   ] = useState(NOTES.find(n => n.freq === 1760)!);
  const [chime2,    setChime2   ] = useState(NOTES.find(n => n.freq === 1319)!);

  const interval = (() => {
    const semitones = Math.round(12 * Math.log2(chime1.freq / chime2.freq));
    const abs = Math.abs(semitones);
    const names: Record<number, string> = {
      0: "unison", 1: "minor 2nd", 2: "major 2nd / whole tone",
      3: "minor 3rd", 4: "major 3rd", 5: "perfect 4th",
      6: "tritone", 7: "perfect 5th", 8: "minor 6th",
      9: "major 6th", 10: "minor 7th", 11: "major 7th", 12: "octave",
    };
    const name = names[abs] ?? `${abs} semitones`;
    return semitones > 0 ? `↓ ${name}` : semitones < 0 ? `↑ ${name}` : name;
  })();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "32px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 28 }}>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>Tone Tester</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Click a note to hear it, then preview the combination</div>
        </div>

        {/* Set complete */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 20px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Set complete</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Single ding — click to audition</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {NOTES.map(n => (
              <NoteButton key={n.freq} note={n} selected={ringNote.freq === n.freq} color="#7c3aed"
                onTap={() => { setRingNote(n); playSingle(n.freq); }} />
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>
            Selected: {ringNote.label} ({ringNote.freq} Hz)
          </div>
        </div>

        {/* RPE chime */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 20px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>RPE confirmed</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Two dings — pick each note, then preview together</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>1st ding (high)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {NOTES.map(n => (
                <NoteButton key={n.freq} note={n} selected={chime1.freq === n.freq} color="#6d28d9"
                  onTap={() => { setChime1(n); playSingle(n.freq); }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 8 }}>2nd ding (lower)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {NOTES.map(n => (
                <NoteButton key={n.freq} note={n} selected={chime2.freq === n.freq} color="#a78bfa"
                  onTap={() => { setChime2(n); playSingle(n.freq); }} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              <span style={{ fontWeight: 600, color: "#6d28d9" }}>{chime1.label}</span>
              {" → "}
              <span style={{ fontWeight: 600, color: "#a78bfa" }}>{chime2.label}</span>
              <span style={{ color: "#94a3b8", marginLeft: 6 }}>({interval})</span>
            </div>
            <button
              onClick={() => playChime(chime1.freq, chime2.freq)}
              style={{
                padding: "8px 18px",
                borderRadius: 12,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ▶ Preview
            </button>
          </div>
        </div>

        <div style={{ background: "#f1f5f9", borderRadius: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Tell me what to hardcode</div>
          <div style={{ fontSize: 13, color: "#475569", fontFamily: "monospace" }}>
            Set complete: <strong>{ringNote.label} ({ringNote.freq} Hz)</strong><br />
            RPE 1st ding: <strong>{chime1.label} ({chime1.freq} Hz)</strong><br />
            RPE 2nd ding: <strong>{chime2.label} ({chime2.freq} Hz)</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
