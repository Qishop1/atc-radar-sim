import { memo, useMemo } from "react";
import { buildAircraftLikeTurnPreview, buildTurnToRadialPreview } from "../../core-v2/procedures/approximateTurnGeometry.js";
import { buildProcedureRoutePreview, expandProcedureRouteEntries, normalizeProcedureTraceType } from "../../core-v2/procedures/procedureRouteBuilder.js";

function projectPoint(point, projection) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return null;
  const projected = projection.projectLatLon(point.lat, point.lon);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return { ...point, x: projected.x, y: projected.y };
}

function isDisplayPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function projectWaypointById(id, waypointLookup, projection) {
  const waypoint = id ? waypointLookup[id] : null;
  if (!Number.isFinite(waypoint?.lat) || !Number.isFinite(waypoint?.lon)) return null;
  return projectPoint({ id, lat: waypoint.lat, lon: waypoint.lon }, projection);
}

function buildDisplayAnchorFrame({ originPoint, axisTargetPoint }) {
  if (!isDisplayPoint(originPoint) || !isDisplayPoint(axisTargetPoint)) return null;
  const dx = axisTargetPoint.x - originPoint.x;
  const dy = axisTargetPoint.y - originPoint.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return null;
  const unitU = { x: dx / length, y: dy / length };
  const unitV = { x: -unitU.y, y: unitU.x };
  return {
    origin: { x: originPoint.x, y: originPoint.y },
    length,
    unitU,
    unitV,
  };
}

