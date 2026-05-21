import { runways as legacyRunways } from "../../airspace/rjcc/runways.js";

export const runways = legacyRunways.filter((runway) => runway.airportId === "RJCJ");

