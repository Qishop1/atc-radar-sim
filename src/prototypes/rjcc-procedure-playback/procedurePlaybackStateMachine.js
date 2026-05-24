export const PLAYBACK_STATES = Object.freeze({
  IDLE: "IDLE",
  READY: "READY",
  RUNWAY_ROLL: "RUNWAY_ROLL",
  INITIAL_CLIMB: "INITIAL_CLIMB",
  DIRECT_TO_FIX: "DIRECT_TO_FIX",
  TRACK_ROUTE: "TRACK_ROUTE",
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
});

const EARTH_RADIUS_NM = 3440.065;
const DEFAULT_SANDBOX_GROUND_SPEED_KT = 220;

function isRunwayStart(point) {
  return String(point?.role || "").toLowerCase().includes("start");
}

function isInitialGate(point) {
  const role = String(point?.role || "").toLowerCase();
  return role.includes("gate") || role.includes("initial-climb");
}

function headingBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

function targetState(points, targetIndex) {
  const previous = points[targetIndex - 1];
  const target = points[targetIndex];
  if (isInitialGate(target)) return PLAYBACK_STATES.INITIAL_CLIMB;
  if (isRunwayStart(previous) || isInitialGate(previous)) return PLAYBACK_STATES.DIRECT_TO_FIX;
  return PLAYBACK_STATES.TRACK_ROUTE;
}

function altitudeForTarget(aircraft, target, targetIndex) {
  const gateAltitude = Number(target?.displayAltitudeFt);
  if (Number.isFinite(gateAltitude)) return Math.max(aircraft.altitudeFt, gateAltitude);
  return Math.max(aircraft.altitudeFt, targetIndex * 650);
}

