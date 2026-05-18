import { AIRPORT_RUNWAYS, PX_PER_NM } from "./constants.js";
import { bearingToXY, distancePointToSegment, hdgVector, normHeading, runwayPointAt } from "./geometry.js";
import { isRotor } from "./aircraftPerf.js";
import { activeAirportRunway } from "./weather.js";

export const MISSION_AREAS = [];
const SAR_AREA_BEARINGS = [145, 165, 190, 215, 245, 275];

function wp(nav, id) { return nav.find((w) => w.id === id); }

export function airportPoint(env, airportId) {
  return wp(env.nav, airportId) || bearingToXY(285, 4.5);
}

export function airportRunwayPointAt(env, airportId, runwayName, dme) {
  const apt = airportPoint(env, airportId);
  const rw = (AIRPORT_RUNWAYS[airportId] || []).find((r) => r.name === runwayName) || activeAirportRunway(airportId, env.wind);
  return runwayPointAt(apt, rw.course, dme);
}

export function airportDepartureEnd(env, airportId, runwayName) {
  const apt = airportPoint(env, airportId);
  const rw = (AIRPORT_RUNWAYS[airportId] || []).find((r) => r.name === runwayName) || activeAirportRunway(airportId, env.wind);
  const v = hdgVector(rw.course);
  return { x: apt.x - v.x * 1.05 * PX_PER_NM, y: apt.y - v.y * 1.05 * PX_PER_NM, course: rw.course, runwayName: rw.name };
}

export function rjcjRunwayForType(env, type) {
  return activeAirportRunway("RJCJ", env.wind);
}

export function rjcjDepartureGate(env, runwayName, type) {
  const rw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === runwayName) || activeAirportRunway("RJCJ", env.wind);
  const apt = airportPoint(env, "RJCJ");
  const out = runwayPointAt(apt, rw.course, -5.5);
  const side = type === "UH-60J" ? (rw.name === "36" ? -1.2 : 1.2) : 0;
  const rv = hdgVector(rw.course);
  const right = { x: -rv.y, y: rv.x };
  return { x: out.x + right.x * side * PX_PER_NM, y: out.y + right.y * side * PX_PER_NM };
}

export function rjcjHelipadPoint(env) {
  const apt = airportPoint(env, "RJCJ");
  return { x: apt.x - 13, y: apt.y + 2, course: 270, runwayName: "HELIPAD" };
}

export function makeSarMissionArea(seq = 0, type = "U-125A") {
  const b = SAR_AREA_BEARINGS[Math.abs(seq) % SAR_AREA_BEARINGS.length] + Math.sin(seq * 1.91) * 9;
  const range = 24 + (Math.abs(Math.sin(seq * 0.73)) * 26);
  const helo = type === "UH-60J";
  return {
    id: `SAR_${String(Math.abs(seq) % 100).padStart(2, "0")}`,
    label: helo ? "SAR HELO" : "SAR SEARCH",
    bearing: normHeading(b),
    range,
    radiusNm: helo ? 5.5 : 7.5,
    minAlt: helo ? 600 : 1800,
    maxAlt: helo ? 2500 : 7000,
    types: ["U-125A", "UH-60J", "C-2"],
    dynamic: true,
  };
}

export function missionAreaPoint(area) { return bearingToXY(area.bearing, area.range); }

export function makeTrainingMissionArea(seq = 0, type = "T-4") {
  const bearings = type === "F-15J" ? [292, 310, 330] : type === "C-2" ? [135, 155, 185] : [245, 270, 300];
  const b = bearings[Math.abs(seq) % bearings.length] + Math.sin(seq * 1.37) * 7;
  const range = type === "F-15J" ? 48 + Math.abs(Math.sin(seq * 0.51)) * 18 : 34 + Math.abs(Math.sin(seq * 0.77)) * 20;
  return {
    id: `TRAIN_${String(Math.abs(seq) % 100).padStart(2, "0")}`,
    label: "RJCJ TRAINING",
    bearing: normHeading(b),
    range,
    radiusNm: type === "F-15J" ? 9.0 : 7.0,
    minAlt: type === "F-15J" ? 16000 : 5000,
    maxAlt: type === "F-15J" ? 30000 : 16000,
    types: [type],
    dynamic: true,
  };
}

export function missionForType(type, seq = 0) {
  if (type === "U-125A" || type === "UH-60J") return makeSarMissionArea(seq, type);
  return makeTrainingMissionArea(seq, type);
}

export function getAircraftMissionArea(ac) {
  return ac?.missionAreaObj || MISSION_AREAS.find((m) => m.id === ac?.missionArea) || missionForType(ac?.type || "F-15J", 0);
}

