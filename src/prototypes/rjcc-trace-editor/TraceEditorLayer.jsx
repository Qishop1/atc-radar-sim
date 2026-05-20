import { memo } from "react";

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

export const TRACE_TYPES = ["SOLID_ROUTE", "APPROX_TURN", "RADIAL", "CONNECTOR"];

export const TraceEditorLayer = memo(function TraceEditorLayer({
  points,
  selectedPointId,
  traceType,
  uiScale,
  showPointLabels,
  onSelectPoint,
}) {
  const s = uiScale;
  const stroke = traceType === "SOLID_ROUTE" ? "#f1fbff" : traceType === "RADIAL" ? "#b9eef3" : "#d6f6fa";
  const dash = traceType === "SOLID_ROUTE" ? undefined : traceType === "RADIAL" ? "10 6" : "6 4";
  const pointRadius = Math.max(1.45 * s, 0.55);
  const labelStyle = {
    fill: "#d8fbff",
    fontFamily: "monospace",
    fontSize: Math.max(10 * s, 3.2),
    fontWeight: 900,
  };

  return (
    <g id="trace-editor-layer" fill="none" stroke={stroke} vectorEffect="non-scaling-stroke">
      {points.length >= 2 && (
        <path
          d={pathFromPoints(points)}
          stroke={stroke}
          strokeWidth="1.4"
          strokeDasharray={dash}
          opacity="0.92"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((point, index) => {
        const selected = point.id === selectedPointId;
        return (
          <g
            key={point.id}
            transform={`translate(${point.x} ${point.y})`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSelectPoint(point.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              r={selected ? pointRadius * 1.35 : pointRadius}
              fill={selected ? "#d8fbff" : "#071c20"}
              stroke={selected ? "#ffffff" : stroke}
              strokeWidth={selected ? 0.9 : 0.6}
              vectorEffect="non-scaling-stroke"
            />
            {showPointLabels && (
              <text x={5 * s} y={-5 * s} style={labelStyle} stroke="none">
                {index + 1}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});
