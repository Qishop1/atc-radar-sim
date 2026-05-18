export default function ControlConsole({
  title,
  seat,
  lang,
  activeButton,
  buttonStyle,
  selectedId,
  aircraft,
  inputStyle,
  modeText,
  onSeatChange,
  onSelectAircraft,
  selectedPanel,
  children,
}) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
        <button style={seat === "APP" ? activeButton : buttonStyle} onClick={() => onSeatChange("APP")}>{lang === "zh" ? "进近" : "APP"}</button>
        <button style={seat === "DEP" ? activeButton : buttonStyle} onClick={() => onSeatChange("DEP")}>{lang === "zh" ? "离场" : "DEP"}</button>
        <button style={seat === "RJCJ" ? activeButton : buttonStyle} onClick={() => onSeatChange("RJCJ")}>RJCJ</button>
        <button style={seat === "TWR" ? activeButton : buttonStyle} onClick={() => onSeatChange("TWR")}>{lang === "zh" ? "塔台" : "TWR"}</button>
      </div>
      <select value={selectedId} onChange={(e) => onSelectAircraft(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>{aircraft.map((a) => <option key={a.id} value={a.id}>{a.id} | {a.category} | {modeText(a)}</option>)}</select>
      {selectedPanel}
      {children}
    </div>
  );
}
