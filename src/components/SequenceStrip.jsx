export default function SequenceStrip({
  lang,
  simSeconds,
  buttonStyle,
  smallText,
  arrivalStripRows,
  formatJstTime,
  formatSignedClock,
  formatEta,
  fmtFL,
  wakeCategory,
  wakeShort,
  onResetAuto,
  onMove,
}) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12, flex: "0 0 auto", minHeight: 600, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{lang === "zh" ? "进场排序条" : "Arrival Sequence"}</div>
        <button style={{ ...buttonStyle, padding: "5px 8px", fontSize: 12 }} onClick={onResetAuto}>{lang === "zh" ? "自动" : "Auto"}</button>
      </div>
      <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.35, marginBottom: 8 }}>{lang === "zh" ? `JST ${formatJstTime(simSeconds)}。计划进场提前显示，未进入管制圈时不激活。` : `JST ${formatJstTime(simSeconds)}. Scheduled arrivals appear before entering the control area.`}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 540, minHeight: 520, overflowY: "auto" }}>
        {arrivalStripRows.length ? arrivalStripRows.map((r) => {
          const ac = r.ac;
          const border = r.inactive ? "#64748b" : r.scheduleLevel === "RED" || r.level === "RED" ? "#ef4444" : r.scheduleLevel === "AMBER" || r.level === "AMBER" ? "#f59e0b" : "#22c55e";
          const bg = r.inactive ? "rgba(15,23,42,0.72)" : r.scheduleLevel === "RED" || r.level === "RED" ? "rgba(127,29,29,0.24)" : r.scheduleLevel === "AMBER" || r.level === "AMBER" ? "rgba(120,53,15,0.22)" : "#030712";
          return <div key={`left-strip-${r.id}`} style={{ border: `1px solid ${border}`, background: bg, borderRadius: 12, padding: 8, fontFamily: "monospace", fontSize: 12, lineHeight: 1.35, userSelect: "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto", alignItems: "center", gap: 6 }}>
              <b style={{ color: border }}>{r.pos}</b>
              <b style={{ color: "#e5e7eb" }}>{ac.id} &nbsp; {ac.type} &nbsp; {wakeShort(wakeCategory(ac))}</b>
              {!r.inactive ? <button style={{ ...buttonStyle, padding: "1px 6px", fontSize: 11 }} onClick={() => onMove(ac.id, -1)}>↑</button> : <span />}
              {!r.inactive ? <button style={{ ...buttonStyle, padding: "1px 6px", fontSize: 11 }} onClick={() => onMove(ac.id, 1)}>↓</button> : <span />}
            </div>
            <div>ETA JST {formatJstTime(r.eta)} &nbsp; DEV {formatSignedClock(r.delay || 0)}{!r.inactive && r.predictedAt ? ` | PRED ${formatJstTime(r.predictedAt)}` : ""}{r.inactive ? ` | ACT ${formatJstTime(r.activationSec || 0)}` : ""}</div>
            <div>DME {Number.isFinite(r.geo?.alongNm) ? r.geo.alongNm.toFixed(1) : "--"} &nbsp; ALT {fmtFL(ac.altitude)} &nbsp; SPD {Math.round(ac.speed)}</div>
            {r.inactive ? <div style={{ color: "#94a3b8" }}>NOT ACTIVE — outside control area</div> : !r.gap ? <div>SEP ---- (first)</div> : <>
              <div>SEP {r.gap.predictedNm.toFixed(1)}NM {r.gap.predictedNm >= r.gap.radarReq ? "✓" : "✗"} &nbsp; WAKE {r.gap.wakeReq.toFixed(0)}NM {r.gap.predictedNm >= r.gap.wakeReq ? "✓" : "✗"}</div>
              {r.level !== "GREEN" ? <div style={{ color: border }}>{r.alertReason === "SCHEDULE_LATE" ? (lang === "zh" ? `进场已晚点 ${formatEta(r.delay || 0)}，需要重新排序或加速处理。` : `Arrival is late by ${formatEta(r.delay || 0)}; resequence or expedite.`) : r.alertReason === "SCHEDULE_DELAY" ? (lang === "zh" ? `预计延误 ${formatEta(r.delay || 0)}，间隔本身可用。` : `Projected delay ${formatEta(r.delay || 0)}; spacing itself is acceptable.`) : r.gap?.predictedNm < r.gap?.wakeReq ? `${wakeShort(wakeCategory(arrivalStripRows[r.pos - 2]?.ac || ac))}后${wakeShort(wakeCategory(ac))}需${r.gap.wakeReq.toFixed(0)}NM，预测仅${r.gap.predictedNm.toFixed(1)}NM` : r.gap?.predictedNm < r.gap?.radarReq ? `雷达间隔需3NM，预测仅${r.gap.predictedNm.toFixed(1)}NM` : (lang === "zh" ? `间隔可用，当前警告来自排序/时刻约束。` : `Spacing is acceptable; warning is from sequencing/schedule constraint.`)}</div> : null}
            </>}
          </div>;
        }) : <div style={{ ...smallText, border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 10 }}>{lang === "zh" ? "当前没有进场计划。" : "No active arrival plan."}</div>}
      </div>
    </div>
  );
}
