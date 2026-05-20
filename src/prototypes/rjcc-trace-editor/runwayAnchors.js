function isFiniteLatLon(item) {
  return item && Number.isFinite(item.lat) && Number.isFinite(item.lon);
}

function oppositeDepartureEndId(endId) {
  if (endId.startsWith("19")) return endId.replace(/^19/, "01");
  if (endId.startsWith("01")) return endId.replace(/^01/, "19");
  return endId;
}

function representativeDepartureName(runwayEndIds) {
  if (runwayEndIds.every((endId) => endId.startsWith("19"))) return "RWY19";
  if (runwayEndIds.every((endId) => endId.startsWith("01"))) return "RWY01";
  return `RWY${runwayEndIds.join("_")}`;
}

function averageRunwayHeading(ends, requestedRunwayName) {
  const values = ends.map((end) => end.trueBearingDeg).filter(Number.isFinite);
  if (!values.length) return null;
  const average = values.reduce((sum, bearing) => sum + bearing, 0) / values.length;
  if (requestedRunwayName === "RWY19") return (average + 180) % 360;
  if (requestedRunwayName === "RWY01") return (average + 180) % 360;
  return average;
}

export function getRunwayEndById(runways, airportId, endId) {
  for (const runway of runways || []) {
    if (airportId && runway.airportId !== airportId) continue;
    const end = runway.ends?.find((candidate) => candidate.id === endId);
    if (end && isFiniteLatLon(end)) {
      return {
        ...end,
        id: `${runway.airportId}_${end.id}`,
        label: `${runway.airportId} RWY ${end.id}`,
        airportId: runway.airportId,
        runwayId: runway.id,
      };
    }
  }
  return null;
}

export function getRepresentativeDepartureEnd(runways, airportId, runwayEndIds) {
  const representativeName = representativeDepartureName(runwayEndIds || []);
  const departureEndIds = (runwayEndIds || []).map(oppositeDepartureEndId);
  const ends = departureEndIds.map((endId) => getRunwayEndById(runways, airportId, endId)).filter(Boolean);
  if (!ends.length) return null;
  const lat = ends.reduce((sum, end) => sum + end.lat, 0) / ends.length;
  const lon = ends.reduce((sum, end) => sum + end.lon, 0) / ends.length;
  const trueBearingDeg = averageRunwayHeading(ends, representativeName);
  return {
    id: `${airportId}_${representativeName}_REPRESENTATIVE`,
    label: `Representative ${representativeName} departure anchor`,
    airportId,
    runwayEndIds,
    departureEndIds,
    lat,
    lon,
    trueBearingDeg,
  };
}
