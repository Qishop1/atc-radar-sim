import { memo, useMemo } from "react";
import { airports as rjccAirports } from "../../data/airspace/rjcc/airports.js";

function isMilitaryOrMixedAirport(airport) {
  const text = `${airport.operator || ""} ${airport.name || ""}`.toUpperCase();
  return text.includes("JSDF") || text.includes("USAF") || text.includes("AIR BASE");
}

function projectAirport(airport, projection) {
  if (!Number.isFinite(airport?.lat) || !Number.isFinite(airport?.lon)) return null;
  const point = projection.projectLatLon(airport.lat, airport.lon);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { ...airport, x: point.x, y: point.y, militaryOrMixed: isMilitaryOrMixedAirport(airport) };
}

export const AirportLayer = memo(function AirportLayer({ airports = rjccAirports, projection, uiScale }) {
  const projectedAirports = useMemo(
    () => airports.map((airport) => projectAirport(airport, projection)).filter(Boolean),
    [airports, projection]
  );
  const stroke = "#7fc6cf";
  const symbolSize = 4.8 * uiScale;
  const labelOffset = 7 * uiScale;
  const labelStyle = {
    fill: stroke,
    fontSize: 10 * uiScale,
    fontFamily: "monospace",
    fontWeight: 700,
  };

  return (
    <g id="airport-layer" opacity="0.85" fill="none" stroke={stroke} strokeWidth="0.75" vectorEffect="non-scaling-stroke">
      {projectedAirports.map((airport) => (
        <g key={airport.id} transform={`translate(${airport.x} ${airport.y})`}>
          <title>{`${airport.icao || airport.id} ${airport.name || ""}${airport.elevationFt != null ? ` elev ${airport.elevationFt}ft` : ""}${airport.source ? ` (${airport.source})` : ""}`}</title>
          {airport.militaryOrMixed ? (
            <>
              <rect x={-symbolSize} y={-symbolSize} width={symbolSize * 2} height={symbolSize * 2} vectorEffect="non-scaling-stroke" />
              <path d={`M ${(-symbolSize * 1.25).toFixed(2)} 0 L ${(symbolSize * 1.25).toFixed(2)} 0 M 0 ${(-symbolSize * 1.25).toFixed(2)} L 0 ${(symbolSize * 1.25).toFixed(2)}`} vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            <>
              <circle cx="0" cy="0" r={symbolSize} vectorEffect="non-scaling-stroke" />
              <path d={`M ${(-symbolSize * 1.35).toFixed(2)} 0 L ${(-symbolSize * 0.45).toFixed(2)} 0 M ${(symbolSize * 0.45).toFixed(2)} 0 L ${(symbolSize * 1.35).toFixed(2)} 0 M 0 ${(-symbolSize * 1.35).toFixed(2)} L 0 ${(-symbolSize * 0.45).toFixed(2)} M 0 ${(symbolSize * 0.45).toFixed(2)} L 0 ${(symbolSize * 1.35).toFixed(2)}`} vectorEffect="non-scaling-stroke" />
            </>
          )}
          <text x={labelOffset} y={-labelOffset} style={labelStyle} stroke="none">{airport.icao || airport.id}</text>
        </g>
      ))}
    </g>
  );
});
