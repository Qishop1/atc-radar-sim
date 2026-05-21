import { manualProcedurePreviews } from "../../data/airspace/rjcc/manualProcedurePreviews.js";

function collectLegs(procedure) {
  const segmentLegs = (procedure?.segments || []).flatMap((segment) => segment.legs || []);
  const directLegs = procedure?.legs || [];
  const holdLeg = procedure?.fixId ? [{ type: procedure.type || "HOLD", fixId: procedure.fixId }] : [];
  return [...segmentLegs, ...directLegs, ...holdLeg];
}

export function expandProcedureVariants(procedure) {
  if (!procedure?.variants?.length) return procedure ? [procedure] : [];
  return procedure.variants.map((variant) => ({
    ...procedure,
    ...variant,
    id: variant.id,
    name: variant.name || `${procedure.name || procedure.id} ${variant.id}`,
    type: procedure.type,
    navSpec: procedure.navSpec,
    airportId: procedure.airportId,
    source: variant.source || procedure.source,
    parentProcedureId: procedure.id,
    parentProcedureName: procedure.name || procedure.id,
    notes: [...(procedure.notes || []), ...(variant.notes || [])],
    criticalDme: variant.criticalDme || procedure.criticalDme,
    dmeGap: variant.dmeGap || procedure.dmeGap,
    variants: undefined,
  }));
}

export function expandProcedureRouteEntries(procedures = []) {
  return procedures.flatMap((procedure) => expandProcedureVariants(procedure));
}

function altitudeConstraintText(altitude) {
  if (!altitude) return null;
  if (altitude.atFt != null) return `${altitude.atFt}`;
  if (altitude.atOrAboveFt != null) return `at or above ${altitude.atOrAboveFt}`;
  if (altitude.atOrBelowFt != null) return `at or below ${altitude.atOrBelowFt}`;
  if (altitude.minFt != null && altitude.maxFt != null) return `${altitude.minFt}-${altitude.maxFt}`;
  if (altitude.minFt != null) return `min ${altitude.minFt}`;
  if (altitude.maxFt != null) return `max ${altitude.maxFt}`;
  return null;
}

function speedConstraintText(speed) {
  if (!speed) return null;
  if (speed.atKt != null) return `${speed.atKt} kt`;
  if (speed.maxKt != null) return `max ${speed.maxKt} kt`;
  if (speed.minKt != null) return `min ${speed.minKt} kt`;
  return null;
}

function endpointFixIdForLeg(leg) {
  return leg?.fixId || leg?.endpointFixId || leg?.toFixId || null;
}

function roleForLeg(leg) {
  if (leg?.type === "HEADING_TO_FIX") return "heading-to-fix-endpoint";
  if (leg?.type === "HOLD" || leg?.type === "HOLD_LEG") return "hold";
  return "waypoint";
}

function appendPoint(points, point) {
  const previous = points[points.length - 1];
  if (previous?.id === point.id) return;
  points.push(point);
}

function runwayEndWaypoint(waypointLookup, airportId, runwayEndId) {
  return waypointLookup[`${airportId}:${runwayEndId}`] || waypointLookup[runwayEndId] || null;
}

