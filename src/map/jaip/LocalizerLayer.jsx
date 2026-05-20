import { memo, useMemo } from "react";
import { localizers as rjccLocalizers } from "../../data/airspace/rjcc/localizers.js";

function projectLocalizer(localizer, projection) {
  if (!Number.isFinite(localizer?.lat) || !Number.isFinite(localizer?.lon)) return null;
  const point = projection.projectLatLon(localizer.lat, localizer.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...localizer, x: point.x, y: point.y };
}

function shouldShowLabels(labelMode, zoom) {
  if (labelMode === "on") return true;
  if (labelMode === "off") return false;
  return zoom >= 2.4;
}

function isInView(point, view) {
  if (!view) return true;
  const margin = Math.max(view.w || 0, view.h || 0) * 0.12;
  return point.x >= view.x - margin
    && point.x <= view.x + view.w + margin
    && point.y >= view.y - margin
    && point.y <= view.y + view.h + margin;
}

export const LocalizerLayer = memo(function LocalizerLayer({ localizers = rjccLocalizers, projection, view, zoom = 1, uiScale, labelMode = "auto" }) {
  const projectedLocalizers = useMemo(
    () => localizers.map((localizer) => projectLocalizer(localizer, projection)).filter(Boolean),
    [localizers, projection]
  );
  const visibleLocalizers = useMemo(
    () => projectedLocalizers.filter((localizer) => isInView(localizer, view)),
    [projectedLocalizers, view]
  );
  const stroke = "#d8fbff";
  const s = uiScale;
  const size = 5.8 * s;
  const showLabels = shouldShowLabels(labelMode, zoom);
  const labelStyle = { fill: stroke, fontSize: 9.5 * s, fontFamily: "monospace", fontWeight: 800 };

  if (!visibleLocalizers.length) return null;

  return (
    <g id="localizer-layer" opacity="0.78" fill="none" stroke={stroke} strokeWidth="0.75" vectorEffect="non-scaling-stroke">
      {visibleLocalizers.map((localizer) => (
        <g key={localizer.id} transform={`translate(${localizer.x} ${localizer.y})`}>
          <title>{[localizer.id, localizer.type, localizer.runwayId, localizer.frequencyMHz ? `${localizer.frequencyMHz} MHz` : null, localizer.dmeChannel, localizer.notes].filter(Boolean).join("\n")}</title>
          <path d={`M ${(-size).toFixed(2)} ${(-size * 0.55).toFixed(2)} H ${(size).toFixed(2)} M 0 ${(-size).toFixed(2)} V ${(size).toFixed(2)} M ${(-size * 0.72).toFixed(2)} ${(size * 0.62).toFixed(2)} L 0 ${(size).toFixed(2)} L ${(size * 0.72).toFixed(2)} ${(size * 0.62).toFixed(2)}`} vectorEffect="non-scaling-stroke" />
          {showLabels && <text x={7 * s} y={-6 * s} style={labelStyle} stroke="none">{localizer.id}</text>}
        </g>
      ))}
    </g>
  );
});
