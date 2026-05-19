import { getApproachesForRunway } from "../procedures/procedureLookup.js";

const fallbackApproaches = [
  { id: "ILS_Y_RWY_01L", runwayId: "01L", name: "ILS Y Runway 01L", source: "prototype-placeholder" },
  { id: "ILS_Z_RWY_01L", runwayId: "01L", name: "ILS Z Runway 01L", source: "prototype-placeholder" },
  { id: "ILS_RWY_19R", runwayId: "19R", name: "ILS Runway 19R", source: "prototype-placeholder" },
  { id: "ILS_RWY_19L", runwayId: "19L", name: "ILS Runway 19L", source: "prototype-placeholder" },
  { id: "VISUAL_RWY_01L", runwayId: "01L", name: "Visual Runway 01L", source: "prototype-placeholder" },
];

const procedureApproaches = getApproachesForRunway({ airportId: "RJCC" });

export const sampleApproaches = procedureApproaches.length
  ? procedureApproaches.map(({ id, runwayId, name, source }) => ({ id, runwayId, name, source }))
  : fallbackApproaches;
