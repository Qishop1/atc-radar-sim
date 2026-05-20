import { memo, useMemo } from "react";
import { navaids as rjccNavaids } from "../../data/airspace/rjcc/navaids.js";

function regularPolygonPoints(sides, radius, startDeg = -90) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (startDeg + i * (360 / sides)) * Math.PI / 180;
    return `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
}

function projectNavaid(navaid, projection) {
  if (!Number.isFinite(navaid?.lat) || !Number.isFinite(navaid?.lon)) return null;
  const point = projection.projectLatLon(navaid.lat, navaid.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...navaid, x: point.x, y: point.y };
}

function titleForNavaid(navaid) {
  return [
    `${navaid.id} ${navaid.name || ""}`.trim(),
    navaid.type,
    navaid.dms,
    navaid.frequencyMHz ? `${navaid.frequencyMHz} MHz` : null,
    navaid.channel,
    navaid.alternateChannelNote,
  ].filter(Boolean).join("\n");
}

function shouldShowLabels(labelMode, zoom) {
  if (labelMode === "on") return true;
  if (labelMode === "off") return false;
  return zoom >= 1;
}

function isInView(point, view) {
  if (!view) return true;
  const margin = Math.max(view.w || 0, view.h || 0) * 0.12;
  return point.x >= view.x - margin
    && point.x <= view.x + view.w + margin
    && point.y >= view.y - margin
    && point.y <= view.y + view.h + margin;
}

export const NavaidLayer = memo(function NavaidLayer({ navaids = rjccNavaids, projection, view, zoom = 1, uiScale, labelMode = "auto" }) {
  const projectedNavaids = useMemo(
    () => navaids.map((navaid) => projectNavaid(navaid, projection)).filter(Boolean),
    [navaids, projection]
  );
  const visibleNavaids = useMemo(
    () => projectedNavaids.filter((navaid) => isInView(navaid, view)),
    [projectedNavaids, view]
  );
  const stroke = "#9ed7df";
  const s = uiScale;
  const size = 5.2 * s;
  const showLabels = shouldShowLabels(labelMode, zoom);
  const labelStyle = { fill: stroke, fontSize: 10 * s, fontFamily: "monospace", fontWeight: 800 };

  return (
    <g id="navaid-layer" opacity="0.9" fill="none" stroke={stroke} strokeWidth="0.7" vectorEffect="non-scaling-stroke">
      {visibleNavaids.map((navaid) => {
        const isTacan = String(navaid.type || "").toUpperCase().includes("TACAN");
        const hex = regularPolygonPoints(6, size * 0.82, -150);
        const diamond = regularPolygonPoints(4, size * 1.12, -90);
        return (
          <g key={navaid.id} transform={`translate(${navaid.x} ${navaid.y})`}>
            <title>{titleForNavaid(navaid)}</title>
            {isTacan ? (
              <>
                <polygon points={diamond} vectorEffect="non-scaling-stroke" />
                <path d={`M ${(-size).toFixed(2)} 0 H ${(size).toFixed(2)} M 0 ${(-size).toFixed(2)} V ${(size).toFixed(2)}`} vectorEffect="non-scaling-stroke" />
              </>
            ) : (
              <>
                <rect x={-size} y={-size} width={size * 2} height={size * 2} vectorEffect="non-scaling-stroke" />
                <polygon points={hex} vectorEffect="non-scaling-stroke" />
                <circle cx="0" cy="0" r={0.9 * s} fill={stroke} stroke="none" />
              </>
            )}
            {showLabels && <text x={7 * s} y={-7 * s} style={labelStyle} stroke="none">{navaid.id}</text>}
          </g>
        );
      })}
    </g>
  );
});
