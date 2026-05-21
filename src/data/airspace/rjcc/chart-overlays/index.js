import { CHITOSE_FOUR_CHART_OVERLAY } from "./CHITOSE_FOUR.chartOverlay.js";
import { KURIS_SEVEN_CHART_OVERLAY } from "./KURIS_SEVEN.chartOverlay.js";
import { DALBI_ONE_CHART_OVERLAY } from "./DALBI_ONE.chartOverlay.js";

const sharedChartOverlays = [
  CHITOSE_FOUR_CHART_OVERLAY,
  KURIS_SEVEN_CHART_OVERLAY,
  DALBI_ONE_CHART_OVERLAY,
];

function procedureEntriesForOverlay(overlay) {
  const procedureIds = overlay.procedureIds || (overlay.procedureId ? [overlay.procedureId] : []);
  return procedureIds.map((procedureId) => [procedureId, overlay]);
}

export const chartOverlays = {
  ...Object.fromEntries(sharedChartOverlays.flatMap(procedureEntriesForOverlay)),
};

export const chartOverlaysByChartId = {
  ...Object.fromEntries(sharedChartOverlays.map((overlay) => [overlay.chartId, overlay])),
};
