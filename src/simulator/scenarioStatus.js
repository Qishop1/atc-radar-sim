export function buildSnowRemovalNotice({ scenarioId, closedRunways, realTick }) {
  if (scenarioId !== "winter_sar_front") return "";
  if (closedRunways.length) return `RJCC ${closedRunways.join("/")} CLOSED DUE SNOWPLOW`;
  if (realTick >= 480 && realTick < 600) return `RJCC 01L WILL CLOSE IN ${Math.ceil((600 - realTick) / 2)}s DUE SNOWPLOW`;
  if (realTick >= 960 && realTick < 1080) return `RJCC 01R WILL CLOSE IN ${Math.ceil((1080 - realTick) / 2)}s DUE SNOWPLOW`;
  return "";
}

export function buildRjcjPriorityNotice({ scenarioId, scenarioEventsDone, tick, lang }) {
  if (scenarioId !== "foxhound_adiz_05") return null;
  if (scenarioEventsDone.foxhoundSuccess && !scenarioEventsDone.eagleRecovered) return lang === "zh"
    ? { level: "INFO", title: "ADIZ 伴飞驱离完成", body: "FOXHOUND 已转向脱离 — EAGLE01 返回 RJCJ" }
    : { level: "INFO", title: "ADIZ ESCORT COMPLETE", body: "FOXHOUND OUTBOUND — EAGLE01 RTB RJCJ" };
  if (scenarioEventsDone.foxhoundFailed) {
    if (scenarioEventsDone.fuelOutFailed) return lang === "zh"
      ? { level: "FAIL", title: "任务失败", body: `${scenarioEventsDone.fuelOutId || "飞机"} 燃油耗尽` }
      : { level: "FAIL", title: "MISSION FAILED", body: `${scenarioEventsDone.fuelOutId || "AIRCRAFT"} FUEL EXHAUSTED` };
    return lang === "zh"
      ? { level: "FAIL", title: "任务失败", body: "FOXHOUND 已深入 ADIZ" }
      : { level: "FAIL", title: "MISSION FAILED", body: "FOXHOUND DEEP ADIZ PENETRATION" };
  }
  if (scenarioEventsDone.foxhoundSuccess && scenarioEventsDone.eagleRecovered) return lang === "zh"
    ? { level: "DONE", title: "RJCJ 截击任务完成", body: "EAGLE01 已返场" }
    : { level: "DONE", title: "RJCJ INTERCEPT COMPLETE", body: "EAGLE01 RECOVERED" };
  if (tick >= 780) return lang === "zh"
    ? { level: "DANGER", title: "紧急截击已启动", body: "FOXHOUND31 西北方向 — EAGLE01 截击中 / 民航避开 ADIZ-NW" }
    : { level: "DANGER", title: "SCRAMBLE FI ACTIVE", body: "FOXHOUND31 NW — EAGLE01 INTERCEPT / KEEP CIVIL CLEAR ADIZ-NW" };
  if (scenarioEventsDone.foxhoundPreAlert) return lang === "zh"
    ? { level: "WARN", title: "RJCJ 来电 — 截击预警", body: `FI 紧急起飞 T-${Math.max(0, Math.ceil((780 - tick) / 2))}s / ADIZ-NW 预留空域` }
    : { level: "WARN", title: "RJCJ CALL — SCRAMBLE NOTICE", body: `FI SCRAMBLE IN T-${Math.max(0, Math.ceil((780 - tick) / 2))}s / ADIZ-NW RESERVED` };
  return null;
}

export function deriveScenarioStatus({
  gameMode,
  scenarioObjective,
  scenarioEventsDone,
  landedCount,
  handoffCount,
  conflictPairs,
  conflictFailureReady,
  missedCount,
  fuelOutAircraft,
  tick,
}) {
  const scenario05Complete = scenarioObjective?.special === "FOXHOUND_ADIZ" && !!scenarioEventsDone.foxhoundSuccess && !!scenarioEventsDone.eagleRecovered && landedCount >= scenarioObjective.landed && handoffCount >= scenarioObjective.handoff && conflictPairs.length <= scenarioObjective.maxConflict && missedCount <= scenarioObjective.maxMissed;
  const normalScenarioComplete = scenarioObjective?.special ? false : gameMode === "SCENARIO" && scenarioObjective && landedCount >= scenarioObjective.landed && handoffCount >= scenarioObjective.handoff && conflictPairs.length <= scenarioObjective.maxConflict && missedCount <= scenarioObjective.maxMissed;
  const scenarioComplete = !!(normalScenarioComplete || scenario05Complete);
  const scenarioFailed = gameMode === "SCENARIO" && scenarioObjective && (!!fuelOutAircraft || (scenarioObjective.special === "FOXHOUND_ADIZ" && scenarioEventsDone.foxhoundFailed) || (conflictPairs.length > scenarioObjective.maxConflict && conflictFailureReady) || missedCount > scenarioObjective.maxMissed || tick > scenarioObjective.duration + 240);
  const scenarioEnded = !!(scenarioComplete || scenarioFailed);
  return { scenario05Complete, normalScenarioComplete, scenarioComplete, scenarioFailed, scenarioEnded };
}
