import { isGroundTraffic } from "./separation.js";
import { AIRPORT_RUNWAYS, ILS_FAR_PX, ILS_NEAR_PX, PATTERN_ALT, PX_PER_NM, RUNWAYS, SIM_STEP_SECONDS, TWR_RADIUS_NM } from "./constants.js";
import { bearingToXY, clamp, finalGeometryAt, hdgVector, headingToPoint, normHeading, runwayPointAt, shortestTurn, xyToBearingRange } from "./geometry.js";
import { runwayOrigin, runwayPairName } from "./navigation.js";
import { approachSpeedFor, callsigns, cleanSpeedFor, depFlightPlans, isRotor, milCallsigns, milTypes, perfFor, speedLimitForAircraft, types } from "./aircraftPerf.js";
import { STATE_ALIAS, VALID_TRANSITIONS } from "./stateMachine.js";
import { divertRequired, intersectsRedWeather, nearestRedWeatherAhead, parseWind, windVector } from "./weather.js";
import { runwayPointForRunway } from "./runwayGeometry.js";
import { makeAircraft } from "./aircraftFactory.js";
import { adizEscortComplete, foxhoundAdizArea, foxhoundEscortPatch, isFoxhound } from "./interceptScenario.js";
import { holdPatternPoints, makeNavCached, makeRoutes, makeSids, wp } from "./airspaceRoutes.js";
import { alternateHandoffRadiusNm, approachRunwayForAircraft, finalGeometryForAircraft, finalLandingState, ilsAutoEligible, isAlternateMode, isApproachMode, isFinalMode, runwayPointForAircraft, wrongRunwayTailwindMiss } from "./arrivalApproach.js";
import { resolveAlternateTargetState, resolveDepartureGroundTargetState, resolveDepartureTargetState, resolveDirectFixTargetState, resolveExitState, resolveRotorTargetState, stepFuelOutAircraft, stepRolloutAircraft } from "./engine.js";
import { airportDepartureEnd, getAircraftMissionArea, makeSarMissionArea, missionAreaPoint, missionForType, rjcjDepartureGate, rjcjHelipadPoint, rjcjRunwayForType } from "./military.js";
import { militaryBingoFuelMinutes, militaryRtbPatch, nearestMissionAreaAhead, shouldMilitaryRTB } from "./militaryBoundary.js";

