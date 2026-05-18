export default function RadioLog({ title, buttonStyle, collapsed, lang, log, onToggle }) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12, flex: "0 0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={onToggle}>{collapsed ? (lang === "zh" ? "展开" : "Show") : (lang === "zh" ? "收起" : "Hide")}</button>
      </div>
      {!collapsed ? <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 130, overflowY: "auto", marginTop: 8 }}>
        {log.map((l, i) => <div key={`log-${i}`} style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 10, padding: "8px 9px", color: "#e5e7eb", fontSize: 12, fontFamily: "monospace", lineHeight: 1.45 }}>{l}</div>)}
      </div> : null}
    </div>
  );
}
