export default function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-hover)",
        direction: "rtl",
        fontFamily: "'Segoe UI',Tahoma,sans-serif",
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 16 }}>🏢</div>
      <div style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 16 }}>
        …
      </div>
      <div
        style={{
          width: 200,
          height: 4,
          background: "var(--border-color)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "100%",
            background: "var(--primary-color)",
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
