import { chartOverlays, chartOverlaysByChartId } from "../../data/airspace/rjcc/chartOverlays.js";

const RUNWAY_ID_PATTERN = /_RWY_?(01L|01R|01|19L|19R|19)(?:_|$)/;

function chartIdFromProcedureId(procedureId) {
  if (!procedureId) return "";
  const runwayMatch = RUNWAY_ID_PATTERN.exec(procedureId);
  if (runwayMatch?.index > 0) return procedureId.slice(0, runwayMatch.index);
  if (procedureId.endsWith("_DEPARTURE")) return procedureId.slice(0, -"_DEPARTURE".length);
  const arrivalIndex = procedureId.indexOf("_ARRIVAL");
  if (arrivalIndex > 0) return procedureId.slice(0, arrivalIndex + "_ARRIVAL".length);
  return procedureId;
}

export function getChartOverlayForProcedureId(procedureId) {
  if (!procedureId) return null;
  return chartOverlays[procedureId] || chartOverlaysByChartId[chartIdFromProcedureId(procedureId)] || null;
}

export function getChartOverlaysForProcedureIds(procedureIds = []) {
  return procedureIds.map((procedureId) => getChartOverlayForProcedureId(procedureId)).filter(Boolean);
}

export function getFirstAvailableChartOverlay(procedureIds = []) {
  return getChartOverlaysForProcedureIds(procedureIds)[0] || null;
}