function anchorUvToProjected(uv, frame) {
  if (!frame || !Number.isFinite(uv?.u) || !Number.isFinite(uv?.v)) return null;
  return {
    x: frame.origin.x + (uv.u * frame.unitU.x + uv.v * frame.unitV.x) * frame.length,
    y: frame.origin.y + (uv.u * frame.unitU.y + uv.v * frame.unitV.y) * frame.length,
  };
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function pointsToCatmullRomPath(points, tension = 0.35) {
  const safe = (points || []).filter(isDisplayPoint);

  if (safe.length < 2) return "";
  if (safe.length < 3) return pathFromPoints(safe);

  let d = `M ${safe[0].x.toFixed(2)} ${safe[0].y.toFixed(2)}`;

  for (let i = 0; i < safe.length - 1; i += 1) {
    const p0 = safe[i - 1] || safe[i];
    const p1 = safe[i];
    const p2 = safe[i + 1];
    const p3 = safe[i + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;

    if (![cp1x, cp1y, cp2x, cp2y, p2.x, p2.y].every(Number.isFinite)) continue;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

function chaikinSmoothPoints(points, iterations = 3) {
  let safe = (points || []).filter(isDisplayPoint);

  if (safe.length < 3) return safe;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = [safe[0]];

    for (let i = 0; i < safe.length - 1; i += 1) {
      const p0 = safe[i];
      const p1 = safe[i + 1];

      next.push({
        x: p0.x * 0.75 + p1.x * 0.25,
        y: p0.y * 0.75 + p1.y * 0.25,
        role: p0.role || "manual-trace-smoothed",
      });

      next.push({
        x: p0.x * 0.25 + p1.x * 0.75,
        y: p0.y * 0.25 + p1.y * 0.75,
        role: p1.role || "manual-trace-smoothed",
      });
    }

    next.push(safe[safe.length - 1]);
    safe = next;
  }

  return safe;
}

function pathFromManualTracePoints(segment, points) {
  if (normalizeProcedureTraceType(segment?.traceType, { segment, fallback: "manual-trace" }) !== "approx-turn") return pathFromPoints(points);

  const tailStartIndex = Number.isInteger(segment.radialTailStartIndex)
    ? segment.radialTailStartIndex
    : null;

  if (tailStartIndex !== null && tailStartIndex > 1 && tailStartIndex < points.length - 1) {
    const turnPoints = points.slice(0, tailStartIndex + 1);
    const tailPoints = points.slice(tailStartIndex);
    const smoothedTurn = chaikinSmoothPoints(turnPoints, 3);
    const turnPath = pointsToCatmullRomPath(smoothedTurn, 0.35);
    const tailPath = tailPoints
      .slice(1)
      .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    return [turnPath, tailPath].filter(Boolean).join(" ");
  }

  const smoothedPoints = chaikinSmoothPoints(points, 3);
  return pointsToCatmullRomPath(smoothedPoints, 0.35);
}

function midpoint(points) {
  if (!points.length) return null;
  return points[Math.floor((points.length - 1) / 2)];
}

function displayUnitsPerNm(projection) {
  if (Number.isFinite(projection?.nmToScreen) && projection.nmToScreen > 0) return projection.nmToScreen;
  if (Number.isFinite(projection?.scale) && projection.scale > 0) return projection.scale / 60;
  return null;
}

function isPointInView(point, view, paddingRatio = 0.12) {
  if (!view) return true;
  const padding = Math.max(view.w || 0, view.h || 0) * paddingRatio;
  return point.x >= view.x - padding
    && point.x <= view.x + view.w + padding
    && point.y >= view.y - padding
    && point.y <= view.y + view.h + padding;
}

function routePointKey(point) {
  if (point.id) return point.id;
  return `${point.x.toFixed(2)}:${point.y.toFixed(2)}`;
}

function rawProjectedTracePoints(segment) {
  return (segment.rawProjectedPoints || segment.points || [])
    .map((point) => ({ x: Number(point.x), y: Number(point.y), role: "manual-trace" }))
    .filter(isDisplayPoint);
}

function manualTracePath(segment, projection, waypointLookup) {
  const warnings = [];
  let projected = [];

  if (segment.coordinateSpace === "anchor-normalized") {
    const origin = projectWaypointById(segment.anchorFrame?.originId, waypointLookup, projection);
    const axisTarget = projectWaypointById(segment.anchorFrame?.axisToId, waypointLookup, projection);
    const frame = buildDisplayAnchorFrame({ originPoint: origin, axisTargetPoint: axisTarget });

    if (frame) {
      projected = (segment.normalizedPoints || segment.points || [])
        .map((point, index, points) => {
          const projectedPoint = anchorUvToProjected(point, frame);
          if (!projectedPoint) return null;
          if (index === 0 && segment.anchorFrame?.startId) return { ...projectedPoint, id: segment.anchorFrame.startId, role: "manual-trace-start" };
          if (index === points.length - 1 && segment.anchorFrame?.finalId) return { ...projectedPoint, id: segment.anchorFrame.finalId, role: "manual-trace-final" };
          return { ...projectedPoint, role: "manual-trace" };
        })
        .filter(isDisplayPoint);
    } else {
      warnings.push("Manual trace anchor frame could not be resolved; using raw projected points if available.");
      projected = rawProjectedTracePoints(segment);
    }
  } else if (segment.coordinateSpace === "rjcc-projected") {
    projected = rawProjectedTracePoints(segment);
  }

  if (projected.length < 2) {
    return { d: null, points: projected, warnings: ["Manual trace skipped: fewer than two valid display points.", ...warnings] };
  }

  return {
    d: pathFromManualTracePoints(segment, projected),
    points: projected,
    warnings,
  };
}

function mergeRoutePoints(projectedRoutes) {
  const merged = new Map();

  for (const route of projectedRoutes) {
    route.projectedPoints.forEach((point, index) => {
      const key = routePointKey(point);
      const existing = merged.get(key);
      const flags = {
        first: index === 0,
        last: index === route.projectedPoints.length - 1,
        critical: Boolean(point.altitudeConstraintText || point.speedConstraintText),
      };

      if (!existing) {
        merged.set(key, { ...point, ...flags, routeIds: [route.procedureId].filter(Boolean) });
        return;
      }

      existing.first = existing.first || flags.first;
      existing.last = existing.last || flags.last;
      existing.critical = existing.critical || flags.critical;
      if (route.procedureId && !existing.routeIds.includes(route.procedureId)) existing.routeIds.push(route.procedureId);
    });
  }

  return [...merged.values()];
}

function pointLabelBudget(zoom) {
  if (zoom < 7) return 0;
  if (zoom < 14) return 4;
  return 20;
}

function pointLabelPriority(point, view) {
  const centerX = view ? view.x + view.w / 2 : point.x;
  const centerY = view ? view.y + view.h / 2 : point.y;
  const special = (point.first || point.last || point.critical) ? -100000 : 0;
  return special + Math.hypot(point.x - centerX, point.y - centerY);
}

function approximateSegmentPath(segment, projection, waypointLookup) {
  if (segment.type === "MANUAL_TRACE") return manualTracePath(segment, projection, waypointLookup);

  const projected = (segment.points || []).map((point) => projectPoint(point, projection)).filter(Boolean);
  if (projected.length < 2) return null;

  if (segment.type === "APPROX_DIRECT") {
    return {
      d: pathFromPoints(projected),
      points: projected,
      warnings: [],
    };
  }

  const scale = displayUnitsPerNm(projection);
  let preview = null;

  if (segment.type === "APPROX_LEFT_TEARDROP_TO_RADIAL" || segment.type === "APPROX_TURN_TO_RADIAL") {
    preview = buildTurnToRadialPreview({
      runwayEnd: projected[0],
      runwayHeadingDeg: segment.headingDeg,
      stationPoint: projected[1],
      radialDeg: segment.radialDeg,
      destinationFix: projected[projected.length - 1],
      turnDirection: segment.turnDirection || "LEFT",
      nmToDisplayUnits: scale,
      initialStraightNm: segment.turnStartNmFromRunwayEnd,
      interceptDistanceNm: segment.interceptDistanceNm,
      turnStartNmFromRunwayEnd: segment.turnStartNmFromRunwayEnd,
      turnWithinNm: segment.turnWithinNm,
      sampleCount: segment.sampleCount,
    });
  } else {
    preview = buildAircraftLikeTurnPreview({
      startPoint: projected[0],
      endPoint: projected[projected.length - 1],
      initialTrackDeg: segment.headingDeg,
      turnDirection: segment.turnDirection || "RIGHT",
      nmToDisplayUnits: scale,
      initialStraightNm: segment.initialStraightNm,
      turnRadiusNm: segment.turnRadiusNm,
      maxTurnDeg: segment.maxTurnDeg,
      sampleCount: segment.sampleCount,
    });
  }

  if (!preview?.points?.length || preview.points.length < 2) return null;
  return {
    d: pathFromPoints(preview.points),
    points: preview.points,
    warnings: preview.warnings || [],
  };
}

function routeStyle(traceType) {
  const normalized = normalizeProcedureTraceType(traceType, { fallback: "connector" });
  if (normalized === "route-solid") {
    return { stroke: "#f1fbff", opacity: 0.9, strokeWidth: 1.25, strokeDasharray: undefined };
  }
  if (normalized === "approx-turn") {
    return { stroke: "#d6f6fa", opacity: 0.58, strokeWidth: 0.95, strokeDasharray: "6 4" };
  }
  if (normalized === "radial-segment") {
    return { stroke: "#b9eef3", opacity: 0.5, strokeWidth: 0.85, strokeDasharray: "10 4 2 4" };
  }
  if (normalized === "manual-trace") {
    return { stroke: "#d6f6fa", opacity: 0.5, strokeWidth: 0.9, strokeDasharray: "5 4" };
  }
  return { stroke: "#9ed7df", opacity: 0.35, strokeWidth: 0.8, strokeDasharray: "3 5" };
}

export const ProcedureRouteLayer = memo(function ProcedureRouteLayer({
  procedures = [],
  selectedProcedureIds = [],
  waypointLookup = {},
  projection,
  view,
  zoom = 1,
  uiScale,
  detailMode = "path",
  showLabels,
  showApproximateGeometry = false,
}) {
  const selectedIds = useMemo(() => new Set(selectedProcedureIds), [selectedProcedureIds]);
  const rawRoutePreviews = useMemo(
    () => expandProcedureRouteEntries(procedures)
      .filter((procedure) => selectedIds.has(procedure.id))
      .map((procedure) => buildProcedureRoutePreview({ procedure, waypointLookup })),
    [procedures, selectedIds, waypointLookup]
  );

  const projectedRoutes = useMemo(
    () => rawRoutePreviews.map((preview) => {
      const projectedPoints = preview.points.map((point) => projectPoint(point, projection)).filter(Boolean);
      return {
        ...preview,
        projectedPoints,
        pathD: projectedPoints.length >= 2 ? pathFromPoints(projectedPoints) : null,
        approximatePaths: (preview.approximateSegments || [])
          .filter((segment) => showApproximateGeometry || segment.type === "MANUAL_TRACE")
          .map((segment) => ({ segment, path: approximateSegmentPath(segment, projection, waypointLookup) }))
          .filter((item) => item.path?.d),
      };
    }),
    [projection, rawRoutePreviews, showApproximateGeometry, waypointLookup]
  );

  const mergedRoutePoints = useMemo(() => mergeRoutePoints(projectedRoutes), [projectedRoutes]);
  const visibleRoutePoints = useMemo(() => mergedRoutePoints.filter((point) => isPointInView(point, view)), [mergedRoutePoints, view]);
  const labelPoints = useMemo(() => {
    if (detailMode !== "labels" || !showLabels) return [];
    return [...visibleRoutePoints]
      .sort((a, b) => pointLabelPriority(a, view) - pointLabelPriority(b, view))
      .slice(0, pointLabelBudget(zoom));
  }, [detailMode, showLabels, view, visibleRoutePoints, zoom]);

  const s = uiScale;
  const showMarkers = detailMode === "points" || detailMode === "labels";
  const showText = detailMode === "labels" && showLabels;
  const stroke = "#b9eef3";
  const markerRadius = 1.9 * s;
  const procedureLabelStyle = { fill: "#d8fbff", fontSize: 11 * s, fontFamily: "monospace", fontWeight: 900 };
  const pointLabelStyle = { fill: stroke, fontSize: 9.5 * s, fontFamily: "monospace", fontWeight: 800 };
  const approximateTitle = "Approximate aircraft-like turn preview; not authoritative procedure geometry.";

  if (!projectedRoutes.length) return null;

  return (
    <g id="procedure-route-layer" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.85" vectorEffect="non-scaling-stroke">
      {projectedRoutes.map((preview) => {
        const labelPoint = midpoint(preview.projectedPoints);
        const title = [preview.label, ...preview.warnings].filter(Boolean).join("\n");
        const mainStyle = routeStyle(preview.traceType);

        return (
          <g key={preview.procedureId || preview.label}>
            <title>{title}</title>
            {preview.approximatePaths.map(({ segment, path }, index) => {
              const segmentStyle = routeStyle(segment.traceType || segment.type);
              return (
                <g key={`${preview.procedureId}-approx-${index}`} opacity={segmentStyle.opacity} stroke={segmentStyle.stroke} strokeWidth={segmentStyle.strokeWidth} strokeDasharray={segmentStyle.strokeDasharray} vectorEffect="non-scaling-stroke">
                  <title>{[segment.notes || approximateTitle, ...(path.warnings || [])].filter(Boolean).join("\n")}</title>
                  <path d={path.d} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
            {preview.pathD && <path d={preview.pathD} stroke={mainStyle.stroke} strokeWidth={mainStyle.strokeWidth} strokeDasharray={mainStyle.strokeDasharray} opacity={mainStyle.opacity} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
            {showText && labelPoint && <text x={labelPoint.x + 7 * s} y={labelPoint.y + 11 * s} style={procedureLabelStyle} stroke="none">{preview.procedureId}</text>}
          </g>
        );
      })}
      {showMarkers && (
        <g id="procedure-marker-layer" fill="#071c20" stroke={stroke} strokeWidth="0.8" vectorEffect="non-scaling-stroke">
          {visibleRoutePoints.map((point) => (
            <circle key={routePointKey(point)} cx={point.x} cy={point.y} r={markerRadius} vectorEffect="non-scaling-stroke">
              {detailMode !== "path" && <title>{[point.id, ...point.routeIds].filter(Boolean).join("\n")}</title>}
            </circle>
          ))}
        </g>
      )}
      {showText && (
        <g id="procedure-label-layer" stroke="none">
          {labelPoints.map((point) => (
            <text key={routePointKey(point)} x={point.x + 5 * s} y={point.y - 5 * s} style={pointLabelStyle}>{point.id}</text>
          ))}
        </g>
      )}
    </g>
  );
});
