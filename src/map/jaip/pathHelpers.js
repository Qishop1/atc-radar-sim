export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleFrom(center, pt) {
  return Math.atan2(pt.y - center.y, pt.x - center.x);
}

function normalizePositive(angle) {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

export function circumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 0.001) return null;
  const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
  const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
  return { x: ux, y: uy };
}

export function averagePoint(pointById, ids, dx = 0, dy = 0) {
  const pts = ids.map((id) => pointById[id]);
  return {
    x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length + dx,
    y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length + dy,
  };
}

export function offsetFromCenter(center, target, offsetPx = 10) {
  const len = Math.hypot(target.x - center.x, target.y - center.y) || 1;
  return {
    x: center.x + ((target.x - center.x) / len) * offsetPx,
    y: center.y + ((target.y - center.y) / len) * offsetPx,
  };
}

export function makePathHelpers(pointById) {
  const p = (id) => pointById[id];
  const linePath = (ids) => ids.map((id, i) => `${i === 0 ? "M" : "L"} ${p(id).x.toFixed(1)} ${p(id).y.toFixed(1)}`).join(" ");
  const circleArcPath = (startId, endId, centerId, sweep = 1) => {
    const a = p(startId), b = p(endId), c = p(centerId);
    const r = (distance(a, c) + distance(b, c)) / 2;
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  const arcByThreePoints = (startId, throughId, endId, sweep = 1) => {
    const a = p(startId), b = p(throughId), c = p(endId);
    const center = circumcenter(a, b, c);
    if (!center) return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
    const r = (distance(a, center) + distance(b, center) + distance(c, center)) / 3;
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
  };
  const centerArc = (centerId, startId, endId, sweep = 1) => {
    const a = p(startId), b = p(endId), center = p(centerId);
    const r = (distance(a, center) + distance(b, center)) / 2;
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  const radiusPointOnArc = (center, startId, endId, t = 0.5, sweep = 1) => {
    const a = p(startId), b = p(endId);
    const r = (distance(a, center) + distance(b, center)) / 2;
    const start = normalizePositive(angleFrom(center, a));
    const end = normalizePositive(angleFrom(center, b));
    const twoPi = Math.PI * 2;
    let delta = end - start;
    if (sweep === 1 && delta < 0) delta += twoPi;
    if (sweep !== 1 && delta > 0) delta -= twoPi;
    const angle = start + delta * t;
    return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
  };
  return { p, linePath, circleArcPath, arcByThreePoints, rjcoArc: (s, e, sw = 1) => centerArc("RJCO ARP", s, e, sw), hwe45Arc: (s, e, sw = 1) => centerArc("HWE", s, e, sw), radiusPointOnArc };
}
