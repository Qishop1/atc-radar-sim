import { memo, useMemo } from "react";
import { buildProcedureRoutePreview, expandProcedureRouteEntries } from "../../core-v2/procedures/procedureRouteBuilder.js";

function projectPoint(point, projection) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return null;
  const projected = projection.projectLatLon(point.lat, point.lon);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return { ...point, x: projected.x, y: projected.y };
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function midpoint(points) {
  if (!points.length) return null;
  const index = Math.floor((points.length - 1) / 2);
  return points[index];
}

export const ProcedureRouteLayer = memo(function ProcedureRouteLayer({
  procedures = [],
  selectedProcedureIds = [],
  waypointLookup = {},
  projection,
  zoom = 1,
  uiScale,
  showLabels,
}) {
  const selectedIds = useMemo(() => new Set(selectedProcedureIds), [selectedProcedureIds]);
  const routePreviews = useMemo(
    () => expandProcedureRouteEntries(procedures)
      .filter((procedure) => selectedIds.has(procedure.id))
      .map((procedure) => buildProcedureRoutePreview({ procedure, waypointLookup }))
      .map((preview) => ({
        ...preview,
        projectedPoints: preview.points.map((point) => projectPoint(point, projection)).filter(Boolean),
      })),
    [procedures, projection, selectedIds, waypointLookup]
  );

  const s = uiScale;
  const labelsVisible = showLabels || zoom >= 4.2;
  const stroke = "#b9eef3";
  const labelStyle = { fill: stroke, fontSize: 10 * s, fontFamily: "monospace", fontWeight: 900 };
  const procedureLabelStyle = { ...labelStyle, fontSize: 11 * s, fill: "#d8fbff" };

  if (!routePreviews.length) return null;

  return (
    <g id="procedure-route-layer" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.85" vectorEffect="non-scaling-stroke">
      {routePreviews.map((preview) => {
        const points = preview.projectedPoints;
        const labelPoint = midpoint(points);
        const title = [preview.label, ...preview.warnings].filter(Boolean).join("\n");

        return (
          <g key={preview.procedureId || preview.label} strokeDasharray={preview.warnings.length ? `${6 * s} ${4 * s}` : undefined}>
            <title>{title}</title>
            {points.length >= 2 && <path d={pathFromPoints(points)} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((point) => (
              <g key={`${preview.procedureId}-${point.id}`} transform={`translate(${point.x} ${point.y})`}>
                <circle r={2.2 * s} fill="#071c20" stroke={stroke} vectorEffect="non-scaling-stroke" />
                {labelsVisible && <text x={5 * s} y={-5 * s} style={labelStyle} stroke="none">{point.id}</text>}
              </g>
            ))}
            {labelPoint && <text x={labelPoint.x + 7 * s} y={labelPoint.y + 11 * s} style={procedureLabelStyle} stroke="none">{preview.procedureId}</text>}
          </g>
        );
      })}
    </g>
  );
});
