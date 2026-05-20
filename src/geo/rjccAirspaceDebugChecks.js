import { airports } from "../data/airspace/rjcc/airports.js";
import { fixes } from "../data/airspace/rjcc/fixes.js";
import { navaids } from "../data/airspace/rjcc/navaids.js";
import { runways } from "../data/airspace/rjcc/runways.js";
import { bearingDistanceBetween, normalizeBearing } from "./earth.js";
import { createLegacyCoordinateBridge } from "./legacyCoordinateBridge.js";
import { createRjccRadarProjection } from "./rjccRadarProjection.js";
import { compareLegacyBridge, debugCoordinateRoundTrip } from "./debugCoordinateChecks.js";

export const RJCC_AIRSPACE_DEBUG_DEFAULTS = {
  centerAirportId: "RJCC",
  rangeNm: 140,
  frame: { x: 0, y: 0, width: 720, height: 720 },
  rotationDeg: 0,
  legacy: {
    oldCenter: { x: 360, y: 360 },
    oldPxPerNm: 5,
  },
};

const METERS_PER_NM = 1852;

function round(value, places = 6) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function angularDelta(a, b) {
  const diff = Math.abs(normalizeBearing(a) - normalizeBearing(b));
  return Math.min(diff, 360 - diff);
}

function latLonErrorNm(a, b) {
  return bearingDistanceBetween({ lat1: a.lat, lon1: a.lon, lat2: b.lat, lon2: b.lon }).distanceNm;
}

function pointProjectionCheck(point, projection) {
  const bearingRange = projection.latLonToBearingRange(point.lat, point.lon);
  const radarXY = projection.latLonToXY(point.lat, point.lon);
  const latLonBack = projection.xyToLatLon(radarXY.x, radarXY.y);
  return {
    lat: round(point.lat, 8),
    lon: round(point.lon, 8),
    bearingDeg: round(bearingRange.bearingDeg),
    rangeNm: round(bearingRange.rangeNm),
    radarXY: { x: round(radarXY.x), y: round(radarXY.y) },
    roundTripErrorNm: round(latLonErrorNm(point, latLonBack), 9),
  };
}

function pointLegacyBridgeCheck(point, bridge) {
  const legacyXY = bridge.latLonToLegacyXY(point.lat, point.lon);
  const latLonBack = bridge.legacyXYToLatLon(legacyXY.x, legacyXY.y);
  return {
    legacyXY: { x: round(legacyXY.x), y: round(legacyXY.y) },
    roundTripErrorNm: round(latLonErrorNm(point, latLonBack), 9),
  };
}

export function validateRjccAirspaceSeeds({ airportData = airports, runwayData = runways, navaidData = navaids, fixData = fixes } = {}) {
  const issues = [];
  const airportIds = new Set();
  const navaidIds = new Set();

  for (const airport of airportData) {
    if (!airport?.id) issues.push({ level: "error", code: "AIRPORT_MISSING_ID", item: airport });
    if (airport?.id && airportIds.has(airport.id)) issues.push({ level: "error", code: "AIRPORT_DUPLICATE_ID", airportId: airport.id });
    if (airport?.id) airportIds.add(airport.id);
    if (!isFiniteNumber(airport?.lat) || !isFiniteNumber(airport?.lon)) issues.push({ level: "error", code: "AIRPORT_INVALID_LAT_LON", airportId: airport?.id });
  }

  for (const runway of runwayData) {
    if (!runway?.airportId) issues.push({ level: "error", code: "RUNWAY_MISSING_AIRPORT_ID", runwayId: runway?.id });
    if (runway?.airportId && !airportIds.has(runway.airportId)) issues.push({ level: "error", code: "RUNWAY_UNKNOWN_AIRPORT", runwayId: runway?.id, airportId: runway.airportId });
    if (!runway?.id) issues.push({ level: "error", code: "RUNWAY_MISSING_ID", airportId: runway?.airportId });
    if (!isFiniteNumber(runway?.lengthM) || Number(runway.lengthM) <= 0) issues.push({ level: "error", code: "RUNWAY_INVALID_LENGTH", runwayId: runway?.id });
    if (!Array.isArray(runway?.ends) || runway.ends.length !== 2) {
      issues.push({ level: "error", code: "RUNWAY_END_COUNT", runwayId: runway?.id, count: runway?.ends?.length ?? 0 });
      continue;
    }

    for (const end of runway.ends) {
      if (!end?.id) issues.push({ level: "error", code: "RUNWAY_END_MISSING_ID", runwayId: runway.id });
      if (!isFiniteNumber(end?.lat) || !isFiniteNumber(end?.lon)) issues.push({ level: "error", code: "RUNWAY_END_INVALID_LAT_LON", runwayId: runway.id, endId: end?.id });
      if (end?.trueBearingDeg != null && (!isFiniteNumber(end.trueBearingDeg) || end.trueBearingDeg < 0 || end.trueBearingDeg >= 360)) {
        issues.push({ level: "error", code: "RUNWAY_END_INVALID_TRUE_BEARING", runwayId: runway.id, endId: end.id, trueBearingDeg: end.trueBearingDeg });
      }
    }
  }

  for (const navaid of navaidData) {
    if (!navaid?.id || typeof navaid.id !== "string") issues.push({ level: "error", code: "NAVAID_MISSING_ID", item: navaid });
    if (navaid?.id && navaidIds.has(navaid.id)) issues.push({ level: "error", code: "NAVAID_DUPLICATE_ID", navaidId: navaid.id });
    if (navaid?.id) navaidIds.add(navaid.id);
    if (!navaid?.type || typeof navaid.type !== "string") issues.push({ level: "error", code: "NAVAID_MISSING_TYPE", navaidId: navaid?.id });
    if (!isFiniteNumber(navaid?.lat) || !isFiniteNumber(navaid?.lon)) issues.push({ level: "error", code: "NAVAID_INVALID_LAT_LON", navaidId: navaid?.id });
  }

  for (const fix of fixData) {
    if (!fix?.id || typeof fix.id !== "string") issues.push({ level: "error", code: "FIX_MISSING_ID", item: fix });
    if (!fix?.type || typeof fix.type !== "string") issues.push({ level: "error", code: "FIX_MISSING_TYPE", fixId: fix?.id });
    if (!isFiniteNumber(fix?.lat) || !isFiniteNumber(fix?.lon)) issues.push({ level: "error", code: "FIX_INVALID_LAT_LON", fixId: fix?.id });
    if (fix?.reference?.navaidId && !navaidIds.has(fix.reference.navaidId)) {
      issues.push({ level: "warning", code: "FIX_REFERENCE_UNKNOWN_NAVAID", fixId: fix.id, navaidId: fix.reference.navaidId });
    }
  }

  return {
    airportCount: airportData.length,
    runwayCount: runwayData.length,
    navaidCount: navaidData.length,
    fixCount: fixData.length,
    runwayEndCount: runwayData.reduce((count, runway) => count + (Array.isArray(runway.ends) ? runway.ends.length : 0), 0),
    issues,
    ok: issues.every((issue) => issue.level !== "error"),
  };
}

