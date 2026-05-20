import { airports } from "../../data/airspace/rjcc/airports.js";
import { fixes } from "../../data/airspace/rjcc/fixes.js";
import { localizers } from "../../data/airspace/rjcc/localizers.js";
import { navaids } from "../../data/airspace/rjcc/navaids.js";
import { arrivals, approaches, departures, holdings } from "../../data/airspace/rjcc/procedures.js";
import { radialDmeReferences } from "../../data/airspace/rjcc/radialDmeReferences.js";
import { runways } from "../../data/airspace/rjcc/runways.js";
import { expandProcedureRouteEntries } from "./procedureRouteBuilder.js";

function isFiniteLatLon(item) {
  return Number.isFinite(item?.lat) && Number.isFinite(item?.lon);
}

function normalizeApproach(procedure) {
  return {
    id: procedure.id,
    runwayId: procedure.runwayId,
    name: procedure.name || `${procedure.approachType || "Approach"} Runway ${procedure.runwayId}`,
    source: procedure.source,
    procedure,
  };
}

export function getProcedureById(id) {
  return getAllProcedures().find((procedure) => procedure.id === id) || expandProcedureRouteEntries(getAllProcedures()).find((procedure) => procedure.id === id) || null;
}

export function getApproachesForRunway({ airportId, runwayId } = {}) {
  return approaches
    .filter((procedure) => (!airportId || procedure.airportId === airportId) && (!runwayId || procedure.runwayId === runwayId))
    .map(normalizeApproach);
}

export function getHoldByFixId(fixId) {
  return holdings.find((holding) => holding.fixId === fixId) || null;
}

export function getAllProcedures() {
  return [...arrivals, ...departures, ...approaches, ...holdings];
}

export function buildProcedureDisplayOptions() {
  return expandProcedureRouteEntries(getAllProcedures()).map((procedure) => ({
    id: procedure.id,
    label: procedure.name || procedure.id,
    type: procedure.type || (procedure.fixId ? "HOLD" : "PROCEDURE"),
    airportId: procedure.airportId,
    runwayIds: procedure.runwayIds || (procedure.runwayId ? [procedure.runwayId] : []),
    parentProcedureId: procedure.parentProcedureId,
  }));
}

function addLookupItem(lookup, entry) {
  if (!entry?.id) return;
  const existing = lookup[entry.id];
  if (!existing) {
    lookup[entry.id] = entry;
    return;
  }

  const roles = new Set([...(existing.roles || [existing.type]), entry.type]);
  lookup[entry.id] = {
    ...existing,
    roles: [...roles],
    duplicateItems: [...(existing.duplicateItems || [existing.item].filter(Boolean)), entry.item].filter(Boolean),
  };
}

function keyedById(items, type) {
  return Object.fromEntries((items || []).filter((item) => item?.id).map((item) => [item.id, { id: item.id, type, source: item.source, item }]));
}

export function buildWaypointLookup() {
  const lookup = {};

  for (const fix of fixes) {
    if (fix?.id && isFiniteLatLon(fix)) addLookupItem(lookup, { id: fix.id, type: "FIX", lat: fix.lat, lon: fix.lon, source: fix.source, item: fix });
  }

  for (const navaid of navaids) {
    if (navaid?.id && isFiniteLatLon(navaid)) addLookupItem(lookup, { id: navaid.id, type: navaid.type || "NAVAID", lat: navaid.lat, lon: navaid.lon, source: navaid.source, item: navaid });
  }

  for (const airport of airports) {
    if (airport?.id && isFiniteLatLon(airport)) addLookupItem(lookup, { id: airport.id, type: "AIRPORT", lat: airport.lat, lon: airport.lon, source: airport.source, item: airport });
  }

  for (const runway of runways) {
    for (const end of runway.ends || []) {
      if (!end?.id || !isFiniteLatLon(end)) continue;
      const id = `${runway.airportId}:${end.id}`;
      addLookupItem(lookup, { id, type: "RUNWAY_END", airportId: runway.airportId, runwayId: runway.id, endId: end.id, lat: end.lat, lon: end.lon, source: runway.source, item: end });
    }
  }

  lookup._localizers = keyedById(localizers, "LOCALIZER");
  for (const localizer of localizers) {
    if (localizer?.id && isFiniteLatLon(localizer)) addLookupItem(lookup, { id: localizer.id, type: "LOCALIZER", lat: localizer.lat, lon: localizer.lon, source: localizer.source, item: localizer });
  }
  lookup._radialDmeReferences = keyedById(radialDmeReferences, "RADIAL_DME_REFERENCE");

  return lookup;
}