function buildApproximateProcedureGeometry({ procedure, waypointLookup = {} } = {}) {
  const previewGeometry = procedure?.previewGeometry;
  const warnings = [];
  if (!previewGeometry?.approximate) return { approximateSegments: [], warnings };

  const toFix = waypointLookup[previewGeometry.toFixId];
  if (!toFix || !Number.isFinite(toFix.lat) || !Number.isFinite(toFix.lon)) {
    return {
      approximateSegments: [],
      warnings: [`Approximate preview skipped: missing coordinate endpoint ${previewGeometry.toFixId}.`],
    };
  }
  const stationId = previewGeometry.interceptRadial?.stationId || previewGeometry.altitudeGate?.stationId || null;
  const station = stationId ? waypointLookup[stationId] : null;
  const needsRadialStation = previewGeometry.type === "APPROX_LEFT_TEARDROP_TO_RADIAL" || previewGeometry.type === "APPROX_TURN_TO_RADIAL";
  if (needsRadialStation && (!station || !Number.isFinite(station.lat) || !Number.isFinite(station.lon))) {
    return {
      approximateSegments: [],
      warnings: [`Approximate preview skipped: missing coordinate station ${stationId}.`],
    };
  }

  const approximateSegments = [];
  const runwayEnds = [];
  for (const runwayEndId of previewGeometry.fromRunwayEnds || []) {
    const runwayEnd = runwayEndWaypoint(waypointLookup, procedure.airportId, runwayEndId);
    if (!runwayEnd || !Number.isFinite(runwayEnd.lat) || !Number.isFinite(runwayEnd.lon)) {
      warnings.push(`Approximate preview skipped ${runwayEndId}: runway end coordinate missing.`);
      continue;
    }
    runwayEnds.push(runwayEnd);
  }

  for (const runwayEnd of runwayEnds) {
    const segmentType = previewGeometry.type === "APPROX_DIRECT_TO_FIX"
      ? "APPROX_DIRECT"
      : needsRadialStation
        ? previewGeometry.type
        : "APPROX_AIRCRAFT_TURN";
    approximateSegments.push({
      type: segmentType,
      approximate: true,
      turnDirection: previewGeometry.turnDirection || null,
      headingDeg: previewGeometry.initialHeadingDeg ?? runwayEnd.item?.trueBearingDeg ?? null,
      initialStraightNm: previewGeometry.initialStraightNm ?? 1,
      turnRadiusNm: previewGeometry.turnRadiusNm ?? 2.4,
      maxTurnDeg: previewGeometry.maxTurnDeg ?? 210,
      sampleCount: previewGeometry.sampleCount ?? 24,
      radialDeg: previewGeometry.interceptRadial?.radialDeg ?? null,
      interceptDistanceNm: previewGeometry.interceptDistanceNm ?? null,
      turnStartNmFromRunwayEnd: previewGeometry.turnStart?.distanceFromRunwayEndNm ?? previewGeometry.initialStraightNm ?? 1,
      turnWithinNm: previewGeometry.turnLimit?.withinNm ?? previewGeometry.turnLimit?.distanceNm ?? null,
      altitudeGate: previewGeometry.altitudeGate || null,
      turnLimit: previewGeometry.turnLimit || null,
      points: [
        {
          id: runwayEnd.endId || runwayEnd.id,
          lat: runwayEnd.lat,
          lon: runwayEnd.lon,
          role: "approx-der",
          headingDeg: previewGeometry.initialHeadingDeg ?? runwayEnd.item?.trueBearingDeg ?? null,
        },
        ...(needsRadialStation ? [{
          id: stationId,
          lat: station.lat,
          lon: station.lon,
          role: "station",
        }] : []),
        {
          id: previewGeometry.toFixId,
          lat: toFix.lat,
          lon: toFix.lon,
          role: "fix",
        },
      ],
      notes: previewGeometry.notes || "Display-only approximate procedure preview; not authoritative.",
    });
  }

  if (approximateSegments.length) warnings.push("Approximate preview geometry is display-only and not authoritative.");
  return { approximateSegments, warnings };
}

function manualPreviewForProcedure(procedureId) {
  return procedureId ? manualProcedurePreviews[procedureId] || null : null;
}

function isRnavProcedure(procedure) {
  const navSpec = `${procedure?.navSpec || ""}`.toUpperCase();
  return navSpec.includes("RNAV");
}

function buildManualPreviewRoute({ procedure, manualPreview, waypointLookup }) {
  const warnings = ["Using manual display-only trace geometry."];
  const finalId = manualPreview?.anchorFrame?.finalId;
  const finalWaypoint = finalId ? waypointLookup[finalId] : null;
  const points = [];

  if (finalWaypoint && Number.isFinite(finalWaypoint.lat) && Number.isFinite(finalWaypoint.lon)) {
    points.push({
      id: finalId,
      lat: finalWaypoint.lat,
      lon: finalWaypoint.lon,
      role: "manual-trace-final",
      altitudeConstraintText: finalWaypoint.item?.altitudeConstraintText || null,
      speedConstraintText: null,
      sourceLeg: null,
    });
  }

  return {
    procedureId: procedure?.id || manualPreview.id,
    type: procedure?.type || null,
    label: procedure?.name || procedure?.id || manualPreview.id || "Procedure",
    points,
    approximateSegments: [
      {
        type: "MANUAL_TRACE",
        approximate: true,
        traceType: manualPreview.traceType || null,
        coordinateSpace: manualPreview.coordinateSpace,
        normalizedPoints: manualPreview.points || [],
        rawProjectedPoints: manualPreview.rawProjectedPoints || [],
        anchorFrame: manualPreview.anchorFrame || null,
        constructionItems: manualPreview.constructionItems || [],
        overlay: manualPreview.overlay || null,
        source: manualPreview.source || "manual chart trace",
        notes: manualPreview.notes || "Display-only manual trace; not authoritative navigation geometry.",
      },
    ],
    warnings,
  };
}

