import { getRepresentativeDepartureEnd, getRunwayEndById } from "./runwayAnchors.js";

function isFiniteLatLon(item) {
  return Number.isFinite(item?.lat) && Number.isFinite(item?.lon);
}

function projectLatLonItem(item, projection) {
  if (!isFiniteLatLon(item) || !projection?.projectLatLon) return null;
  const projected = projection.projectLatLon(item.lat, item.lon);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return { ...item, x: projected.x, y: projected.y };
}

function runwayAnchorTarget({ id, label, anchor, projection }) {
  const projected = projectLatLonItem(anchor, projection);
  if (!projected) return null;
  return {
    id,
    type: "RWY_ANCHOR",
    label,
    lat: anchor.lat,
    lon: anchor.lon,
    x: projected.x,
    y: projected.y,
    source: "runways.js",
    item: anchor,
  };
}

export function projectWaypointSnapTarget(target, projection) {
  if (!target) return null;
  if (Number.isFinite(target.x) && Number.isFinite(target.y)) return target;
  return projectLatLonItem(target, projection);
}

export function buildWaypointSnapTargets({ fixes = [], navaids = [], runways = [], airports = [], projection } = {}) {
  const targets = [];

  for (const fix of fixes) {
    const projected = projectLatLonItem(fix, projection);
    if (!projected?.id) continue;
    targets.push({
      id: fix.id,
      type: "FIX",
      label: `${fix.id} / ${fix.type || "FIX"}`,
      name: fix.name || fix.notes || "",
      lat: fix.lat,
      lon: fix.lon,
      x: projected.x,
      y: projected.y,
      source: fix.source,
      item: fix,
    });
  }

  for (const navaid of navaids) {
    const projected = projectLatLonItem(navaid, projection);
    if (!projected?.id) continue;
    targets.push({
      id: navaid.id,
      type: navaid.type || "NAVAID",
      label: `${navaid.id} / ${navaid.type || "NAVAID"}`,
      name: navaid.name || "",
      lat: navaid.lat,
      lon: navaid.lon,
      x: projected.x,
      y: projected.y,
      source: navaid.source,
      item: navaid,
    });
  }

  for (const airport of airports) {
    const projected = projectLatLonItem(airport, projection);
    if (!projected?.id) continue;
    targets.push({
      id: airport.id,
      type: "AIRPORT",
      label: `${airport.id} / AIRPORT`,
      name: airport.name || "",
      lat: airport.lat,
      lon: airport.lon,
      x: projected.x,
      y: projected.y,
      source: airport.source,
      item: airport,
    });
  }

  const rjccRwy01Representative = getRepresentativeDepartureEnd(runways, "RJCC", ["01L", "01R"]);
  const rjccRwy19Representative = getRepresentativeDepartureEnd(runways, "RJCC", ["19L", "19R"]);
  [
    runwayAnchorTarget({
      id: "RJCC_RWY01_REPRESENTATIVE",
      label: "RJCC RWY01 representative departure anchor",
      anchor: rjccRwy01Representative,
      projection,
    }),
    runwayAnchorTarget({
      id: "RJCC_RWY19_REPRESENTATIVE",
      label: "RJCC RWY19 representative departure anchor",
      anchor: rjccRwy19Representative,
      projection,
    }),
  ].filter(Boolean).forEach((target) => targets.push(target));

  for (const endId of ["01L", "01R", "19L", "19R"]) {
    const anchor = getRunwayEndById(runways, "RJCC", endId);
    const target = runwayAnchorTarget({
      id: `RJCC_RWY${endId}`,
      label: `RJCC RWY${endId}`,
      anchor,
      projection,
    });
    if (target) targets.push(target);
  }

  return targets.sort((a, b) => a.id.localeCompare(b.id));
}

export function findWaypointSnapTargetById(id, targets = []) {
  const normalized = String(id || "").trim().toUpperCase();
  if (!normalized) return null;
  return targets.find((target) => String(target.id || "").toUpperCase() === normalized) || null;
}

export function filterWaypointSnapTargets(query, targets = []) {
  const normalized = (query || "").trim().toUpperCase();
  if (!normalized) return targets.slice(0, 80);
  return targets
    .filter((target) => [
      target.id,
      target.type,
      target.label,
      target.name,
    ].filter(Boolean).some((value) => String(value).toUpperCase().includes(normalized)))
    .slice(0, 80);
}
