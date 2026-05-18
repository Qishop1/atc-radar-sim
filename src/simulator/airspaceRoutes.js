import { PX_PER_NM, RUNWAYS } from "./constants.js";
import { bearingToXY, hdgVector, normHeading } from "./geometry.js";
import { runwayOrigin, runwayPairName } from "./navigation.js";
import { runwayPointForRunway } from "./runwayGeometry.js";

export function makeNav(runwayName) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const pair = runwayPairName(runwayName);
  const course = rw.course;
  const origin = runwayOrigin(rw);
  const opposite = normHeading(course + 180);
  const eastDownwindBearing = pair === "19" ? normHeading(opposite + 62) : normHeading(opposite - 62);
  const westDownwindBearing = pair === "19" ? normHeading(opposite - 62) : normHeading(opposite + 62);
  const eastBaseBearing = pair === "19" ? normHeading(opposite + 40) : normHeading(opposite - 40);
  const westBaseBearing = pair === "19" ? normHeading(opposite - 40) : normHeading(opposite + 40);
  const rel = (bearing, rangeNm) => {
    const v = hdgVector(bearing);
    return { x: origin.x + v.x * rangeNm * PX_PER_NM, y: origin.y + v.y * rangeNm * PX_PER_NM };
  };
  const rwy = (dme) => runwayPointForRunway(rw.name, dme);
  return [
    { id: "CHITOSE", x: origin.x, y: origin.y, label: "RJCC" },
    { id: "FAF", ...rwy(7), label: "FAF" },
    { id: "IF01", ...rwy(14), label: "IF01" },
    { id: "IAF_N", ...rel(350, 44), label: "IAF_N" },
    { id: "IAF_E", ...rel(70, 44), label: "IAF_E" },
    { id: "IAF_W", ...rel(285, 44), label: "IAF_W" },
    { id: "IAF_S", ...rel(180, 46), label: "IAF_S" },
    { id: "DW_E", ...rel(eastDownwindBearing, 18), label: "DW_E" },
    { id: "DW_W", ...rel(westDownwindBearing, 18), label: "DW_W" },
    { id: "BASE_E", ...rel(eastBaseBearing, 17), label: "BASE_E" },
    { id: "BASE_W", ...rel(westBaseBearing, 17), label: "BASE_W" },
    { id: "HOLD_IN_N", ...rel(0, 54), label: "HOLD_IN_N" },
    { id: "HOLD_IN_NE", ...rel(45, 52), label: "HOLD_IN_NE" },
    { id: "HOLD_IN_E", ...rel(90, 54), label: "HOLD_IN_E" },
    { id: "HOLD_IN_SE", ...rel(135, 54), label: "HOLD_IN_SE" },
    { id: "HOLD_IN_S", ...rel(180, 56), label: "HOLD_IN_S" },
    { id: "HOLD_IN_SW", ...rel(225, 54), label: "HOLD_IN_SW" },
    { id: "HOLD_IN_W", ...rel(270, 54), label: "HOLD_IN_W" },
    { id: "HOLD_IN_NW", ...rel(315, 52), label: "HOLD_IN_NW" },
    { id: "HOLD_N", ...rel(0, 78), label: "HOLD_OUT_N" },
    { id: "HOLD_NE", ...rel(45, 74), label: "HOLD_OUT_NE" },
    { id: "HOLD_E", ...rel(90, 78), label: "HOLD_OUT_E" },
    { id: "HOLD_SE", ...rel(135, 76), label: "HOLD_OUT_SE" },
    { id: "HOLD_S", ...rel(180, 82), label: "HOLD_OUT_S" },
    { id: "HOLD_SW", ...rel(225, 76), label: "HOLD_OUT_SW" },
    { id: "HOLD_W", ...rel(270, 78), label: "HOLD_OUT_W" },
    { id: "HOLD_NW", ...rel(315, 74), label: "HOLD_OUT_NW" },
    { id: "DPN1", ...rel(18, 14), label: "DPN1" },
    { id: "DPN2", ...rel(18, 32), label: "DPN2" },
    { id: "DPN", ...rel(18, 58), label: "DPN" },
    { id: "DPE1", ...rel(70, 14), label: "DPE1" },
    { id: "DPE2", ...rel(70, 34), label: "DPE2" },
    { id: "DPE", ...rel(70, 58), label: "DPE" },
    { id: "DPS1", ...rel(165, 14), label: "DPS1" },
    { id: "DPS2", ...rel(165, 32), label: "DPS2" },
    { id: "DPS", ...rel(165, 58), label: "DPS" },
    { id: "DPW1", ...rel(295, 14), label: "DPW1" },
    { id: "DPW2", ...rel(295, 34), label: "DPW2" },
    { id: "DPW", ...rel(295, 58), label: "DPW" },
    { id: "RJCJ", ...bearingToXY(285, 4.5), label: "RJCJ" },
    { id: "RJCH", ...bearingToXY(212, 74), label: "RJCH" },
    { id: "RJSM", ...bearingToXY(190, 96), label: "RJSM" },
    { id: "MA1", ...rel(course, 8), label: "MA1" },
    { id: "MAHOLD", ...rel(normHeading(course + 35), 17), label: "MAHOLD" },
  ];
}

