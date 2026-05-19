import { bearingDistanceBetween, destinationPoint, normalizeBearing } from "./earth.js";

function resolveFrame(frame) {
  const width = Number(frame?.width ?? frame?.w ?? 0);
  const height = Number(frame?.height ?? frame?.h ?? 0);
  const x = Number(frame?.x ?? 0);
  const y = Number(frame?.y ?? 0);
  const centerX = Number(frame?.centerX ?? frame?.cx ?? (x + width / 2));
  const centerY = Number(frame?.centerY ?? frame?.cy ?? (y + height / 2));
  return { ...frame, x, y, width, height, centerX, centerY };
}

function rotateScreen(dx, dy, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: (dx * cos) - (dy * sin),
    y: (dx * sin) + (dy * cos),
  };
}

function unrotateScreen(dx, dy, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: (dx * cos) + (dy * sin),
    y: (-dx * sin) + (dy * cos),
  };
}

export function createRjccRadarProjection(options) {
  const centerLat = Number(options?.centerLat);
  const centerLon = Number(options?.centerLon);
  const rangeNm = Number(options?.rangeNm);
  const frame = resolveFrame(options?.frame);
  const rotationDeg = Number(options?.rotationDeg ?? 0);
  const explicitScale = Number(options?.nmToScreen);
  const nmToScreen = Number.isFinite(explicitScale) && explicitScale > 0
    ? explicitScale
    : Math.min(frame.width, frame.height) / (2 * rangeNm);
  const screenToNm = 1 / nmToScreen;

  function bearingRangeToXY(bearingDeg, distanceNm) {
    const bearingRad = (normalizeBearing(bearingDeg) * Math.PI) / 180;
    const eastNm = Math.sin(bearingRad) * distanceNm;
    const northNm = Math.cos(bearingRad) * distanceNm;
    const rotated = rotateScreen(eastNm * nmToScreen, -northNm * nmToScreen, rotationDeg);
    return {
      x: frame.centerX + rotated.x,
      y: frame.centerY + rotated.y,
    };
  }

  function xyToBearingRange(x, y) {
    const dx = (x - frame.centerX) * screenToNm;
    const dy = (y - frame.centerY) * screenToNm;
    const unrotated = unrotateScreen(dx, dy, rotationDeg);
    const eastNm = unrotated.x;
    const northNm = -unrotated.y;
    return {
      bearingDeg: normalizeBearing((Math.atan2(eastNm, northNm) * 180) / Math.PI),
      rangeNm: Math.hypot(eastNm, northNm),
    };
  }

  function latLonToBearingRange(lat, lon) {
    const { bearingDeg, distanceNm } = bearingDistanceBetween({ lat1: centerLat, lon1: centerLon, lat2: lat, lon2: lon });
    return { bearingDeg, rangeNm: distanceNm };
  }

  function bearingRangeToLatLon(bearingDeg, distanceNm) {
    return destinationPoint({ lat: centerLat, lon: centerLon, bearingDeg, distanceNm });
  }

  function latLonToXY(lat, lon) {
    const { bearingDeg, rangeNm: distanceNm } = latLonToBearingRange(lat, lon);
    return bearingRangeToXY(bearingDeg, distanceNm);
  }

  function xyToLatLon(x, y) {
    const { bearingDeg, rangeNm: distanceNm } = xyToBearingRange(x, y);
    return bearingRangeToLatLon(bearingDeg, distanceNm);
  }

  return {
    centerLat,
    centerLon,
    rangeNm,
    frame,
    rotationDeg,
    nmToScreen,
    screenToNm,
    projectLatLon: latLonToXY,
    latLonToXY,
    xyToLatLon,
    bearingRangeToXY,
    xyToBearingRange,
    latLonToBearingRange,
    bearingRangeToLatLon,
  };
}