export function estimateBurnRate(ac, targetAltitude, targetSpeed) {
  const perf = perfFor(ac.type);
  if ((ac.fuelMinutes ?? 60) <= 0) return 0;
  const climbDemand = targetAltitude - ac.altitude;
  const speedDemand = (targetSpeed || ac.speed || 180) - (ac.speed || 180);
  const speedFactor = clamp(Math.pow((targetSpeed || ac.speed || 180) / 200, 1.15), 0.5, 1.75);
  const altitudeFactor = clamp(1.15 - ac.altitude / 52000, 0.55, 1.15);
  let rate = 0.72 * speedFactor * altitudeFactor * (perf.burn || 1);
  if ((ac.category === "MIL" || ac.milMission) && ac.mode === "RJCJ_MISSION") rate = Math.max(rate, 1.05 * speedFactor * (perf.burn || 1));
  if ((ac.category === "MIL" || ac.milMission) && ac.mode === "RJCJ_RTB") rate = Math.max(rate, 0.85 * speedFactor * (perf.burn || 1));
  if (climbDemand > 500) rate = Math.max(rate, 1.55 * speedFactor * altitudeFactor);
  if (climbDemand > 2500) rate = Math.max(rate, 2.05 * speedFactor * altitudeFactor);
  if (ac.category === "DEP" && ac.altitude < 3000 && climbDemand > 500) rate = Math.max(rate, 2.25 * speedFactor * altitudeFactor);
  if (ac.mode === "MISSED_APP") {
    const activeGoAround = climbDemand > 400 || speedDemand > 25 || ac.altitude < 2500;
    rate = Math.max(rate, (activeGoAround ? 2.45 : 0.9) * speedFactor * altitudeFactor);
  }
  if (climbDemand < -500) rate = Math.min(rate, 0.36 * speedFactor * altitudeFactor);
  if (ac.mode === "ILS" || isFinalMode(ac.mode)) rate = Math.min(rate, 0.48 * speedFactor * altitudeFactor);
  if (ac.mode === "HOLD") rate = Math.max(rate, 0.85 * speedFactor * altitudeFactor);
  return clamp(rate, 0.18, 3.2);
}
export function aircraftFactoryDeps() { return { makeMilitary, makeDeparture, rjcjHelipadPoint }; }
export function makeIntruderMig31(env, seq = 0) {
  const start = bearingToXY(315, 95);
  const adiz = bearingToXY(315, 48);
  const base = makeAircraft(`FOXHOUND${31 + (seq % 6)}`, "A320", 315, 95, headingToPoint(start.x, start.y, adiz), 320, 31000, "#ef4444");
  return normalizeAircraftState({ ...base, id: `FOXHOUND${31 + (seq % 6)}`, type: "MiG-31", speed: 520, assignedSpeed: 520, maxSpeedOverride: 900 });
}
export function makeFoxhoundIntruder(env, seq = 0) {
  const base = makeIntruderMig31(env, seq);
  const area = foxhoundAdizArea();
  return { ...base, category: "INTRUDER", mode: "FOXHOUND_INBOUND", destination: "ADIZ-NW", assignedHeading: headingToPoint(base.x, base.y, { x: area.x, y: area.y }), assignedAltitude: 31000, assignedSpeed: 520, speed: 520, altitude: 31000, adizArea: area, intercepted: false, hostileTrack: true, maxSpeedOverride: 900, color: "#ef4444" };
}
export function makeScenario05Interceptor(env) {
  const rjcjRw = { name: "36", course: 360 };
  const dep = airportDepartureEnd(env, "RJCJ", rjcjRw.name);
  const area = { id: "INT-NW", label: "ADIZ INTERCEPT", bearing: 315, range: 48, radiusNm: 7.5, minAlt: 24000, maxAlt: 38000, dynamic: true };
  const ac = makeAircraft("EAGLE01", "F-15J", xyToBearingRange(dep.x, dep.y).bearing, xyToBearingRange(dep.x, dep.y).rangeNm, rjcjRw.course, 0, 0, "#60a5fa");
  return normalizeAircraftState({
    ...ac,
    x: dep.x,
    y: dep.y,
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    mode: "RJCJ_DEP",
    rjcjRunway: "36",
    rjcjCourse: 360,
    rjcjAirborne: false,
    rjcjWestGatePassed: true,
    missionArea: "ADIZ-NW",
    missionAreaObj: null,
    missionKind: "INTERCEPT",
    interceptTargetId: "FOXHOUND31",
    assignedHeading: rjcjRw.course,
    assignedAltitude: 32000,
    assignedSpeed: 850,
    fuelMinutes: 90,
    bingoFuelMinutes: 12,
    maxSpeedOverride: 880,
    noCommandDelay: true,
    color: "#60a5fa"
  });
}
export function makeMilitary(seq, existing = [], forcedType = null, env = null) {
  const id = `${milCallsigns[seq % milCallsigns.length]}${String(10 + (seq * 7) % 80)}`;
  let type = forcedType || milTypes[seq % milTypes.length];
  if (type === "U-125A" && existing.some((a) => a.type === "U-125A" && a.category === "MIL")) type = seq % 2 === 0 ? "UH-60J" : "T-4";
  const p = perfFor(type);
  const area = (type === "U-125A" || type === "UH-60J") ? makeSarMissionArea(seq, type) : missionForType(type, seq);
  const areaPoint = missionAreaPoint(area);
  const fallbackEnv = env || { nav: makeNavCached("01L"), wind: parseWind("360/03") };
  const rjcjRw = rjcjRunwayForType(fallbackEnv, type);
  const rjcjDep = airportDepartureEnd(fallbackEnv, "RJCJ", rjcjRw.name);
  const rjcjPad = rjcjHelipadPoint(fallbackEnv);
  const spawnRecovery = seq % 5 === 0;
  const fastJet = type === "F-15J";
  const start = spawnRecovery ? { x: areaPoint.x + Math.sin(seq) * area.radiusNm * PX_PER_NM, y: areaPoint.y + Math.cos(seq) * area.radiusNm * PX_PER_NM } : (p.rotor ? rjcjPad : rjcjDep);
  const br = xyToBearingRange(start.x, start.y);
  const missionAlt = p.rotor ? 1800 : type === "U-125A" ? 3500 : fastJet ? 18000 : 9000;
  const missionSpeed = p.rotor ? 95 : fastJet ? 330 : Math.min(220, p.clean);
  const depHeading = p.rotor ? headingToPoint(start.x, start.y, areaPoint) : rjcjDep.course;
  const ac = makeAircraft(id, type, br.bearing, br.rangeNm, depHeading, spawnRecovery ? missionSpeed : 0, spawnRecovery ? missionAlt : 0, "#60a5fa");
  return {
    ...ac,
    x: start.x,
    y: start.y,
    speed: spawnRecovery ? missionSpeed : 0,
    assignedSpeed: spawnRecovery ? missionSpeed : (p.rotor ? 65 : 130),
    assignedAltitude: spawnRecovery ? missionAlt : (p.rotor ? 700 : 1200),
    assignedHeading: depHeading,
    rjcjRunway: p.rotor ? "HELIPAD" : rjcjRw.name,
    rjcjCourse: p.rotor ? depHeading : rjcjRw.course,
    rjcjAirborne: spawnRecovery,
    category: "MIL",
    destination: "RJCJ",
    mode: spawnRecovery ? "RJCJ_MISSION" : (p.rotor ? "RJCJ_HELO_DEP" : "RJCJ_DEP"),
    missionArea: area.id,
    missionAreaObj: area.dynamic ? area : null,
    missionKind: fastJet ? "INTERCEPT" : (type === "U-125A" || type === "UH-60J") ? "SAR" : "TRAINING",
    missionTicks: 0,
    fuelMinutes: Math.round(95 + Math.random() * 90),
    bingoFuelMinutes: militaryBingoFuelMinutes({ ...ac, x: start.x, y: start.y, type, category: "MIL", speed: spawnRecovery ? missionSpeed : 0, assignedSpeed: spawnRecovery ? missionSpeed : (p.rotor ? 65 : 130), mode: spawnRecovery ? "RJCJ_MISSION" : (p.rotor ? "RJCJ_HELO_DEP" : "RJCJ_DEP") }, fallbackEnv),
  };
}
export function departureRunwayEntry(runwayName) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  return runwayPointForRunway(rw.name, 0.62);
}
export function departureQueuePoint(runwayName, slot = 0) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01"];
  const entry = departureRunwayEntry(rw.name);
  const v = hdgVector(rw.course);
  const side = { x: -v.y, y: v.x };
  const stagger = (slot % 4) * 7;
  return { x: entry.x + side.x * (20 + stagger), y: entry.y + side.y * (20 + stagger) };
}
export function makeDeparture(seq, env, runwayName = env.runway.name) {
  const depRunway = RUNWAYS[runwayName] || env.runway;
  const depSids = makeSids(depRunway.name);
  const plan = depFlightPlans[seq % depFlightPlans.length], sid = depSids[plan.sid] || depSids.NORTH;
  const id = `${callsigns[(seq + 2) % callsigns.length]}${String(300 + ((seq * 59 + Math.floor(Math.random() * 400)) % 600))}`;
  const q = departureQueuePoint(depRunway.name, seq);
  const br = xyToBearingRange(q.x, q.y);
  return { ...makeAircraft(id, types[(seq * 5) % types.length], br.bearing, br.rangeNm, depRunway.course, 0, 0, "#c084fc"), x: q.x, y: q.y, category: "DEP", destination: plan.destination, sid: plan.sid, depRunway: depRunway.name, mode: "DEP_READY", depState: "PENDING_TWR", towerControlled: true, takeoffClearance: false, runwayOccupancy: false, assignedHeading: depRunway.course, assignedAltitude: 0, assignedSpeed: 0, route: sid.route, routeIndex: 0, fuelMinutes: Math.round(120 + Math.random() * 90) };
}
export function scoreAircraft(ac) {
  let score = 0;
  if (ac.landed) score += 120;
  if (ac.handedOff) score += 90;
  if (ac.emergency) score -= 160;
  if ((ac.fuelMinutes ?? 60) < 15) score -= 40;
  if (ac.mode === "FUEL_EXHAUSTED" || ac.mode === "DEADSTICK") score -= 220;
  if (ac.mode === "MISSED_APP" || ac.mode === "MISSED" || ac.missed) score -= 35;
  if (ac.mode === "HOLD") score -= 4;
  return score;
}
export function depExitReady(ac, env) {
  if (ac.category !== "DEP" || !ac.sid) return false;
  const sid = env.sids[ac.sid] || env.sids.NORTH;
  const br = xyToBearingRange(ac.x, ac.y);
  const exitFix = sid.exitFix ? wp(env.nav, sid.exitFix) : null;
  const exitDist = exitFix ? Math.hypot(ac.x - exitFix.x, ac.y - exitFix.y) / PX_PER_NM : 99;
  const routeDone = ac.routeIndex >= (ac.route?.length || 0) || exitDist < 4.5 || br.rangeNm > 56;
  return routeDone && br.rangeNm > 42 && Math.abs(shortestTurn(br.bearing, sid.exitBearing)) < 28 && ac.altitude >= Math.min(10000, sid.initialAlt + 3000);
}
export function shouldAutoMissed(ac, env) {
  if (ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || isAlternateMode(ac.mode)) return false;
  if (ac.category !== "ARR" || ac.clearedILS || ac.landingClearance || ac.mode === "VISUAL_APP" || ac.mode === "TWR_PATTERN" || ac.mode === "MISSED" || ac.mode === "APP_RETURN") return false;
  const rw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const aligned = Math.abs(shortestTurn(ac.heading, rw.course)) < 70;
  return geo.alongNm < -0.25 && geo.alongNm > -3 && Math.abs(geo.crossPx) < 90 && ac.altitude < 3500 && aligned;
}
export function ilsGateState(ac, env) {
  const rw = approachRunwayForAircraft(ac, env);
  if (env.closedRunways?.includes(rw.name)) {
    const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
    return { rw, geo, inCone: false, capture: false, unstable: false, closed: true };
  }
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const locLimitPx = ILS_NEAR_PX + geo.alongNm * ((ILS_FAR_PX - ILS_NEAR_PX) / 18);
  const desiredAlt = geo.alongNm * 320;
  const gateAltOk = geo.alongNm > 9 ? ac.altitude <= 5000 : Math.abs(ac.altitude - desiredAlt) < 1200;
  const gateSpeedOk = ac.speed < approachSpeedFor(ac) + 85;
  const headingOk = Math.abs(shortestTurn(ac.heading, rw.course)) < 85 || Math.abs(shortestTurn(ac.assignedHeading ?? ac.heading, rw.course)) < 85;
  const inCone = geo.alongNm > 5 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx + 22;
  const capture = geo.alongNm > 5 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx && gateAltOk && gateSpeedOk && headingOk;
  const unstable = inCone && (!gateAltOk || !gateSpeedOk || !headingOk);
  return { rw, geo, inCone, capture, unstable };
}
export function canClearILS(ac, env) {
  return ilsGateState(ac, env).capture;
}
export function isIlsTerminalExcludedMode(mode) {
  return ["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) || isAlternateMode(mode);
}
export function ilsMissedPatch(env, runwayName) {
  return missedApproachPatch(env, runwayName);
}
export function resolveIlsCaptureState(ac, env, mode, clearedILS, routeIndex) {
  const gate = ilsGateState({ ...ac, mode, clearedILS }, env);
  const vappMode = mode === "VISUAL_APP" || mode === "TWR_PATTERN";
  const eligible = ac.category === "ARR" && ilsAutoEligible({ ...ac, mode, routeIndex }, mode) && !vappMode && !ac.touchdown && !isIlsTerminalExcludedMode(mode);
  if (!eligible) return { ac, mode, clearedILS, gate, action: "NONE" };
  if (!clearedILS && gate.capture) {
    return {
      ac: { ...ac, clearedILS: true, mode: "ILS", approachRunway: gate.rw.name, routeRunway: gate.rw.name, assignedHeading: gate.rw.course, assignedSpeed: Math.max(approachSpeedFor(ac) + 20, 150) },
      mode: "ILS",
      clearedILS: true,
      gate,
      action: "CAPTURE",
    };
  }
  if (!clearedILS && gate.unstable && (mode === "DIRECT_FIX" || isFinalMode(mode))) {
    return { ac, mode, clearedILS, gate, action: "MISSED", patch: ilsMissedPatch(env, gate.rw.name) };
  }
  return { ac, mode, clearedILS, gate, action: "MONITOR" };
}
export function resolveIlsGuidanceState(ac, env, mode, clearedILS) {
  if (!clearedILS) return null;
  const ilsRw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const desiredAlt = geo.alongNm * 320;
  const locLimitPx = ILS_NEAR_PX + geo.alongNm * ((ILS_FAR_PX - ILS_NEAR_PX) / 18);
  const nearFinal = geo.alongNm > -0.35 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx + 12;
  const highOnGate = geo.alongNm < 8 && ac.altitude > desiredAlt + 900;
  const fastOnGate = geo.alongNm < 8 && ac.speed > approachSpeedFor(ac) + 55;
  const targetHeading = Math.abs(geo.crossPx) < 10 ? ilsRw.course : headingToPoint(ac.x, ac.y, runwayPointForAircraft(ac, env, clamp(geo.alongNm - 2, 0, 16)));
  const targetSpeed = geo.alongNm < 3 ? approachSpeedFor(ac) : Math.max(approachSpeedFor(ac) + 20, 150);
  const targetAltitude = clamp(desiredAlt + 50, 50, 3000);
  const nextMode = highOnGate || fastOnGate ? "UNSTABLE_ILS" : "ILS";
  const landState = finalLandingState(ac, env, 26, 180);
  const canTouchdown = ac.landingClearance && geo.alongNm < 1.25 && geo.alongNm > -3.0 && Math.abs(geo.crossPx) < 160 && ac.altitude < 1800;
  const lateTouchdown = ac.landingClearance && geo.alongNm < -2.2 && ac.altitude < 900;
  const mustMiss = ((landState.atThreshold || landState.overrun) && !ac.landingClearance) || (!ac.landingClearance && (!nearFinal || geo.alongNm < -1.85));
  return { ilsRw, geo, targetHeading, targetSpeed, targetAltitude, mode: nextMode, land: canTouchdown || lateTouchdown, missed: mustMiss, missedPatch: ilsMissedPatch(env, ac.approachRunway || ac.routeRunway || env.runway.name) };
}
export function vnavConstraintForFix(id) {
  if (!id) return 6000;
  if (id.startsWith("IAF")) return 8000;
  if (id.startsWith("DW_")) return 6000;
  if (id.startsWith("BASE_")) return 5000;
  if (id === "IF01") return 3000;
  if (id === "FAF") return 2200;
  if (id.startsWith("HOLD")) return 6000;
  if (id.startsWith("MA")) return 3000;
  return 6000;
}
export function vnavDescentToIaf(distNextNm) {
  if (distNextNm > 28) return 12000;
  if (distNextNm > 22) return 11000;
  if (distNextNm > 16) return 10000;
  if (distNextNm > 10) return 9000;
  return 8000;
}
export function vnavTargetAltitude(ac, env, routeIndex = ac.routeIndex) {
  if (ac.category !== "ARR") return ac.assignedAltitude;
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const dme = Number.isFinite(geo.alongNm) ? geo.alongNm : 30;
  const absCrossNm = Math.abs(geo.crossPx) / PX_PER_NM;

  if (!ac.clearedILS && ac.route?.length && ac.mode === "ROUTE") {
    const routeNav = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
    const nextId = ac.route[Math.min(routeIndex, ac.route.length - 1)];
    const prevId = ac.route[Math.max(0, routeIndex - 1)];
    const nextFix = wp(routeNav, nextId);
    const nextAlt = vnavConstraintForFix(nextId);
    const prevAlt = vnavConstraintForFix(prevId);
    const distNext = nextFix ? Math.hypot(ac.x - nextFix.x, ac.y - nextFix.y) / PX_PER_NM : 99;
    let target = nextAlt;

    if (nextId === "FAF") target = distNext > 4 ? 3000 : 2200;
    else if (nextId === "IF01") target = distNext > 5 ? Math.max(4000, nextAlt) : nextAlt;
    else if (nextId?.startsWith("BASE_")) target = distNext > 5 ? 5500 : Math.max(5000, nextAlt);
    else if (nextId?.startsWith("DW_")) target = distNext > 6 ? 7000 : Math.max(6000, nextAlt);
    else if (nextId?.startsWith("IAF")) target = vnavDescentToIaf(distNext);
    else target = Math.max(nextAlt, Math.min(prevAlt, nextAlt + distNext * 180));

    return Math.round(clamp(target, 2200, 10000) / 100) * 100;
  }

  if (!ac.clearedILS && (isFinalMode(ac.mode) || ac.mode === "VECTOR" || ac.mode === "DIRECT_FIX")) {
    if (dme > 14) return 5000;
    if (dme > 10) return 4000;
    if (dme > 6.5) return 3000;
    return 2200;
  }

  let target;
  if (dme > 38) target = 12000;
  else if (dme > 32) target = 11000;
  else if (dme > 26) target = 10000;
  else if (dme > 22) target = 9000;
  else if (dme > 18) target = 7500;
  else if (dme > 14) target = 5000;
  else if (dme > 10) target = 4000;
  else if (dme > 7) target = 3000;
  else if (dme > 0) target = Math.max(0, dme * 320);
  else target = 0;
  if (absCrossNm > 10 && dme < 18 && !ac.clearedILS) target = Math.max(target, 4000);
  return Math.round(clamp(target, 0, 10000) / 100) * 100;
}
export function vnavStatus(ac, env) {
  if (ac.category !== "ARR") return "-";
  const tgt = vnavTargetAltitude(ac, env);
  const diff = ac.altitude - tgt;
  if (diff > 900) return "HIGH";
  if (diff < -900) return "LOW";
  return "PATH";
}
export function canClearVisual(ac, env) {
  return ac.category === "ARR" && ac.altitude <= 6000 && ac.speed < Math.max(250, approachSpeedFor(ac) + 110) && env.tailwind <= 7 && !divertRequired(env.wind);
}
export function visualEntryType(ac, env, requested = "DOWNWIND") {
  return "DOWNWIND";
}
export function visualDownwindEntry(env) {
  return visualPatternPoints(env)[0];
}
export function patternLegName(ac) {
  const names = ["OVERHEAD", "UPWIND", "CROSSWIND", "DOWNWIND", "BASE", "FINAL"];
  return names[ac.patternLeg || 0] || "PATTERN";
}
export function inTowerAirspace(ac, env) {
  const br = xyToBearingRange(ac.x, ac.y);
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  return br.rangeNm <= TWR_RADIUS_NM || (geo.alongNm < 8.5 && geo.alongNm > -1.5 && Math.abs(geo.crossPx) < 120 && ac.altitude < 3500);
}
export function runwayOccupied(aircraft, runwayName = null) {
  return aircraft.some((a) => {
    if (a.handedOff || a.landed) return false;
    if (runwayName && a.occupancyRunway && a.occupancyRunway !== runwayName) return false;
    if (a.runwayOccupancy) return true;
    if (runwayName && a.depRunway && a.depRunway !== runwayName) return false;
    return a.towerControlled && a.altitude < 400 && xyToBearingRange(a.x, a.y).rangeNm < 1.2;
  });
}
export function towerQueue(aircraft, env) {
  const arrivals = aircraft.filter((a) => a.category === "ARR" && !a.handedOff && !a.landed && (inTowerAirspace(a, env) || a.towerPending));
  const departures = aircraft.filter((a) => a.category === "DEP" && !a.handedOff && !a.landed && (a.mode === "DEP_READY" || a.mode === "LINEUP_WAIT" || a.mode === "TAKEOFF_ROLL"));
  const pattern = aircraft.filter((a) => a.mode === "TWR_PATTERN" || a.mode === "VISUAL_APP");
  return { arrivals, departures, pattern };
}
export function alternateHandoffState(ac, env) {
  const altAirport = ac.destination || ac.alternate || "RJCH";
  const apt = wp(env.nav, altAirport);
  if (!apt) return null;
  const distNm = Math.hypot(ac.x - apt.x, ac.y - apt.y) / PX_PER_NM;
  const radiusNm = alternateHandoffRadiusNm(altAirport);
  return { altAirport, apt, distNm, radiusNm, inside: distNm <= radiusNm };
}
export function alternateDivertStep(ac, env) {
  const st = alternateHandoffState(ac, env);
  if (!st) return null;
  const targetAltitude = st.distNm > 38 ? 9000 : st.distNm > 24 ? 7000 : 5000;
  const targetSpeed = st.distNm > 28 ? 230 : 210;
  return {
    ...st,
    mode: st.inside ? "ALT_HANDOFF" : "DIVERT",
    targetHeading: headingToPoint(ac.x, ac.y, st.apt),
    targetAltitude,
    targetSpeed,
  };
}
export function alternateLocalizerHeading(course, crossPx, alongNm) {
  const maxIntercept = alongNm > 11 ? 42 : alongNm > 6 ? 32 : 22;
  const gain = alongNm > 11 ? 0.34 : alongNm > 6 ? 0.26 : 0.18;
  return normHeading(course - clamp(crossPx * gain, -maxIntercept, maxIntercept));
}
export function alternateApproachFixes(apt, cfg) {
  return {
    ifPoint: runwayPointAt(apt, cfg.course, 18),
    capturePoint: runwayPointAt(apt, cfg.course, 14),
    interceptPoint: runwayPointAt(apt, cfg.course, 10),
    fafPoint: runwayPointAt(apt, cfg.course, 6.5),
  };
}
export function alternateApproachStep(ac, env, mode) {
  return alternateDivertStep(ac, env);
}
export function finalModeFor(ac) {
  return "FINAL";
}
export function missedApproachPatch(env, runwayName = env.runway.name) {
  const rw = RUNWAYS[runwayName] || env.runway;
  return {
    runwayOccupancy: false,
    occupancyRunway: null,
    touchdown: false,
    towerControlled: false,
    landingClearance: false,
    contact: "DEP",
    category: "DEP",
    destination: "RJCC",
    sid: null,
    depState: "MISSED_APP",
    clearedILS: false,
    missed: true,
    mode: "MISSED_APP",
    route: ["MA1", "MAHOLD"],
    routeIndex: 0,
    hold: null,
    speedRestriction: 200,
    assignedHeading: rw.course,
    assignedAltitude: 3000,
    assignedSpeed: 180,
    routeRunway: rw.name,
    approachRunway: rw.name,
    color: "#ff9f43",
    missedTicks: 0,
  };
}
export function missedApproachSafeToReturn(ac, env) {
  if (ac.category !== "DEP" || ac.depState !== "MISSED_APP") return false;
  const rw = RUNWAYS[ac.routeRunway || ac.approachRunway || env.runway.name] || env.runway;
  const origin = runwayOrigin(rw);
  const geo = finalGeometryAt(origin, rw.course, ac.x, ac.y);
  const distFromRunwayNm = Math.hypot(ac.x - origin.x, ac.y - origin.y) / PX_PER_NM;
  const ticks = ac.missedTicks || 0;
  const highEnough = ac.altitude >= 2600;
  const awayFromRunway = geo.alongNm < -4.8 || distFromRunwayNm >= 5.5 || ticks >= 90;
  const cleanState = !ac.touchdown && !ac.runwayOccupancy && ac.mode === "MISSED_APP";
  return cleanState && highEnough && awayFromRunway;
}
export function missedApproachReturnPatch(ac, env, afterMove = null) {
  const rw = RUNWAYS[env.runway.name] || env.runway;
  const returnRoute = env.routes.MISSED_RETURN || env.routes.VECTORS_IF01 || [];
  const firstFix = returnRoute.length ? wp(env.nav, returnRoute[0]) : null;
  const h = firstFix ? headingToPoint(afterMove?.x ?? ac.x, afterMove?.y ?? ac.y, firstFix) : rw.course;
  return {
    category: "ARR",
    destination: "RJCC",
    sid: null,
    depState: null,
    missed: false,
    missedTicks: 0,
    clearedILS: false,
    landingClearance: false,
    towerControlled: false,
    contact: "APP",
    mode: returnRoute.length ? "ROUTE" : "VECTOR",
    route: returnRoute,
    routeIndex: 0,
    routeRunway: rw.name,
    approachRunway: rw.name,
    hold: null,
    speedRestriction: null,
    assignedHeading: h,
    assignedAltitude: Math.max(4000, Math.round((ac.altitude || 3000) / 100) * 100),
    assignedSpeed: 190,
    color: "#32ff4d",
  };
}
export function normalizeAircraftState(ac) {
  const fromMode = ac.previousMode || ac.lastMode || ac.mode;
  if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) {
    const mode = canonicalMode(ac.mode);
    const invalidTransition = !isValidTransition(fromMode, mode);
    if (invalidTransition && typeof console !== "undefined") console.warn("Unexpected aircraft state transition", { id: ac.id, from: fromMode, to: mode, category: ac.category, type: ac.type });
    return { ...ac, previousMode: mode, invalidTransition, transitionFrom: invalidTransition ? fromMode : null, transitionTo: invalidTransition ? mode : null, mode, towerPending: false, landingClearance: false, towerControlled: false, contact: ac.contact || "RJCJ", takeoffClearance: false, emergencyTowerAccepted: false };
  }
  const mode = canonicalMode(ac.mode);
  const invalidTransition = !isValidTransition(fromMode, mode);
  if (invalidTransition && typeof console !== "undefined") console.warn("Unexpected aircraft state transition", { id: ac.id, from: fromMode, to: mode, category: ac.category, type: ac.type });
  const emergencyTowerAccepted = !!ac.emergencyTowerAccepted && !!(ac.emergency || ac.mode === "MAYDAY" || ac.mode === "PANPAN");
  const forcedTower = emergencyTowerAccepted || ac.towerControlled || ac.contact === "TWR";
  const towerPending = forcedTower ? false : !!ac.towerPending;
  const landingClearance = forcedTower ? !!ac.landingClearance : false;
  const takeoffClearance = ac.mode === "TAKEOFF_ROLL" || ac.mode === "LINEUP_WAIT" ? !!ac.takeoffClearance : ac.category === "DEP" ? !!ac.takeoffClearance : false;
  return { ...ac, previousMode: mode, invalidTransition, transitionFrom: invalidTransition ? fromMode : null, transitionTo: invalidTransition ? mode : null, mode, towerPending, landingClearance, takeoffClearance, emergencyTowerAccepted, towerControlled: forcedTower, contact: forcedTower ? "TWR" : ac.contact };
}
export function canonicalMode(mode) {
  const m = isFinalMode(mode) ? "FINAL" : String(mode || "NO_TARGET");
  return STATE_ALIAS[m] || m;
}
export function isValidTransition(fromMode, toMode) {
  const from = canonicalMode(fromMode);
  const to = canonicalMode(toMode);
  if (!from || from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return true;
  return allowed.map(canonicalMode).includes(to);
}
export function displayMode(a) {
  if (a.category === "MIL" && a.mode === "RJCJ_DEP" && a.altitude < 80 && a.speed > 30) return "RJCJ TAKEOFF ROLL";
  if (a.category === "MIL" && a.mode === "RJCJ_DEP" && a.altitude < 80 && a.speed <= 30) return "RJCJ READY";
  if (a.towerPending && !a.towerControlled) return `${a.mode} / TWR PENDING`;
  if (a.mode === "ROLLOUT") return "ROLLOUT";
  if (a.mode === "VACATED") return "VACATED";
  if (a.landingClearance) {
    if (isFinalMode(a.mode)) return "FINAL / LAND CLR";
    if (a.mode === "ILS") return "ILS / LAND CLR";
    if (a.mode === "VISUAL_APP") return "VISUAL / LAND CLR";
    return `${a.mode} / LAND CLR`;
  }
  if (a.takeoffClearance) return `${a.mode} / TKOF CLR`;
  if (a.towerControlled) {
    if (isFinalMode(a.mode)) return "FINAL / NO CLR";
    if (a.mode === "TWR_PATTERN") return `TWR PATTERN / ${patternLegName(a)}`;
    return `${a.mode} / TWR`;
  }
  return a.mode;
}
export function rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, runwayName = null) {
  const rw = RUNWAYS[runwayName || ac.approachRunway || ac.routeRunway || ac.occupancyRunway || env.runway.name] || env.runway;
  return { ...ac, touchdown: true, landed: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: "RJCC", sid: null, depState: null, towerControlled: true, landingClearance: false, contact: "TWR", heading: rw.course, speed: Math.max(80, spd), altitude: 0, x: point.x, y: point.y, assignedHeading: rw.course, assignedSpeed: 25, assignedAltitude: 0, routeIndex: 0, route: [], patternLeg: 0, mode: "ROLLOUT", clearedILS: false, missed: false, speedRestriction: null, color: "#4ade80", runwayOccupancy: true, occupancyRunway: rw.name, approachRunway: rw.name, routeRunway: rw.name, rolloutTicks: 0, trail: [...ac.trail.slice(-55), trailPoint] };
}
export function alternateRolloutPatch(ac, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, airportId, runwayName, course) {
  return { ...ac, touchdown: true, landed: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: airportId, alternate: airportId, sid: null, depState: null, towerControlled: true, landingClearance: false, contact: "ALT_APP", heading: course, speed: Math.max(70, spd), altitude: 0, x: point.x, y: point.y, assignedHeading: course, assignedSpeed: 0, assignedAltitude: 0, routeIndex: 0, route: [], patternLeg: 0, mode: "ALT_ROLLOUT", clearedILS: false, missed: false, speedRestriction: null, color: "#4ade80", runwayOccupancy: true, occupancyRunway: `${airportId}-${runwayName}`, approachRunway: null, routeRunway: null, rolloutTicks: 0, trail: [...ac.trail.slice(-55), trailPoint] };
}
export function visualPatternPoints(env) {
  const v = hdgVector(env.runway.course);
  const origin = runwayOrigin(env.runway);
  const left = { x: v.y, y: -v.x };
  const lateral = 3.6 * PX_PER_NM;
  return [
    { id: "OVERHEAD", x: origin.x, y: origin.y, alt: PATTERN_ALT, speedAdd: 45 },
    { id: "UPWIND", x: origin.x + v.x * 2.4 * PX_PER_NM, y: origin.y + v.y * 2.4 * PX_PER_NM, alt: PATTERN_ALT, speedAdd: 42 },
    { id: "CROSSWIND", x: origin.x + v.x * 2.4 * PX_PER_NM + left.x * lateral, y: origin.y + v.y * 2.4 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 40 },
    { id: "DOWNWIND", x: origin.x - v.x * 0.6 * PX_PER_NM + left.x * lateral, y: origin.y - v.y * 0.6 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 35 },
    { id: "BASE", x: origin.x - v.x * 4.4 * PX_PER_NM + left.x * lateral, y: origin.y - v.y * 4.4 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 30 },
    { id: "FINAL", x: origin.x - v.x * 5.2 * PX_PER_NM, y: origin.y - v.y * 5.2 * PX_PER_NM, alt: 1500, speedAdd: 25 },
  ];
}
export function isRolloutMode(ac) {
  return ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "ALT_ROLLOUT" || ac.mode === "VACATED";
}
export function isFuelOutMode(ac) {
  return (ac.fuelMinutes ?? 60) <= 0 || ac.mode === "FUEL_EXHAUSTED" || ac.mode === "DEADSTICK";
}
export function rjcjRolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, runwayName = null) {
  const rjcj = wp(env.nav, "RJCJ") || bearingToXY(285, 4.5);
  const rw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === (runwayName || ac.rjcjRunway || env.airports.RJCJ.name)) || env.airports.RJCJ || AIRPORT_RUNWAYS.RJCJ[0];
  return {
    ...ac,
    type: ac.type === "F-15J + MiG-31" ? "F-15J" : ac.type,
    touchdown: true,
    landed: false,
    fuelMinutes: nextFuelMinutes,
    burnRate,
    emergency,
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    towerControlled: false,
    landingClearance: false,
    heading: rw.course,
    speed: Math.max(80, spd),
    altitude: 0,
    x: point?.x ?? rjcj.x,
    y: point?.y ?? rjcj.y,
    assignedHeading: rw.course,
    assignedSpeed: 25,
    assignedAltitude: 0,
    routeIndex: 0,
    route: [],
    patternLeg: 0,
    mode: "RJCJ_ROLLOUT",
    clearedILS: false,
    missed: false,
    speedRestriction: null,
    color: "#60a5fa",
    runwayOccupancy: true,
    occupancyRunway: `RJCJ-${rw.name}`,
    rjcjRunway: rw.name,
    rolloutTicks: 0,
    trail: [...ac.trail.slice(-55), trailPoint || { x: ac.x, y: ac.y }]
  };
}
export function stepRolloutMotion(ac, env) {
  if (ac.landed || ac.handedOff) return ac;
  if (ac.touchdown && ac.mode !== "ROLLOUT" && ac.mode !== "VACATED" && ac.mode !== "RJCJ_ROLLOUT" && ac.mode !== "ALT_ROLLOUT") {
    ac = {
      ...ac,
      category: "ARR",
      sid: null,
      depState: null,
      missed: false,
      clearedILS: false,
      landingClearance: false,
      towerControlled: true,
      contact: "TWR",
      runwayOccupancy: true,
      occupancyRunway: ac.occupancyRunway || env.runway.name,
      mode: "ROLLOUT",
    };
  }
  if (ac.mode === "ALT_ROLLOUT") {
    const nextSpeed = Math.max(0, (ac.speed || 80) - Math.max(4.0, perfFor(ac.type).decel * 1.5));
    const ticks = (ac.rolloutTicks || 0) + 1;
    const fullyStopped = ticks > 55 || nextSpeed <= 12;
    const v = hdgVector(ac.heading || ac.assignedHeading || 120);
    const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
    return { ...ac, touchdown: !fullyStopped, runwayOccupancy: !fullyStopped, angularRate: 0, speed: fullyStopped ? 0 : nextSpeed, altitude: 0, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, mode: fullyStopped ? "VACATED" : "ALT_ROLLOUT", handedOff: fullyStopped, landed: fullyStopped, rolloutTicks: ticks, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  if (ac.mode === "RJCJ_ROLLOUT") {
    const rw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ || AIRPORT_RUNWAYS.RJCJ[0];
    const v = hdgVector(rw.course);
    const nextSpeed = Math.max(16, (ac.speed || 90) - Math.max(4.2, perfFor(ac.type).decel * 1.5));
    const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
    const ticks = (ac.rolloutTicks || 0) + 1;
    const fullyStopped = ticks > 70 || nextSpeed <= 20;
    return { ...ac, touchdown: !fullyStopped, runwayOccupancy: !fullyStopped, angularRate: 0, speed: fullyStopped ? 0 : nextSpeed, altitude: 0, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, assignedSpeed: 0, assignedAltitude: 0, contact: "RJCJ", mode: fullyStopped ? "RJCJ_PARKED" : "RJCJ_ROLLOUT", handedOff: fullyStopped, landed: fullyStopped, rolloutTicks: ticks, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  const rw = RUNWAYS[ac.occupancyRunway || env.runway.name] || env.runway;
  const v = hdgVector(rw.course);
  const nextSpeed = Math.max(18, (ac.speed || 90) - Math.max(3.5, perfFor(ac.type).decel * 1.4));
  const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
  const ticks = (ac.rolloutTicks || 0) + 1;
  const slowEnoughToVacate = nextSpeed <= 60;
  const fullyStopped = ticks > 60 || nextSpeed <= 22;
  return { ...ac, touchdown: false, angularRate: 0, category: "ARR", sid: null, depState: null, missed: false, clearedILS: false, towerControlled: !fullyStopped, contact: fullyStopped ? null : "TWR", landingClearance: false, runwayOccupancy: !slowEnoughToVacate, occupancyRunway: slowEnoughToVacate ? null : rw.name, altitude: 0, assignedAltitude: 0, speed: fullyStopped ? 0 : nextSpeed, assignedSpeed: 0, heading: rw.course, assignedHeading: rw.course, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, rolloutTicks: ticks, mode: fullyStopped ? "VACATED" : "ROLLOUT", handedOff: fullyStopped, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
export function stepFuelOutMotion(ac, env) {
  const v = hdgVector(ac.heading), deadstickSpeed = Math.max(0, ac.speed - 5), deadstickAlt = Math.max(0, ac.altitude - 120), distanceNm = (deadstickSpeed * SIM_STEP_SECONDS) / 3600, stopped = deadstickAlt <= 0 || deadstickSpeed <= 20;
  return { ...ac, fuelMinutes: 0, angularRate: 0, mode: stopped ? "FUEL_EXHAUSTED" : "DEADSTICK", speed: stopped ? 0 : deadstickSpeed, altitude: stopped ? 0 : deadstickAlt, x: stopped ? ac.x : ac.x + v.x * distanceNm * PX_PER_NM, y: stopped ? ac.y : ac.y + v.y * distanceNm * PX_PER_NM, assignedSpeed: 0, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
export function aircraftStep(ac, env) {
  return aircraftCoreStep(ac, env);
}
export function aircraftCoreStep(ac, env) {
  if (ac.landed || ac.handedOff) return ac;
  if (isFoxhound(ac)) return stepFoxhoundIntruder(ac, env);
  if (isRolloutMode(ac)) return stepRolloutAircraft(ac, env, stepRolloutMotion);
  if (isFuelOutMode(ac)) return stepFuelOutAircraft(ac, env, stepFuelOutMotion);
  if (isAlternateMode(ac.mode)) return stepAlternateAircraft(ac, env);
  if (ac.category === "MIL") return stepMilitaryAircraft(ac, env);
  if (ac.category === "DEP") return stepDepartureAircraft(ac, env);
  return stepArrivalAircraft(ac, env);
}
export function stepFoxhoundIntruder(ac, env) {
  const area = ac.adizArea || foxhoundAdizArea();
  const targetHeading = ac.mode === "FOXHOUND_EGRESS" ? 315 : ac.mode === "FOXHOUND_FORMATION" ? (ac.assignedHeading ?? ac.heading) : headingToPoint(ac.x, ac.y, { x: area.x, y: area.y });
  const targetSpeed = ac.mode === "FOXHOUND_EGRESS" ? 620 : ac.mode === "FOXHOUND_FORMATION" ? (ac.assignedSpeed ?? ac.speed ?? 520) : 520;
  const targetAltitude = 31000;
  const maxSpd = Math.max(900, ac.maxSpeedOverride || 0);
  const hdg = normHeading(ac.heading + clamp(shortestTurn(ac.heading, targetHeading), -2.2, 2.2));
  const spd = ac.speed + clamp(targetSpeed - ac.speed, -8, 8);
  const alt = Math.max(0, ac.altitude + clamp(targetAltitude - ac.altitude, -450, 450));
  const v = hdgVector(hdg);
  const distNm = (spd * SIM_STEP_SECONDS) / 3600;
  const afterMove = { x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM };
  return { ...ac, heading: hdg, angularRate: shortestTurn(ac.heading, hdg) / SIM_STEP_SECONDS, speed: clamp(spd, 220, maxSpd), altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, adizArea: area, color: ac.mode === "FOXHOUND_EGRESS" ? "#f97316" : "#ef4444", trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
export function stepAlternateAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "ALTERNATE");
}
export function stepMilitaryAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "MILITARY");
}
export function stepDepartureAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "DEPARTURE");
}
export function stepArrivalAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "ARRIVAL");
}
export function resolveMilitaryTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed) {
  const rjcj = wp(env.nav, "RJCJ");
  const rjcjRw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ;
  if (shouldMilitaryRTB(ac, env)) {
    const rtb = militaryRtbPatch(ac, env);
    mode = rtb.mode;
    targetHeading = rtb.assignedHeading;
    targetAltitude = rtb.assignedAltitude;
    targetSpeed = rtb.assignedSpeed;
    ac = { ...ac, ...rtb };
  }
  if (mode === "RJCJ_DEP") {
    const area = getAircraftMissionArea(ac);
    const adizArea = ac.missionKind === "INTERCEPT" ? foxhoundAdizArea() : null;
    const mp = ac.missionKind === "INTERCEPT" ? { x: adizArea.x, y: adizArea.y } : missionAreaPoint(area);
    const depRw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ;
    const westGate = rjcjDepartureGate(env, depRw.name, ac.type);
    const distGate = Math.hypot(ac.x - westGate.x, ac.y - westGate.y) / PX_PER_NM;
    const distMission = Math.hypot(ac.x - mp.x, ac.y - mp.y) / PX_PER_NM;
    const scrambleIntercept = ac.missionKind === "INTERCEPT" && ac.type === "F-15J" && ac.maxSpeedOverride >= 700;
    if (scrambleIntercept) {
      const rotate = 150;
      if (!ac.rjcjAirborne) {
        targetHeading = depRw.course;
        targetSpeed = ac.speed < rotate ? 290 : 430;
        targetAltitude = ac.speed >= rotate ? 8000 : 0;
        if (ac.speed >= rotate && ac.altitude > 60) ac = { ...ac, rjcjAirborne: true, rjcjWestGatePassed: true, takeoffClearance: false, towerControlled: false, contact: "RJCJ" };
      } else {
        ac = { ...ac, rjcjWestGatePassed: true, contact: "RJCJ" };
        const interceptPoint = ac.interceptTargetX !== undefined && ac.interceptTargetY !== undefined ? { x: ac.interceptTargetX, y: ac.interceptTargetY } : mp;
        const joinProfile = ["REJOIN", "JOIN_STERN", "VISUAL_ID", "FORMATION"].includes(ac.interceptPhase);
        targetHeading = ac.interceptJoinHeading ?? headingToPoint(ac.x, ac.y, interceptPoint);
        targetAltitude = joinProfile ? clamp(ac.assignedAltitude || 31000, 20000, 38000) : clamp(ac.assignedAltitude || 32000, 24000, 38000);
        targetSpeed = joinProfile ? clamp(ac.assignedSpeed || 600, 500, ac.maxSpeedOverride || 880) : ac.altitude < 10000 ? 470 : (ac.maxSpeedOverride || 850);
      }
    } else if (!ac.rjcjAirborne) {
      targetHeading = depRw.course;
      const rotate = Math.max(145, approachSpeedFor(ac) + 15);
      targetSpeed = ac.speed < rotate ? rotate + 12 : Math.max(165, cleanSpeedFor(ac));
      targetAltitude = ac.speed >= rotate ? Math.max(1200, ac.assignedAltitude || 1200) : 0;
      if (ac.speed >= rotate && ac.altitude > 40) ac = { ...ac, rjcjAirborne: true };
    } else if (!ac.rjcjWestGatePassed && distGate > 1.3) {
      targetHeading = headingToPoint(ac.x, ac.y, westGate);
      targetAltitude = Math.min(4000, clamp(ac.assignedAltitude, area.minAlt, area.maxAlt));
      targetSpeed = Math.min(ac.assignedSpeed, ac.type === "F-15J" ? 260 : 190);
    } else {
      ac = { ...ac, rjcjWestGatePassed: true };
      targetHeading = headingToPoint(ac.x, ac.y, mp);
      targetAltitude = clamp(ac.assignedAltitude, area.minAlt, area.maxAlt);
      targetSpeed = ac.assignedSpeed;
    }
    if (!scrambleIntercept && distMission < area.radiusNm * 0.8) mode = "RJCJ_MISSION";
  } else if (mode === "ADIZ_ESCORT") {
    const area = ac.adizArea || foxhoundAdizArea();
    const exit = bearingToXY(315, 78);
    targetHeading = headingToPoint(ac.x, ac.y, exit);
    targetAltitude = 31000;
    targetSpeed = 580;
    ac = { ...ac, contact: "RJCJ", assignedAltitude: 31000, assignedSpeed: 620 };
    if (adizEscortComplete(ac)) {
      const rtb = foxhoundEscortPatch(ac, env);
      mode = rtb.mode;
      targetHeading = rtb.assignedHeading;
      targetAltitude = rtb.assignedAltitude;
      targetSpeed = rtb.assignedSpeed;
      ac = { ...ac, ...rtb };
    }
  } else if (mode === "RJCJ_MISSION") {
    const area = getAircraftMissionArea(ac);
    const mp = missionAreaPoint(area);
    const dxNm = (ac.x - mp.x) / PX_PER_NM;
    const dyNm = (ac.y - mp.y) / PX_PER_NM;
    const angle = Math.atan2(dyNm, dxNm);
    const radiusNm = Math.hypot(dxNm, dyNm);
    const orbitRadius = area.radiusNm * (isRotor(ac) ? 0.45 : 0.62);
    const step = isRotor(ac) ? 0.48 : 0.62;
    const target = { x: mp.x + Math.cos(angle + step) * orbitRadius * PX_PER_NM, y: mp.y + Math.sin(angle + step) * orbitRadius * PX_PER_NM };
    targetHeading = radiusNm > area.radiusNm ? headingToPoint(ac.x, ac.y, mp) : headingToPoint(ac.x, ac.y, target);
    targetAltitude = clamp(ac.assignedAltitude, area.minAlt, area.maxAlt);
    targetSpeed = isRotor(ac) ? 85 : ac.type === "F-15J" ? 320 : 190;
    ac = { ...ac, missionTicks: (ac.missionTicks || 0) + 1 };
    if ((ac.missionTicks || 0) > (isRotor(ac) ? 720 : 900) && Math.random() < 0.003) mode = isRotor(ac) ? "RJCJ_HELO_RECOVERY" : "RJCJ_RECOVERY";
  } else if (mode === "RJCJ_WX_AVOID") {
    targetHeading = ac.wxResumeHeading ?? ac.assignedHeading;
    targetAltitude = ac.wxResumeAltitude ?? ac.assignedAltitude;
    targetSpeed = ac.wxResumeSpeed ?? ac.assignedSpeed;
    mode = ac.wxResumeMode || "RJCJ_DEP";
  } else if (mode === "RJCJ_RTB" || mode === "RJCJ_RECOVERY") {
    const finalFix = runwayPointAt(rjcj, rjcjRw.course, 11);
    const distFinal = Math.hypot(ac.x - finalFix.x, ac.y - finalFix.y) / PX_PER_NM;
    targetHeading = headingToPoint(ac.x, ac.y, finalFix);
    targetAltitude = 3500;
    targetSpeed = ac.type === "F-15J" ? 240 : cleanSpeedFor(ac);
    if (distFinal < 2.0) mode = "RJCJ_ILS";
  } else if (mode === "RJCJ_ILS") {
    const geo = finalGeometryAt(rjcj, rjcjRw.course, ac.x, ac.y);
    targetHeading = Math.abs(geo.crossPx) < 18 ? rjcjRw.course : headingToPoint(ac.x, ac.y, runwayPointAt(rjcj, rjcjRw.course, clamp(geo.alongNm - 2, 0, 10)));
    targetAltitude = clamp(geo.alongNm * 350, 0, 3000);
    targetSpeed = approachSpeedFor(ac);
    if (geo.alongNm < 0.35 && geo.alongNm > -1.2 && ac.altitude < 450 && Math.abs(geo.crossPx) < 70) {
      const touchdown = runwayPointAt(rjcj, rjcjRw.course, clamp(geo.alongNm, -0.08, 0.08));
      return { ac, mode, targetHeading, targetAltitude, targetSpeed, landed, directReturn: rjcjRolloutPatch(ac, env, Math.max(0, (ac.fuelMinutes ?? 60) - (estimateBurnRate(ac, 0, 25) * SIM_STEP_SECONDS) / 60), estimateBurnRate(ac, 0, 25), ac.emergency, ac.speed, touchdown, { x: ac.x, y: ac.y }, rjcjRw.name) };
    }
  } else if (mode === "RJCJ_VECTOR") {
    targetHeading = ac.assignedHeading;
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
  } else {
    targetHeading = ac.assignedHeading;
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
    if (xyToBearingRange(ac.x, ac.y).rangeNm > 80) mode = "RJCJ_OUTSIDE";
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed, landed, directReturn: null };
}
export function resolveArrivalTargetState(ac, env, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, navForAc) {
  const appRw = approachRunwayForAircraft(ac, env);
  if (isFinalMode(mode)) {
    const state = finalLandingState(ac, env, 36, 220);
    const finalRw = state.runway || appRw;
    targetHeading = finalRw.course;
    targetSpeed = Math.max(approachSpeedFor(ac) + 20, 150);
    targetAltitude = clamp(state.geo.alongNm * 320, 0, 3000);
    if (ac.landingClearance && state.geo.alongNm < 1.25 && state.geo.alongNm > -3.0 && Math.abs(state.geo.crossPx) < 160 && ac.altitude < 1800) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: finalRw.name, approachRunway: finalRw.name, routeRunway: finalRw.name };
    } else if ((state.atThreshold || state.overrun) && !ac.landingClearance) {
      const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
      missed = true;
      clearedILS = false;
      mode = "MISSED";
      targetHeading = missedRw.course;
      targetAltitude = 3000;
      targetSpeed = 180;
      ac = { ...ac, routeRunway: missedRw.name, approachRunway: missedRw.name };
    } else if (ac.landingClearance && state.geo.alongNm < -2.2 && ac.altitude < 900) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: finalRw.name, approachRunway: finalRw.name, routeRunway: finalRw.name };
    } else mode = finalModeFor(ac);
  } else if (mode === "HOLD" && ac.hold) {
    const fixId = ac.hold.fixId || "HOLD_SW";
    const pattern = holdPatternPoints(navForAc, fixId, ac.hold.navRunway || ac.routeRunway || env.runway.name);
    const leg = clamp(ac.hold.legIndex || 0, 0, Math.max(0, pattern.length - 1));
    const target = pattern[leg] || wp(navForAc, fixId) || wp(navForAc, "HOLD_SW");
    const distNm = target ? Math.hypot(ac.x - target.x, ac.y - target.y) / PX_PER_NM : 99;
    let nextLeg = leg;
    if (target && distNm < 0.75) nextLeg = leg >= pattern.length - 2 ? 0 : leg + 1;
    ac = { ...ac, hold: { ...ac.hold, legIndex: nextLeg } };
    const nextTarget = pattern[nextLeg] || target;
    targetHeading = nextTarget ? headingToPoint(ac.x, ac.y, nextTarget) : targetHeading;
    targetAltitude = ac.hold.altitude;
    targetSpeed = 190;
  } else if (mode === "ROUTE" && ac.route.length) {
    const fix = wp(navForAc, ac.route[routeIndex]);
    if (fix) {
      const distNm = Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM;
      const remaining = ac.route.length - routeIndex;
      const vnavAlt = vnavTargetAltitude(ac, env, routeIndex);
      const high = ac.altitude - vnavAlt > 900;
      const low = ac.altitude - vnavAlt < -900;
      targetHeading = headingToPoint(ac.x, ac.y, fix);
      targetSpeed = remaining <= 2 ? (high ? 160 : 170) : high ? 190 : low ? 210 : 200;
      targetAltitude = vnavAlt;
      if (fix.id?.startsWith("BASE_") && distNm < 2.8 && ac.route?.[routeIndex + 1]) {
        const nextFix = wp(navForAc, ac.route[routeIndex + 1]);
        if (nextFix) {
          routeIndex += 1;
          targetHeading = headingToPoint(ac.x, ac.y, nextFix);
          targetAltitude = vnavTargetAltitude(ac, env, routeIndex);
          targetSpeed = 180;
        }
      }
      if (distNm < 1.2) {
        if (routeIndex < ac.route.length - 1) routeIndex += 1;
        else {
          mode = finalModeFor(ac);
          targetHeading = approachRunwayForAircraft(ac, env).course;
          targetSpeed = 160;
          targetAltitude = vnavTargetAltitude(ac, env, routeIndex);
          ac = { ...ac, approachRunway: ac.approachRunway || ac.routeRunway || env.runway.name };
        }
      }
    }
  }
  const ilsGuidance = resolveIlsGuidanceState(ac, env, mode, clearedILS);
  if (ilsGuidance) {
    targetHeading = ilsGuidance.targetHeading;
    targetSpeed = ilsGuidance.targetSpeed;
    targetAltitude = ilsGuidance.targetAltitude;
    mode = ilsGuidance.mode;
    if (ilsGuidance.land) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: ilsGuidance.ilsRw.name, approachRunway: ilsGuidance.ilsRw.name, routeRunway: ilsGuidance.ilsRw.name };
    } else if (ilsGuidance.missed) {
      missed = true;
      clearedILS = false;
      mode = "MISSED";
      targetHeading = ilsGuidance.missedPatch.assignedHeading;
      targetAltitude = ilsGuidance.missedPatch.assignedAltitude;
      targetSpeed = ilsGuidance.missedPatch.assignedSpeed;
      ac = { ...ac, routeRunway: ilsGuidance.missedPatch.routeRunway, approachRunway: ilsGuidance.missedPatch.approachRunway };
    }
  }
  return { ac, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg };
}
export function resolveVisualTargetState(ac, env, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, appRw) {
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const patternEnv = appRw.name === env.runway.name ? env : { ...env, runway: appRw, nav: makeNavCached(appRw.name), routes: makeRoutes(appRw.name), sids: makeSids(appRw.name) };
  const pattern = visualPatternPoints(patternEnv);
  const leg = clamp(patternLeg || 0, 0, pattern.length - 1);
  const fix = pattern[leg];
  if (leg < pattern.length - 1) {
    const distNm = Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM;
    targetHeading = headingToPoint(ac.x, ac.y, fix);
    targetAltitude = fix.alt;
    targetSpeed = Math.max(approachSpeedFor(ac) + fix.speedAdd, 145);
    mode = inTowerAirspace(ac, env) ? "TWR_PATTERN" : "VISUAL_APP";
    if (distNm < 1.0) {
      const nextLeg = Math.min(leg + 1, pattern.length - 1);
      patternLeg = nextLeg;
      if (fix.id === "DOWNWIND") ac = { ...ac, patternReport: "DOWNWIND" };
      if (inTowerAirspace(ac, env)) ac = { ...ac, towerControlled: true, contact: "TWR", towerPending: false };
    }
  } else {
    const finalFix = pattern[pattern.length - 1];
    const distFinal = Math.hypot(ac.x - finalFix.x, ac.y - finalFix.y) / PX_PER_NM;
    if (distFinal > 0.8 && geo.alongNm > 3.8) {
      targetHeading = headingToPoint(ac.x, ac.y, finalFix);
      targetAltitude = finalFix.alt;
      targetSpeed = Math.max(approachSpeedFor(ac) + 25, 145);
      mode = "TWR_PATTERN";
    } else {
      mode = "VISUAL_APP";
      const aim = runwayPointForAircraft(ac, env, clamp(geo.alongNm - 1.4, 0, 10));
      targetHeading = Math.abs(geo.crossPx) < 10 ? appRw.course : headingToPoint(ac.x, ac.y, aim);
      targetAltitude = clamp(geo.alongNm * 300, 0, 2500);
      targetSpeed = geo.alongNm < 3 ? approachSpeedFor(ac) : Math.max(approachSpeedFor(ac) + 20, 145);
    }
  }
  const state = finalLandingState(ac, env, 60, 320);
  const unstable = state.geo.alongNm < 2.2 && (Math.abs(state.geo.crossPx) > 85 || ac.speed > approachSpeedFor(ac) + 70 || Math.abs(ac.altitude - Math.max(0, state.geo.alongNm * 300)) > 1100);
  if (ac.landingClearance && patternLeg >= 5 && Math.abs(shortestTurn(ac.heading, appRw.course)) < 85 && state.geo.alongNm < 1.35 && state.geo.alongNm > -3.0 && Math.abs(state.geo.crossPx) < 170 && ac.altitude < 1900) {
    landed = true;
    ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: appRw.name, approachRunway: appRw.name, routeRunway: appRw.name };
  } else if (!ac.landingClearance && (state.overrun || unstable) && ac.altitude < 700) {
    const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
    missed = true;
    clearedILS = false;
    mode = "MISSED";
    targetHeading = missedRw.course;
    targetAltitude = 3000;
    targetSpeed = 180;
    ac = { ...ac, routeRunway: missedRw.name, approachRunway: missedRw.name };
  }
  return { ac, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg };
}
export function aircraftMotionStep(ac, env, stepKind = "ARRIVAL") {
  if (ac.landed || ac.handedOff) return ac;
  if (isRolloutMode(ac)) return stepRolloutMotion(ac, env);
  if (isFuelOutMode(ac)) return stepFuelOutMotion(ac, env);
  let targetHeading = ac.assignedHeading, targetSpeed = ac.assignedSpeed, targetAltitude = ac.assignedAltitude, mode = ac.mode, routeIndex = ac.routeIndex, clearedILS = ac.clearedILS, landed = false, missed = ac.missed, patternLeg = ac.patternLeg || 0;
  let alternateLanding = null;
  const navForAc = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
  const routesForAc = ac.routeRunway ? makeRoutes(ac.routeRunway) : env.routes;

  const appRw = approachRunwayForAircraft(ac, env);
  const earlyGeo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const closedRunwayApproachMissed = ac.category === "ARR" && !ac.touchdown && env.closedRunways?.includes(appRw.name) && !["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) && !isAlternateMode(mode) && (ac.clearedILS || isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || ac.approachRunway === appRw.name || ac.routeRunway === appRw.name);
  const forcedRunwayChangeMissed = ac.category === "ARR" && !ac.touchdown && !["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) && !isAlternateMode(mode) && (ac.clearedILS || isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN") && runwayPairName(appRw.name) !== runwayPairName(env.runway.name);
  if (closedRunwayApproachMissed || forcedRunwayChangeMissed) {
    return { ...ac, touchdown: false, runwayOccupancy: false, occupancyRunway: null, category: "DEP", destination: "RJCC", sid: null, depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, routeRunway: appRw.name, approachRunway: appRw.name, clearedILS: false, landingClearance: false, towerControlled: false, contact: "DEP", missed: true, assignedHeading: appRw.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43", missedTicks: 0 };
  }
  const vappMode = mode === "VISUAL_APP" || mode === "TWR_PATTERN";
  const ilsCapture = resolveIlsCaptureState(ac, env, mode, clearedILS, routeIndex);
  if (ilsCapture.action === "MISSED") return { ...ac, ...ilsCapture.patch };
  ac = ilsCapture.ac;
  mode = ilsCapture.mode;
  clearedILS = ilsCapture.clearedILS;
  const visualFinalReady = !vappMode || (patternLeg >= 5 && Math.abs(shortestTurn(ac.heading, appRw.course)) < 85);
  const earlyTouchdownAllowed =
    ac.category === "ARR" &&
    ac.landingClearance &&
    visualFinalReady &&
    (ac.clearedILS || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || isFinalMode(mode) || mode === "MISSED") &&
    earlyGeo.alongNm <= 1.25 &&
    earlyGeo.alongNm > -3.0 &&
    Math.abs(earlyGeo.crossPx) < 160 &&
    ac.altitude < 1800 &&
    ac.speed < approachSpeedFor(ac) + 190;
  if (earlyTouchdownAllowed) {
    const p = runwayPointForAircraft(ac, env, clamp(earlyGeo.alongNm, -0.15, 0.15));
    const br = estimateBurnRate(ac, 0, 25);
    return rolloutPatch(ac, env, Math.max(0, (ac.fuelMinutes ?? 60) - br / 60), br, ac.emergency, ac.speed, p, { x: ac.x, y: ac.y }, appRw.name);
  }

  if (shouldAutoMissed(ac, env) || wrongRunwayTailwindMiss(ac, env)) {
    const missedRunway = ac.approachRunway || ac.routeRunway || env.runway.name;
    const missedRw = RUNWAYS[missedRunway] || env.runway;
    return { ...ac, touchdown: false, runwayOccupancy: false, occupancyRunway: null, fuelMinutes: Math.max(0, (ac.fuelMinutes ?? 60) - (estimateBurnRate(ac, 3000, 180) * SIM_STEP_SECONDS) / 60), burnRate: estimateBurnRate(ac, 3000, 180), category: "DEP", destination: "RJCC", sid: null, depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, routeRunway: missedRw.name, approachRunway: missedRw.name, clearedILS: false, landingClearance: false, towerControlled: false, contact: "DEP", missed: true, assignedHeading: missedRw.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43", missedTicks: 0 };
  }

  if (mode === "VISUAL_APP" || mode === "TWR_PATTERN") {
    const visualState = resolveVisualTargetState(ac, env, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, appRw);
    ac = visualState.ac;
    mode = visualState.mode;
    clearedILS = visualState.clearedILS;
    targetHeading = visualState.targetHeading;
    targetAltitude = visualState.targetAltitude;
    targetSpeed = visualState.targetSpeed;
    landed = visualState.landed;
    missed = visualState.missed;
    patternLeg = visualState.patternLeg;
  } else if (mode === "LINEUP_WAIT" || mode === "TAKEOFF_ROLL" || mode === "INITIAL_CLIMB") {
    const depGroundState = resolveDepartureGroundTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed);
    ac = depGroundState.ac;
    mode = depGroundState.mode;
    targetHeading = depGroundState.targetHeading;
    targetAltitude = depGroundState.targetAltitude;
    targetSpeed = depGroundState.targetSpeed;
  } else if (isRotor(ac) && (mode === "RJCJ_HELO_DEP" || mode === "RJCJ_HELO_RECOVERY" || mode === "RJCJ_HELO_VECTOR")) {
    const rotorState = resolveRotorTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed);
    ac = rotorState.ac;
    mode = rotorState.mode;
    targetHeading = rotorState.targetHeading;
    targetAltitude = rotorState.targetAltitude;
    targetSpeed = rotorState.targetSpeed;
    landed = rotorState.landed;
  } else if (mode === "DIRECT_FIX" && ac.route.length) {
    const directState = resolveDirectFixTargetState(ac, navForAc, mode, targetHeading, targetAltitude, targetSpeed);
    ac = directState.ac;
    mode = directState.mode;
    targetHeading = directState.targetHeading;
    targetAltitude = directState.targetAltitude;
    targetSpeed = directState.targetSpeed;
  } else if (["DIVERT", "ALT_HANDOFF"].includes(ac.mode)) {
    const altState = resolveAlternateTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, alternateDivertStep);
    ac = altState.ac;
    mode = altState.mode;
    targetHeading = altState.targetHeading;
    targetAltitude = altState.targetAltitude;
    targetSpeed = altState.targetSpeed;
  } else if (stepKind === "MILITARY") {
    const milState = resolveMilitaryTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed);
    if (milState.directReturn) return milState.directReturn;
    ac = milState.ac;
    mode = milState.mode;
    targetHeading = milState.targetHeading;
    targetAltitude = milState.targetAltitude;
    targetSpeed = milState.targetSpeed;
    landed = milState.landed;
  } else if (stepKind === "DEPARTURE") {
    const depState = resolveDepartureTargetState(ac, env, mode, routeIndex, targetHeading, targetAltitude, targetSpeed, {
      depExitReady,
      makeNavCached,
      missedApproachReturnPatch,
      missedApproachSafeToReturn,
    });
    ac = depState.ac;
    mode = depState.mode;
    routeIndex = depState.routeIndex;
    targetHeading = depState.targetHeading;
    targetAltitude = depState.targetAltitude;
    targetSpeed = depState.targetSpeed;
  } else if (stepKind === "ARRIVAL" || stepKind === "ALTERNATE") {
    const arrState = resolveArrivalTargetState(ac, env, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, navForAc);
    ac = arrState.ac;
    mode = arrState.mode;
    routeIndex = arrState.routeIndex;
    clearedILS = arrState.clearedILS;
    targetHeading = arrState.targetHeading;
    targetAltitude = arrState.targetAltitude;
    targetSpeed = arrState.targetSpeed;
    landed = arrState.landed;
    missed = arrState.missed;
    patternLeg = arrState.patternLeg;
  }

  const missionConflict = nearestMissionAreaAhead(ac, targetHeading);
  if (missionConflict) {
    targetHeading = normHeading(targetHeading + (missionConflict.side >= 0 ? -28 : 28));
    if (ac.category === "ARR" && !isApproachMode(mode)) mode = "VECTOR";
  }
  if (ac.speedRestriction !== null && ac.speedRestriction !== undefined) targetSpeed = Math.min(targetSpeed, ac.speedRestriction);
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT") targetSpeed = 0;
  else if (mode === "TAKEOFF_ROLL") targetSpeed = clamp(targetSpeed, 0, speedLimitForAircraft(ac, Math.min(ac.altitude, targetAltitude)));
  else if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) targetSpeed = clamp(targetSpeed, 0, ac.maxSpeedOverride);
  else targetSpeed = clamp(targetSpeed, 90, speedLimitForAircraft(ac, Math.min(ac.altitude, targetAltitude)));
  if (ac.category === "MIL" && env.weatherOn && !isRotor(ac)) {
    const wx = nearestRedWeatherAhead(ac, targetHeading, env.weatherCells);
    if (wx) {
      const resumeMode = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeMode || "RJCJ_DEP") : mode;
      const resumeHeading = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeHeading ?? targetHeading) : targetHeading;
      const resumeAltitude = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeAltitude ?? targetAltitude) : targetAltitude;
      const resumeSpeed = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeSpeed ?? targetSpeed) : targetSpeed;
      const avoidTurn = wx.side >= 0 ? -62 : 62;
      const hardTurn = wx.d < Math.max(wx.cell.wid || 20, 18) ? 82 : 62;
      targetHeading = normHeading(resumeHeading + (wx.side >= 0 ? -hardTurn : hardTurn));
      targetAltitude = resumeAltitude;
      targetSpeed = resumeSpeed;
      if (mode !== "RJCJ_RECOVERY" && mode !== "RJCJ_ILS") {
        mode = "RJCJ_WX_AVOID";
        ac = { ...ac, wxResumeMode: resumeMode, wxResumeHeading: resumeHeading, wxResumeAltitude: resumeAltitude, wxResumeSpeed: resumeSpeed, wxAvoidSide: avoidTurn };
      }
    } else if (mode === "RJCJ_WX_AVOID") {
      mode = ac.wxResumeMode || "RJCJ_DEP";
      targetHeading = ac.wxResumeHeading ?? targetHeading;
      targetAltitude = ac.wxResumeAltitude ?? targetAltitude;
      targetSpeed = ac.wxResumeSpeed ?? targetSpeed;
      ac = { ...ac, wxResumeMode: null, wxResumeHeading: null, wxResumeAltitude: null, wxResumeSpeed: null };
    }
  }
  const burnRate = estimateBurnRate(ac, targetAltitude, targetSpeed), nextFuelMinutes = Math.max(0, (ac.fuelMinutes ?? 60) - (burnRate * SIM_STEP_SECONDS) / 60);
  const perf = perfFor(ac.type);
  const altDelta = targetAltitude - ac.altitude;
  const scrambleProfile = ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700;
  const effectiveClimb = scrambleProfile ? (ac.altitude < 10000 ? 28000 : 42000) : perf.climb;
  const effectiveDescent = scrambleProfile ? Math.max(perf.descent, 18000) : perf.descent;
  const climbStep = altDelta >= 0 ? effectiveClimb : effectiveDescent;
  const secondsPerTick = SIM_STEP_SECONDS;
  const climbStepUp = (effectiveClimb / 60) * secondsPerTick;
  const climbStepDown = (effectiveDescent / 60) * secondsPerTick;
  const verticalStep = clamp(altDelta, -climbStepDown, climbStepUp);
  const climbRateFpm = (verticalStep / secondsPerTick) * 60;
  let accel = perf.accel, decel = perf.decel;
  if (climbRateFpm > 1000) accel *= 0.55;
  if (climbRateFpm > 2200) accel *= 0.32;
  if (scrambleProfile) {
    accel = Math.max(accel, ac.altitude < 10000 ? 26.0 : 36.0);
  }
  if (climbRateFpm < -1000) decel *= 0.58;
  if (climbRateFpm < -2200) decel *= 0.38;
  let hdg = normHeading(ac.heading + clamp(shortestTurn(ac.heading, targetHeading), -perf.turn, perf.turn)), spd = ac.speed + clamp(targetSpeed - ac.speed, -decel, accel), alt = Math.max(0, ac.altitude + verticalStep);
  if (ac.category !== "MIL" && alt < 10000 && spd > 250) spd = Math.max(250, spd - Math.max(3, perf.decel));
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT") spd = 0;
  else if (mode === "TAKEOFF_ROLL") spd = clamp(spd, 0, speedLimitForAircraft(ac, alt));
  else if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) spd = clamp(spd, 0, ac.maxSpeedOverride);
  else spd = clamp(spd, perf.min, speedLimitForAircraft(ac, alt));
  const air = hdgVector(hdg), wv = windVector(env.wind), distanceAirNm = (spd * SIM_STEP_SECONDS) / 3600, distanceWindNm = (env.wind.speed * SIM_STEP_SECONDS) / 3600;
  let dx = (air.x * distanceAirNm + wv.x * distanceWindNm) * PX_PER_NM, dy = (air.y * distanceAirNm + wv.y * distanceWindNm) * PX_PER_NM;
  if (mode === "TAKEOFF_ROLL" && alt < 50) { dx = air.x * distanceAirNm * PX_PER_NM; dy = air.y * distanceAirNm * PX_PER_NM; }
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT" || (ac.altitude <= 0 && spd <= 1 && !ac.takeoffClearance)) { dx = 0; dy = 0; }
  const beforeMove = { x: ac.x, y: ac.y };
  let afterMove = { x: ac.x + dx, y: ac.y + dy };
  let emergency = ac.emergency;
  if (env.weatherOn && ac.category === "ARR" && !isGroundTraffic(ac) && ac.altitude >= 500 && !["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "INITIAL_CLIMB", "DEP_RADAR_CONTACT", "SID", "ACC_READY", "ROLLOUT", "VACATED"].includes(mode) && intersectsRedWeather(beforeMove, afterMove, env.weatherCells, ac)) {
    const chance = ac.altitude < 6000 ? 0.1 : 0.055;
    if (!emergency && Math.random() < chance) emergency = ac.altitude < 6000 ? "MAYDAY" : "PANPAN";
    ac = { ...ac, wxExposure: (ac.wxExposure || 0) + 1 };
    if (emergency) {
      mode = emergency;
      clearedILS = false;
      targetAltitude = Math.max(3000, ac.altitude);
      targetSpeed = Math.min(ac.speed, 190);
    }
  }
  if (clearedILS) { const ilsRw = approachRunwayForAircraft(ac, env); const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y), right = { x: -hdgVector(ilsRw.course).y, y: hdgVector(ilsRw.course).x }, correction = clamp(-geo.crossPx * 0.018, -0.55, 0.55); dx += right.x * correction; dy += right.y * correction; afterMove = { x: ac.x + dx, y: ac.y + dy }; }
  const protectedRollout = ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || mode === "ROLLOUT" || mode === "VACATED";
  const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
  const twrMissedToDep = mode === "MISSED" && ac.category === "ARR" && !ac.landingClearance && !protectedRollout;
  const appReturn = mode === "MISSED_TRANSFER_APP" || missedApproachSafeToReturn(ac, env);
  const appReturnPatch = appReturn ? missedApproachReturnPatch(ac, env, afterMove) : null;
  const emergencyTowerControlled = !!emergency && (ac.emergencyTowerAccepted || ac.towerControlled || ac.contact === "TWR");
  const exitState = resolveExitState(ac, { protectedRollout, emergency, emergencyTowerControlled, appReturn, twrMissedToDep, appReturnPatch, missedRw, mode, routeIndex, clearedILS, missed, patternLeg, targetHeading, targetSpeed, targetAltitude });
  const nextCategory = exitState.category;
  const nextRoute = exitState.route;
  const nextRouteIndex = exitState.routeIndex;
  const nextDepState = exitState.depState;
  const nextClearedILS = exitState.clearedILS;
  const nextMode = exitState.mode;
  const nextMissed = exitState.missed;
  const nextDestination = exitState.destination;
  const nextSid = exitState.sid;
  const nextColor = exitState.color;
  const nextRouteRunway = exitState.routeRunway;
  const nextApproachRunway = exitState.approachRunway;
  if (landed) { const landRw = approachRunwayForAircraft(ac, env); const landGeo = finalGeometryAt(runwayOrigin(landRw), landRw.course, afterMove.x, afterMove.y); return rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, runwayPointAt(runwayOrigin(landRw), landRw.course, clamp(landGeo.alongNm, -0.15, 0.15)), { x: ac.x, y: ac.y }, landRw.name); }
  if (isAlternateMode(mode)) {
    const st = alternateHandoffState(ac, env);
    if (mode === "ALT_HANDOFF" || st?.inside) {
      return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: st?.altAirport || ac.destination, alternate: st?.altAirport || ac.alternate, sid: null, depState: null, towerControlled: false, landingClearance: false, contact: "ALT_APP", heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, routeIndex: 0, route: [], routeRunway: null, approachRunway: null, patternLeg: 0, mode: "ALT_HANDOFF", clearedILS: false, missed: false, speedRestriction: null, color: "#22c55e", landed: true, handedOff: true, runwayOccupancy: false, occupancyRunway: null, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
    }
    return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: ac.destination, alternate: ac.alternate, sid: null, depState: null, towerControlled: false, landingClearance: false, contact: "APP", heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, routeIndex: 0, route: [], routeRunway: null, approachRunway: null, patternLeg, mode: "DIVERT", clearedILS: false, missed: false, speedRestriction: null, color: "#f59e0b", landed: false, runwayOccupancy: false, occupancyRunway: null, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  const touchRw = approachRunwayForAircraft(ac, env);
  const preTouchGeo = finalGeometryAt(runwayOrigin(touchRw), touchRw.course, ac.x, ac.y);
  const postTouchGeo = finalGeometryAt(runwayOrigin(touchRw), touchRw.course, afterMove.x, afterMove.y);
  const touchdownAllowed = ac.category === "ARR" && ac.landingClearance && (clearedILS || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || isFinalMode(mode));
  const crossedTouchdown = preTouchGeo.alongNm > 0.18 && postTouchGeo.alongNm <= 0.18 && postTouchGeo.alongNm > -1.15;
  const nearTouchdownZone = postTouchGeo.alongNm <= 0.25 && postTouchGeo.alongNm > -1.15;
  const touchdownStable = Math.abs(postTouchGeo.crossPx) < 120 && Math.abs(shortestTurn(hdg, touchRw.course)) < 80 && spd < approachSpeedFor(ac) + 130 && alt < 900;
  const overTouchdownArea = postTouchGeo.alongNm <= 0.45 && postTouchGeo.alongNm > -2.4;
  if (!landed && touchdownAllowed && (crossedTouchdown || nearTouchdownZone || overTouchdownArea) && touchdownStable) landed = true;
  const rolloutPoint = runwayPointAt(runwayOrigin(touchRw), touchRw.course, clamp(postTouchGeo.alongNm, -0.15, 0.15));
  if (landed) return rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, rolloutPoint, { x: ac.x, y: ac.y }, touchRw.name);
  const nextEmergencyTowerAccepted = emergencyTowerControlled || (!!emergency && !!ac.emergencyTowerAccepted);
  return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, angularRate: shortestTurn(ac.heading, hdg) / SIM_STEP_SECONDS, emergency, emergencyTowerAccepted: nextEmergencyTowerAccepted, category: nextCategory, destination: nextDestination, sid: nextSid, depState: nextDepState, towerControlled: exitState.towerControlled, landingClearance: exitState.landingClearance, contact: exitState.contact, heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: exitState.assignedHeading, assignedSpeed: exitState.assignedSpeed, assignedAltitude: exitState.assignedAltitude, routeIndex: nextRouteIndex, route: nextRoute, routeRunway: nextRouteRunway, approachRunway: nextApproachRunway, patternLeg: exitState.patternLeg, mode: nextMode, clearedILS: nextClearedILS, missed: nextMissed, missedTicks: exitState.missedTicks, speedRestriction: exitState.speedRestriction, color: nextColor, landed: false, runwayOccupancy: exitState.runwayOccupancy, occupancyRunway: exitState.occupancyRunway, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
