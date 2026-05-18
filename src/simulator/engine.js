import { PX_PER_NM, RUNWAYS } from "./constants.js";
import { headingToPoint, xyToBearingRange } from "./geometry.js";
import { approachSpeedFor, cleanSpeedFor } from "./aircraftPerf.js";

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
