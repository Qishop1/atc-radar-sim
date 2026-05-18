import { CENTER, PX_PER_NM } from "./constants.js";

export function hashSeed(text) {
  let h = 2166136261;
  const s = String(text || "scenario");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function seededRng(seedText) {
  let s = hashSeed(seedText) || 1;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 4294967296;
  };
}

export function withSeededRandom(seedText, fn) {
  const oldRandom = Math.random;
  Math.random = seededRng(seedText);
  try { return fn(); }
  finally { Math.random = oldRandom; }
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function normHeading(h) { return ((h % 360) + 360) % 360; }
export function fmt3(h) { return String(Math.round(normHeading(h))).padStart(3, "0"); }
export function fmtFL(alt) { return `FL${String(Math.max(0, Math.round((alt || 0) / 100))).padStart(3, "0")}`; }
export function shortestTurn(current, target) { return ((target - current + 540) % 360) - 180; }
export function hdgVector(hdg) { const r = (hdg * Math.PI) / 180; return { x: Math.sin(r), y: -Math.cos(r) }; }
export function bearingToXY(bearing, rangeNm) { const v = hdgVector(bearing); return { x: CENTER + v.x * rangeNm * PX_PER_NM, y: CENTER + v.y * rangeNm * PX_PER_NM }; }

export const AIRPORTS = [
  { id: "RJCJ", label: "RJCJ", ...bearingToXY(285, 4.5) },
  { id: "RJCH", label: "RJCH", ...bearingToXY(212, 74) },
  { id: "RJSM", label: "RJSM", ...bearingToXY(190, 96) },
];

export function xyToBearingRange(x, y) { const dx = x - CENTER, dy = CENTER - y; return { rangeNm: Math.hypot(dx, dy) / PX_PER_NM, bearing: normHeading(Math.atan2(dx, dy) * 180 / Math.PI) }; }
export function headingToPoint(x, y, p) { return normHeading(Math.atan2(p.x - x, y - p.y) * 180 / Math.PI); }
export function runwayPoint(course, dme) { const v = hdgVector(course); return { x: CENTER - v.x * dme * PX_PER_NM, y: CENTER - v.y * dme * PX_PER_NM }; }
export function runwayPointAt(origin, course, dme) {
  const v = hdgVector(course);
  return { x: origin.x - v.x * dme * PX_PER_NM, y: origin.y - v.y * dme * PX_PER_NM };
}
export function finalGeometry(course, x, y) { const v = hdgVector(course), rx = x - CENTER, ry = y - CENTER; return { alongNm: -((rx * v.x + ry * v.y) / PX_PER_NM), crossPx: rx * (-v.y) + ry * v.x }; }
export function finalGeometryAt(origin, course, x, y) {
  const v = hdgVector(course), rx = x - origin.x, ry = y - origin.y;
  return { alongNm: -((rx * v.x + ry * v.y) / PX_PER_NM), crossPx: rx * (-v.y) + ry * v.x };
}
export function ptsString(pts) { return pts.map((p) => `${p.x},${p.y}`).join(" "); }
export function distancePointToSegment(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, wx = p.x - a.x, wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy;
  const t = c2 <= 0 ? 0 : clamp(c1 / c2, 0, 1);
  const x = a.x + vx * t, y = a.y + vy * t;
  return Math.hypot(p.x - x, p.y - y);
}
