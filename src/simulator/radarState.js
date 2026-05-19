import { PX_PER_NM, RADAR_SWEEP_SECONDS, SIM_STEP_SECONDS } from "./constants.js";
import { clamp, hdgVector, normHeading } from "./geometry.js";

export function computeRadarDisplayTargets(radarTargets, tick, running) {
  return radarTargets.map((a) => {
    const ageSec = Math.max(0, (tick - (a.radarSweepTick ?? tick)) * SIM_STEP_SECONDS);
    const extrapSec = running ? clamp(ageSec, 0, RADAR_SWEEP_SECONDS) : 0;
    const extrapHeading = normHeading((a.heading || 0) + (a.angularRate || 0) * extrapSec);
    const v = hdgVector(extrapHeading);
    const distNm = ((a.speed || 0) * extrapSec) / 3600;
    return {
      ...a,
      radarAgeSec: ageSec,
      displayHeading: extrapHeading,
      displayX: a.x + v.x * distNm * PX_PER_NM,
      displayY: a.y + v.y * distNm * PX_PER_NM,
    };
  });
}

export function runwayRoleOf(rw, { closedRunways, openArrRunways, openDepRunways }) {
  if (closedRunways.includes(rw)) return "CLOSED";
  const arr = openArrRunways.includes(rw);
  const dep = openDepRunways.includes(rw);
  if (arr && dep) return "BOTH";
  if (arr) return "ARR";
  if (dep) return "DEP";
  return "STANDBY";
}

export function showAirportIls(id, { seat, selected }) {
  if (id === "RJCJ") return seat === "RJCJ" || selected?.category === "MIL" || selected?.destination === "RJCJ";
  return selected?.destination === id || ["DIVERT", "ALT_HANDOFF"].includes(selected?.mode);
}

export function runwayLabelForRole(role, lang) {
  if (role === "PENDING") return lang === "zh" ? "候选" : "PENDING";
  if (role === "INACTIVE") return lang === "zh" ? "未用" : "STANDBY";
  if (role === "CLOSED") return lang === "zh" ? "关闭" : "CLOSED";
  if (role === "ARR") return lang === "zh" ? "进场" : "ARR";
  if (role === "BOTH") return lang === "zh" ? "混用" : "BOTH";
  if (role === "DEP") return lang === "zh" ? "离场" : "DEP";
  return lang === "zh" ? "当前" : "ACTIVE";
}

export function buildRjccRunwayDisplaySet({
  runwayChangeCandidate,
  runwayNames,
  runwayPairRunways,
  closedRunways,
  openArrRunways,
  openDepRunways,
  activeRunway,
  depRunway,
}) {
  const pending = runwayChangeCandidate?.pair ? runwayPairRunways(runwayChangeCandidate.pair) : null;
  return runwayNames.map((rw) => {
    if (closedRunways.includes(rw)) return { runway: rw, role: "CLOSED" };
    if (pending && (rw === pending.arr || rw === pending.dep) && !openArrRunways.includes(rw) && !openDepRunways.includes(rw)) return { runway: rw, role: "PENDING" };
    const arr = openArrRunways.includes(rw);
    const dep = openDepRunways.includes(rw);
    if (arr && dep) return { runway: rw, role: "BOTH" };
    if (arr) return { runway: rw, role: rw === activeRunway ? "CURRENT" : "ARR" };
    if (dep) return { runway: rw, role: rw === depRunway ? "DEP" : "DEP" };
    return { runway: rw, role: "INACTIVE" };
  });
}