export function displayedMissionAreas(aircraft = []) {
  const dynamic = [];
  for (const ac of aircraft) {
    if (ac.category !== "MIL" || !ac.missionAreaObj) continue;
    if (ac.mode === "ADIZ_ESCORT" || ac.missionKind === "INTERCEPT_RTB") continue;
    if (!dynamic.some((m) => m.id === ac.missionAreaObj.id)) dynamic.push(ac.missionAreaObj);
  }
  return [...MISSION_AREAS, ...dynamic];
}

export function activeMissionAreas(aircraft = []) {
  return displayedMissionAreas(aircraft);
}

export function missionCorridorForAircraft(ac, env) {
  if (ac.category !== "MIL" || ac.landed || ac.handedOff) return null;
  if (ac.missionKind === "INTERCEPT" || ac.missionKind === "INTERCEPT_RTB" || ac.mode === "ADIZ_ESCORT") return null;
  const area = getAircraftMissionArea(ac);
  if (!area) return null;
  const areaCenter = missionAreaPoint(area);
  const distAreaNm = Math.hypot(ac.x - areaCenter.x, ac.y - areaCenter.y) / PX_PER_NM;
  const areaOnly = ac.mode === "RJCJ_MISSION" || distAreaNm <= area.radiusNm * 1.15;
  const color = "#f59e0b";
  if (areaOnly) {
    return {
      kind: "AREA",
      id: `${ac.id}-${area.id}-AREA`,
      aircraftId: ac.id,
      areaId: area.id,
      label: `${ac.id} ${area.label}`,
      center: areaCenter,
      start: areaCenter,
      end: areaCenter,
      position: { x: ac.x, y: ac.y },
      area,
      widthNm: 0,
      controlRadiusNm: area.radiusNm + 3.0,
      color,
    };
  }
  const enrouteModes = ["RJCJ_DEP", "RJCJ_HELO_DEP", "RJCJ_RTB", "RJCJ_RECOVERY", "RJCJ_HELO_RECOVERY", "RJCJ_ILS", "RJCJ_WX_AVOID"];
  if (!enrouteModes.includes(ac.mode)) return null;
  const v = hdgVector(ac.heading || ac.assignedHeading || 0);
  const backNm = isRotor(ac) ? 1.0 : 1.8;
  const aheadNm = isRotor(ac) ? 5.5 : ac.type === "F-15J" ? 13.0 : 8.5;
  return {
    kind: "MOVING_CORRIDOR",
    id: `${ac.id}-${area.id}-MOVING`,
    aircraftId: ac.id,
    areaId: area.id,
    label: `${ac.id} ${area.label}`,
    start: { x: ac.x - v.x * backNm * PX_PER_NM, y: ac.y - v.y * backNm * PX_PER_NM },
    end: { x: ac.x + v.x * aheadNm * PX_PER_NM, y: ac.y + v.y * aheadNm * PX_PER_NM },
    position: { x: ac.x, y: ac.y },
    area,
    widthNm: isRotor(ac) ? 2.2 : ac.type === "F-15J" ? 4.0 : 3.0,
    controlRadiusNm: area.radiusNm + 3.0,
    color,
  };
}

export function activeMissionCorridors(aircraft = [], env) {
  return aircraft.map((a) => missionCorridorForAircraft(a, env)).filter(Boolean);
}

export function corridorPolygonPoints(corridor) {
  const dx = corridor.end.x - corridor.start.x;
  const dy = corridor.end.y - corridor.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const half = corridor.widthNm * PX_PER_NM;
  return [
    { x: corridor.start.x + nx * half, y: corridor.start.y + ny * half },
    { x: corridor.end.x + nx * half, y: corridor.end.y + ny * half },
    { x: corridor.end.x - nx * half, y: corridor.end.y - ny * half },
    { x: corridor.start.x - nx * half, y: corridor.start.y - ny * half },
  ];
}

export function missionRestrictionViolation(ac, corridors = [], isGroundTrafficFn = () => false) {
  if (ac.category === "MIL" || ac.landed || ac.handedOff || isGroundTrafficFn(ac)) return null;
  const p = { x: ac.x, y: ac.y };
  for (const c of corridors) {
    const areaDistanceNm = Math.hypot(ac.x - c.end.x, ac.y - c.end.y) / PX_PER_NM;
    if (c.kind === "AREA") {
      if (areaDistanceNm <= c.controlRadiusNm) return { id: ac.id, corridorId: c.id, aircraftId: c.aircraftId, areaId: c.areaId, kind: "MISSION AREA", corridorDistanceNm: Infinity, areaDistanceNm, level: "RED" };
      continue;
    }
    const corridorDistanceNm = distancePointToSegment(p, c.start, c.end) / PX_PER_NM;
    if (corridorDistanceNm <= c.widthNm) return { id: ac.id, corridorId: c.id, aircraftId: c.aircraftId, areaId: c.areaId, kind: "MOVING MISSION CORRIDOR", corridorDistanceNm, areaDistanceNm, level: "RED" };
  }
  return null;
}
