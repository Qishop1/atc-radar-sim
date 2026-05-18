import { RUNWAYS } from "./constants.js";
import { finalGeometryAt, runwayPointAt, shortestTurn } from "./geometry.js";
import { runwayOrigin } from "./navigation.js";
import { approachSpeedFor } from "./aircraftPerf.js";
import { runwayHeadwind } from "./weather.js";

export function isFinalMode(mode) {
  return mode === "FINAL" || mode === "FINAL_NO_CLEAR" || mode === "TWR_FINAL" || mode === "FINAL_LAND";
}

export function isApproachMode(mode) {
  return isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN";
}

export function ilsAutoEligible(ac, mode = ac.mode) {
  if (!ac || ac.category !== "ARR") return false;
  if (mode === "ILS" || mode === "UNSTABLE_ILS" || isFinalMode(mode)) return true;
  if (mode === "DIRECT_FIX") return ac.route?.[0] === "IF01" || ac.route?.[0] === "FAF";
  if (mode === "ROUTE") {
    const current = ac.route?.[ac.routeIndex || 0];
    const previous = ac.route?.[Math.max(0, (ac.routeIndex || 0) - 1)];
    return current === "FAF" || previous === "IF01";
  }
  return false;
}

export function isAlternateMode(mode) {
  return ["DIVERT", "ALT_HANDOFF", "ALT_ROLLOUT"].includes(mode);
}

export function alternateHandoffRadiusNm(airportId) {
  return airportId === "RJSM" ? 18 : 16;
}

export function alternateHandoffLabel(airportId) {
  return `${airportId} APP HANDOFF`;
}

export function approachRunwayForAircraft(ac, env) {
  return RUNWAYS[ac.approachRunway || ac.routeRunway || ac.occupancyRunway || env.runway.name] || env.runway;
}

export function approachRunwayLocked(ac) {
  if (!ac || ac.category !== "ARR" || ac.touchdown || ac.landed || ac.handedOff || isAlternateMode(ac.mode)) return false;
  if (ac.clearedILS || ac.landingClearance || ac.towerControlled || ac.towerPending) return true;
  return ["ROUTE", "DIRECT_FIX", "ILS", "UNSTABLE_ILS", "VISUAL_APP", "TWR_PATTERN", "FINAL", "FINAL_NO_CLEAR", "TWR_FINAL", "FINAL_LAND"].includes(ac.mode);
}

export function approachRunwayChangeRequiresMissed(ac, targetRunway) {
  if (!approachRunwayLocked(ac)) return false;
  const current = ac.approachRunway || ac.routeRunway || ac.occupancyRunway;
  return !!current && !!targetRunway && current !== targetRunway;
}

export function finalGeometryForAircraft(ac, env, x = ac.x, y = ac.y) {
  const rw = approachRunwayForAircraft(ac, env);
  return finalGeometryAt(runwayOrigin(rw), rw.course, x, y);
}

export function runwayPointForAircraft(ac, env, dme) {
  const rw = approachRunwayForAircraft(ac, env);
  return runwayPointAt(runwayOrigin(rw), rw.course, dme);
}

export function finalLandingState(ac, env, crossLimit = 32, altLimit = 220) {
  const rw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const stable = Math.abs(geo.crossPx) < Math.max(crossLimit, 48) && Math.abs(shortestTurn(ac.heading, rw.course)) < 65 && ac.speed < approachSpeedFor(ac) + 105 && env.tailwind <= 10;
  const touchdownZone = geo.alongNm < 0.65 && geo.alongNm > -2.2;
  const atThreshold = touchdownZone && ac.altitude < Math.max(altLimit, 900);
  const overrun = geo.alongNm < -2.4 && ac.altitude < 900;
  return { geo, stable, atThreshold, overrun, runway: rw };
}

export function wrongRunwayTailwindMiss(ac, env) {
  if (ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || isAlternateMode(ac.mode)) return false;
  return (
    !ac.landingClearance &&
    (ac.clearedILS || ac.mode === "VISUAL_APP" || isFinalMode(ac.mode)) &&
    runwayHeadwind(env.wind, approachRunwayForAircraft(ac, env).course) < -5 &&
    ac.altitude < 500
  );
}