export function buildProcedureRoutePreview({ procedure, waypointLookup = {} } = {}) {
  const warnings = [];
  const points = [];
  const procedureId = procedure?.id || null;
  const rnavProcedure = isRnavProcedure(procedure);
  const manualPreview = manualPreviewForProcedure(procedureId);

  if (manualPreview && !rnavProcedure) {
    return buildManualPreviewRoute({ procedure, manualPreview, waypointLookup });
  }

  if (manualPreview && rnavProcedure) {
    warnings.push("RNAV manual trace ignored in JAIP route preview; RNAV display preview uses fix-to-fix polyline only.");
  }

  const approximateGeometry = rnavProcedure
    ? { approximateSegments: [], warnings: [] }
    : buildApproximateProcedureGeometry({ procedure, waypointLookup });

  if (rnavProcedure && procedure?.previewGeometry?.approximate) {
    warnings.push("RNAV previewGeometry ignored; RNAV display preview uses fix-to-fix polyline only.");
  }
  warnings.push(...approximateGeometry.warnings);

  for (const leg of collectLegs(procedure)) {
    const legType = leg?.type || "FIX";
    const fixId = endpointFixIdForLeg(leg);

    if (legType === "HEADING_TO_FIX") {
      warnings.push("HEADING_TO_FIX preview uses fix endpoint only; heading geometry is not drawn. Initial heading leg approximated as direct-to-fix preview.");
    }

    if (legType === "RUNWAY_HEADING") {
      warnings.push("RUNWAY_HEADING is display-only; no coordinate segment is drawn.");
      continue;
    }

    if (legType === "TURN_DIRECT_FIX") {
      warnings.push("TURN_DIRECT_FIX uses endpoint fix only unless approximate preview is enabled.");
    }

    if (legType === "RADIAL_DME_CONSTRAINT") {
      warnings.push("RADIAL_DME_CONSTRAINT is metadata only; no coordinate segment is drawn.");
      continue;
    }

    if (legType === "LEFT_TURN_TO_RADIAL" || legType === "TURN_TO_RADIAL") {
      warnings.push(`${legType} is display-only approximate geometry; no authoritative coordinate segment is drawn.`);
      continue;
    }

    if (legType === "RADIAL_TO_FIX") {
      warnings.push("RADIAL_TO_FIX uses station/radial metadata and destination fix for display preview.");
    }

    if (!["FIX", "FIX_LEG", "HOLD", "HOLD_LEG", "DIRECT_FIX", "HEADING_TO_FIX", "COURSE_LEG", "TURN_DIRECT_FIX", "RADIAL_TO_FIX"].includes(legType)) {
      warnings.push(`${legType || "UNKNOWN"} geometry is not supported by the route preview.`);
      continue;
    }

    if (!fixId) {
      warnings.push(`${legType} leg has no coordinate-bearing fix endpoint.`);
      continue;
    }

    const waypoint = waypointLookup[fixId];
    if (!waypoint || !Number.isFinite(waypoint.lat) || !Number.isFinite(waypoint.lon)) {
      warnings.push(`Missing coordinate waypoint for ${fixId}; segment skipped.`);
      continue;
    }

    appendPoint(points, {
      id: fixId,
      lat: waypoint.lat,
      lon: waypoint.lon,
      role: roleForLeg(leg),
      altitudeConstraintText: altitudeConstraintText(leg.altitude) || waypoint.item?.altitudeConstraintText || null,
      speedConstraintText: speedConstraintText(leg.speed),
      sourceLeg: leg,
    });
  }

  return {
    procedureId,
    type: procedure?.type || null,
    label: procedure?.name || procedureId || "Procedure",
    points,
    approximateSegments: approximateGeometry.approximateSegments,
    warnings,
  };
}

export function buildProcedureRoutePreviews({ procedures = [], waypointLookup = {} } = {}) {
  return expandProcedureRouteEntries(procedures).map((procedure) => buildProcedureRoutePreview({ procedure, waypointLookup }));
}
