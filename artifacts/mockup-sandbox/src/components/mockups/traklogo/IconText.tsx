export function IconText() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16 bg-white px-12">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" />
      <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Option B — Icon + Text</p>

      {/* Light version */}
      <div className="flex flex-col items-center gap-10">
        <div className="flex items-center gap-4">
          {/* Pulse / activity icon */}
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="#7c3aed" />
            <polyline points="6,22 13,22 17,12 21,32 25,18 29,22 38,22"
              stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div className="flex items-baseline gap-1">
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 38, fontWeight: 800, letterSpacing: "-1.5px", color: "#18181b" }}>Trak</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 38, fontWeight: 400, letterSpacing: "-0.5px", color: "#7c3aed" }}>AI</span>
          </div>
        </div>

        {/* Dark version */}
        <div className="flex items-center gap-4 bg-zinc-950 rounded-2xl px-8 py-6">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="#6d28d9" />
            <polyline points="6,22 13,22 17,12 21,32 25,18 29,22 38,22"
              stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div className="flex items-baseline gap-1">
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 38, fontWeight: 800, letterSpacing: "-1.5px", color: "#fff" }}>Trak</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 38, fontWeight: 400, letterSpacing: "-0.5px", color: "#a78bfa" }}>AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
