export default function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
        direction: "rtl",
        fontFamily: "'Segoe UI',Tahoma,sans-serif",
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 16 }}>🏢</div>
      <div style={{ fontSize: 16, color: "#64748b", marginBottom: 16 }}>
        …
      </div>
      <div
        style={{
          width: 200,
          height: 4,
          background: "#e2e8f0",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "100%",
            background: "#3b82f6",
            borderRadius: 2,
            animation: "slide 1.5s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes slide {
          0%   { transform:translateX(-100%); }
          100% { transform:translateX(300%); }
        }
      `}</style>
    </div>
  );
}
