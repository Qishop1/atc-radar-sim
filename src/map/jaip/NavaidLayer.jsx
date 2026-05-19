import { memo, useMemo } from "react";
import { navaids as rjccNavaids } from "../../data/airspace/rjcc/navaids.js";

function projectNavaid(navaid, projection) {
  if (!Number.isFinite(navaid?.lat) || !Number.isFinite(navaid?.lon)) return null;
  const point = projection.projectLatLon(navaid.lat, navaid.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...navaid, x: point.x, y: point.y };
}

export const NavaidLayer = memo(function NavaidLayer({ navaids = rjccNavaids, projection, uiScale }) {
  const projectedNavaids = useMemo(
    () => navaids.map((navaid) => projectNavaid(navaid, projection)).filter(Boolean),
    [navaids, projection]
  );
  const stroke = "#9ed7df";
  const s = uiScale;
  const size = 5.2 * s;
  const labelStyle = { fill: stroke, fontSize: 10 * s, fontFamily: "monospace", fontWeight: 800 };

  return (
    <g id="navaid-layer" opacity="0.9" fill="none" stroke={stroke} strokeWidth="0.7" vectorEffect="non-scaling-stroke">
      {projectedNavaids.map((navaid) => {
        const hex = Array.from({ length: 6 }, (_, i) => {
          const angle = (-150 + i * 60) * Math.PI / 180;
          return `${(Math.cos(angle) * size * 0.82).toFixed(2)},${(Math.sin(angle) * size * 0.82).toFixed(2)}`;
        }).join(" ");
        return (
          <g key={navaid.id} transform={`translate(${navaid.x} ${navaid.y})`}>
            <title>{`${navaid.id} ${navaid.name || ""} ${navaid.type || ""}`}</title>
            <rect x={-size} y={-size} width={size * 2} height={size * 2} vectorEffect="non-scaling-stroke" />
            <polygon points={hex} vectorEffect="non-scaling-stroke" />
            <circle cx="0" cy="0" r={0.9 * s} fill={stroke} stroke="none" />
            <text x={7 * s} y={-7 * s} style={labelStyle} stroke="none">{navaid.id}</text>
          </g>
        );
      })}
    </g>
  );
});
