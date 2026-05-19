function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function delta(a, b) {
  return round(Math.abs(a - b));
}

export function debugCoordinateRoundTrip(projection) {
  const bearingRangeCases = [
    { bearingDeg: 0, rangeNm: projection.rangeNm * 0.25 },
    { bearingDeg: 90, rangeNm: projection.rangeNm * 0.5 },
    { bearingDeg: 225, rangeNm: projection.rangeNm * 0.75 },
  ];

  const bearingRange = bearingRangeCases.map((sample) => {
    const xy = projection.bearingRangeToXY(sample.bearingDeg, sample.rangeNm);
    const back = projection.xyToBearingRange(xy.x, xy.y);
    return {
      sample,
      xy: { x: round(xy.x), y: round(xy.y) },
      back: { bearingDeg: round(back.bearingDeg), rangeNm: round(back.rangeNm) },
      error: {
        bearingDeg: delta(back.bearingDeg, sample.bearingDeg),
        rangeNm: delta(back.rangeNm, sample.rangeNm),
      },
    };
  });

  const latLonCases = bearingRangeCases.map((sample) => ({
    sample,
    latLon: projection.bearingRangeToLatLon(sample.bearingDeg, sample.rangeNm),
  }));

  const latLon = latLonCases.map(({ sample, latLon: point }) => {
    const back = projection.latLonToBearingRange(point.lat, point.lon);
    return {
      sample,
      latLon: { lat: round(point.lat), lon: round(point.lon) },
      back: { bearingDeg: round(back.bearingDeg), rangeNm: round(back.rangeNm) },
      error: {
        bearingDeg: delta(back.bearingDeg, sample.bearingDeg),
        rangeNm: delta(back.rangeNm, sample.rangeNm),
      },
    };
  });

  return { bearingRange, latLon };
}

export function compareLegacyBridge(bridge) {
  const samples = [
    { x: 360, y: 360 },
    { x: 420, y: 300 },
    { x: 240, y: 510 },
  ];

  return {
    samples: samples.map((legacy) => {
      const bearingRange = bridge.legacyXYToBearingRange(legacy.x, legacy.y);
      const radar = bridge.legacyXYToRadarXY(legacy.x, legacy.y);
      const legacyBack = bridge.radarXYToLegacyXY(radar.x, radar.y);
      const latLon = bridge.legacyXYToLatLon(legacy.x, legacy.y);
      const legacyFromLatLon = bridge.latLonToLegacyXY(latLon.lat, latLon.lon);
      return {
        legacy,
        bearingRange: { bearingDeg: round(bearingRange.bearingDeg), rangeNm: round(bearingRange.rangeNm) },
        radar: { x: round(radar.x), y: round(radar.y) },
        legacyBack: { x: round(legacyBack.x), y: round(legacyBack.y) },
        legacyFromLatLon: { x: round(legacyFromLatLon.x), y: round(legacyFromLatLon.y) },
        error: {
          radarXyToLegacyX: delta(legacyBack.x, legacy.x),
          radarXyToLegacyY: delta(legacyBack.y, legacy.y),
          latLonToLegacyX: delta(legacyFromLatLon.x, legacy.x),
          latLonToLegacyY: delta(legacyFromLatLon.y, legacy.y),
        },
      };
    }),
  };
}
