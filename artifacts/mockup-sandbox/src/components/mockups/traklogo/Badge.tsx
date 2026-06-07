export function Badge() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 bg-white px-12">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" />
      <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Option D — Badge</p>

      <div className="flex flex-col items-center gap-8">
        {/* Filled pill — dark */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "#18181b", borderRadius: 999,
          padding: "14px 32px",
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <polyline points="1,11 5,11 7,5 10,17 13,8 15,11 21,11"
              stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            Trak<span style={{ color: "#a78bfa" }}>AI</span>
          </span>
        </div>

        {/* Outlined pill — light */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          border: "2.5px solid #18181b", borderRadius: 999,
          padding: "14px 32px",
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <polyline points="1,11 5,11 7,5 10,17 13,8 15,11 21,11"
              stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#18181b", letterSpacing: "-0.5px" }}>
            Trak<span style={{ color: "#7c3aed" }}>AI</span>
          </span>
        </div>

        {/* Violet pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "#7c3aed", borderRadius: 999,
          padding: "14px 32px",
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <polyline points="1,11 5,11 7,5 10,17 13,8 15,11 21,11"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            TrakAI
          </span>
        </div>
      </div>
    </div>
  );
}
