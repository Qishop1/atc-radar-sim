import { destinationPoint } from "../../geo/earth.js";

const EPSILON = 1e-9;

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function projectedPoint(point, projection) {
  if (!point) return null;
  if (finitePoint(point)) return { ...point };
  if (Number.isFinite(point.lat) && Number.isFinite(point.lon) && projection?.projectLatLon) {
    return { ...point, ...projection.projectLatLon(point.lat, point.lon) };
  }
  return null;
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length < EPSILON) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function fallbackBearingUnit(bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

function localNmScale(station, projection, fallback = 10) {
  if (!projection?.projectLatLon || !Number.isFinite(station?.lat) || !Number.isFinite(station?.lon)) return fallback;
  const p0 = projection.projectLatLon(station.lat, station.lon);
  const p1LatLon = destinationPoint({ lat: station.lat, lon: station.lon, bearingDeg: 90, distanceNm: 1 });
  const p2LatLon = destinationPoint({ lat: station.lat, lon: station.lon, bearingDeg: 0, distanceNm: 1 });
  const p1 = projection.projectLatLon(p1LatLon.lat, p1LatLon.lon);
  const p2 = projection.projectLatLon(p2LatLon.lat, p2LatLon.lon);
  const east = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const north = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const scale = (east + north) / 2;
  return Number.isFinite(scale) && scale > EPSILON ? scale : fallback;
}

function resolveNmScale(station, projection, nmToDisplayUnits) {
  if (typeof nmToDisplayUnits === "function") return nmToDisplayUnits(station);
  if (Number.isFinite(nmToDisplayUnits)) return nmToDisplayUnits;
  return localNmScale(station, projection);
}

export function bearingToUnitVectorProjected({ origin, bearingDeg, projection }) {
  if (projection?.projectLatLon && Number.isFinite(origin?.lat) && Number.isFinite(origin?.lon)) {
    const p0 = projection.projectLatLon(origin.lat, origin.lon);
    const dest = destinationPoint({ lat: origin.lat, lon: origin.lon, bearingDeg, distanceNm: 1 });
    const p1 = projection.projectLatLon(dest.lat, dest.lon);
    return normalize({ x: p1.x - p0.x, y: p1.y - p0.y }) || fallbackBearingUnit(bearingDeg);
  }
  return fallbackBearingUnit(bearingDeg);
}

export function buildRadialLine({ station, radialDeg, lengthNm = 35, projection, nmToDisplayUnits }) {
  const origin = projectedPoint(station, projection);
  if (!origin || !Number.isFinite(radialDeg)) return null;
  const unit = bearingToUnitVectorProjected({ origin: station, bearingDeg: radialDeg, projection });
  const length = Math.max(0, lengthNm) * resolveNmScale(station, projection, nmToDisplayUnits);
  return {
    points: [
      { x: origin.x, y: origin.y },
      { x: origin.x + unit.x * length, y: origin.y + unit.y * length },
    ],
  };
}

export function buildDmeCircle({ station, radiusNm, projection, sampleCount = 96, nmToDisplayUnits }) {
  const origin = projectedPoint(station, projection);
  if (!origin || !Number.isFinite(radiusNm) || radiusNm <= 0) return [];
  if (projection?.projectLatLon && Number.isFinite(station?.lat) && Number.isFinite(station?.lon)) {
    return Array.from({ length: sampleCount + 1 }, (_, index) => {
      const bearingDeg = (360 * index) / sampleCount;
      const latLon = destinationPoint({ lat: station.lat, lon: station.lon, bearingDeg, distanceNm: radiusNm });
      return projection.projectLatLon(latLon.lat, latLon.lon);
    }).filter(finitePoint);
  }
  const radius = radiusNm * resolveNmScale(station, projection, nmToDisplayUnits);
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sampleCount;
    return { x: origin.x + Math.sin(angle) * radius, y: origin.y - Math.cos(angle) * radius };
  });
}

