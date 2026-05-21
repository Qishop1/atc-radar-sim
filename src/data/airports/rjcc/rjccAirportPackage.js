import { chartOverlays, chartOverlaysByChartId } from "./charts.js";
import { rjccDepartureAuthoringPresets, rjccDepartureChartManifest, rjccDepartureChartOptions } from "./departureChartManifest.js";
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
  departures: rjccDepartureChartManifest,
  departureOptions: rjccDepartureChartOptions,
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
  departureChartManifest: rjccDepartureChartManifest,
  manualPreviews: manualProcedurePreviews,
  procedureAuthoring: {
    ...procedureAuthoring,
    departureChartManifest: rjccDepartureChartManifest,
    departureAuthoringPresets: rjccDepartureAuthoringPresets,
  },
  regionalAirportMarkers,
  compatibility: {
    legacyAirspacePath: "src/data/airspace/rjcc",
  },
};
