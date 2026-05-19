import { memo, useMemo } from "react";
import { runways as rjccRunways } from "../../data/airspace/rjcc/runways.js";

function formatRunwayLabel(runway) {
  const endLabels = Array.isArray(runway.ends) ? runway.ends.map((end) => end.id).filter(Boolean) : [];
  return endLabels.length === 2 ? `${endLabels[0]} / ${endLabels[1]}` : runway.id;
}

function projectRunway(runway, projection) {
  if (!Array.isArray(runway?.ends) || runway.ends.length !== 2) return null;
  const [first, second] = runway.ends;
  if (!Number.isFinite(first?.lat) || !Number.isFinite(first?.lon) || !Number.isFinite(second?.lat) || !Number.isFinite(second?.lon)) return null;
  const a = projection.projectLatLon(first.lat, first.lon);
  const b = projection.projectLatLon(second.lat, second.lon);
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  return { runway, first, second, a, b, label: formatRunwayLabel(runway) };
}

export const RunwayLayer = memo(function RunwayLayer({ runways = rjccRunways, projection, zoom, uiScale }) {
  const projectedRunways = useMemo(
    () => runways.map((runway) => projectRunway(runway, projection)).filter(Boolean),
    [runways, projection]
  );
  const showLabels = zoom >= 4.5;
  const stroke = "#89d6dd";
  const labelStyle = {
    fill: stroke,
    fontSize: 9 * uiScale,
    fontFamily: "monospace",
    fontWeight: 700,
  };

  return (
    <g id="runway-layer" opacity="0.75" fill="none" stroke={stroke} strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinecap="round">
      {projectedRunways.map(({ runway, first, second, a, b, label }) => {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        return (
          <g key={`${runway.airportId}-${runway.id}`}>
            <title>{`${runway.airportId} RWY ${label}${runway.lengthM ? ` ${runway.lengthM}x${runway.widthM || "?"}m` : ""}${runway.source ? ` (${runway.source})` : ""}`}</title>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
            {showLabels && (
              <>
                <text x={midX + 4 * uiScale} y={midY - 4 * uiScale} style={labelStyle} stroke="none">{label}</text>
                <text x={a.x + 3 * uiScale} y={a.y - 3 * uiScale} style={labelStyle} stroke="none" opacity="0.85">{first.id}</text>
                <text x={b.x + 3 * uiScale} y={b.y - 3 * uiScale} style={labelStyle} stroke="none" opacity="0.85">{second.id}</text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
});
