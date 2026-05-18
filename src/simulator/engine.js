import { PX_PER_NM, RUNWAYS } from "./constants.js";
import { clamp, headingToPoint, xyToBearingRange } from "./geometry.js";
import { approachSpeedFor, cleanSpeedFor, depTargetSpeed } from "./aircraftPerf.js";
import { getAircraftMissionArea, missionAreaPoint, rjcjDepartureGate, rjcjHelipadPoint } from "./military.js";

function wp(nav, id) { return nav.find((w) => w.id === id); }

export function stepRolloutAircraft(ac, env, stepRolloutMotion) {
  return stepRolloutMotion(ac, env);
}

export function stepFuelOutAircraft(ac, env, stepFuelOutMotion) {
  return stepFuelOutMotion(ac, env);
}

export function resolveDepartureGroundTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed) {
  if (mode === "LINEUP_WAIT") {
    targetHeading = RUNWAYS[ac.depRunway || env.runway.name]?.course || env.runway.course;
    targetAltitude = 0;
    targetSpeed = 0;
  } else if (mode === "TAKEOFF_ROLL") {
    const depRw = RUNWAYS[ac.depRunway || env.runway.name] || env.runway;
    const rotateSpeed = Math.max(118, approachSpeedFor(ac) - 8);
    targetHeading = depRw.course;
    targetSpeed = ac.speed < rotateSpeed ? rotateSpeed + 8 : Math.max(170, cleanSpeedFor(ac));
    targetAltitude = ac.speed >= rotateSpeed ? 1200 : 0;
    if (ac.speed >= rotateSpeed && ac.altitude > 80) {
      const depSid = env.sids[ac.sid] || env.sids.NORTH;
      mode = "INITIAL_CLIMB";
      targetAltitude = Math.max(4000, depSid.initialAlt || 5000);
      targetSpeed = Math.max(175, cleanSpeedFor(ac));
    }
  } else if (mode === "INITIAL_CLIMB") {
    const depSid = env.sids[ac.sid] || env.sids.NORTH;
    targetHeading = RUNWAYS[ac.depRunway || env.runway.name]?.course || env.runway.course;
    targetAltitude = Math.max(4000, depSid.initialAlt || 5000);
    targetSpeed = Math.max(175, cleanSpeedFor(ac));
    if (ac.altitude > 700 || xyToBearingRange(ac.x, ac.y).rangeNm > 1.8) {
      mode = "DEP_RADAR_CONTACT";
      ac = { ...ac, runwayOccupancy: false, occupancyRunway: null, towerControlled: false };
    }
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed };
}

export function resolveDepartureTargetState(ac, env, mode, routeIndex, targetHeading, targetAltitude, targetSpeed, deps) {
  const { depExitReady, makeNavCached, missedApproachReturnPatch, missedApproachSafeToReturn } = deps;
  const sid = env.sids[ac.sid] || env.sids.NORTH;
  const br = xyToBearingRange(ac.x, ac.y);
  if (ac.depState === "UNRESTRICTED") {
    const nextFix = ac.route.length && routeIndex < ac.route.length ? wp(env.nav, ac.route[routeIndex]) : null;
    const routeDone = routeIndex >= ac.route.length;
    targetHeading = nextFix ? headingToPoint(ac.x, ac.y, nextFix) : sid.exitBearing;
    targetAltitude = sid.topAlt;
    targetSpeed = depTargetSpeed(ac);
    mode = "SID";
    if (nextFix && Math.hypot(ac.x - nextFix.x, ac.y - nextFix.y) / PX_PER_NM < 1.2) routeIndex = routeIndex < ac.route.length - 1 ? routeIndex + 1 : ac.route.length;
    if (routeDone) targetHeading = sid.exitBearing;
    if (sid && depExitReady({ ...ac, altitude: Math.max(ac.altitude, targetAltitude), routeIndex }, env)) mode = "ACC_READY";
  } else if (ac.depState === "MISSED_APP") {
    const missedNav = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
    const fix = wp(missedNav, ac.route[routeIndex]);
    const missedCourse = RUNWAYS[ac.routeRunway || ac.approachRunway || env.runway.name]?.course || env.runway.course;
    targetHeading = fix ? headingToPoint(ac.x, ac.y, fix) : missedCourse;
    targetAltitude = 3000;
    targetSpeed = 180;
    mode = "MISSED_APP";
    if (missedApproachSafeToReturn(ac, env)) {
      mode = "MISSED_TRANSFER_APP";
      const returnPatch = missedApproachReturnPatch(ac, env);
      targetHeading = returnPatch.assignedHeading;
      targetAltitude = returnPatch.assignedAltitude;
      targetSpeed = returnPatch.assignedSpeed;
      routeIndex = 0;
      ac = { ...ac, ...returnPatch };
    } else if (fix && Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM < 1.2) {
      if (routeIndex < ac.route.length - 1) routeIndex += 1;
      else {
        mode = "MISSED_TRANSFER_APP";
        const returnPatch = missedApproachReturnPatch(ac, env);
        targetHeading = returnPatch.assignedHeading;
        targetAltitude = returnPatch.assignedAltitude;
        targetSpeed = returnPatch.assignedSpeed;
        routeIndex = 0;
        ac = { ...ac, ...returnPatch };
      }
    }
  } else if (mode === "DEP_READY") {
    targetHeading = env.runway.course;
    targetAltitude = 0;
    targetSpeed = 0;
  } else if (mode === "DEP_RADAR_CONTACT" || mode === "SID") {
    const fix = wp(env.nav, ac.route[routeIndex]);
    targetHeading = fix ? headingToPoint(ac.x, ac.y, fix) : sid.heading;
    targetAltitude = (ac.depState === "RELEASED" || ac.depState === "UNRESTRICTED") ? ac.assignedAltitude : (ac.assignedAltitude && ac.assignedAltitude > 0 ? ac.assignedAltitude : sid.initialAlt);
    targetSpeed = depTargetSpeed(ac);
    mode = br.rangeNm > 2 ? "SID" : "DEP_RADAR_CONTACT";
    if (fix && Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM < 1.2) routeIndex = routeIndex < ac.route.length - 1 ? routeIndex + 1 : ac.route.length;
    if (sid && depExitReady(ac, env)) mode = "ACC_READY";
  } else if (mode === "DEP_VECTOR") {
    targetHeading = ac.assignedHeading;
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
    if (sid && depExitReady(ac, env)) mode = "ACC_READY";
  }
  return { ac, mode, routeIndex, targetHeading, targetAltitude, targetSpeed };
}

