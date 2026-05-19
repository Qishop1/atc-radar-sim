const ACTIVE_SEQUENCE_EXCLUDED_MODES = new Set(["VACATED", "ROLLOUT", "HOLD", "MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "DIVERT", "ALT_HANDOFF", "MAYDAY", "PANPAN"]);

export function buildSequenceRows({
  arrivalSequence,
  aircraft,
  env,
  simSeconds,
  estimateArrivalEtaSec,
  sequenceGapAssessment,
  finalGeometryForAircraft,
  sequencingDeps,
}) {
  const byId = new Map(aircraft.map((a) => [a.id, a]));
  const anyManual = arrivalSequence.some((s) => s.manualPosition !== null && s.manualPosition !== undefined);
  const ordered = arrivalSequence
    .map((s) => ({ ...s, ac: byId.get(s.id) }))
    .filter((s) => s.ac && s.ac.category === "ARR" && !s.ac.handedOff && !s.ac.landed && !s.ac.hold && !ACTIVE_SEQUENCE_EXCLUDED_MODES.has(s.ac.mode))
    .sort((a, b) => {
      if (anyManual) {
        const ap = a.manualPosition ?? 999 + estimateArrivalEtaSec(a.ac, env, sequencingDeps) / 100000;
        const bp = b.manualPosition ?? 999 + estimateArrivalEtaSec(b.ac, env, sequencingDeps) / 100000;
        return ap - bp;
      }
      return estimateArrivalEtaSec(a.ac, env, sequencingDeps) - estimateArrivalEtaSec(b.ac, env, sequencingDeps);
    });
  return ordered.map((row, idx) => {
    const etaRel = estimateArrivalEtaSec(row.ac, env, sequencingDeps);
    const eta = row.etaSec ?? (simSeconds + etaRel);
    const predictedAt = simSeconds + etaRel;
    const autoRank = [...ordered].sort((a, b) => estimateArrivalEtaSec(a.ac, env, sequencingDeps) - estimateArrivalEtaSec(b.ac, env, sequencingDeps)).findIndex((r) => r.id === row.id);
    const prev = idx > 0 ? ordered[idx - 1].ac : null;
    const gap = prev ? sequenceGapAssessment(prev, row.ac, env, sequencingDeps) : null;
    const delay = Math.max(0, predictedAt - eta, simSeconds > eta ? simSeconds - eta : 0);
    const scheduleLevel = simSeconds > eta ? "RED" : delay > 180 ? "AMBER" : "ONTIME";
    const geo = finalGeometryForAircraft(row.ac, env, row.ac.x, row.ac.y);
    const gapLevel = !gap ? "GREEN" : gap.level;
    const level = scheduleLevel === "RED" ? "RED" : scheduleLevel === "AMBER" && gapLevel === "GREEN" ? "AMBER" : gapLevel;
    const alertReason = scheduleLevel === "RED" ? "SCHEDULE_LATE" : scheduleLevel === "AMBER" && gapLevel === "GREEN" ? "SCHEDULE_DELAY" : gap?.level === "RED" || gap?.level === "AMBER" ? "SEPARATION" : "NONE";
    return { ...row, pos: idx + 1, eta, predictedAt, autoRank, delay, scheduleLevel, geo, gap, gapLevel, alertReason, level };
  });
}

export function moveArrivalInSequence(prev, arrivalStripRows, id, direction) {
  const activeRows = arrivalStripRows.filter((r) => !r.inactive && prev.some((s) => s.id === r.id));
  const visible = activeRows.map((r) => r.id);
  const idx = visible.indexOf(id);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= visible.length) return prev;
  const nextOrder = [...visible];
  [nextOrder[idx], nextOrder[target]] = [nextOrder[target], nextOrder[idx]];
  return prev.map((s) => nextOrder.includes(s.id) ? { ...s, manualPosition: nextOrder.indexOf(s.id) } : s);
}

export function resetArrivalSequenceAuto(prev) {
  return prev.map((s) => ({ ...s, manualPosition: null }));
}

export function buildArrivalStripRows({ gameMode, scenarioPlan, scenarioTrafficDone, sequenceRows, arrivalSequence }) {
  const future = gameMode === "SCENARIO" ? scenarioPlan
    .filter((i) => i.kind === "ARR" && !scenarioTrafficDone[i.at])
    .map((i) => {
      const eta = i.etaSec ?? (i.at / 2 + 1080);
      return {
        id: i.id,
        pos: 0,
        inactive: true,
        ac: { id: i.id, type: i.type, altitude: i.alt, speed: i.spd, category: "ARR", mode: "PREACTIVE" },
        eta,
        delay: 0,
        geo: { alongNm: Infinity },
        gap: null,
        level: "PENDING",
        activationSec: i.at / 2,
      };
    }) : [];
  const manual = arrivalSequence.some((s) => s.manualPosition !== null && s.manualPosition !== undefined);
  const combined = manual
    ? [...sequenceRows, ...future.sort((a, b) => a.eta - b.eta)]
    : [...sequenceRows, ...future].sort((a, b) => a.eta - b.eta);
  return combined.map((r, i) => ({ ...r, pos: i + 1 }));
}
