import { memo, useMemo } from "react";
import { fixes as rjccFixes } from "../../data/airspace/rjcc/fixes.js";

function isApproachFix(fix) {
  const text = `${fix?.type || ""} ${fix?.notes || ""} ${fix?.altitudeConstraintText || ""}`.toUpperCase();
  return /\b(FAF|IAF|IF|MAPT|MATF|APPROACH)\b/.test(text);
}

function projectFix(fix, projection) {
  if (!Number.isFinite(fix?.lat) || !Number.isFinite(fix?.lon)) return null;
  const point = projection.projectLatLon(fix.lat, fix.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...fix, x: point.x, y: point.y };
}

function titleForFix(fix) {
  return [
    fix.id,
    fix.type,
    fix.dms,
    fix.altitudeConstraintText,
    fix.reference?.raw,
    fix.notes,
    fix.approximate ? "approximate coordinate" : null,
  ].filter(Boolean).join("\n");
}

function shouldShowLabels(labelMode, zoom) {
  if (labelMode === "on") return true;
  if (labelMode === "off") return false;
  return zoom >= 3.1;
}

export const FixLayer = memo(function FixLayer({ fixes = rjccFixes, projection, zoom = 1, uiScale, labelMode = "auto" }) {
  const projectedFixes = useMemo(
    () => fixes.map((fix) => projectFix(fix, projection)).filter(Boolean),
    [fixes, projection]
  );
  const stroke = "#7fc6cf";
  const s = uiScale;
  const size = 4.8 * s;
  const showLabels = shouldShowLabels(labelMode, zoom);
  const labelStyle = { fill: stroke, fontSize: 9.5 * s, fontFamily: "monospace", fontWeight: 800 };

  return (
    <g id="fix-layer" opacity="0.82" fill="none" stroke={stroke} strokeWidth="0.75" vectorEffect="non-scaling-stroke">
      {projectedFixes.map((fix) => {
        const approachFix = isApproachFix(fix);
        const opacity = fix.approximate ? 0.45 : approachFix ? 0.92 : 0.74;
        const symbol = approachFix
          ? `M 0 ${(-size).toFixed(2)} L ${(size * 0.92).toFixed(2)} ${(size * 0.72).toFixed(2)} L ${(-size * 0.92).toFixed(2)} ${(size * 0.72).toFixed(2)} Z`
          : `M 0 ${(-size).toFixed(2)} L ${(size).toFixed(2)} 0 L 0 ${(size).toFixed(2)} L ${(-size).toFixed(2)} 0 Z`;

        return (
          <g key={fix.id} transform={`translate(${fix.x} ${fix.y})`} opacity={opacity} strokeDasharray={fix.approximate ? `${2 * s} ${2 * s}` : undefined}>
            <title>{titleForFix(fix)}</title>
            <path d={symbol} vectorEffect="non-scaling-stroke" />
            {showLabels && <text x={7 * s} y={-6 * s} style={labelStyle} stroke="none">{fix.id}</text>}
          </g>
        );
      })}
    </g>
  );
});
