export default function App() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0e17",
      }}
    >
      <div
        style={{
          width: 390,
          height: "min(844px, 96dvh)",
          borderRadius: 44,
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)",
          background: "#000",
          flexShrink: 0,
        }}
      >
        <iframe
          src="/client/"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          title="Trak Client"
        />
      </div>
    </div>
  );
}
