import { manualProcedurePreviews } from "../../data/airspace/rjcc/manualProcedurePreviews.js";
import { buildProcedureRoutePreview } from "../../core-v2/procedures/procedureRouteBuilder.js";
import { buildWaypointLookup, getProcedureById } from "../../core-v2/procedures/procedureLookup.js";

const DISPLAY_PLAYBACK_SAFETY = Object.freeze({
  displayOnly: true,
  guidanceEnabled: false,
  legs: null,
  sandboxOnly: true,
});

function isFiniteLatLon(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lon);
}

function isRnav(procedure) {
  return String(procedure?.navSpec || "").toUpperCase().includes("RNAV");
}

function endpointId(leg) {
  return leg?.fixId || leg?.toFixId || leg?.waypointId || null;
}

function referencedWaypointIds(procedure) {
  const routeFixes = (procedure?.routeFixes || []).map((item) => typeof item === "string" ? item : item?.id || item?.fixId).filter(Boolean);
  if (routeFixes.length) return routeFixes;
  return (procedure?.segments || [])
    .flatMap((segment) => segment?.legs || [])
    .map(endpointId)
    .filter(Boolean);
}

function projectPoint(point, projection, index) {
  const projected = projection?.projectLatLon?.(point.lat, point.lon) || { x: point.lon, y: -point.lat };
  return {
    ...point,
    id: point.id || `DISPLAY_POINT_${index + 1}`,
    label: point.label || point.id || `P${index + 1}`,
    x: projected.x,
    y: projected.y,
  };
}

function manualPreviewPoints(preview, projection) {
  if (!preview) return [];
  const coordinatePoints = (preview.rawProjectedPoints || []).filter(isFiniteLatLon).length >= 2
    ? preview.rawProjectedPoints
    : (preview.points || []).filter(isFiniteLatLon);
  const finalId = preview.anchorFrame?.finalId || null;
  return coordinatePoints.map((point, index) => {
    const isLast = index === coordinatePoints.length - 1;
    return projectPoint({
      ...point,
      id: isLast && finalId ? finalId : `${preview.id}_DISPLAY_${String(index + 1).padStart(2, "0")}`,
      label: isLast && finalId ? finalId : null,
      role: isLast && finalId ? "manual-trace-final" : "display-fallback",
      displayOnly: true,
    }, projection, index);
  });
}

function previewPoints(preview, projection) {
  return (preview?.points || []).filter(isFiniteLatLon).map((point, index) => projectPoint({
    ...point,
    displayAltitudeFt: point?.sourceLeg?.atOrAboveFt ?? point?.sourceLeg?.altitude?.atOrAboveFt ?? null,
  }, projection, index));
}

function resolutionDiagnostics(procedure, waypointLookup) {
  const unresolvedFixes = [];
  const ambiguousFixes = [];
  for (const id of [...new Set(referencedWaypointIds(procedure))]) {
    const waypoint = waypointLookup[id];
    if (!waypoint || !isFiniteLatLon(waypoint)) {
      unresolvedFixes.push(id);
    } else if ((waypoint.duplicateItems || []).length > 1) {
      ambiguousFixes.push(id);
    }
  }
  return { unresolvedFixes, ambiguousFixes };
}

export function resolveProcedurePlaybackRoute({
  procedureId,
  procedureRecord,
  waypointLookup = buildWaypointLookup(),
  projection,
} = {}) {
  const warnings = [
    "Display route playback only. Not aircraft guidance.",
    "No aircraft-readable legs are created. legs is null.",
  ];
  const errors = [];
  const procedure = procedureRecord || getProcedureById(procedureId);

  if (!procedure) {
    return {
      ok: false,
      procedureId,
      procedureName: procedureId || "Unknown procedure",
      runway: null,
      sourceKind: "unknown",
      safety: DISPLAY_PLAYBACK_SAFETY,
      points: [],
      unresolvedFixes: [],
      ambiguousFixes: [],
      warnings,
      errors: [`Procedure not found: ${procedureId || "(missing id)"}.`],
    };
  }

  const manualPreview = manualProcedurePreviews[procedure.id] || null;
  const displayPreview = buildProcedureRoutePreview({ procedure, waypointLookup });
  const { unresolvedFixes, ambiguousFixes } = resolutionDiagnostics(procedure, waypointLookup);
  let sourceKind = "unknown";
  let points = [];

  if ((procedure.routeFixes || []).length) {
    sourceKind = "routeFixes";
    points = previewPoints(displayPreview, projection);
  } else if (isRnav(procedure)) {
    sourceKind = "segments";
    points = previewPoints(displayPreview, projection);
    warnings.push("RNAV display route is resolved from registered display segments because routeFixes are not present on this record.");
  } else if (manualPreview) {
    sourceKind = "manualPreview";
    points = manualPreviewPoints(manualPreview, projection);
    warnings.push("Conventional SID playback uses manual display-only trace geometry.");
  } else {
    sourceKind = "segments";
    points = previewPoints(displayPreview, projection);
  }

  warnings.push(...(displayPreview?.warnings || []));
  if (unresolvedFixes.length) errors.push(`Unresolved display waypoints: ${unresolvedFixes.join(", ")}.`);
  if (ambiguousFixes.length) warnings.push(`Ambiguous display waypoints reported: ${ambiguousFixes.join(", ")}.`);
  if (points.some((point) => !isFiniteLatLon(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    errors.push("Display route contains a point without finite coordinates.");
    points = points.filter((point) => isFiniteLatLon(point) && Number.isFinite(point.x) && Number.isFinite(point.y));
  }
  if (points.length < 2) errors.push("No continuous display route with at least two points is available.");

  return {
    ok: errors.length === 0,
    procedureId: procedure.id,
    procedureName: procedure.name || procedure.id,
    runway: (procedure.runwayIds || []).join("/") || procedure.runwayId || null,
    sourceKind,
    safety: DISPLAY_PLAYBACK_SAFETY,
    points,
    unresolvedFixes,
    ambiguousFixes,
    warnings: [...new Set(warnings)],
    errors,
    navSpec: procedure.navSpec || null,
    traceType: displayPreview?.traceType || null,
  };
}

export { DISPLAY_PLAYBACK_SAFETY };
