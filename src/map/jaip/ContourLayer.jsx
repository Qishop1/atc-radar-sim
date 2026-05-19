import { memo, useMemo } from "react";

function contourLineToPath(line, projectLatLon, downsample = 1) {
  const stride = Math.max(1, Math.floor(downsample));
  const sampled = line.filter((_, idx) => idx % stride === 0 || idx === line.length - 1);
  return sampled.map(([lat, lon], i) => {
    const pt = projectLatLon(lat, lon);
    return `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }).join(" ");
}

function buildSegments(contours, projection) {
  const out = [];
  const levels = Array.isArray(contours?.levels) ? contours.levels : [];

  for (const level of levels) {
    const lines = Array.isArray(level.lines) ? level.lines : [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!Array.isArray(line) || line.length < 2) continue;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [lat, lon] of line) {
        const pt = projection.projectLatLon(lat, lon);
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }

      out.push({ key: `${level.elevation_ft}-${i}`, line, elevation_ft: level.elevation_ft, minX, minY, maxX, maxY });
    }
  }

  return out;
}

function allowedContourLevels(zoom, isZooming) {
  if (isZooming) {
    return zoom < 8 ? [3000, 5000] : zoom < 18 ? [2000, 3000, 5000] : [1000, 2000, 3000, 5000];
  }
  if (zoom < 1.8) return [3000, 5000];
  if (zoom < 4) return [2000, 3000, 5000];
  if (zoom < 12) return [1000, 2000, 3000, 5000];
  return null;
}

function filterVisibleSegments(segments, view, zoom, isZooming) {
  const margin = Math.max(view.w, view.h) * 0.04;
  const minX = view.x - margin;
  const maxX = view.x + view.w + margin;
  const minY = view.y - margin;
  const maxY = view.y + view.h + margin;
  const levels = allowedContourLevels(zoom, isZooming);
  const minScreenPx = zoom < 1.8 ? 18 : zoom < 4 ? 10 : zoom < 12 ? 5 : 1.5;
  const screenWidth = typeof window === "undefined" ? 1000 : window.innerWidth;
  const screenHeight = typeof window === "undefined" ? 930 : window.innerHeight;

  return segments.filter((seg) => {
    if (levels && !levels.includes(seg.elevation_ft)) return false;
    if (seg.maxX < minX || seg.minX > maxX || seg.maxY < minY || seg.minY > maxY) return false;

    const screenW = ((seg.maxX - seg.minX) / view.w) * screenWidth;
    const screenH = ((seg.maxY - seg.minY) / view.h) * screenHeight;
    if (screenW < minScreenPx && screenH < minScreenPx) return false;

    return true;
  });
}

export const ContourLayer = memo(function ContourLayer({ contours, projection, view, zoom, isZooming }) {
  const downsample = isZooming
    ? (zoom < 8 ? 18 : zoom < 18 ? 10 : zoom < 32 ? 5 : 3)
    : (zoom < 1.8 ? 8 : zoom < 4 ? 5 : zoom < 12 ? 3 : zoom < 32 ? 2 : 1);

  const segments = useMemo(() => buildSegments(contours, projection), [contours, projection]);
  const pathD = useMemo(() => filterVisibleSegments(segments, view, zoom, isZooming)
    .map((seg) => contourLineToPath(seg.line, projection.projectLatLon, downsample))
    .filter(Boolean)
    .join(" "), [segments, view, zoom, isZooming, projection, downsample]);

  return (
    <path
      id="contour-layer"
      d={pathD}
      fill="none"
      stroke="#2f8792"
      strokeWidth="0.5"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.72"
    />
  );
});
