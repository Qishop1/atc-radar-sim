import { CENTER, PX_PER_NM } from "./constants.js";
import { bearingToXY, clamp, hdgVector, xyToBearingRange } from "./geometry.js";
import { wp } from "./airspaceRoutes.js";

export function project3DPoint(x, y, alt = 0, large = false, { view3D, aircraft }) {
  const yaw = (view3D.yaw * Math.PI) / 180;
  const pitch = (view3D.pitch * Math.PI) / 180;
  const focus = aircraft.find((a) => a.id === view3D.focusId);
  const ox = focus ? focus.x : (view3D.centerX ?? CENTER);
  const oy = focus ? focus.y : (view3D.centerY ?? CENTER);
  const X = x - ox;
  const Z = y - oy;
  const Y = alt / 220;
  const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
  const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
  const y2 = Y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = Y * Math.sin(pitch) + z1 * Math.cos(pitch);
  const s = view3D.scale * (large ? 1.32 : 1);
  const focal = large ? 2200 : 1500;
  const perspective = clamp(focal / (focal + z2 * 0.35), 0.82, 1.18);
  return { x: (large ? 450 : 200) + x1 * s * perspective, y: (large ? 645 : 248) - y2 * s * perspective, depth: z2, scale: perspective };
}

export function ring3DPoints(radiusNm, large, project3D) {
  return Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    const x = CENTER + Math.sin(a) * radiusNm * PX_PER_NM;
    const y = CENTER - Math.cos(a) * radiusNm * PX_PER_NM;
    const p = project3D(x, y, 0, large);
    return `${p.x},${p.y}`;
  }).join(" ");
}

export function glidePath3D(course, sideNm, origin, large, project3D) {
  const v = hdgVector(course);
  const r = { x: -v.y, y: v.x };
  return [18, 15, 12, 9, 6, 3, 0].map((d) => {
    const p = { x: origin.x - v.x * d * PX_PER_NM + r.x * sideNm * PX_PER_NM, y: origin.y - v.y * d * PX_PER_NM + r.y * sideNm * PX_PER_NM };
    return project3D(p.x, p.y, d * 320, large);
  });
}

export function routeGlide3D(route, large, env, project3D) {
  const points = [];
  const first = wp(env.nav, route[0]);
  if (first && route[0]?.startsWith("IAF")) {
    const br = xyToBearingRange(first.x, first.y).bearing;
    const baseRange = xyToBearingRange(first.x, first.y).rangeNm;
    const outer120 = bearingToXY(br, baseRange + 26);
    const outer100 = bearingToXY(br, baseRange + 13);
    points.push(project3D(outer120.x, outer120.y, 12000, large));
    points.push(project3D(outer100.x, outer100.y, 10000, large));
  }
  route.forEach((id, idx) => {
    const w = wp(env.nav, id);
    if (!w) return;
    const alt = id.startsWith("IAF") ? 8000 : id.startsWith("DW_") ? 6000 : id.startsWith("BASE_") ? 5000 : id === "IF01" ? 3000 : id === "FAF" ? 2200 : Math.max(3500, 6500 - idx * 800);
    points.push(project3D(w.x, w.y, alt, large));
  });
  return points;
}
