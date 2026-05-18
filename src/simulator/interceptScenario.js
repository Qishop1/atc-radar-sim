import { PX_PER_NM } from "./constants.js";
import { bearingToXY, clamp, hdgVector, headingToPoint, xyToBearingRange } from "./geometry.js";

export function foxhoundAdizArea() {
  const center = bearingToXY(315, 48);
  return { id: "ADIZ-NW", label: "JASDF ADIZ", x: center.x, y: center.y, heading: 315, lengthNm: 30, widthNm: 15, radiusNm: 9.5 };
}

export function adizRectCorners(area = foxhoundAdizArea()) {
  const v = hdgVector(area.heading || 315);
  const r = { x: -v.y, y: v.x };
  const hl = (area.lengthNm || 30) * PX_PER_NM / 2;
  const hw = (area.widthNm || 15) * PX_PER_NM / 2;
  return [
    { x: area.x + v.x * hl + r.x * hw, y: area.y + v.y * hl + r.y * hw },
    { x: area.x + v.x * hl - r.x * hw, y: area.y + v.y * hl - r.y * hw },
    { x: area.x - v.x * hl - r.x * hw, y: area.y - v.y * hl - r.y * hw },
    { x: area.x - v.x * hl + r.x * hw, y: area.y - v.y * hl + r.y * hw },
  ];
}

export function adizLocalCoordsNm(x, y, area = foxhoundAdizArea()) {
  const v = hdgVector(area.heading || 315);
  const r = { x: -v.y, y: v.x };
  const dx = x - area.x;
  const dy = y - area.y;
  return {
    alongNm: (dx * v.x + dy * v.y) / PX_PER_NM,
    crossNm: (dx * r.x + dy * r.y) / PX_PER_NM,
  };
}

export function pointInAdizRect(x, y, area = foxhoundAdizArea()) {
  const local = adizLocalCoordsNm(x, y, area);
  return Math.abs(local.alongNm) <= (area.lengthNm || 30) / 2 && Math.abs(local.crossNm) <= (area.widthNm || 15) / 2;
}

export function foxhoundDeepPenetration(ac, area = foxhoundAdizArea()) {
  if (!pointInAdizRect(ac.x, ac.y, area)) return false;
  const local = adizLocalCoordsNm(ac.x, ac.y, area);
  return local.alongNm <= -2.0;
}

export function distanceFromAdizCenterNm(ac, area = foxhoundAdizArea()) {
  return Math.hypot(ac.x - area.x, ac.y - area.y) / PX_PER_NM;
}

export function isFoxhound(ac) {
  return ac?.type === "MiG-31" || ac?.mode === "FOXHOUND_INBOUND" || ac?.mode === "FOXHOUND_EGRESS" || ac?.mode === "FOXHOUND_FORMATION";
}

export function isScenario05InterceptPair(a, b) {
  const ids = new Set([a?.id, b?.id]);
  const types = new Set([a?.type, b?.type]);
  const modes = new Set([a?.mode, b?.mode]);
  const eagleFoxhoundIds = ids.has("EAGLE01") && [...ids].some((id) => String(id || "").startsWith("FOXHOUND"));
  const f15FoxhoundTypes = types.has("F-15J") && types.has("MiG-31");
  const formationOrJoin = [...modes].some((m) => ["FOXHOUND_INBOUND", "FOXHOUND_FORMATION", "ADIZ_ESCORT", "RJCJ_DEP"].includes(m)) || a?.interceptPhase || b?.interceptPhase;
  return (eagleFoxhoundIds || f15FoxhoundTypes) && formationOrJoin;
}

