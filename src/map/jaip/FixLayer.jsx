import { memo, useMemo } from "react";
import { fixes as rjccFixes } from "../../data/airspace/rjcc/fixes.js";

function projectFix(fix, projection) {
  if (!Number.isFinite(fix?.lat) || !Number.isFinite(fix?.lon)) return null;
  const point = projection.projectLatLon(fix.lat, fix.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...fix, x: point.x, y: point.y };
}

export const FixLayer = memo(function FixLayer({ fixes = rjccFixes, projection, uiScale }) {
  const projectedFixes = useMemo(
    () => fixes.map((fix) => projectFix(fix, projection)).filter(Boolean),
    [fixes, projection]
  );
  const stroke = "#7fc6cf";
  const s = uiScale;
  const size = 5.3 * s;
  const labelStyle = { fill: stroke, fontSize: 9.5 * s, fontFamily: "monospace", fontWeight: 800 };

  return (
    <g id="fix-layer" opacity="0.82" fill="none" stroke={stroke} strokeWidth="0.75" vectorEffect="non-scaling-stroke">
      {projectedFixes.map((fix) => (
        <g key={fix.id} transform={`translate(${fix.x} ${fix.y})`}>
          <title>{`${fix.id}${fix.reference?.raw ? `\n${fix.reference.raw}` : ""}`}</title>
          <path d={`M 0 ${(-size).toFixed(2)} L ${(size).toFixed(2)} 0 L 0 ${(size).toFixed(2)} L ${(-size).toFixed(2)} 0 Z`} vectorEffect="non-scaling-stroke" />
          <text x={7 * s} y={-6 * s} style={labelStyle} stroke="none">{fix.id}</text>
        </g>
      ))}
    </g>
  );
});