export function createRjccAirspaceDebugProjection({
  airportData = airports,
  centerAirportId = RJCC_AIRSPACE_DEBUG_DEFAULTS.centerAirportId,
  rangeNm = RJCC_AIRSPACE_DEBUG_DEFAULTS.rangeNm,
  frame = RJCC_AIRSPACE_DEBUG_DEFAULTS.frame,
  rotationDeg = RJCC_AIRSPACE_DEBUG_DEFAULTS.rotationDeg,
} = {}) {
  const center = airportData.find((airport) => airport.id === centerAirportId);
  if (!center) {
    throw new Error(`Missing center airport seed: ${centerAirportId}`);
  }

  return createRjccRadarProjection({
    centerLat: center.lat,
    centerLon: center.lon,
    rangeNm,
    frame,
    rotationDeg,
  });
}

function buildRunwayChecks(runwayData, projection, bridge) {
  return runwayData.map((runway) => {
    const [first, second] = runway.ends;
    const measured = first && second
      ? bearingDistanceBetween({ lat1: first.lat, lon1: first.lon, lat2: second.lat, lon2: second.lon })
      : null;
    const expectedLengthNm = Number.isFinite(runway.lengthM) ? runway.lengthM / METERS_PER_NM : null;
    const bearingErrorDeg = measured && first?.trueBearingDeg != null
      ? angularDelta(measured.bearingDeg, first.trueBearingDeg)
      : null;

    return {
      airportId: runway.airportId,
      runwayId: runway.id,
      source: runway.source,
      expectedLengthNm: expectedLengthNm == null ? null : round(expectedLengthNm),
      measuredThresholdDistanceNm: measured == null ? null : round(measured.distanceNm),
      thresholdDistanceDeltaNm: measured == null || expectedLengthNm == null ? null : round(Math.abs(measured.distanceNm - expectedLengthNm)),
      measuredFirstToSecondBearingDeg: measured == null ? null : round(measured.bearingDeg),
      firstEndTrueBearingDeg: first?.trueBearingDeg ?? null,
      firstEndBearingErrorDeg: bearingErrorDeg == null ? null : round(bearingErrorDeg),
      ends: runway.ends.map((end) => ({
        id: end.id,
        projection: pointProjectionCheck(end, projection),
        legacyBridge: bridge ? pointLegacyBridgeCheck(end, bridge) : null,
      })),
    };
  });
}

export function debugRjccAirspaceCoordinates({
  airportData = airports,
  runwayData = runways,
  navaidData = navaids,
  fixData = fixes,
  includeLegacyBridge = true,
  legacy = RJCC_AIRSPACE_DEBUG_DEFAULTS.legacy,
  projectionOptions = {},
} = {}) {
  const seedValidation = validateRjccAirspaceSeeds({ airportData, runwayData, navaidData, fixData });
  const projection = createRjccAirspaceDebugProjection({ airportData, ...projectionOptions });
  const bridge = includeLegacyBridge
    ? createLegacyCoordinateBridge({ oldCenter: legacy.oldCenter, oldPxPerNm: legacy.oldPxPerNm, projection })
    : null;

  return {
    note: "Debug only. Legacy x/y remains authoritative for gameplay; airport ARP coordinates come only from airports.js.",
    seedValidation,
    projectionRoundTrip: debugCoordinateRoundTrip(projection),
    legacyBridgeRoundTrip: bridge ? compareLegacyBridge(bridge) : null,
    airports: airportData.map((airport) => ({
      id: airport.id,
      icao: airport.icao,
      name: airport.name,
      source: airport.source,
      projection: pointProjectionCheck(airport, projection),
      legacyBridge: bridge ? pointLegacyBridgeCheck(airport, bridge) : null,
    })),
    runways: buildRunwayChecks(runwayData, projection, bridge),
    navaids: navaidData.map((navaid) => ({
      id: navaid.id,
      type: navaid.type,
      name: navaid.name,
      source: navaid.source,
      projection: pointProjectionCheck(navaid, projection),
      legacyBridge: bridge ? pointLegacyBridgeCheck(navaid, bridge) : null,
    })),
    fixes: fixData.map((fix) => ({
      id: fix.id,
      type: fix.type,
      reference: fix.reference ?? null,
      source: fix.source,
      projection: pointProjectionCheck(fix, projection),
      legacyBridge: bridge ? pointLegacyBridgeCheck(fix, bridge) : null,
    })),
  };
}
