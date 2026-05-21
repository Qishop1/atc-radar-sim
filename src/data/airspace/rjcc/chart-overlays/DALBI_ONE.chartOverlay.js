// src/data/airspace/rjcc/chart-overlays/DALBI_ONE.chartOverlay.js
// Display-only shared chart image overlay transform.
// Not authoritative navigation data. Not used by gameplay.

export const DALBI_ONE_CHART_OVERLAY = {
  "id": "DALBI_ONE_CHART_OVERLAY",
  "chartId": "DALBI_ONE",
  "procedureIds": [
    "DALBI_ONE_RWY01"
  ],
  "title": "DALBI ONE DEPARTURE",
  "imageUrl": "/charts/rjcc/DALBI_ONE.png",
  "width": 520,
  "height": 720,
  "approximate": true,
  "source": "manual chart overlay transform",
  "transform": {
    "x": 312.43,
    "y": 615.78,
    "scale": 0.6142,
    "rotationDeg": -0.7,
    "opacity": 0.42
  },
  "notes": "Chart overlay is a visual reference only. AIP SID sketch is not georeferenced."
};
