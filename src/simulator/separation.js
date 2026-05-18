import { PX_PER_NM } from "./constants.js";
import { finalGeometryAt, hdgVector, shortestTurn } from "./geometry.js";
import { runwayOrigin } from "./navigation.js";
import { wakeMinNm } from "./aircraftPerf.js";

export function separationAssessment(a, b) {
  const dxNm = (b.x - a.x) / PX_PER_NM;
  const dyNm = (b.y - a.y) / PX_PER_NM;
  const lateralNm = Math.hypot(dxNm, dyNm);
  const verticalFt = Math.abs(a.altitude - b.altitude);
  const av = hdgVector(a.heading), bv = hdgVector(b.heading);
  const rvx = (b.speed * bv.x - a.speed * av.x) / 3600;
  const rvy = (b.speed * bv.y - a.speed * av.y) / 3600;
  const closingKts = lateralNm > 0 ? -((dxNm * rvx + dyNm * rvy) / lateralNm) * 3600 : 0;
  const tMinSec = closingKts > 1 ? Math.max(0, ((lateralNm - 3) / closingKts) * 3600) : Infinity;
  const predicted = closingKts > 1 && lateralNm < 8 && verticalFt < 1500 && tMinSec <= 90;
  const violation = lateralNm < 3 && verticalFt < 1000;
  const amber = !violation && (predicted || (lateralNm < 4.5 && verticalFt < 1200 && closingKts > 20));
  return { a: a.id, b: b.id, lateralNm, verticalFt, closingKts, tMinSec, level: violation ? "RED" : amber ? "AMBER" : "NONE", kind: "RADAR" };
}

export function isGroundTraffic(ac) {
  return ac.touchdown || ac.runwayOccupancy || ac.altitude < 300 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(ac.mode);
}

export function wakeAssessment(lead, trail, env, deps) {
  const { approachRunwayForAircraft } = deps;
  if (isGroundTraffic(lead) || isGroundTraffic(trail)) return null;
  if (lead.category !== "ARR" || trail.category !== "ARR") return null;
  const finalWakeModes = new Set(["ILS", "FINAL", "FINAL_NO_CLEAR", "TWR_FINAL", "FINAL_LAND", "UNSTABLE_ILS"]);
  if (!finalWakeModes.has(lead.mode) || !finalWakeModes.has(trail.mode)) return null;
  if (lead.hold || trail.hold || lead.mode === "HOLD" || trail.mode === "HOLD") return null;
  if (lead.missed || trail.missed || String(lead.mode).includes("MISSED") || String(trail.mode).includes("MISSED")) return null;
  const rwLead = approachRunwayForAircraft(lead, env), rwTrail = approachRunwayForAircraft(trail, env);
  if (rwLead.name !== rwTrail.name) return null;
  if (Math.abs(shortestTurn(lead.heading, rwLead.course)) > 45 || Math.abs(shortestTurn(trail.heading, rwTrail.course)) > 45) return null;
  const gLead = finalGeometryAt(runwayOrigin(rwLead), rwLead.course, lead.x, lead.y);
  const gTrail = finalGeometryAt(runwayOrigin(rwTrail), rwTrail.course, trail.x, trail.y);
  if (Math.abs(gLead.crossPx) > 55 || Math.abs(gTrail.crossPx) > 55) return null;
  if (gLead.alongNm < 0.2 || gTrail.alongNm < 0.2 || gLead.alongNm > 16 || gTrail.alongNm > 16) return null;
  if (gLead.alongNm >= gTrail.alongNm) return null;
  const spacingNm = gTrail.alongNm - gLead.alongNm;
  const requiredNm = wakeMinNm(lead, trail);
  const closureKts = Math.max(0, trail.speed - lead.speed);
  const tMinSec = closureKts > 1 ? Math.max(0, ((spacingNm - requiredNm) / closureKts) * 3600) : Infinity;
  const violation = spacingNm < requiredNm;
  const amber = !violation && spacingNm < requiredNm + 1.5 && (closureKts > 5 || spacingNm < requiredNm + 0.8);
  return { a: lead.id, b: trail.id, lead: lead.id, trail: trail.id, runway: rwLead.name, spacingNm, requiredNm, closureKts, tMinSec, level: violation ? "RED" : amber ? "AMBER" : "NONE", kind: "WAKE" };
}
