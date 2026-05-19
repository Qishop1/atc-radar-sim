function collectLegs(procedure) {
  const segmentLegs = (procedure?.segments || []).flatMap((segment) => segment.legs || []);
  const directLegs = procedure?.legs || [];
  const holdLeg = procedure?.fixId ? [{ type: procedure.type || "HOLD", fixId: procedure.fixId }] : [];
  return [...segmentLegs, ...directLegs, ...holdLeg];
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

export function buildProcedureRoutePreview({ procedure, waypointLookup = {} } = {}) {
  const warnings = [];
  const points = [];
  const procedureId = procedure?.id || null;

  for (const leg of collectLegs(procedure)) {
    const legType = leg?.type || "FIX";
    const fixId = endpointFixIdForLeg(leg);

    if (legType === "HEADING_TO_FIX") {
      warnings.push("HEADING_TO_FIX preview uses fix endpoint only; heading geometry is not drawn. Initial heading leg approximated as direct-to-fix preview.");
    }

    if (!["FIX", "FIX_LEG", "HOLD", "HOLD_LEG", "DIRECT_FIX", "HEADING_TO_FIX", "COURSE_LEG"].includes(legType)) {
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
    warnings,
  };
}

export function buildProcedureRoutePreviews({ procedures = [], waypointLookup = {} } = {}) {
  return procedures.map((procedure) => buildProcedureRoutePreview({ procedure, waypointLookup }));
}
