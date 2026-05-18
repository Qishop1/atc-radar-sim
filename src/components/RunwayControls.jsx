export default function RunwayControls({
  lang,
  buttonStyle,
  smallText,
  openArrRunways,
  openDepRunways,
  closedRunways,
  runwayNames,
  activeRunway,
  windObj,
  runways,
  parallelApproach,
  runwayPairName,
  runwayRoleOf,
  runwayLabelForRole,
  runwayHeadwind,
  onToggleParallel,
  onSetRunwayRole,
  onSetRunwayEndPlan,
}) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{lang === "zh" ? "RJCC 跑道选择器" : "RJCC Runway Planner"}</div>
        <button style={{ ...buttonStyle, padding: "6px 8px", fontSize: 12 }} onClick={onToggleParallel}>{parallelApproach ? (lang === "zh" ? "平行进近 开" : "Parallel ON") : (lang === "zh" ? "平行进近 关" : "Parallel OFF")}</button>
      </div>
      <div style={{ ...smallText, marginBottom: 10 }}>
        ARR {openArrRunways.join("/")} | DEP {openDepRunways.join("/")} | CLOSED {closedRunways.length ? closedRunways.join("/") : "NONE"}<br />
        {lang === "zh" ? "点击每条跑道下面的角色按钮；绿色为进场，紫色为离场，黄绿色为混用，红色为关闭。" : "Use the role buttons under each runway. Green is ARR, purple is DEP, yellow-green is BOTH, red is CLOSED."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {runwayNames.map((rw) => {
          const role = runwayRoleOf(rw);
          const color = role === "CLOSED" ? "#ef4444" : role === "BOTH" ? "#84cc16" : role === "ARR" ? "#22c55e" : role === "DEP" ? "#a855f7" : "#38bdf8";
          const hw = runwayHeadwind(windObj, runways[rw].course);
          return <div key={`planner-${rw}`} style={{ border: `1px solid ${color}`, background: "#030712", borderRadius: 14, padding: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <b style={{ color, fontFamily: "monospace", fontSize: 15 }}>RWY {rw}</b>
              <span style={{ color: hw >= 0 ? "#22c55e" : "#ef4444", fontFamily: "monospace", fontSize: 12 }}>{hw >= 0 ? "HW" : "TW"} {Math.abs(hw).toFixed(1)}</span>
            </div>
            <div style={{ height: 42, borderRadius: 10, background: `linear-gradient(90deg, rgba(148,163,184,0.12), ${color}55)`, border: `1px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center", color, fontWeight: 900, fontFamily: "monospace", marginBottom: 7 }}>{runwayLabelForRole(role)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <button style={{ ...buttonStyle, padding: "5px 4px", fontSize: 11, background: role === "ARR" ? "#14532d" : "#111827" }} onClick={() => onSetRunwayRole(rw, "ARR")}>ARR</button>
              <button style={{ ...buttonStyle, padding: "5px 4px", fontSize: 11, background: role === "DEP" ? "#581c87" : "#111827" }} onClick={() => onSetRunwayRole(rw, "DEP")}>DEP</button>
              <button style={{ ...buttonStyle, padding: "5px 4px", fontSize: 11, background: role === "BOTH" ? "#365314" : "#111827" }} onClick={() => onSetRunwayRole(rw, "BOTH")}>BOTH</button>
              <button style={{ ...buttonStyle, padding: "5px 4px", fontSize: 11, background: role === "CLOSED" ? "#7f1d1d" : "#111827" }} onClick={() => onSetRunwayRole(rw, "CLOSED")}>CLOSE</button>
            </div>
          </div>;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan("01", "SPLIT")}>01 SPLIT</button>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan("01", "PARALLEL_ARR")}>01 PAR ARR</button>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan("19", "SPLIT")}>19 SPLIT</button>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan("19", "PARALLEL_ARR")}>19 PAR ARR</button>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan(runwayPairName(activeRunway), "SINGLE_LEFT")}>{runwayPairName(activeRunway)}L SINGLE</button>
        <button style={buttonStyle} onClick={() => onSetRunwayEndPlan(runwayPairName(activeRunway), "SINGLE_RIGHT")}>{runwayPairName(activeRunway)}R SINGLE</button>
      </div>
    </div>
  );
}
