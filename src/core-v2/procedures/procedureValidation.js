import { airports } from "../../data/airspace/rjcc/airports.js";
import { fixes } from "../../data/airspace/rjcc/fixes.js";
import { localizers } from "../../data/airspace/rjcc/localizers.js";
import { navaids } from "../../data/airspace/rjcc/navaids.js";
import { arrivals, approaches, departures, holdings } from "../../data/airspace/rjcc/procedures.js";
import { radialDmeReferences } from "../../data/airspace/rjcc/radialDmeReferences.js";
import { runways } from "../../data/airspace/rjcc/runways.js";
import { expandProcedureRouteEntries } from "./procedureRouteBuilder.js";

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function collectLegs(procedure) {
  const segmentLegs = (procedure.segments || []).flatMap((segment) => segment.legs || []);
  return [...segmentLegs, ...(procedure.legs || [])];
}

function validateAltitude(altitude, context, issues) {
  if (!altitude) return;
  for (const key of ["atFt", "atOrAboveFt", "atOrBelowFt", "minFt", "maxFt"]) {
    if (altitude[key] != null && !isNumber(altitude[key])) issues.push({ level: "error", code: "ALTITUDE_CONSTRAINT_INVALID", key, ...context });
  }
}

function validateSpeed(speed, context, issues) {
  if (!speed) return;
  for (const key of ["atKt", "minKt", "maxKt"]) {
    if (speed[key] != null && !isNumber(speed[key])) issues.push({ level: "error", code: "SPEED_CONSTRAINT_INVALID", key, ...context });
  }
}

function coordinatesMatch(a, b) {
  return Math.abs(Number(a.lat) - Number(b.lat)) < 1e-7 && Math.abs(Number(a.lon) - Number(b.lon)) < 1e-7;
}

function validateCoordinateItems(items, datasetName, errors, warnings, { warnApproximate = false } = {}) {
  const byId = new Map();

  for (const item of items || []) {
    if (!item?.id || typeof item.id !== "string") {
      errors.push({ code: "AIRSPACE_ITEM_MISSING_ID", dataset: datasetName, item });
      continue;
    }
    if (item.type != null && typeof item.type !== "string") errors.push({ code: "AIRSPACE_ITEM_INVALID_TYPE", dataset: datasetName, id: item.id });
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) errors.push({ code: "AIRSPACE_ITEM_INVALID_LAT_LON", dataset: datasetName, id: item.id });
    if (warnApproximate && item.approximate) warnings.push({ code: "FIX_COORDINATE_APPROXIMATE", id: item.id, dataset: datasetName });

    const existing = byId.get(item.id);
    if (existing) {
      if (!item.approximate && !existing.approximate && !coordinatesMatch(existing, item)) {
        errors.push({ code: "AIRSPACE_DUPLICATE_ID_CONFLICT", dataset: datasetName, id: item.id });
      } else {
        warnings.push({ code: "AIRSPACE_DUPLICATE_ID", dataset: datasetName, id: item.id });
      }
    } else {
      byId.set(item.id, item);
    }
  }
}

function validateLocalizers(localizerData, errors, warnings) {
  const ids = new Set();
  for (const localizer of localizerData || []) {
    if (!localizer?.id || typeof localizer.id !== "string") {
      errors.push({ code: "LOCALIZER_MISSING_ID", localizer });
      continue;
    }
    if (ids.has(localizer.id)) warnings.push({ code: "LOCALIZER_DUPLICATE_ID", id: localizer.id });
    ids.add(localizer.id);
    if (localizer.type != null && typeof localizer.type !== "string") errors.push({ code: "LOCALIZER_INVALID_TYPE", id: localizer.id });
    if (localizer.runwayId != null && typeof localizer.runwayId !== "string") errors.push({ code: "LOCALIZER_INVALID_RUNWAY_ID", id: localizer.id });
    if (localizer.frequencyMHz != null && !isNumber(localizer.frequencyMHz)) errors.push({ code: "LOCALIZER_INVALID_FREQUENCY", id: localizer.id });
    if (localizer.gpMHz != null && !isNumber(localizer.gpMHz)) errors.push({ code: "LOCALIZER_INVALID_GP_FREQUENCY", id: localizer.id });
    if (localizer.finalCourseDeg != null && (!isNumber(localizer.finalCourseDeg) || localizer.finalCourseDeg < 0 || localizer.finalCourseDeg >= 360)) errors.push({ code: "LOCALIZER_INVALID_FINAL_COURSE", id: localizer.id });
  }
}

function validateRadialDmeReferences(referenceData, errors, warnings) {
  const ids = new Set();
  for (const reference of referenceData || []) {
    if (!reference?.id || typeof reference.id !== "string") {
      errors.push({ code: "RADIAL_DME_REFERENCE_MISSING_ID", reference });
      continue;
    }
    if (ids.has(reference.id)) warnings.push({ code: "RADIAL_DME_REFERENCE_DUPLICATE_ID", id: reference.id });
    ids.add(reference.id);
    if (!reference.definition || typeof reference.definition !== "string") warnings.push({ code: "RADIAL_DME_REFERENCE_MISSING_DEFINITION", id: reference.id });
    if ((reference.lat != null && !Number.isFinite(reference.lat)) || (reference.lon != null && !Number.isFinite(reference.lon))) warnings.push({ code: "RADIAL_DME_REFERENCE_IGNORES_NONFINITE_COORDINATE", id: reference.id });
  }
}