export function resolveDirectFixTargetState(ac, navForAc, mode, targetHeading, targetAltitude, targetSpeed) {
  const fix = wp(navForAc, ac.route[0]);
  if (fix) {
    targetHeading = headingToPoint(ac.x, ac.y, fix);
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
    if (Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM < 1.0) {
      mode = ac.category === "MIL" ? "RJCJ_VECTOR" : ac.category === "DEP" ? "DEP_VECTOR" : "VECTOR";
      targetHeading = ac.assignedHeading;
    }
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed };
}

export function resolveAlternateTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, alternateDivertStep) {
  const altStep = alternateDivertStep(ac, env);
  if (altStep) {
    mode = altStep.mode;
    targetHeading = altStep.targetHeading;
    targetAltitude = altStep.targetAltitude;
    targetSpeed = altStep.targetSpeed;
    ac = { ...ac, destination: altStep.altAirport, alternate: altStep.altAirport, category: "ARR", clearedILS: false, landingClearance: false, towerControlled: false, contact: "APP", route: [], routeRunway: null, approachRunway: null };
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed };
}

export function resolveRotorTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed) {
  if (mode === "RJCJ_HELO_DEP") {
    const area = getAircraftMissionArea(ac);
    const mp = missionAreaPoint(area);
    const heloGate = rjcjDepartureGate(env, ac.rjcjRunway === "HELIPAD" ? env.airports.RJCJ.name : ac.rjcjRunway, ac.type);
    const distGate = Math.hypot(ac.x - heloGate.x, ac.y - heloGate.y) / PX_PER_NM;
    const distMission = Math.hypot(ac.x - mp.x, ac.y - mp.y) / PX_PER_NM;
    if (!ac.heloGatePassed && distGate > 1.0) {
      targetHeading = headingToPoint(ac.x, ac.y, heloGate);
      targetAltitude = 1000;
      targetSpeed = 80;
    } else {
      ac = { ...ac, heloGatePassed: true };
      targetHeading = headingToPoint(ac.x, ac.y, mp);
      targetAltitude = clamp(ac.assignedAltitude, area.minAlt, area.maxAlt);
      targetSpeed = Math.min(ac.assignedSpeed, 115);
    }
    if (distMission < area.radiusNm * 0.75) mode = "RJCJ_MISSION";
  } else if (mode === "RJCJ_HELO_RECOVERY") {
    const pad = rjcjHelipadPoint(env);
    const distNm = Math.hypot(ac.x - pad.x, ac.y - pad.y) / PX_PER_NM;
    targetHeading = headingToPoint(ac.x, ac.y, pad);
    targetAltitude = clamp(distNm * 220, 0, 1600);
    targetSpeed = distNm > 5 ? 105 : distNm > 2 ? 75 : 45;
    if (distNm < 0.25 && ac.altitude < 120 && ac.speed < 70) landed = true;
  } else {
    targetHeading = ac.assignedHeading;
    targetAltitude = clamp(ac.assignedAltitude, 0, 2500);
    targetSpeed = Math.min(ac.assignedSpeed, 115);
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed, landed };
}

