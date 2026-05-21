import { rjccDepartureAuthoringPresets } from "../../data/airports/rjcc/departureChartManifest.js";

const legacyDisabledManualPreviewPresets = [
  {
    id: "CHITOSE_ONE_RWY01_TODO",
    label: "CHITOSE ONE RWY01 (TODO)",
    procedureId: "CHITOSE_ONE_RWY01",
    chartId: "CHITOSE_ONE",
    chartTitle: "CHITOSE ONE DEPARTURE",
    suggestedChartFilename: "CHITOSE_ONE.png",
    traceType: "APPROX_TURN",
    coordinateSpace: "anchor-normalized",
    enabled: false,
    status: "todo",
    notes: "Legacy disabled scaffold only: no current chart asset is present in public/charts/rjcc.",
    anchorFrame: {
      originId: "CHE",
      axisToId: "CHE",
      startId: "RJCC_RWY01_REPRESENTATIVE",
      finalId: "CHE",
    },
    constructionDefaults: {
      stationId: "CHE",
      bearingType: "MAGNETIC",
      magneticVariationDeg: -9,
      dmeNm: [],
    },
  },
  {
    id: "CHITOSE_ONE_RWY19_TODO",
    label: "CHITOSE ONE RWY19 (TODO)",
    procedureId: "CHITOSE_ONE_RWY19",
    chartId: "CHITOSE_ONE",
    chartTitle: "CHITOSE ONE DEPARTURE",
    suggestedChartFilename: "CHITOSE_ONE.png",
    traceType: "APPROX_TURN",
    coordinateSpace: "anchor-normalized",
    enabled: false,
    status: "todo",
    notes: "Legacy disabled scaffold only: no current chart asset is present in public/charts/rjcc.",
    anchorFrame: {
      originId: "CHE",
      axisToId: "CHE",
      startId: "RJCC_RWY19_REPRESENTATIVE",
      finalId: "CHE",
    },
    constructionDefaults: {
      stationId: "CHE",
      bearingType: "MAGNETIC",
      magneticVariationDeg: -9,
      dmeNm: [],
    },
  },
];

export const manualPreviewPresets = [
  ...rjccDepartureAuthoringPresets,
  ...legacyDisabledManualPreviewPresets,
];

export function getManualPreviewPreset(id) {
  return manualPreviewPresets.find((preset) => preset.id === id) || null;
}
