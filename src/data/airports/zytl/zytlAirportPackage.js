import { airport } from "./airport.js";
import { procedures } from "./procedures.js";
import { runways } from "./runways.js";

export const zytlAirportPackage = {
  id: "zytl",
  icao: "ZYTL",
  type: "airport",
  status: "placeholder",
  airport,
  runways,
  procedures,
  charts: [],
  manualPreviews: [],
  procedureAuthoring: {
    status: "future",
    items: [],
  },
};