export function resolveExitState(ac, ctx) {
  const {
    protectedRollout,
    emergency,
    appReturn,
    twrMissedToDep,
    appReturnPatch,
    missedRw,
    mode,
    routeIndex,
    clearedILS,
    missed,
    patternLeg,
  } = ctx;
  if (protectedRollout) {
    return {
      category: "ARR",
      route: [],
      routeIndex,
      depState: null,
      clearedILS: false,
      mode: "ROLLOUT",
      missed: false,
      destination: "RJCC",
      sid: null,
      color: "#4ade80",
      routeRunway: ac.routeRunway,
      approachRunway: ac.approachRunway,
      assignedHeading: ctx.targetHeading,
      assignedSpeed: ctx.targetSpeed,
      assignedAltitude: ctx.targetAltitude,
      towerControlled: ac.towerControlled,
      landingClearance: ac.landingClearance,
      contact: ac.contact,
      patternLeg,
      missedTicks: ac.missedTicks,
      speedRestriction: ac.speedRestriction,
      runwayOccupancy: ac.runwayOccupancy,
      occupancyRunway: ac.occupancyRunway,
    };
  }
  if (emergency) {
    return {
      category: "ARR",
      route: [],
      routeIndex: 0,
      depState: null,
      clearedILS: false,
      mode: emergency,
      missed: false,
      destination: "RJCC",
      sid: null,
      color: "#ff4d4d",
      routeRunway: ac.routeRunway,
      approachRunway: ac.approachRunway,
      assignedHeading: ctx.targetHeading,
      assignedSpeed: ctx.targetSpeed,
      assignedAltitude: ctx.targetAltitude,
      towerControlled: ctx.emergencyTowerControlled ? true : ac.towerControlled,
      landingClearance: ac.landingClearance,
      contact: ctx.emergencyTowerControlled ? "TWR" : "APP",
      patternLeg,
      missedTicks: ac.missedTicks,
      speedRestriction: ac.speedRestriction,
      runwayOccupancy: ac.runwayOccupancy,
      occupancyRunway: ac.occupancyRunway,
    };
  }
  if (appReturn) {
    return {
      category: "ARR",
      route: appReturnPatch.route,
      routeIndex: 0,
      depState: null,
      clearedILS: false,
      mode: appReturnPatch.mode,
      missed: false,
      destination: ac.destination,
      sid: null,
      color: "#32ff4d",
      routeRunway: appReturnPatch.routeRunway,
      approachRunway: appReturnPatch.approachRunway,
      assignedHeading: appReturnPatch.assignedHeading,
      assignedSpeed: appReturnPatch.assignedSpeed,
      assignedAltitude: appReturnPatch.assignedAltitude,
      towerControlled: false,
      landingClearance: false,
      contact: "APP",
      patternLeg: 0,
      missedTicks: 0,
      speedRestriction: null,
      runwayOccupancy: false,
      occupancyRunway: null,
    };
  }
  if (twrMissedToDep) {
    return {
      category: "DEP",
      route: ["MA1", "MAHOLD"],
      routeIndex: 0,
      depState: "MISSED_APP",
      clearedILS: false,
      mode: "MISSED_APP",
      missed: true,
      destination: "RJCC",
      sid: null,
      color: "#ff9f43",
      routeRunway: missedRw.name,
      approachRunway: missedRw.name,
      assignedHeading: missedRw.course,
      assignedSpeed: 180,
      assignedAltitude: 3000,
      towerControlled: false,
      landingClearance: false,
      contact: "DEP",
      patternLeg: 0,
      missedTicks: 0,
      speedRestriction: 200,
      runwayOccupancy: false,
      occupancyRunway: null,
    };
  }
  return {
    category: ac.category,
    route: ac.route,
    routeIndex,
    depState: ac.depState,
    clearedILS,
    mode,
    missed,
    destination: ac.destination,
    sid: ac.sid,
    color: ac.color,
    routeRunway: ac.routeRunway,
    approachRunway: ac.approachRunway,
    assignedHeading: ctx.targetHeading,
    assignedSpeed: ctx.targetSpeed,
    assignedAltitude: ctx.targetAltitude,
    towerControlled: ac.towerControlled,
    landingClearance: ac.landingClearance,
    contact: ac.contact,
    patternLeg,
    missedTicks: ac.depState === "MISSED_APP" ? (ac.missedTicks || 0) + 1 : ac.missedTicks,
    speedRestriction: ac.speedRestriction,
    runwayOccupancy: ac.runwayOccupancy,
    occupancyRunway: ac.occupancyRunway,
  };
}
