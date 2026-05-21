import { airports as legacyAirports } from "../../airspace/rjcc/airports.js";

export const airport = legacyAirports.find((item) => item.icao === "RJCC") || {
  id: "RJCC",
  icao: "RJCC",
  name: "New Chitose Airport",
  lat: null,
  lon: null,
  source: null,
};

export const regionalAirportMarkers = legacyAirports;

