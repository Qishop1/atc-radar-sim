export default function ScenarioCard({ scenario, lang, buttonStyle, onStart }) {
  const isSandbox = scenario.kind === "SANDBOX";
  const accent = isSandbox ? "#38bdf8" : scenario.difficulty === "HARD" ? "#ef4444" : scenario.difficulty === "EASY" ? "#22c55e" : "#f59e0b";
  return (
    <div style={{ border: `1px solid ${accent}`, background: "rgba(15, 23, 42, 0.86)", borderRadius: 22, padding: 18, minHeight: 265, boxShadow: `0 0 24px ${isSandbox ? "rgba(56,189,248,0.12)" : scenario.difficulty === "HARD" ? "rgba(239,68,68,0.16)" : "rgba(245,158,11,0.10)"}`, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 12, color: accent, fontWeight: 900, letterSpacing: 1.3, marginBottom: 10 }}>{isSandbox ? "FREE PLAY" : scenario.difficulty}</div>
      <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.18 }}>{lang === "zh" ? scenario.titleZh : scenario.title}</div>
      <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>{lang === "zh" ? scenario.subtitleZh : scenario.subtitle}</div>
      <div style={{ marginTop: 16, fontFamily: "monospace", color: "#94a3b8", fontSize: 12, lineHeight: 1.55 }}>
        ARR {scenario.arrRunway} / DEP {scenario.depRunway}<br />WIND {scenario.wind}<br />WX {scenario.weatherOn ? "ON" : "OFF"}<br />MODE {scenario.kind}{scenario.kind === "SCENARIO" ? <><br />INIT BOTH</> : null}
      </div>
      <button style={{ ...buttonStyle, background: isSandbox ? "#075985" : "#1d4ed8", border: `1px solid ${accent}`, marginTop: "auto" }} onClick={() => onStart(scenario)}>{lang === "zh" ? (isSandbox ? "进入自由模式" : "开始关卡") : (isSandbox ? "Start Free Play" : "Start Scenario")}</button>
    </div>
  );
}
