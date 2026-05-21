import { chartOverlays, chartOverlaysByChartId } from "./charts.js";
import { localizers } from "./localizers.js";
import { manualProcedurePreviews } from "./manualPreviews.js";
import { airport, regionalAirportMarkers } from "./airport.js";
import { approaches, arrivals, departures, holdings } from "./procedures.js";
import { procedureAuthoring } from "./procedureAuthoring.js";
import { runways } from "./runways.js";

export const procedures = {
  arrivals,
  departures,
  approaches,
  holdings,
};

export const charts = {
  chartOverlays,
  chartOverlaysByChartId,
};

export const rjccAirportPackage = {
  id: "rjcc",
  icao: "RJCC",
  type: "airport",
  status: "active",
  airport,
  runways,
  localizers,
  procedures,
  charts,
  manualPreviews: manualProcedurePreviews,
  procedureAuthoring,
  regionalAirportMarkers,
  compatibility: {
    legacyAirspacePath: "src/data/airspace/rjcc",
  },
};