export function buildDmeArc({ station, radiusNm, startBearingDeg, endBearingDeg, projection, sampleCount = 64, nmToDisplayUnits }) {
  const origin = projectedPoint(station, projection);
  if (!origin || !Number.isFinite(radiusNm) || radiusNm <= 0 || !Number.isFinite(startBearingDeg) || !Number.isFinite(endBearingDeg)) return [];
  let sweep = endBearingDeg - startBearingDeg;
  if (Math.abs(sweep) > 360) sweep = 360 * Math.sign(sweep);
  if (sweep === 0) sweep = 360;

  if (projection?.projectLatLon && Number.isFinite(station?.lat) && Number.isFinite(station?.lon)) {
    return Array.from({ length: sampleCount + 1 }, (_, index) => {
      const bearingDeg = startBearingDeg + (sweep * index) / sampleCount;
      const latLon = destinationPoint({ lat: station.lat, lon: station.lon, bearingDeg, distanceNm: radiusNm });
      return projection.projectLatLon(latLon.lat, latLon.lon);
    }).filter(finitePoint);
  }
  const radius = radiusNm * resolveNmScale(station, projection, nmToDisplayUnits);
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const bearingDeg = startBearingDeg + (sweep * index) / sampleCount;
    const rad = (bearingDeg * Math.PI) / 180;
    return { x: origin.x + Math.sin(rad) * radius, y: origin.y - Math.cos(rad) * radius };
  });
}

export function buildAuxLine({ fromPoint, toPoint }) {
  return finitePoint(fromPoint) && finitePoint(toPoint) ? { points: [fromPoint, toPoint] } : null;
}

export function projectPointToRadial({ point, station, radialDeg, projection }) {
  const origin = projectedPoint(station, projection);
  if (!finitePoint(point) || !origin || !Number.isFinite(radialDeg)) return null;
  const unit = bearingToUnitVectorProjected({ origin: station, bearingDeg: radialDeg, projection });
  const vx = point.x - origin.x;
  const vy = point.y - origin.y;
  const distance = vx * unit.x + vy * unit.y;
  return { x: origin.x + unit.x * distance, y: origin.y + unit.y * distance };
}

export function snapPointToDmeCircle({ point, station, radiusNm, projection, nmToDisplayUnits }) {
  const origin = projectedPoint(station, projection);
  if (!finitePoint(point) || !origin || !Number.isFinite(radiusNm) || radiusNm <= 0) return null;
  const vector = normalize({ x: point.x - origin.x, y: point.y - origin.y }) || { x: 1, y: 0 };
  const radius = radiusNm * resolveNmScale(station, projection, nmToDisplayUnits);
  return { x: origin.x + vector.x * radius, y: origin.y + vector.y * radius };
}

export function buildRadialDmePoint({ station, radialDeg, radiusNm, projection, nmToDisplayUnits }) {
  const origin = projectedPoint(station, projection);
  if (!origin || !Number.isFinite(radialDeg) || !Number.isFinite(radiusNm)) return null;
  if (projection?.projectLatLon && Number.isFinite(station?.lat) && Number.isFinite(station?.lon)) {
    const latLon = destinationPoint({ lat: station.lat, lon: station.lon, bearingDeg: radialDeg, distanceNm: radiusNm });
    return projection.projectLatLon(latLon.lat, latLon.lon);
  }
  const unit = bearingToUnitVectorProjected({ origin: station, bearingDeg: radialDeg, projection });
  const radius = radiusNm * resolveNmScale(station, projection, nmToDisplayUnits);
  return { x: origin.x + unit.x * radius, y: origin.y + unit.y * radius };
}

function nearestOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < EPSILON) return { point: a, distance: Math.hypot(point.x - a.x, point.y - a.y) };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const nearest = { x: a.x + dx * t, y: a.y + dy * t };
  return { point: nearest, distance: Math.hypot(point.x - nearest.x, point.y - nearest.y) };
}

export function nearestPointOnPolyline({ point, polyline }) {
  if (!finitePoint(point) || !Array.isArray(polyline) || !polyline.length) return null;
  if (polyline.length === 1) return polyline[0];
  let best = null;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    if (!finitePoint(a) || !finitePoint(b)) continue;
    const candidate = nearestOnSegment(point, a, b);
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best?.point || null;
}

export function distancePointToPolyline({ point, polyline }) {
  const nearest = nearestPointOnPolyline({ point, polyline });
  return nearest ? Math.hypot(point.x - nearest.x, point.y - nearest.y) : Infinity;
}
