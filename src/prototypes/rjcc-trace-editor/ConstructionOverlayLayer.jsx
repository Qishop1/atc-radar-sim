import { memo, useMemo } from "react";
import { buildDmeArc, buildDmeCircle, buildRadialLine } from "./constructionGeometry.js";

function pathFromPoints(points) {
  return (points || [])
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function projectPoint(point, projection) {
  if (!point) return null;
  if (Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
  if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) return { ...point, ...projection.projectLatLon(point.lat, point.lon) };
  return null;
}

function itemVisibleForGroup(item, groups) {
  if (item.visible === false) return false;
  if (item.kind === "RADIAL") return groups.showRadials;
  if (item.kind === "DME_CIRCLE") return groups.showDme;
  if (item.kind === "DME_ARC") return groups.showArcs;
  if (item.kind === "AUX_LINE") return groups.showAux;
  if (item.kind === "ANCHOR") return groups.showAnchors;
  return true;
}

function ConstructionLabel({ x, y, children, uiScale, selected }) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !children) return null;
  const s = uiScale;
  return (
    <text
      x={x + 6 * s}
      y={y - 6 * s}
      fill={selected ? "#ffffff" : "#b9eef3"}
      fontFamily="monospace"
      fontSize={Math.max(10 * s, 3.2)}
      fontWeight="900"
      stroke="none"
      opacity="0.92"
    >
      {children}
    </text>
  );
}

function Marker({ item, point, uiScale, showLabels, selected }) {
  if (!point) return null;
  const s = uiScale;
  const stroke = selected ? "#ffffff" : item.kind === "ANCHOR" ? "#d8fbff" : "#b9eef3";
  return (
    <g transform={`translate(${point.x} ${point.y})`} vectorEffect="non-scaling-stroke">
      <path d={`M ${-5 * s} 0 L ${5 * s} 0 M 0 ${-5 * s} L 0 ${5 * s}`} stroke={stroke} strokeWidth={selected ? "1.5" : "1"} vectorEffect="non-scaling-stroke" />
      <rect x={-3 * s} y={-3 * s} width={6 * s} height={6 * s} fill="none" stroke={stroke} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      {showLabels && <ConstructionLabel x={0} y={0} uiScale={uiScale} selected={selected}>{item.label}</ConstructionLabel>}
    </g>
  );
}

export const ConstructionOverlayLayer = memo(function ConstructionOverlayLayer({
  showRadials,
  showDme,
  showArcs,
  showAux,
  showAnchors,
  showLabels,
  constructionItems,
  selectedItemId,
  projection,
  uiScale,
  stationsById,
}) {
  const groups = { showRadials, showDme, showArcs, showAux, showAnchors };
  const rendered = useMemo(() => (constructionItems || [])
    .filter((item) => itemVisibleForGroup(item, groups))
    .map((item) => {
      const station = stationsById?.[item.data?.stationId];
      if (item.kind === "RADIAL") {
        const line = buildRadialLine({ station, radialDeg: item.data.trueBearingDeg ?? item.data.radialDeg, lengthNm: item.data.lengthNm, projection });
        return line?.points?.length === 2 ? { item, points: line.points, type: "path" } : null;
      }
      if (item.kind === "DME_CIRCLE") {
        const points = buildDmeCircle({ station, radiusNm: item.data.radiusNm, projection, sampleCount: 120 });
        return points.length > 2 ? { item, points, type: "circle" } : null;
      }
      if (item.kind === "DME_ARC") {
        const points = buildDmeArc({ station, radiusNm: item.data.radiusNm, startBearingDeg: item.data.startBearingDeg, endBearingDeg: item.data.endBearingDeg, projection, sampleCount: 72 });
        return points.length > 1 ? { item, points, type: "arc" } : null;
      }
      if (item.kind === "AUX_LINE") return { item, points: item.data.points || [], type: "aux" };
      if (item.kind === "MARKER" || item.kind === "ANCHOR") return { item, point: projectPoint(item.data.point, projection), type: "marker" };
      return null;
    })
    .filter(Boolean), [constructionItems, groups.showAnchors, groups.showArcs, groups.showAux, groups.showDme, groups.showRadials, projection, stationsById]);

  return (
    <g id="trace-construction-overlay" pointerEvents="none" fill="none" vectorEffect="non-scaling-stroke">
      {rendered.map((entry) => {
        const selected = entry.item.id === selectedItemId;
        const common = {
          strokeWidth: selected ? 1.55 : 0.9,
          opacity: selected ? 0.95 : 0.62,
          vectorEffect: "non-scaling-stroke",
        };
        if (entry.type === "marker") return <Marker key={entry.item.id} item={entry.item} point={entry.point} uiScale={uiScale} showLabels={showLabels} selected={selected} />;
        const d = pathFromPoints(entry.points);
        const labelPoint = entry.points[Math.floor(entry.points.length / 2)] || entry.points[entry.points.length - 1];
        const stroke = entry.item.kind === "RADIAL" ? "#6bd4df" : entry.item.kind === "DME_CIRCLE" ? "#7fc6cf" : entry.item.kind === "DME_ARC" ? "#9ed7df" : "#91aeb4";
        const dash = entry.item.kind === "DME_CIRCLE" ? "2 5" : entry.item.kind === "RADIAL" ? "7 5" : "5 4";
        return (
          <g key={entry.item.id}>
            <path d={d} stroke={stroke} strokeDasharray={dash} {...common} />
            {showLabels && labelPoint && <ConstructionLabel x={labelPoint.x} y={labelPoint.y} uiScale={uiScale} selected={selected}>{entry.item.label}</ConstructionLabel>}
          </g>
        );
      })}
    </g>
  );
});
