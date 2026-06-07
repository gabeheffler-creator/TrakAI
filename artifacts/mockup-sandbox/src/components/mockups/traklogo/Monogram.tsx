export function Monogram() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 bg-white px-12">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap" />
      <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Option C — Monogram</p>

      <div className="flex items-center gap-14">
        {/* Light mark */}
        <div className="flex flex-col items-center gap-5">
          <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
            <rect width="88" height="88" rx="24" fill="#7c3aed" />
            {/* Bold T */}
            <text x="44" y="62" textAnchor="middle"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 56, fontWeight: 700, fill: "white" }}>
              T
            </text>
            {/* Pulse underline */}
            <polyline points="20,76 29,76 32,70 36,82 40,72 44,76 68,76"
              stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#18181b" }}>
            Trak<span style={{ color: "#7c3aed", fontWeight: 400 }}>AI</span>
          </div>
        </div>

        {/* Dark background version */}
        <div className="flex flex-col items-center gap-5 bg-zinc-950 rounded-2xl px-10 py-8">
          <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
            <rect width="88" height="88" rx="24" fill="#6d28d9" />
            <text x="44" y="62" textAnchor="middle"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 56, fontWeight: 700, fill: "white" }}>
              T
            </text>
            <polyline points="20,76 29,76 32,70 36,82 40,72 44,76 68,76"
              stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
            Trak<span style={{ color: "#a78bfa", fontWeight: 400 }}>AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
