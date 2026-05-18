import { PX_PER_NM } from "./constants.js";
import { finalGeometryAt, xyToBearingRange } from "./geometry.js";
import { runwayOrigin } from "./navigation.js";
import { approachSpeedFor, cleanSpeedFor, wakeMinNm } from "./aircraftPerf.js";

export function arrivalPathDistanceNm(ac, env, deps) {
  const { approachRunwayForAircraft, makeNavCached, wp } = deps;
  if (ac.category !== "ARR") return Infinity;
  const rw = approachRunwayForAircraft(ac, env);
  const nav = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  let dist = Math.max(0, geo.alongNm);
  if (ac.route?.length && ac.mode === "ROUTE") {
    let px = ac.x, py = ac.y;
    dist = 0;
    for (let i = ac.routeIndex || 0; i < ac.route.length; i++) {
      const fix = wp(nav, ac.route[i]);
      if (!fix) continue;
      dist += Math.hypot(px - fix.x, py - fix.y) / PX_PER_NM;
      px = fix.x; py = fix.y;
    }
    const lastGeo = finalGeometryAt(runwayOrigin(rw), rw.course, px, py);
    dist += Math.max(0, lastGeo.alongNm);
  } else if (ac.mode === "VECTOR" || ac.mode === "RADAR_CONTACT" || ac.mode === "DIRECT_FIX") {
    dist = Math.max(dist, xyToBearingRange(ac.x, ac.y).rangeNm * 0.55);
  } else if (ac.mode === "VISUAL_APP" || ac.mode === "TWR_PATTERN") {
    dist = Math.max(0, geo.alongNm) + Math.max(0, 5 - (ac.patternLeg || 0)) * 2.2;
  } else if (ac.mode === "MISSED_APP" || ac.mode === "MISSED" || ac.mode === "MISSED_TRANSFER_APP") {
    dist = Math.max(14, xyToBearingRange(ac.x, ac.y).rangeNm * 0.55);
  }
  return dist;
}

export function estimateArrivalEtaSec(ac, env, deps) {
  const dist = arrivalPathDistanceNm(ac, env, deps);
  const spd = Math.max(90, Math.min(Math.max(ac.speed || 0, approachSpeedFor(ac)), cleanSpeedFor(ac)));
  return (dist / spd) * 3600;
}

export function sequenceGapAssessment(lead, trail, env, deps) {
  const leadEta = estimateArrivalEtaSec(lead, env, deps);
  const trailEta = estimateArrivalEtaSec(trail, env, deps);
  const timeDelta = trailEta - leadEta;
  const predictedNm = Math.max(0, (timeDelta / 3600) * Math.max(approachSpeedFor(trail), 90));
  const wakeReq = wakeMinNm(lead, trail);
  const radarReq = 3;
  const required = Math.max(wakeReq, radarReq);
  const level = predictedNm < required ? "RED" : predictedNm < required + 1.2 ? "AMBER" : "GREEN";
  return { leadEta, trailEta, timeDelta, predictedNm, wakeReq, radarReq, required, level };
}