function validateLegGeometry(leg, context, fixIds, errors, warnings) {
  const supportedPreviewTypes = new Set(["FIX", "FIX_LEG", "HOLD", "HOLD_LEG", "DIRECT_FIX", "HEADING_TO_FIX", "COURSE_LEG"]);
  if (!supportedPreviewTypes.has(leg.type)) warnings.push({ code: "PROCEDURE_PREVIEW_UNSUPPORTED_GEOMETRY", ...context });

  if (leg.type === "HEADING_TO_FIX") {
    if (leg.headingDeg != null && (!isNumber(leg.headingDeg) || Number(leg.headingDeg) < 0 || Number(leg.headingDeg) >= 360)) errors.push({ code: "PROCEDURE_HEADING_TO_FIX_INVALID_HEADING", ...context });
    if (!leg.fixId) errors.push({ code: "PROCEDURE_HEADING_TO_FIX_MISSING_FIX", ...context });
    warnings.push({ code: "PROCEDURE_HEADING_TO_FIX_ENDPOINT_PREVIEW_ONLY", ...context });
  }

  if (leg.type === "COURSE_LEG" && !leg.fixId && !leg.endpointFixId && !leg.toFixId) warnings.push({ code: "PROCEDURE_COURSE_LEG_MISSING_ENDPOINT_FOR_PREVIEW", ...context });
  if (leg.fixId && !fixIds.has(leg.fixId)) errors.push({ code: "PROCEDURE_UNKNOWN_FIX", ...context });
}

export function validateProcedures({
  airportData = airports,
  runwayData = runways,
  fixData = fixes,
  navaidData = navaids,
  localizerData = localizers,
  radialDmeReferenceData = radialDmeReferences,
  procedureData = { arrivals, departures, approaches, holdings },
} = {}) {
  const warnings = [];
  const errors = [];
  const airportIds = new Set(airportData.map((airport) => airport.id));
  const fixIds = new Set([...fixData.map((fix) => fix.id), ...navaidData.map((navaid) => navaid.id)]);
  const navaidIds = new Set(navaidData.map((navaid) => navaid.id).filter(Boolean));
  const runwayIdsByAirport = new Map();

  validateCoordinateItems(fixData, "fixes", errors, warnings, { warnApproximate: true });
  validateCoordinateItems(navaidData, "navaids", errors, warnings);
  validateLocalizers(localizerData, errors, warnings);
  validateRadialDmeReferences(radialDmeReferenceData, errors, warnings);

  for (const fix of fixData) {
    if (fix?.id && navaidIds.has(fix.id)) warnings.push({ code: "AIRSPACE_ID_USED_AS_FIX_AND_NAVAID", id: fix.id });
  }

  for (const runway of runwayData) {
    if (!runwayIdsByAirport.has(runway.airportId)) runwayIdsByAirport.set(runway.airportId, new Set());
    const ids = runwayIdsByAirport.get(runway.airportId);
    ids.add(runway.id);
    for (const end of runway.ends || []) ids.add(end.id);
  }

  const allProcedures = expandProcedureRouteEntries([
    ...(procedureData.arrivals || []),
    ...(procedureData.departures || []),
    ...(procedureData.approaches || []),
  ]);

  for (const procedure of allProcedures) {
    if (!procedure?.id) errors.push({ code: "PROCEDURE_MISSING_ID", procedure });
    if (procedure?.airportId && !airportIds.has(procedure.airportId)) errors.push({ code: "PROCEDURE_UNKNOWN_AIRPORT", procedureId: procedure.id, airportId: procedure.airportId });

    const runwayIds = [...(procedure.runwayIds || []), ...(procedure.runwayId ? [procedure.runwayId] : [])];
    for (const runwayId of runwayIds) {
      const airportRunways = runwayIdsByAirport.get(procedure.airportId);
      if (!airportRunways || !airportRunways.has(runwayId)) errors.push({ code: "PROCEDURE_UNKNOWN_RUNWAY", procedureId: procedure.id, airportId: procedure.airportId, runwayId });
    }

    for (const leg of collectLegs(procedure)) {
      const context = { procedureId: procedure.id, legType: leg.type, fixId: leg.fixId };
      validateLegGeometry(leg, context, fixIds, errors, warnings);
      validateAltitude(leg.altitude, context, errors);
      validateSpeed(leg.speed, context, errors);
    }

    for (const dme of procedure.criticalDme || []) {
      if (!dme?.stationId) warnings.push({ code: "PROCEDURE_CRITICAL_DME_MISSING_STATION", procedureId: procedure.id });
      if (dme?.stationId && !navaidIds.has(dme.stationId)) warnings.push({ code: "PROCEDURE_CRITICAL_DME_UNKNOWN_STATION", procedureId: procedure.id, stationId: dme.stationId });
    }
  }

  for (const holding of procedureData.holdings || []) {
    if (!holding?.id) errors.push({ code: "HOLD_MISSING_ID", holding });
    if (holding?.fixId && !fixIds.has(holding.fixId)) errors.push({ code: "HOLD_UNKNOWN_FIX", holdId: holding.id, fixId: holding.fixId });
    if (holding?.inboundCourseDeg != null && (!isNumber(holding.inboundCourseDeg) || holding.inboundCourseDeg < 0 || holding.inboundCourseDeg >= 360)) errors.push({ code: "HOLD_INVALID_INBOUND_COURSE", holdId: holding.id });
    if (holding?.legTimeMin != null && !isNumber(holding.legTimeMin)) errors.push({ code: "HOLD_INVALID_LEG_TIME", holdId: holding.id });
    if (holding?.altitudeFt != null && !isNumber(holding.altitudeFt)) errors.push({ code: "HOLD_INVALID_ALTITUDE", holdId: holding.id });
    if (!holding?.fixId) warnings.push({ code: "HOLD_MISSING_FIX", holdId: holding?.id });
  }

  return { valid: errors.length === 0, warnings, errors };
}
