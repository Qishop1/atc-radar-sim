import { memo, useEffect, useState } from "react";
import { rjccDepartureChartOptions } from "../../data/airports/rjcc/departureChartManifest.js";

export const CHART_OVERLAY_OPTIONS = [
  ...rjccDepartureChartOptions,
  {
    id: "custom",
    label: "CUSTOM",
    href: "/charts/rjcc/custom.png",
    width: 520,
    height: 720,
  },
];

export const DEFAULT_OVERLAY_TRANSFORM = {
  x: 500,
  y: 465,
  scale: 1,
  rotationDeg: 0,
  opacity: 0.42,
};

export const ChartOverlayLayer = memo(function ChartOverlayLayer({
  chart,
  transform,
  visible = true,
}) {
  const [imageMissing, setImageMissing] = useState(false);

  useEffect(() => {
    setImageMissing(false);
  }, [chart?.href]);

  if (!visible || !chart) return null;

  const width = chart.width || 520;
  const height = chart.height || 720;
  const x = Number.isFinite(transform?.x) ? transform.x : DEFAULT_OVERLAY_TRANSFORM.x;
  const y = Number.isFinite(transform?.y) ? transform.y : DEFAULT_OVERLAY_TRANSFORM.y;
  const scale = Number.isFinite(transform?.scale) ? transform.scale : DEFAULT_OVERLAY_TRANSFORM.scale;
  const rotationDeg = Number.isFinite(transform?.rotationDeg) ? transform.rotationDeg : DEFAULT_OVERLAY_TRANSFORM.rotationDeg;
  const opacity = Number.isFinite(transform?.opacity) ? transform.opacity : DEFAULT_OVERLAY_TRANSFORM.opacity;

  return (
    <g
      id="chart-overlay-layer"
      opacity={opacity}
      pointerEvents="none"
      transform={`translate(${x} ${y}) rotate(${rotationDeg}) scale(${scale})`}
    >
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="rgba(255,255,255,0.06)"
        stroke="#d8fbff"
        strokeWidth="1"
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
      />
      {!imageMissing && (
        <image
          href={chart.href}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          onError={() => setImageMissing(true)}
        />
      )}
      {imageMissing && (
        <g opacity="0.95">
          <text
            x="0"
            y="-8"
            textAnchor="middle"
            fill="#d8fbff"
            fontFamily="monospace"
            fontSize="16"
            fontWeight="900"
            stroke="none"
          >
            chart image missing
          </text>
          <text
            x="0"
            y="15"
            textAnchor="middle"
            fill="#9ed7df"
            fontFamily="monospace"
            fontSize="11"
            stroke="none"
          >
            {chart.href}
          </text>
        </g>
      )}
    </g>
  );
});
