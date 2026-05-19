export const EARTH_RADIUS_NM = 3440.065;

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function normalizeBearing(deg) {
  return ((deg % 360) + 360) % 360;
}

function normalizeLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function destinationPoint({ lat, lon, bearingDeg, distanceNm }) {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const bearing = degToRad(bearingDeg);
  const lat1 = degToRad(lat);
  const lon1 = degToRad(lon);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDistance = Math.sin(angularDistance);
  const cosDistance = Math.cos(angularDistance);

  const lat2 = Math.asin((sinLat1 * cosDistance) + (cosLat1 * sinDistance * Math.cos(bearing)));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinDistance * cosLat1,
    cosDistance - (sinLat1 * Math.sin(lat2))
  );

  return { lat: radToDeg(lat2), lon: normalizeLongitude(radToDeg(lon2)) };
}

export function bearingDistanceBetween({ lat1, lon1, lat2, lon2 }) {
  const phi1 = degToRad(lat1);
  const phi2 = degToRad(lat2);
  const deltaPhi = degToRad(lat2 - lat1);
  const deltaLambda = degToRad(lon2 - lon1);

  const a = (Math.sin(deltaPhi / 2) ** 2)
    + (Math.cos(phi1) * Math.cos(phi2) * (Math.sin(deltaLambda / 2) ** 2));
  const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = (Math.cos(phi1) * Math.sin(phi2))
    - (Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda));

  return {
    bearingDeg: normalizeBearing(radToDeg(Math.atan2(y, x))),
    distanceNm: angularDistance * EARTH_RADIUS_NM,
  };
}
