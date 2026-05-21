export const procedureAuthoring = {
  toolId: "rjcc-trace-editor",
  route: "#/rjcc-trace-editor",
  outputType: "display-layer-manual-trace",
  verifiedSeeds: ["KURIS_SEVEN", "CHITOSE_FOUR"],
  unverifiedWorkflows: ["RNAV_SID", "STAR", "APPROACH"],
  futureLegAuthoring: false,
  sourcePaths: {
    manualPreviews: "src/data/airspace/rjcc/manual-previews",
    chartOverlays: "src/data/airspace/rjcc/chart-overlays",
    chartImages: "public/charts/rjcc",
    departureChartManifest: "src/data/airports/rjcc/departureChartManifest.js",
  },
};
