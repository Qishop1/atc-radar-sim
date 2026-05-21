const ACA_BOUNDARY_COMMANDS = [
  (paths) => paths.linePath([19, 18, 21, 20, 7, 1, 5]),
  (paths) => paths.arcByThreePoints(5, 4, 12, 1),
  (paths) => paths.linePath([12, 11]),
  (paths) => paths.circleArcPath(11, 10, 6, 1),
  (paths) => paths.linePath([10, 15, 14, 19]),
  (paths) => paths.linePath([14, 13]),
  (paths) => paths.rjcoArc(2, 9, 1),
  (paths) => paths.linePath([9, 10]),
  (paths) => paths.linePath([3, 4]),
  (paths) => paths.linePath([7, 8]),
  (paths) => paths.linePath([1, 8, 2]),
  (paths) => paths.linePath([13, 17]),
  (paths) => paths.hwe45Arc(15, 16, 1),
  (paths) => paths.linePath([16, 17]),
];

function finiteDimension(value, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cssScaleFor(view, size) {
  const x = finiteDimension(size.cssWidth) / finiteDimension(view.w);
  const y = finiteDimension(size.cssHeight) / finiteDimension(view.h);
  return { x, y, average: (x + y) / 2 || 1 };
}

function withWorldTransform(ctx, view, size, draw) {
  const dpr = finiteDimension(size.dpr);
  const sx = (finiteDimension(size.cssWidth) * dpr) / finiteDimension(view.w);
  const sy = (finiteDimension(size.cssHeight) * dpr) / finiteDimension(view.h);
  ctx.save();
  ctx.setTransform(sx, 0, 0, sy, -view.x * sx, -view.y * sy);
  draw(cssScaleFor(view, size));
  ctx.restore();
}

function segmentVisible(seg, view, margin) {
  const minX = view.x - margin;
  const maxX = view.x + view.w + margin;
  const minY = view.y - margin;
  const maxY = view.y + view.h + margin;
  return !(seg.maxX < minX || seg.minX > maxX || seg.maxY < minY || seg.minY > maxY);
}

function screenExtent(seg, view, size) {
  const cssWidth = finiteDimension(size.cssWidth);
  const cssHeight = finiteDimension(size.cssHeight);
  return {
    width: ((seg.maxX - seg.minX) / finiteDimension(view.w)) * cssWidth,
    height: ((seg.maxY - seg.minY) / finiteDimension(view.h)) * cssHeight,
  };
}

function allowedContourLevels(zoom) {
  if (zoom < 1.8) return [3000, 5000];
  if (zoom < 4) return [2000, 3000, 5000];
  if (zoom < 12) return [1000, 2000, 3000, 5000];
  return null;
}

export function coastlineDownsample(zoom) {
  return zoom < 1.8 ? 16 : zoom < 3.5 ? 10 : zoom < 7 ? 6 : zoom < 14 ? 3 : zoom < 32 ? 2 : 1;
}

export function contourDownsample(zoom) {
  return zoom < 1.8 ? 8 : zoom < 4 ? 5 : zoom < 12 ? 3 : zoom < 32 ? 2 : 1;
}

export function buildLatLonLineSegments(lines, projection) {
  return (lines || []).map((line, idx) => {
    const points = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [lat, lon] of line || []) {
      const pt = projection.projectLatLon(lat, lon);
      points.push(pt);
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    return { key: `line-${idx}`, points, minX, minY, maxX, maxY };
  }).filter((seg) => seg.points.length > 1 && Number.isFinite(seg.minX));
}

export function buildContourSegments(contours, projection) {
  const out = [];
  const levels = Array.isArray(contours?.levels) ? contours.levels : [];

  for (const level of levels) {
    const lines = Array.isArray(level.lines) ? level.lines : [];
    for (let i = 0; i < lines.length; i++) {
      const segments = buildLatLonLineSegments([lines[i]], projection);
      if (segments[0]) out.push({ ...segments[0], key: `${level.elevation_ft}-${i}`, elevation_ft: level.elevation_ft });
    }
  }

  return out;
}

export function filterCoastlineSegments(segments, view, zoom, size) {
  const margin = Math.max(view.w, view.h) * 0.08;
  const minScreenPx = zoom < 1.8 ? 2.2 : zoom < 3.5 ? 1.4 : zoom < 7 ? 0.8 : 0;

  return segments.filter((seg) => {
    if (!segmentVisible(seg, view, margin)) return false;
    if (minScreenPx <= 0) return true;
    const screen = screenExtent(seg, view, size);
    return !(screen.width < minScreenPx && screen.height < minScreenPx);
  });
}

export function filterContourSegments(segments, view, zoom, size) {
  const margin = Math.max(view.w, view.h) * 0.04;
  const levels = allowedContourLevels(zoom);
  const minScreenPx = zoom < 1.8 ? 18 : zoom < 4 ? 10 : zoom < 12 ? 5 : 1.5;

  return segments.filter((seg) => {
    if (levels && !levels.includes(seg.elevation_ft)) return false;
    if (!segmentVisible(seg, view, margin)) return false;
    const screen = screenExtent(seg, view, size);
    return !(screen.width < minScreenPx && screen.height < minScreenPx);
  });
}

export function drawPolylineLayer(ctx, segments, { view, size, downsample = 1, stroke = "#5fa8b3", strokeWidth = 1, opacity = 1 } = {}) {
  if (!segments?.length) return;

  withWorldTransform(ctx, view, size, (scale) => {
    const stride = Math.max(1, Math.floor(downsample));
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth / scale.average;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    for (const seg of segments) {
      const points = seg.points || [];
      if (points.length < 2) continue;

      let lastDrawnIndex = -1;
      for (let i = 0; i < points.length; i += stride) {
        const pt = points[i];
        if (lastDrawnIndex < 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
        lastDrawnIndex = i;
      }

      const last = points[points.length - 1];
      if (lastDrawnIndex !== points.length - 1) ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.restore();
  });
}

export function getRjccAcaBoundaryPathData(paths) {
  if (!paths) return [];
  return ACA_BOUNDARY_COMMANDS.map((command) => command(paths)).filter(Boolean);
}

export function drawBoundaryLayer(ctx, { paths, view, size, stroke = "#2c6f7a", strokeWidth = 0.65, opacity = 0.9 } = {}) {
  const Path2DConstructor = globalThis.Path2D;
  if (!Path2DConstructor || !paths) return;

  const pathData = getRjccAcaBoundaryPathData(paths);
  if (!pathData.length) return;

  withWorldTransform(ctx, view, size, (scale) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth / scale.average;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of pathData) ctx.stroke(new Path2DConstructor(d));
    ctx.restore();
  });
}

export function drawProcedurePath(ctx, points, { view, size, stroke = "#d8fbff", strokeWidth = 1, opacity = 1 } = {}) {
  drawPolylineLayer(ctx, [{ points, minX: 0, minY: 0, maxX: 0, maxY: 0 }], { view, size, stroke, strokeWidth, opacity });
}

export function drawDmeCircle(ctx, { center, radius, view, size, stroke = "#5fa8b3", strokeWidth = 0.7, opacity = 0.82 } = {}) {
  if (!center || !Number.isFinite(radius)) return;
  withWorldTransform(ctx, view, size, (scale) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth / scale.average;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

export function drawRadialLine(ctx, { from, to, view, size, stroke = "#5fa8b3", strokeWidth = 0.7, opacity = 0.82 } = {}) {
  if (!from || !to) return;
  drawPolylineLayer(ctx, [{ points: [from, to], minX: Math.min(from.x, to.x), minY: Math.min(from.y, to.y), maxX: Math.max(from.x, to.x), maxY: Math.max(from.y, to.y) }], { view, size, stroke, strokeWidth, opacity });
}

export function drawChartImageLayer(ctx, { image, x, y, width, height, opacity = 1 } = {}) {
  if (!image || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}
