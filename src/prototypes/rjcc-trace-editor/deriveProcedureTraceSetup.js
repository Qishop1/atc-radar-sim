import { expandProcedureRouteEntries } from "../../core-v2/procedures/procedureRouteBuilder.js";

const DEFAULT_MAGNETIC_VARIATION_DEG = -9;
const RUNWAY_ID_PATTERN = /_RWY_?(01L|01R|01|19L|19R|19)(?:_|$)/;
const RADIAL_LEG_TYPES = new Set(["LEFT_TURN_TO_RADIAL", "TURN_TO_RADIAL", "RADIAL_TO_FIX"]);
const TURN_LIKE_LEG_TYPES = new Set([
  "HEADING_TO_FIX",
  "LEFT_TURN_TO_RADIAL",
  "RUNWAY_HEADING",
  "TURN_DIRECT_FIX",
  "TURN_TO_RADIAL",
]);

function normalizeId(id) {
  return String(id || "").trim().toUpperCase();
}

function uniqueFinite(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!Number.isFinite(value)) return false;
    const key = value.toFixed(3);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasKnownId(id, items) {
  if (!id) return false;
  return items.some((item) => item?.id === id);
}

function deriveChartId(procedureId) {
  const runwayMatch = RUNWAY_ID_PATTERN.exec(procedureId);
  if (runwayMatch?.index > 0) return procedureId.slice(0, runwayMatch.index);
  if (procedureId.endsWith("_DEPARTURE")) return procedureId.slice(0, -"_DEPARTURE".length);
  const arrivalIndex = procedureId.indexOf("_ARRIVAL");
  if (arrivalIndex > 0) return procedureId.slice(0, arrivalIndex + "_ARRIVAL".length);
  return procedureId;
}

function chartTitleFromId(chartId) {
  return chartId.replace(/_/g, " ");
}

function deriveRunwayStartId(procedureId) {
  const match = RUNWAY_ID_PATTERN.exec(procedureId);
  const runwayToken = match?.[1] || "";
  if (runwayToken.startsWith("01")) return "RJCC_RWY01_REPRESENTATIVE";
  if (runwayToken.startsWith("19")) return "RJCC_RWY19_REPRESENTATIVE";
  return "";
}

function collectLegs(procedure) {
  return [
    ...((procedure?.segments || []).flatMap((segment) => segment.legs || [])),
    ...(procedure?.legs || []),
  ];
}

function endpointFixIdForLeg(leg) {
  return leg?.fixId || leg?.endpointFixId || leg?.toFixId || null;
}

function deriveFinalId({ procedureId, procedure, legs, fixes, navaids }) {
  for (let index = legs.length - 1; index >= 0; index -= 1) {
    const endpointId = endpointFixIdForLeg(legs[index]);
    if (endpointId) return endpointId;
  }

  if (procedure?.previewGeometry?.toFixId) return procedure.previewGeometry.toFixId;

  const transitionMatch = /_([A-Z0-9]+)_TRANSITION$/.exec(procedureId);
  if (transitionMatch && hasKnownId(transitionMatch[1], fixes)) return transitionMatch[1];

  if (procedureId.includes("KURIS") && hasKnownId("KURIS", fixes)) return "KURIS";
  if (procedureId.includes("TOBBY") && hasKnownId("TOBBY", fixes)) return "TOBBY";
  if (procedureId.includes("CHE") && hasKnownId("CHE", navaids)) return "CHE";

  return "";
}

function deriveRadialMetadata({ procedure, legs }) {
  const radialLeg = legs.find((leg) => RADIAL_LEG_TYPES.has(leg?.type) && Number.isFinite(leg.radialDeg) && leg.stationId);
  if (radialLeg) {
    return {
      stationId: radialLeg.stationId,
      radialDeg: radialLeg.radialDeg,
    };
  }

  const interceptRadial = procedure?.previewGeometry?.interceptRadial;
  if (interceptRadial?.stationId && Number.isFinite(interceptRadial.radialDeg)) {
    return {
      stationId: interceptRadial.stationId,
      radialDeg: interceptRadial.radialDeg,
    };
  }

  return {};
}

