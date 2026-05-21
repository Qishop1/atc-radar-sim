// src/data/airspace/rjcc/chart-overlays/DALBI_ONE.chartOverlay.js
// Display-only shared chart image overlay transform.
// Not authoritative navigation data. Not used by gameplay.

export const DALBI_ONE_CHART_OVERLAY = {
  "id": "DALBI_ONE_CHART_OVERLAY",
  "chartId": "DALBI_ONE",
  "procedureIds": [
    "DALBI_ONE_RWY19"
  ],
  "title": "DALBI ONE DEPARTURE",
  "imageUrl": "/charts/rjcc/DALBI_ONE.png",
  "width": 520,
  "height": 720,
  "approximate": true,
  "source": "manual chart overlay transform",
  "transform": {
    "x": 316.59,
    "y": 616.18,
    "scale": 0.624,
    "rotationDeg": 0,
    "opacity": 0.42
  },
  "notes": "Chart overlay is a visual reference only. AIP SID sketch is not georeferenced.",
  "chartAlignmentNotes": "DALBI_ONE chart is schematic; align for readability only. Route geometry comes from fix sequence or manual display trace."
};
