import { airports as legacyAirports } from "../../airspace/rjcc/airports.js";

export const airport = legacyAirports.find((item) => item.icao === "RJCJ") || {
  id: "RJCJ",
  icao: "RJCJ",
  name: "Chitose Air Base",
  lat: null,
  lon: null,
  operator: "JSDF-A",
  source: null,
};

