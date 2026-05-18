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

export function makeInitialAircraft(env, depRunwayName = env.runway.name, deps = {}) {
  const { makeMilitary, makeDeparture } = deps;
  const pool = [];
  const finalDme = 7.5 + Math.random() * 5;
  pool.push(buildFinalAircraft(env, `${callsigns[Math.floor(Math.random() * callsigns.length)]}${200 + Math.floor(Math.random() * 700)}`, randomType(0), finalDme, Math.random() * 24 - 12, Math.round(finalDme * 320 / 100) * 100, 145 + Math.random() * 25));

  const routeNames = ["SOUTH", "SOUTH", "SOUTH", "WEST", "WEST", "NORTH", "EAST"];
  const routeCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < routeCount; i++) {
    const route = routeNames[Math.floor(Math.random() * routeNames.length)];
    const routeDef = env.routes[route];
    const routeIndex = clamp(1 + Math.floor(Math.random() * Math.max(1, routeDef.length - 2)), 0, routeDef.length - 1);
    pool.push(buildRouteAircraft(env, `${callsigns[(i + 1 + Math.floor(Math.random() * callsigns.length)) % callsigns.length]}${100 + Math.floor(Math.random() * 800)}`, randomType(i + 1), route, routeIndex, 0.2 + Math.random() * 0.65, 4000 + Math.floor(Math.random() * 7) * 1000, 185 + Math.random() * 45));
  }

  const radarCount = Math.random() < 0.55 ? 1 : 0;
  const sectors = [185, 185, 225, 285, 285, 330, 65];
  for (let i = 0; i < radarCount; i++) {
    pool.push(buildRadarContact(`${callsigns[(i + 4) % callsigns.length]}${100 + Math.floor(Math.random() * 800)}`, randomType(i + 4), sectors[Math.floor(Math.random() * sectors.length)], 8000 + Math.floor(Math.random() * 9) * 1000, 220 + Math.random() * 70));
  }

  if (Math.random() < 0.28 && pool.length < 4) pool.push(makeMilitary(80 + Math.floor(Math.random() * 40), pool, null, env));
  if (Math.random() < 0.22 && pool.length < 4) pool.push(makeDeparture(30 + Math.floor(Math.random() * 30), env, depRunwayName));
  return pool.slice(0, 4).map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
}
export function makeScenarioInitialAircraft(env, scenarioId, depRunwayName = env.runway.name, deps = {}) {
  const { makeMilitary, makeDeparture, rjcjHelipadPoint } = deps;
  if (scenarioId === "morning_flow") {
    return [
      buildFinalAircraft(env, "ANA739", "DH8D", 9.8, -5, 3000, 152),
      buildRouteAircraft(env, "JAL214", "B738", "SOUTH", 1, 0.42, 7000, 205),
      buildRouteAircraft(env, "ADO560", "A321", "WEST", 1, 0.30, 9000, 210),
      makeDeparture(31, env, depRunwayName),
      makeDeparture(32, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "wind_shift_19") {
    return [
      buildFinalAircraft(env, "SKY376", "B789", 11.5, 10, 3700, 160),
      buildRouteAircraft(env, "ANA221", "B738", "SOUTH", 1, 0.28, 8000, 210),
      buildRouteAircraft(env, "APJ718", "B738", "WEST", 1, 0.55, 10000, 232),
      makeDeparture(41, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "snow_shower_final") {
    return [
      buildRouteAircraft(env, "JAL511", "B763", "SOUTH", 1, 0.35, 9000, 220),
      buildRouteAircraft(env, "ANA774", "A320", "WEST", 1, 0.26, 7000, 205),
      buildRadarContact("ADO246", "B738", 225, 12000, 250),
      makeDeparture(51, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "winter_sar_front") {
    const initial = [
      buildRouteAircraft(env, "ANA861", "B772", "SOUTH", 1, 0.28, 11000, 235),
      buildRadarContact("JAL303", "B738", 225, 12000, 245),
    ];
    const u125 = makeMilitary(171, initial, "U-125A", env);
    const uh60 = makeMilitary(172, [...initial, u125], "UH-60J", env);
    return [
      ...initial,
      { ...u125, altitude: 3500, assignedAltitude: 3500, speed: 190, assignedSpeed: 210, rjcjWestGatePassed: false },
      { ...uh60, ...rjcjHelipadPoint(env), altitude: 0, assignedAltitude: 1000, speed: 0, assignedSpeed: 80, mode: "RJCJ_HELO_DEP", rjcjRunway: "HELIPAD", rjcjAirborne: false, rjcjWestGatePassed: false, heloGatePassed: false },
      makeDeparture(61, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  return makeInitialAircraft(env, depRunwayName, deps);
}
