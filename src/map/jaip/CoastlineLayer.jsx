import { memo, useMemo } from "react";

function lineToPath(line, projectLatLon, downsample = 1) {
  const stride = Math.max(1, Math.floor(downsample));
  const sampled = line.filter((_, idx) => idx % stride === 0 || idx === line.length - 1);
  return sampled.map(([lat, lon], i) => {
    const pt = projectLatLon(lat, lon);
    return `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }).join(" ");
}

function buildSegments(coastlines, projection) {
  return coastlines.map((line, idx) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [lat, lon] of line) {
      const pt = projection.projectLatLon(lat, lon);
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { idx, line, minX, minY, maxX, maxY };
  });
}

function filterVisibleSegments(segments, view, zoom) {
  const margin = Math.max(view.w, view.h) * 0.08;
  const minX = view.x - margin;
  const maxX = view.x + view.w + margin;
  const minY = view.y - margin;
  const maxY = view.y + view.h + margin;
  const minScreenPx = zoom < 1.8 ? 2.2 : zoom < 3.5 ? 1.4 : zoom < 7 ? 0.8 : 0;
  const screenWidth = typeof window === "undefined" ? 1000 : window.innerWidth;
  const screenHeight = typeof window === "undefined" ? 930 : window.innerHeight;

  return segments.filter((seg) => {
    if (seg.maxX < minX || seg.minX > maxX || seg.maxY < minY || seg.minY > maxY) return false;
    if (minScreenPx > 0) {
      const screenW = ((seg.maxX - seg.minX) / view.w) * screenWidth;
      const screenH = ((seg.maxY - seg.minY) / view.h) * screenHeight;
      if (screenW < minScreenPx && screenH < minScreenPx) return false;
    }
    return true;
  });
}

export const CoastlineLayer = memo(function CoastlineLayer({ coastlines, projection, view, zoom, isZooming }) {
  const downsample = isZooming
    ? (zoom < 3.5 ? 36 : zoom < 7 ? 24 : zoom < 14 ? 16 : zoom < 32 ? 8 : 4)
    : (zoom < 1.8 ? 16 : zoom < 3.5 ? 10 : zoom < 7 ? 6 : zoom < 14 ? 3 : zoom < 32 ? 2 : 1);

  const segments = useMemo(() => buildSegments(coastlines, projection), [coastlines, projection]);
  const pathD = useMemo(() => filterVisibleSegments(segments, view, zoom)
    .map((seg) => lineToPath(seg.line, projection.projectLatLon, downsample))
    .filter(Boolean)
    .join(" "), [segments, view, zoom, projection, downsample]);

  return (
    <path
      id="base-coastline-layer"
      d={pathD}
      fill="none"
      stroke="#0d5263"
      strokeWidth="0.55"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.82"
    />
  );
});
