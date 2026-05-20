import { memo, useEffect, useState } from "react";

const FALLBACK_CHART_SIZE = { width: 520, height: 720 };

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export const ChartOverlayLayer = memo(function ChartOverlayLayer({
  overlay,
  enabled = false,
  opacityOverride,
}) {
  const [imageMissing, setImageMissing] = useState(false);

  useEffect(() => {
    setImageMissing(false);
  }, [overlay?.imageUrl]);

  if (!enabled || !overlay?.imageUrl) return null;

  const transform = overlay.transform || {};
  const width = finiteOr(overlay.width, FALLBACK_CHART_SIZE.width);
  const height = finiteOr(overlay.height, FALLBACK_CHART_SIZE.height);
  const x = finiteOr(transform.x, 500);
  const y = finiteOr(transform.y, 465);
  const scale = finiteOr(transform.scale, 1);
  const rotationDeg = finiteOr(transform.rotationDeg, 0);
  const opacity = finiteOr(opacityOverride, finiteOr(transform.opacity, 0.35));

  return (
    <g
      id="jaip-chart-overlay-layer"
      opacity={opacity}
      pointerEvents="none"
      transform={`translate(${x} ${y}) rotate(${rotationDeg}) scale(${scale})`}
    >
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="rgba(255,255,255,0.04)"
        stroke="#d8fbff"
        strokeWidth="1"
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
      />
      {!imageMissing && (
        <image
          href={overlay.imageUrl}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          onError={() => setImageMissing(true)}
        />
      )}
      {imageMissing && (
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#9ed7df"
          fontFamily="monospace"
          fontSize="12"
          fontWeight="900"
          stroke="none"
        >
          chart image missing
        </text>
      )}
    </g>
  );
});
