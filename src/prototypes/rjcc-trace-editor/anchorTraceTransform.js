const EPSILON = 1e-9;

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

export function buildAnchorFrame({ originPoint, axisTargetPoint }) {
  if (!finitePoint(originPoint) || !finitePoint(axisTargetPoint)) return null;
  const dx = axisTargetPoint.x - originPoint.x;
  const dy = axisTargetPoint.y - originPoint.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < EPSILON) return null;
  const unitU = { x: dx / length, y: dy / length };
  const unitV = { x: -unitU.y, y: unitU.x };
  return {
    origin: { x: originPoint.x, y: originPoint.y },
    axisTarget: { x: axisTargetPoint.x, y: axisTargetPoint.y },
    length,
    unitU,
    unitV,
  };
}

export function projectedToAnchorUv(point, frame) {
  if (!finitePoint(point) || !frame) return null;
  const dx = point.x - frame.origin.x;
  const dy = point.y - frame.origin.y;
  return {
    u: round((dx * frame.unitU.x + dy * frame.unitU.y) / frame.length),
    v: round((dx * frame.unitV.x + dy * frame.unitV.y) / frame.length),
  };
}

export function anchorUvToProjected(uv, frame) {
  if (!uv || !frame || !Number.isFinite(uv.u) || !Number.isFinite(uv.v)) return null;
  return {
    x: frame.origin.x + (uv.u * frame.unitU.x + uv.v * frame.unitV.x) * frame.length,
    y: frame.origin.y + (uv.u * frame.unitU.y + uv.v * frame.unitV.y) * frame.length,
  };
}

export function normalizeTracePoints(points, frame) {
  return (points || []).map((point) => projectedToAnchorUv(point, frame)).filter(Boolean);
}

export function denormalizeTracePoints(points, frame) {
  return (points || []).map((point) => anchorUvToProjected(point, frame)).filter(Boolean);
}