export function scenario05InterceptPlan(f15, mig) {
  const d = Math.hypot(f15.x - mig.x, f15.y - mig.y) / PX_PER_NM;
  const migHdg = mig.heading || mig.assignedHeading || 135;
  const migSpeed = mig.speed || mig.assignedSpeed || 520;
  const migV = hdgVector(migHdg);
  const migRight = { x: -migV.y, y: migV.x };
  const relX = (f15.x - mig.x) / PX_PER_NM;
  const relY = (f15.y - mig.y) / PX_PER_NM;
  const alongNm = relX * migV.x + relY * migV.y;
  const crossNm = relX * migRight.x + relY * migRight.y;
  const side = 1;
  let phase = "CUT_OFF";
  let aim;
  let assignedHeading;
  let assignedSpeed;
  let assignedAltitude = mig.altitude || 31000;

  if (d > 24) {
    phase = "CUT_OFF";
    const leadNm = clamp(d * 0.42, 10, 22);
    aim = {
      x: mig.x + migV.x * leadNm * PX_PER_NM + migRight.x * side * 4.0 * PX_PER_NM,
      y: mig.y + migV.y * leadNm * PX_PER_NM + migRight.y * side * 4.0 * PX_PER_NM,
    };
    assignedSpeed = f15.altitude < 10000 ? 520 : (f15.maxSpeedOverride || 880);
    assignedAltitude = 32000;
  } else if (d > 10) {
    phase = "CONVERT";
    const leadNm = clamp(d * 0.22, 3.5, 8.0);
    aim = {
      x: mig.x + migV.x * leadNm * PX_PER_NM + migRight.x * side * 2.6 * PX_PER_NM,
      y: mig.y + migV.y * leadNm * PX_PER_NM + migRight.y * side * 2.6 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 210);
  } else if (d > 5.5) {
    phase = "REJOIN";
    aim = {
      x: mig.x - migV.x * 3.2 * PX_PER_NM + migRight.x * side * 1.45 * PX_PER_NM,
      y: mig.y - migV.y * 3.2 * PX_PER_NM + migRight.y * side * 1.45 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 110);
  } else if (d > 2.2) {
    phase = "JOIN_STERN";
    aim = {
      x: mig.x - migV.x * 1.75 * PX_PER_NM + migRight.x * side * 0.9 * PX_PER_NM,
      y: mig.y - migV.y * 1.75 * PX_PER_NM + migRight.y * side * 0.9 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 35);
  } else {
    phase = "VISUAL_ID";
    aim = {
      x: mig.x - migV.x * 1.45 * PX_PER_NM + migRight.x * side * 0.75 * PX_PER_NM,
      y: mig.y - migV.y * 1.45 * PX_PER_NM + migRight.y * side * 0.75 * PX_PER_NM,
    };
    assignedSpeed = migSpeed;
  }

  const overshot = alongNm > 1.8 && d < 10;
  if (overshot) {
    phase = "CONVERT";
    aim = {
      x: mig.x - migV.x * 2.2 * PX_PER_NM + migRight.x * side * (crossNm >= 0 ? 2.2 : 3.2) * PX_PER_NM,
      y: mig.y - migV.y * 2.2 * PX_PER_NM + migRight.y * side * (crossNm >= 0 ? 2.2 : 3.2) * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 65);
  }

  assignedHeading = phase === "VISUAL_ID" ? migHdg : headingToPoint(f15.x, f15.y, aim);
  return { phase, aim, assignedHeading, assignedSpeed, assignedAltitude, distanceNm: d, migHdg, migSpeed, alongNm, crossNm };
}

export function adizEscortComplete(ac) {
  if (!ac || ac.mode !== "ADIZ_ESCORT") return false;
  const area = ac.adizArea || foxhoundAdizArea();
  return !pointInAdizRect(ac.x, ac.y, area) && xyToBearingRange(ac.x, ac.y).rangeNm > 62;
}

export function foxhoundEscortPatch(ac, env) {
  const rjcj = env.nav.find((w) => w.id === "RJCJ") || bearingToXY(285, 4.5);
  return {
    type: "F-15J",
    mode: "RJCJ_RTB",
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    assignedHeading: headingToPoint(ac.x, ac.y, rjcj),
    assignedAltitude: 8000,
    assignedSpeed: 320,
    missionKind: "INTERCEPT_RTB",
    interceptMerged: false,
    escortingMig: null,
    adizArea: null,
    maxSpeedOverride: 750,
    color: "#60a5fa"
  };
}
