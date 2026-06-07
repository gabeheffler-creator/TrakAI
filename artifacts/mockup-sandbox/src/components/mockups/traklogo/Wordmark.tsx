export function Wordmark() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16 bg-white px-12">
      <div className="flex flex-col items-center gap-10">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Option A — Wordmark</p>

        {/* Light version */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 700, letterSpacing: "-2px", color: "#18181b" }}>
              Trak
            </span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 300, letterSpacing: "-1px", color: "#7c3aed" }}>
              AI
            </span>
          </div>
          <div style={{ width: 96, height: 3, background: "linear-gradient(90deg, #7c3aed 0%, #a78bfa 60%, transparent 100%)", borderRadius: 99 }} />
        </div>

        {/* Dark version */}
        <div className="flex flex-col items-center gap-3 bg-zinc-950 rounded-2xl px-10 py-7">
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 700, letterSpacing: "-2px", color: "#fff" }}>
              Trak
            </span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 300, letterSpacing: "-1px", color: "#a78bfa" }}>
              AI
            </span>
          </div>
          <div style={{ width: 96, height: 3, background: "linear-gradient(90deg, #7c3aed 0%, #a78bfa 60%, transparent 100%)", borderRadius: 99 }} />
        </div>
      </div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;700&display=swap" />
    </div>
  );
}