function collectDmeDefaults({ procedure, legs }) {
  const values = [];
  for (const leg of legs) {
    values.push(leg?.until?.dme?.distanceNm);
    values.push(leg?.within?.dme?.distanceNm);
    values.push(leg?.withinNm);
  }

  values.push(procedure?.previewGeometry?.turnStart?.dme?.distanceNm);
  values.push(procedure?.previewGeometry?.turnLimit?.withinNm);
  values.push(procedure?.previewGeometry?.turnLimit?.distanceNm);

  if (!uniqueFinite(values).length) {
    for (const item of procedure?.radialDmeMetadata || []) {
      values.push(item?.distanceNm);
    }
  }

  return uniqueFinite(values);
}

function deriveTraceType({ procedure, legs }) {
  if ((procedure?.previewGeometry?.type || "").includes("TURN")) return "APPROX_TURN";
  if (legs.some((leg) => TURN_LIKE_LEG_TYPES.has(leg?.type))) return "APPROX_TURN";
  if (legs.length <= 1 && legs.some((leg) => leg?.type === "DIRECT_FIX" || leg?.type === "HEADING_TO_FIX")) return "CONNECTOR";
  if (procedure?.type === "SID" && procedure?.navSpec === "CONVENTIONAL") return "APPROX_TURN";
  if (procedure?.navSpec === "RNAV1" || procedure?.type === "STAR") return "SOLID_ROUTE";
  return "APPROX_TURN";
}

function findProcedureEntry(procedureId, procedures) {
  return expandProcedureRouteEntries(procedures || []).find((procedure) => procedure?.id === procedureId) || null;
}

export function deriveProcedureTraceSetup({
  procedureId,
  procedures = [],
  fixes = [],
  navaids = [],
  runways = [],
  airports = [],
} = {}) {
  const normalizedProcedureId = normalizeId(procedureId);
  const warnings = [];
  const chartId = deriveChartId(normalizedProcedureId);
  const procedure = findProcedureEntry(normalizedProcedureId, procedures);
  const legs = collectLegs(procedure);
  const startId = deriveRunwayStartId(normalizedProcedureId);
  const finalId = deriveFinalId({ procedureId: normalizedProcedureId, procedure, legs, fixes, navaids });
  const radialMetadata = deriveRadialMetadata({ procedure, legs });
  const dmeNm = collectDmeDefaults({ procedure, legs });
  const hasChe = hasKnownId("CHE", navaids);
  const stationId = radialMetadata.stationId || (hasChe ? "CHE" : "");

  if (!procedure) warnings.push("Could not find procedure data for this procedureId; using ID parsing only.");
  if (!startId) warnings.push("Could not derive runway start anchor from procedureId.");
  if (!finalId) warnings.push("Could not derive final anchor; please select finalId manually.");
  if (startId && !runways.length) warnings.push("Runway data was not supplied; start anchor was derived from ID only.");
  if (procedure?.airportId && !hasKnownId(procedure.airportId, airports)) {
    warnings.push(`Could not verify airport ${procedure.airportId}.`);
  }

  let originId = "";
  let axisToId = "";
  let coordinateSpace = "rjcc-projected";
  if (startId && finalId) {
    originId = stationId && stationId !== finalId ? stationId : startId;
    axisToId = finalId;
    coordinateSpace = originId && axisToId && originId !== axisToId ? "anchor-normalized" : "rjcc-projected";
  }

  if (startId && finalId && coordinateSpace !== "anchor-normalized") {
    warnings.push("Could not build a non-zero anchor frame; using projected coordinate export until anchors are adjusted.");
  }

  const setup = {
    procedureId: normalizedProcedureId,
    label: procedure?.name || chartTitleFromId(chartId),
    chartId,
    chartTitle: chartTitleFromId(chartId),
    chartFilename: `${chartId}.png`,
    traceType: deriveTraceType({ procedure, legs }),
    coordinateSpace,
    anchorFrame: {
      originId,
      axisToId,
      startId,
      finalId,
    },
    constructionDefaults: {
      stationId,
      ...(Number.isFinite(radialMetadata.radialDeg) ? { radialDeg: radialMetadata.radialDeg } : {}),
      bearingType: "MAGNETIC",
      magneticVariationDeg: DEFAULT_MAGNETIC_VARIATION_DEG,
      dmeNm,
    },
  };

  return {
    ok: warnings.length === 0,
    partial: warnings.length > 0,
    warnings,
    setup,
  };
}
