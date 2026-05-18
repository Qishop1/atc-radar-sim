import { CENTER } from "./constants.js";
import { callsigns, perfFor, types } from "./aircraftPerf.js";
import {
  bearingToXY,
  clamp,
  hdgVector,
  headingToPoint,
  normHeading,
  shortestTurn,
  xyToBearingRange,
} from "./geometry.js";
import { spawnRoutes } from "./scenarios.js";
import { runwayPointEnv } from "./runwayGeometry.js";

export function pickWeightedSpawnRoute() {
  const total = spawnRoutes.reduce((s, r) => s + (r.weight || 1), 0);
  let roll = Math.random() * total;
  for (const r of spawnRoutes) {
    roll -= r.weight || 1;
    if (roll <= 0) return r;
  }
  return spawnRoutes[0];
}

export function makeEmptyAircraft() {
  return {
    id: "NO TARGET",
    type: "-",
    x: CENTER,
    y: CENTER,
    heading: 0,
    speed: 0,
    altitude: 0,
    assignedHeading: 0,
    assignedSpeed: 0,
    assignedAltitude: 0,
    speedRestriction: null,
    mode: "NO_TARGET",
    route: [],
    routeIndex: 0,
    hold: null,
    clearedILS: false,
    landed: false,
    missed: false,
    category: "ARR",
    destination: "RJCC",
    sid: null,
    depState: null,
    handedOff: false,
    fuelMinutes: 0,
    burnRate: 0,
    trail: [],
    color: "#64748b",
  };
}

export function makeAircraft(id, type, bearing, range, heading, speed, altitude, color = "#32ff4d") {
  const p = perfFor(type);
  const pos = bearingToXY(bearing, range), limitedSpeed = speed <= 0 ? 0 : clamp(speed, p.min, p.max);
  return { id, type, x: pos.x, y: pos.y, heading, speed: limitedSpeed, altitude, assignedHeading: heading, assignedSpeed: limitedSpeed, assignedAltitude: altitude, speedRestriction: null, mode: "RADAR_CONTACT", route: [], routeIndex: 0, hold: null, clearedILS: false, landed: false, missed: false, category: "ARR", destination: "RJCC", sid: null, depState: null, handedOff: false, fuelMinutes: Math.round(35 + Math.random() * 55), trail: [], color };
}

export function buildRouteAircraft(env, id, type, routeName, routeIndex, offset, altitude, speed) {
  const route = env.routes[routeName], target = env.nav.find((w) => w.id === route[routeIndex]), prev = routeIndex > 0 ? env.nav.find((w) => w.id === route[routeIndex - 1]) : null;
  const base = prev ? { x: prev.x + (target.x - prev.x) * offset, y: prev.y + (target.y - prev.y) * offset } : target;
  const br = xyToBearingRange(base.x, base.y);
  return { ...makeAircraft(id, type, br.bearing, br.rangeNm, headingToPoint(base.x, base.y, target), speed, altitude), x: base.x, y: base.y, mode: "ROUTE", route, routeIndex, routeRunway: env.runway.name, approachRunway: env.runway.name };
}

export function buildFinalAircraft(env, id, type, dme, crossPx, altitude, speed) {
  const p = runwayPointEnv(env, dme), right = { x: -hdgVector(env.runway.course).y, y: hdgVector(env.runway.course).x };
  const x = p.x + right.x * crossPx, y = p.y + right.y * crossPx, br = xyToBearingRange(x, y);
  return { ...makeAircraft(id, type, br.bearing, br.rangeNm, env.runway.course, speed, altitude, "#4de1ff"), x, y, mode: "ILS", clearedILS: true, assignedHeading: env.runway.course, routeRunway: env.runway.name, approachRunway: env.runway.name };
}

export function buildRadarContact(id, type, sectorBearing, altitude, speed) {
  const base = Number.isFinite(sectorBearing) ? (spawnRoutes.find((r) => Math.abs(shortestTurn(r.bearing, sectorBearing)) < 24) || pickWeightedSpawnRoute()) : pickWeightedSpawnRoute();
  return makeAircraft(id, type, normHeading(base.bearing + Math.random() * 8 - 4), base.range + Math.random() * 2 - 1, base.heading, speed, altitude);
}

export function randomType(idx) { return types[(idx * 3 + Math.floor(Math.random() * types.length)) % types.length]; }

export function makeRandomArrival(seq) {
  const c = callsigns[seq % callsigns.length], t = types[(seq * 3) % types.length], base = pickWeightedSpawnRoute();
  const id = `${c}${String(100 + ((seq * 47 + Math.floor(Math.random() * 300)) % 900))}`;
  return makeAircraft(id, t, normHeading(base.bearing + Math.random() * 10 - 5), base.range + Math.random() * 3 - 1.5, base.heading, base.speed, base.altitude);
}
