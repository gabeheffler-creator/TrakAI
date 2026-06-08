function playWorkoutComplete() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const ping = (freq: number, start: number, vol: number, decay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
      osc.start(start); osc.stop(start + decay + 0.05);
    };
    // C major 1-5-8: C6 → G6 → C7, 90ms apart
    ping(1046.50, t + 0.000, 0.26, 1.0); // C6 (1)
    ping(1567.98, t + 0.090, 0.26, 1.0); // G6 (5)
    ping(2093.00, t + 0.180, 0.30, 1.4); // C7 (8)

    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

function playSetComplete() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 1760;
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.start(t); osc.stop(t + 1.2);
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function playRpeConfirm() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
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
    setTimeout(() => ctx.close(), 1800);
  } catch {}
}

function playSwipe() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const dur = 0.32;
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src1 = ctx.createBufferSource(); src1.buffer = buf;
    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass"; bp1.Q.value = 1.4;
    bp1.frequency.setValueAtTime(1200, t);
    bp1.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.5, t + 0.018);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const src2 = ctx.createBufferSource(); src2.buffer = buf;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass"; bp2.Q.value = 1.0;
    bp2.frequency.setValueAtTime(350, t);
    bp2.frequency.exponentialRampToValueAtTime(55, t + dur);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.6, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src1.connect(bp1); bp1.connect(g1); g1.connect(ctx.destination);
    src2.connect(bp2); bp2.connect(g2); g2.connect(ctx.destination);
    src1.start(t); src2.start(t);
    setTimeout(() => ctx.close(), 700);
  } catch {}
}

const sounds = [
  { label: "Workout Complete", description: "Cmaj triad + ping — plays when you finish a workout", fn: playWorkoutComplete, emoji: "🏆", color: "#7c3aed" },
  { label: "Set Complete", description: "Soft ding — plays after each set", fn: playSetComplete, emoji: "✅", color: "#0ea5e9" },
  { label: "RPE Confirmed", description: "Double chime — plays when you lock in your effort rating", fn: playRpeConfirm, emoji: "🎵", color: "#10b981" },
  { label: "RPE Dismissed", description: "Airy swipe — plays when you skip the effort rating", fn: playSwipe, emoji: "💨", color: "#64748b" },
];

export function SoundsPage() {
  return (
    <div className="max-w-md mx-auto py-6 space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sound Preview</h1>
        <p className="text-muted-foreground text-sm mt-1">Tap any button to hear the sound</p>
      </div>
      {sounds.map(s => (
        <div key={s.label} className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div>
            <p className="font-semibold">{s.emoji} {s.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
          </div>
          <button
            onClick={s.fn}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm active:scale-95 transition-transform"
            style={{ backgroundColor: s.color }}
          >
            ▶ Play
          </button>
        </div>
      ))}
    </div>
  );
}
