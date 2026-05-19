export function createLegacyCoordinateBridge({ oldCenter, oldPxPerNm, projection }) {
  const center = {
    x: Number(oldCenter?.x ?? 0),
    y: Number(oldCenter?.y ?? 0),
  };
  const pxPerNm = Number(oldPxPerNm);

  function legacyXYToBearingRange(x, y) {
    const eastNm = (x - center.x) / pxPerNm;
    const northNm = -(y - center.y) / pxPerNm;
    return {
      bearingDeg: ((Math.atan2(eastNm, northNm) * 180 / Math.PI) + 360) % 360,
      rangeNm: Math.hypot(eastNm, northNm),
    };
  }

  function bearingRangeToLegacyXY(bearingDeg, rangeNm) {
    const rad = (bearingDeg * Math.PI) / 180;
    return {
      x: center.x + (Math.sin(rad) * rangeNm * pxPerNm),
      y: center.y - (Math.cos(rad) * rangeNm * pxPerNm),
    };
  }

  function legacyXYToLatLon(x, y) {
    const { bearingDeg, rangeNm } = legacyXYToBearingRange(x, y);
    return projection.bearingRangeToLatLon(bearingDeg, rangeNm);
  }

  function latLonToLegacyXY(lat, lon) {
    const { bearingDeg, rangeNm } = projection.latLonToBearingRange(lat, lon);
    return bearingRangeToLegacyXY(bearingDeg, rangeNm);
  }

  function legacyXYToRadarXY(x, y) {
    const { bearingDeg, rangeNm } = legacyXYToBearingRange(x, y);
    return projection.bearingRangeToXY(bearingDeg, rangeNm);
  }

  function radarXYToLegacyXY(x, y) {
    const { bearingDeg, rangeNm } = projection.xyToBearingRange(x, y);
    return bearingRangeToLegacyXY(bearingDeg, rangeNm);
  }

  return {
    legacyXYToBearingRange,
    bearingRangeToLegacyXY,
    legacyXYToLatLon,
    latLonToLegacyXY,
    legacyXYToRadarXY,
    radarXYToLegacyXY,
  };
}
