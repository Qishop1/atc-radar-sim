// src/data/airspace/rjcc/chart-overlays/CHITOSE_FOUR.chartOverlay.js
// Display-only shared chart image overlay transform.
// Not authoritative navigation data. Not used by gameplay.

export const CHITOSE_FOUR_CHART_OVERLAY = {
  id: "CHITOSE_FOUR_CHART_OVERLAY",
  chartId: "CHITOSE_FOUR",
  procedureIds: ["CHITOSE_FOUR_RWY01", "CHITOSE_FOUR_RWY19"],
  title: "CHITOSE FOUR DEPARTURE",
  imageUrl: "/charts/rjcc/CHITOSE_FOUR.png",
  width: 1240,
  height: 1755,
  approximate: true,
  source: "manual chart overlay transform",
  transform: {
    x: 367.97,
    y: 578.26,
    scale: 0.0774,
    rotationDeg: 1.1,
    opacity: 0.42,
  },
  notes: "Chart overlay is a visual reference only. AIP SID sketch is not georeferenced.",
};
