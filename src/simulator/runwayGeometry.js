import {
  AIRPORT_RUNWAYS,
  CENTER,
  ILS_FAR_PX,
  ILS_NEAR_PX,
  PX_PER_NM,
  RJCC_RUNWAY_VISUAL_NM,
  RUNWAYS,
} from "./constants.js";
import { AIRPORTS, finalGeometryAt, hdgVector, runwayPointAt } from "./geometry.js";
import { runwayOrigin } from "./navigation.js";
import { runwayHeadwind } from "./weather.js";

export function airportApproachGeometry(airportId, ac) {
  const ap = AIRPORTS.find((a) => a.id === airportId);
  if (!ap) return null;
  const rw = ac?.alternateRunway || (airportId === "RJCH" ? "12" : "RWY");
  const course = airportId === "RJCH" ? 120 : airportId === "RJSM" ? 100 : 180;
  const geo = finalGeometryAt({ x: ap.x, y: ap.y }, course, ac.x, ac.y);
  return { airport: ap, runway: rw, course, geo };
}

export function alternateRunwayConfig(airportId, wind = null) {
  const candidates = AIRPORT_RUNWAYS[airportId] || AIRPORT_RUNWAYS.RJCH;
  const picked = wind
    ? candidates.reduce((best, r) => runwayHeadwind(wind, r.course) > runwayHeadwind(wind, best.course) ? r : best, candidates[0])
    : candidates[0];
  return { airportId, runwayName: picked.name, course: picked.course };
}

export function alternateRunwayPoint(airportId, dme, wind = null) {
  const ap = AIRPORTS.find((a) => a.id === airportId);
  const cfg = alternateRunwayConfig(airportId, wind);
  return ap ? runwayPointAt({ x: ap.x, y: ap.y }, cfg.course, dme) : { x: CENTER, y: CENTER };
}

export function runwayPointForRunway(runwayName, dme) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const origin = runwayOrigin(rw);
  const v = hdgVector(rw.course);
  return { x: origin.x - v.x * dme * PX_PER_NM, y: origin.y - v.y * dme * PX_PER_NM };
}

export function runwayPolygonPoints(runwayName, centerX = CENTER, centerY = CENTER, scale = 1, lenNm = RJCC_RUNWAY_VISUAL_NM, halfWidth = 4) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const origin = runwayOrigin(rw);
  const v = hdgVector(rw.course);
  const r = { x: -v.y, y: v.x };
  const len = lenNm * PX_PER_NM * scale;
  const offX = (origin.x - CENTER) * scale;
  const offY = (origin.y - CENTER) * scale;
  const cx = centerX + offX;
  const cy = centerY + offY;
  return [
    { x: cx - v.x * len + r.x * halfWidth, y: cy - v.y * len + r.y * halfWidth },
    { x: cx + v.x * len + r.x * halfWidth, y: cy + v.y * len + r.y * halfWidth },
    { x: cx + v.x * len - r.x * halfWidth, y: cy + v.y * len - r.y * halfWidth },
    { x: cx - v.x * len - r.x * halfWidth, y: cy - v.y * len - r.y * halfWidth },
  ];
}

export function ilsTrapPoints(origin, course, nearNm = 0, farNm = 18, nearHalfPx = ILS_NEAR_PX, farHalfPx = ILS_FAR_PX) {
  const v = hdgVector(course);
  const r = { x: -v.y, y: v.x };
  const near = runwayPointAt(origin, course, nearNm);
  const far = runwayPointAt(origin, course, farNm);
  const leftNear = { x: near.x + r.x * nearHalfPx, y: near.y + r.y * nearHalfPx };
  const leftFar = { x: far.x + r.x * farHalfPx, y: far.y + r.y * farHalfPx };
  const rightFar = { x: far.x - r.x * farHalfPx, y: far.y - r.y * farHalfPx };
  const rightNear = { x: near.x - r.x * nearHalfPx, y: near.y - r.y * nearHalfPx };
  return [leftNear, leftFar, rightFar, rightNear];
}

export function ilsBoundaryLines(origin, course, nearNm = 0, farNm = 18, nearHalfPx = ILS_NEAR_PX, farHalfPx = ILS_FAR_PX) {
  const pts = ilsTrapPoints(origin, course, nearNm, farNm, nearHalfPx, farHalfPx);
  return {
    polygon: pts,
    left: [pts[0], pts[1]],
    right: [pts[3], pts[2]],
    center: [runwayPointAt(origin, course, nearNm), runwayPointAt(origin, course, farNm)],
  };
}

export function runwayPointEnv(env, dme) { return runwayPointForRunway(env.runway.name, dme); }
export function finalGeometryRunway(env, x, y) { return finalGeometryAt(runwayOrigin(env.runway), env.runway.course, x, y); }
