export default function ObjectivePanel({
  gameMode,
  scenarioObjective,
  scenarioFailed,
  scenarioComplete,
  lang,
  smallText,
  rjcjPriorityNotice,
  scenarioEventsDone,
  landedCount,
  handoffCount,
  conflictPairs,
  missedCount,
  tick,
  conflictDetails,
  cautionDetails,
}) {
  if (gameMode !== "SCENARIO" || !scenarioObjective) return null;
  return (
    <div style={{ border: `1px solid ${scenarioFailed ? "#ef4444" : scenarioComplete ? "#22c55e" : "#334155"}`, background: "#0f172a", borderRadius: 18, padding: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{lang === "zh" ? "关卡状态" : "Scenario Status"}</div>
      <div style={{ ...smallText, fontFamily: "monospace" }}>
        {lang === "zh" ? "状态" : "Status"}: {scenarioFailed ? (lang === "zh" ? "失败" : "FAILED") : scenarioComplete ? (lang === "zh" ? "完成" : "COMPLETE") : (lang === "zh" ? "进行中" : "ACTIVE")}<br />
        {scenarioObjective.special === "FOXHOUND_ADIZ" ? <>{rjcjPriorityNotice ? <><span style={{ color: rjcjPriorityNotice.level === "DANGER" ? "#f97316" : rjcjPriorityNotice.level === "WARN" ? "#facc15" : rjcjPriorityNotice.level === "FAIL" ? "#ef4444" : "#38bdf8", fontWeight: 900 }}>{rjcjPriorityNotice.title}</span><br />{rjcjPriorityNotice.body}<br /></> : null}{lang === "zh" ? "任务要求" : "TASK"}: RJCJ CALL {scenarioEventsDone.foxhoundPreAlert ? "DONE" : "PENDING"} | JOIN {scenarioEventsDone.foxhoundJoin ? "DONE" : "PENDING"} | INTERCEPT {scenarioEventsDone.foxhoundSuccess ? "DONE" : "PENDING"} | EAGLE RTB {scenarioEventsDone.eagleRecovered ? "DONE" : "PENDING"} | ARR BANK {landedCount}/{scenarioObjective.landed}<br /></> : null}
        TIME {Math.floor(tick / 120)} / {Math.floor(scenarioObjective.duration / 120)} min<br />
        LAND {landedCount}/{scenarioObjective.landed} | ACC {handoffCount}/{scenarioObjective.handoff}<br />
        CONFLICT {conflictPairs.length}/{scenarioObjective.maxConflict} | MISSED {missedCount}/{scenarioObjective.maxMissed}<br />
        {conflictDetails.length ? `CONFLICTING: ${conflictDetails.map((p) => p.kind === "WAKE" ? `WAKE ${p.lead}>${p.trail} RWY ${p.runway} ${p.spacingNm.toFixed(1)}/${p.requiredNm.toFixed(1)}NM` : `RADAR ${p.a}/${p.b} ${p.lateralNm.toFixed(1)}NM ${Math.round(p.verticalFt)}FT`).join(" | ")}` : ""}<br />
        {cautionDetails.length ? "CAUTION: " + cautionDetails.slice(0, 3).map((p) => p.kind === "WAKE" ? ("WAKE " + p.lead + ">" + p.trail + " " + p.spacingNm.toFixed(1) + "/" + p.requiredNm.toFixed(1) + "NM") : ("RADAR " + p.a + "/" + p.b + " " + p.lateralNm.toFixed(1) + "NM CLOS " + Math.round(p.closingKts) + "KT " + (Number.isFinite(p.tMinSec) ? Math.round(p.tMinSec) + "s" : ""))).join(" | ") : ""}<br />
        {conflictDetails.length && !scenarioFailed ? (lang === "zh" ? "冲突目标已标红，失败判定即将触发。" : "Conflict targets highlighted; failure trigger pending.") : ""}<br />
      </div>
    </div>
  );
}