const navCache = new Map();
export function makeNavCached(runwayName) {
  const key = runwayName || "01L";
  if (!navCache.has(key)) navCache.set(key, makeNav(key));
  return navCache.get(key);
}

export function wp(nav, id) { return nav.find((w) => w.id === id); }

export function holdInboundCourse(fixId, runwayName = "01L") {
  const pair = runwayPairName(runwayName);
  const base = pair === "19" ? 190 : 10;
  if (fixId.endsWith("_N")) return normHeading(base + 180);
  if (fixId.endsWith("_S")) return base;
  if (fixId.endsWith("_E")) return normHeading(base + 270);
  if (fixId.endsWith("_W")) return normHeading(base + 90);
  if (fixId.endsWith("_NE")) return normHeading(base + 225);
  if (fixId.endsWith("_SE")) return normHeading(base + 315);
  if (fixId.endsWith("_SW")) return normHeading(base + 45);
  if (fixId.endsWith("_NW")) return normHeading(base + 135);
  return base;
}

export function holdPatternPoints(nav, fixId, runwayName = "01L") {
  const c = wp(nav, fixId);
  if (!c) return [];
  const inbound = holdInboundCourse(fixId, runwayName);
  const outbound = normHeading(inbound + 180);
  const v = hdgVector(outbound);
  const r = { x: -v.y, y: v.x };
  const legNm = 5.2;
  const halfNm = 1.65;
  return [
    { x: c.x + r.x * halfNm * PX_PER_NM, y: c.y + r.y * halfNm * PX_PER_NM, id: `${fixId}_IN` },
    { x: c.x + v.x * legNm * PX_PER_NM + r.x * halfNm * PX_PER_NM, y: c.y + v.y * legNm * PX_PER_NM + r.y * halfNm * PX_PER_NM, id: `${fixId}_OUT_A` },
    { x: c.x + v.x * legNm * PX_PER_NM - r.x * halfNm * PX_PER_NM, y: c.y + v.y * legNm * PX_PER_NM - r.y * halfNm * PX_PER_NM, id: `${fixId}_OUT_B` },
    { x: c.x - r.x * halfNm * PX_PER_NM, y: c.y - r.y * halfNm * PX_PER_NM, id: `${fixId}_IN_B` },
    { x: c.x + r.x * halfNm * PX_PER_NM, y: c.y + r.y * halfNm * PX_PER_NM, id: `${fixId}_IN` },
  ];
}

export function makeRoutes(runwayName) {
  const pair = runwayPairName(runwayName);
  return pair === "01"
    ? { NORTH: ["IAF_N", "DW_W", "BASE_W", "IF01", "FAF"], EAST: ["IAF_E", "DW_E", "BASE_E", "IF01", "FAF"], WEST: ["IAF_W", "DW_W", "BASE_W", "IF01", "FAF"], SOUTH: ["IAF_S", "IF01", "FAF"], VECTORS_IF01: ["IF01", "FAF"], MISSED_RETURN: ["DW_E", "BASE_E", "IF01", "FAF"] }
    : { NORTH: ["IAF_N", "IF01", "FAF"], EAST: ["IAF_E", "DW_E", "BASE_E", "IF01", "FAF"], WEST: ["IAF_W", "DW_W", "BASE_W", "IF01", "FAF"], SOUTH: ["IAF_S", "DW_E", "BASE_E", "IF01", "FAF"], VECTORS_IF01: ["IF01", "FAF"], MISSED_RETURN: ["DW_W", "BASE_W", "IF01", "FAF"] };
}

export function makeSids(runwayName) {
  return {
    NORTH: { label: `${runwayName}_NORTH`, route: ["DPN1", "DPN2", "DPN"], heading: 18, initialAlt: 5000, topAlt: 14000, speed: 200, exitBearing: 18, exitFix: "DPN" },
    EAST: { label: `${runwayName}_EAST`, route: ["DPE1", "DPE2", "DPE"], heading: 70, initialAlt: 6000, topAlt: 15000, speed: 200, exitBearing: 70, exitFix: "DPE" },
    SOUTH: { label: `${runwayName}_SOUTH`, route: ["DPS1", "DPS2", "DPS"], heading: 165, initialAlt: 5000, topAlt: 12000, speed: 200, exitBearing: 165, exitFix: "DPS" },
    WEST: { label: `${runwayName}_WEST`, route: ["DPW1", "DPW2", "DPW"], heading: 295, initialAlt: 6000, topAlt: 16000, speed: 200, exitBearing: 295, exitFix: "DPW" },
  };
}

export function suggestRouteForBearing(b) { if (b > 315 || b < 45) return "NORTH"; if (b < 135) return "EAST"; if (b < 225) return "SOUTH"; return "WEST"; }

export function suggestHoldForBearing(b) {
  if (b < 30 || b >= 330) return "HOLD_IN_N";
  if (b < 75) return "HOLD_IN_NE";
  if (b < 120) return "HOLD_IN_E";
  if (b < 165) return "HOLD_IN_SE";
  if (b < 210) return "HOLD_IN_S";
  if (b < 255) return "HOLD_IN_SW";
  if (b < 300) return "HOLD_IN_W";
  return "HOLD_IN_NW";
}