export function distanceNmBetweenDisplayPoints(from, to) {
  if (![from?.lat, from?.lon, to?.lat, to?.lon].every(Number.isFinite)) return NaN;
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function displayRouteDistanceNm(points = []) {
  return points.slice(1).reduce((total, point, index) => {
    const distance = distanceNmBetweenDisplayPoints(points[index], point);
    return Number.isFinite(distance) ? total + distance : total;
  }, 0);
}

function aircraftAtRatio(aircraft, target, ratio, targetIndex, groundSpeedKt, distanceIncrementNm) {
  return {
    ...aircraft,
    x: aircraft.x + (target.x - aircraft.x) * ratio,
    y: aircraft.y + (target.y - aircraft.y) * ratio,
    lat: aircraft.lat + (target.lat - aircraft.lat) * ratio,
    lon: aircraft.lon + (target.lon - aircraft.lon) * ratio,
    headingDeg: headingBetween(aircraft, target),
    groundSpeedKt,
    distanceFlownNm: (aircraft.distanceFlownNm || 0) + distanceIncrementNm,
    altitudeFt: ratio >= 1
      ? altitudeForTarget(aircraft, target, targetIndex)
      : Math.round(aircraft.altitudeFt + (altitudeForTarget(aircraft, target, targetIndex) - aircraft.altitudeFt) * ratio),
  };
}

export function createProcedurePlaybackState(route, { groundSpeedKt = DEFAULT_SANDBOX_GROUND_SPEED_KT } = {}) {
  if (!route?.ok || route.points.length < 2) {
    return {
      state: PLAYBACK_STATES.ERROR,
      activePointIndex: null,
      aircraft: null,
      routeProgress: { currentPointIndex: 0, totalPoints: route?.points?.length || 0, completed: false },
      diagnostics: { warnings: route?.warnings || [], errors: route?.errors || ["Invalid display route."] },
    };
  }

  const first = route.points[0];
  return {
    state: PLAYBACK_STATES.READY,
    activePointIndex: 1,
    aircraft: {
      x: first.x,
      y: first.y,
      lat: first.lat,
      lon: first.lon,
      headingDeg: headingBetween(first, route.points[1]),
      groundSpeedKt,
      altitudeFt: 0,
      distanceFlownNm: 0,
    },
    routeProgress: { currentPointIndex: 0, totalPoints: route.points.length, completed: false },
    diagnostics: { warnings: route.warnings || [], errors: route.errors || [] },
  };
}

export function startProcedurePlayback(machine, route) {
  if (machine.state === PLAYBACK_STATES.ERROR || machine.state === PLAYBACK_STATES.COMPLETE) return machine;
  if (machine.state !== PLAYBACK_STATES.READY) return machine;
  const hasRunwayGate = isRunwayStart(route.points[0]) && isInitialGate(route.points[1]);
  return {
    ...machine,
    state: hasRunwayGate ? PLAYBACK_STATES.RUNWAY_ROLL : targetState(route.points, machine.activePointIndex),
  };
}

export function stepProcedurePlayback(machine, route, {
  deltaSeconds = 0,
  groundSpeedKt = machine.aircraft?.groundSpeedKt || DEFAULT_SANDBOX_GROUND_SPEED_KT,
  timeScale = 1,
} = {}) {
  if (![PLAYBACK_STATES.RUNWAY_ROLL, PLAYBACK_STATES.INITIAL_CLIMB, PLAYBACK_STATES.DIRECT_TO_FIX, PLAYBACK_STATES.TRACK_ROUTE].includes(machine.state)) {
    return machine;
  }

  if (!machine.aircraft) {
    return {
      ...machine,
      state: PLAYBACK_STATES.ERROR,
      diagnostics: {
        ...machine.diagnostics,
        errors: [...machine.diagnostics.errors, "Playback target became invalid."],
      },
    };
  }

  let remainingDistanceNm = Math.max(0, groundSpeedKt * Math.max(0, timeScale) * Math.max(0, deltaSeconds) / 3600);
  let nextMachine = { ...machine, aircraft: { ...machine.aircraft, groundSpeedKt } };

  while (remainingDistanceNm > 0 && nextMachine.activePointIndex != null) {
    const targetIndex = nextMachine.activePointIndex;
    const target = route.points[targetIndex];
    if (!target) {
      return {
        ...nextMachine,
        state: PLAYBACK_STATES.ERROR,
        diagnostics: {
          ...nextMachine.diagnostics,
          errors: [...nextMachine.diagnostics.errors, "Playback target became invalid."],
        },
      };
    }

    const distanceNm = distanceNmBetweenDisplayPoints(nextMachine.aircraft, target);
    if (!Number.isFinite(distanceNm)) {
      return {
        ...nextMachine,
        state: PLAYBACK_STATES.ERROR,
        diagnostics: {
          ...nextMachine.diagnostics,
          errors: [...nextMachine.diagnostics.errors, "Playback segment has invalid geographic distance."],
        },
      };
    }

    const reached = distanceNm <= Math.max(0.000001, remainingDistanceNm);
    const distanceMovedNm = reached ? distanceNm : remainingDistanceNm;
    const ratio = reached || distanceNm === 0 ? 1 : distanceMovedNm / distanceNm;
    const nextAircraft = aircraftAtRatio(nextMachine.aircraft, target, ratio, targetIndex, groundSpeedKt, distanceMovedNm);
    if (!reached) {
      return { ...nextMachine, state: targetState(route.points, targetIndex), aircraft: nextAircraft };
    }

    remainingDistanceNm = Math.max(0, remainingDistanceNm - distanceNm);
    if (targetIndex >= route.points.length - 1) {
      return {
        ...nextMachine,
        state: PLAYBACK_STATES.COMPLETE,
        aircraft: nextAircraft,
        routeProgress: { ...nextMachine.routeProgress, currentPointIndex: targetIndex, completed: true },
      };
    }

    const nextTargetIndex = targetIndex + 1;
    nextMachine = {
      ...nextMachine,
      state: targetState(route.points, nextTargetIndex),
      activePointIndex: nextTargetIndex,
      aircraft: {
        ...nextAircraft,
        headingDeg: headingBetween(nextAircraft, route.points[nextTargetIndex]),
      },
      routeProgress: { ...nextMachine.routeProgress, currentPointIndex: targetIndex },
    };
  }

  return nextMachine;
}
