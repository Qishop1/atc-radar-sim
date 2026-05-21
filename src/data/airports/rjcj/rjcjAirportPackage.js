import { airport } from "./airport.js";
import { militaryTraffic } from "./militaryTraffic.js";
import { procedures } from "./procedures.js";
import { recoveryProcedures } from "./recoveryProcedures.js";
import { runways } from "./runways.js";

export const rjcjAirportPackage = {
  id: "rjcj",
  icao: "RJCJ",
  type: "airport",
  status: "placeholder",
  airport,
  runways,
  procedures,
  militaryTraffic,
  recoveryProcedures,
  scrambleInterceptLogic: {
    status: "future",
    items: [],
  },
  compatibility: {
    legacyAirspacePath: "src/data/airspace/rjcc",
  },
};

