export default function MissionStatusPanel({
  tr,
  lang,
  smallText,
  score,
  delayPenalty,
  missionPenalty,
  landedCount,
  handoffCount,
  conflictPairs,
  cautionDetails,
  conflictDetails,
  missionAirspaceViolations,
  missedCount,
  emergencyCount,
  lowFuelCount,
  activeRunway,
  aircraft,
  activeCorridors,
  arrCount,
  depCount,
}) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{tr("scoreboard")}</div>
      <div style={{ ...smallText }}>{tr("score")}: {Math.round(score)}<br />{lang === "zh" ? "延误扣分" : "Delay penalty"}: -{delayPenalty}<br />{lang === "zh" ? "任务空域扣分" : "Mission airspace penalty"}: -{missionPenalty}<br />{tr("landed")}:  {landedCount}<br />{tr("accHandoff")}: {handoffCount}<br />{tr("conflicts")}: {conflictPairs.length}<br />{lang === "zh" ? "警报" : "Alerts"}: {cautionDetails.length} {lang === "zh" ? "黄" : "amber"} / {conflictDetails.length} {lang === "zh" ? "红" : "red"}<br />{lang === "zh" ? "任务空域侵入" : "Mission airspace violations"}: {missionAirspaceViolations.length}<br />{tr("missedAppCount")}:  {missedCount}<br />{tr("emergency")}: {emergencyCount}<br />{tr("lowFuel")}: {lowFuelCount}<br />{tr("rjccActiveRunway")}: {activeRunway}<br />{tr("rjcjTraffic")}: {aircraft.filter((a) => a.category === "MIL").length}<br />{lang === "zh" ? "活跃走廊" : "Active corridors"}: {activeCorridors.length}<br />{tr("arrivals")}:  {arrCount}<br />{tr("departures")}: {depCount}</div>
    </div>
  );
}
