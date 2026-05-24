const AUTHORING_CHART_SIZE = { width: 520, height: 720 };
const SOURCE = "public/charts/rjcc";

const GENERIC_TODO_ANCHOR_FRAME = {
  originId: "CHE",
  axisToId: "",
  startId: "RJCC_RWY19_REPRESENTATIVE",
  finalId: "",
};

const GENERIC_TODO_CONSTRUCTION_DEFAULTS = {
  stationId: "CHE",
  bearingType: "MAGNETIC",
  magneticVariationDeg: -9,
  dmeNm: [],
};

function chartTitleFromId(chartId) {
  return chartId.replace(/_/g, " ");
}

function chartRecord(chartId, overrides = {}) {
  const title = overrides.title || chartTitleFromId(chartId);
  const filename = overrides.filename || `${chartId}.png`;
  return {
    chartId,
    title,
    filename,
    imageUrl: `/charts/rjcc/${filename}`,
    source: SOURCE,
    airac_cycle: null,
    status: overrides.status || "pending_trace",
    procedureType: overrides.procedureType || "SID_TODO",
    width: AUTHORING_CHART_SIZE.width,
    height: AUTHORING_CHART_SIZE.height,
    variants: overrides.variants || [
      pendingTracePreset({
        id: chartId,
        label: `${title} (TODO)`,
        procedureId: chartId,
        chartId,
      }),
    ],
  };
}

function verifiedPreset({
  id,
  label,
  procedureId = id,
  chartId,
  chartTitle,
  startId,
  finalId,
  axisToId = finalId,
  originId = "CHE",
  constructionDefaults,
}) {
  return {
    id,
    label,
    procedureId,
    chartId,
    chartOptionId: chartId,
    chartTitle,
    suggestedChartFilename: `${chartId}.png`,
    procedureType: "SID",
    status: "verified",
    traceType: "APPROX_TURN",
    coordinateSpace: "anchor-normalized",
    anchorFrame: {
      originId,
      axisToId,
      startId,
      finalId,
    },
    constructionDefaults,
  };
}

function pendingTracePreset({
  id,
  label,
  procedureId = id,
  chartId,
  endpointId = null,
  procedureType = "SID_TODO",
  status = "pending_trace",
  pendingTrace = true,
  routeFixes = [],
  runwayIds = [],
  navSpec = null,
  anchorFrame = null,
  initialDisplayClimb = null,
  notes = "TODO chart-only authoring preset. Display trace, route fixes, and legs are intentionally empty until manual tracing.",
}) {
  const normalizedRunwayIds = runwayIds.map((runwayId) => String(runwayId || "").toUpperCase());
  const startId = normalizedRunwayIds.length && normalizedRunwayIds.every((runwayId) => runwayId.startsWith("01"))
    ? "RJCC_RWY01_REPRESENTATIVE"
    : normalizedRunwayIds.length && normalizedRunwayIds.every((runwayId) => runwayId.startsWith("19"))
      ? "RJCC_RWY19_REPRESENTATIVE"
      : GENERIC_TODO_ANCHOR_FRAME.startId;
  return {
    id,
    label,
    procedureId,
    chartId,
    chartOptionId: chartId,
    chartTitle: `${chartTitleFromId(chartId)} DEPARTURE`,
    suggestedChartFilename: `${chartId}.png`,
    procedureType,
    status,
    pendingTrace,
    routeFixes,
    runwayIds,
    navSpec,
    initialDisplayClimb,
    displayPath: null,
    displayTrace: null,
    legs: null,
    endpointId,
    traceType: "APPROX_TURN",
    coordinateSpace: "anchor-normalized",
    anchorFrame: anchorFrame || {
      ...GENERIC_TODO_ANCHOR_FRAME,
      startId,
    },
    constructionDefaults: GENERIC_TODO_CONSTRUCTION_DEFAULTS,
    notes,
  };
}

export const rjccDepartureChartManifest = [
  chartRecord("KURIS_SEVEN", {
    title: "KURIS SEVEN",
    status: "verified",
    procedureType: "SID",
    variants: [
      verifiedPreset({
        id: "KURIS_SEVEN_RWY19",
        label: "KURIS SEVEN RWY19",
        chartId: "KURIS_SEVEN",
        chartTitle: "KURIS SEVEN DEPARTURE",
        originId: "CHE",
        axisToId: "KURIS",
        startId: "RJCC_RWY19_REPRESENTATIVE",
        finalId: "KURIS",
        constructionDefaults: {
          stationId: "CHE",
          radialDeg: 11,
          bearingType: "MAGNETIC",
          magneticVariationDeg: -9,
          dmeNm: [2, 6],
        },
      }),
      verifiedPreset({
        id: "KURIS_SEVEN_RWY01",
        label: "KURIS SEVEN RWY01",
        chartId: "KURIS_SEVEN",
        chartTitle: "KURIS SEVEN DEPARTURE",
        originId: "CHE",
        axisToId: "KURIS",
        startId: "RJCC_RWY01_REPRESENTATIVE",
        finalId: "KURIS",
        constructionDefaults: {
          stationId: "CHE",
          radialDeg: 11,
          bearingType: "MAGNETIC",
          magneticVariationDeg: -9,
          dmeNm: [],
        },
      }),
    ],
  }),
  chartRecord("CHITOSE_FOUR", {
    title: "CHITOSE FOUR",
    status: "verified",
    procedureType: "SID",
    variants: [
      verifiedPreset({
        id: "CHITOSE_FOUR_RWY01",
        label: "CHITOSE FOUR RWY01",
        chartId: "CHITOSE_FOUR",
        chartTitle: "CHITOSE FOUR DEPARTURE",
        originId: "CHE",
        axisToId: "CHE",
        startId: "RJCC_RWY01_REPRESENTATIVE",
        finalId: "CHE",
        constructionDefaults: {
          stationId: "CHE",
          bearingType: "MAGNETIC",
          magneticVariationDeg: -9,
          dmeNm: [6.3, 10],
        },
      }),
      verifiedPreset({
        id: "CHITOSE_FOUR_RWY19",
        label: "CHITOSE FOUR RWY19",
        chartId: "CHITOSE_FOUR",
        chartTitle: "CHITOSE FOUR DEPARTURE",
        originId: "RJCC_RWY19_REPRESENTATIVE",
        axisToId: "CHE",
        startId: "RJCC_RWY19_REPRESENTATIVE",
        finalId: "CHE",
        constructionDefaults: {
          stationId: "CHE",
          bearingType: "MAGNETIC",
          magneticVariationDeg: -9,
          dmeNm: [6.3],
        },
      }),
    ],
  }),
  chartRecord("DALBI_ONE", {
    procedureType: "RNAV_SID",
    variants: [
      pendingTracePreset({
        id: "DALBI_ONE_RWY01",
        label: "DALBI ONE RWY01 (TODO)",
        procedureId: "DALBI_ONE_RWY01",
        chartId: "DALBI_ONE",
        procedureType: "RNAV_SID",
        routeFixes: ["CC01T", "CC02T", "CC03T", "KUGIE", "POWAN", "ZALAR", "DALBI"],
        runwayIds: ["01L", "01R"],
        navSpec: "RNAV1",
      }),
      pendingTracePreset({
        id: "DALBI_ONE_RWY19",
        label: "DALBI ONE RWY19 (TODO)",
        procedureId: "DALBI_ONE_RWY19",
        chartId: "DALBI_ONE",
        procedureType: "RNAV_SID",
        routeFixes: ["NEJIE", "POWAN", "ZALAR", "DALBI"],
        runwayIds: ["19L", "19R"],
        navSpec: "RNAV1",
      }),
    ],
  }),
  chartRecord("HAKODATE_SEVEN"),
  chartRecord("HOKUTO_SEVEN"),
  chartRecord("JUGGLAR_ONE"),
  chartRecord("MUKAWA_EIGHT"),
  chartRecord("NAGANUMA_FIVE"),
  chartRecord("PATRUSH_ONE"),
  chartRecord("REZOT_TWO"),
  chartRecord("SAVIT_TWO"),
  chartRecord("SOSHU_ONE", {
    procedureType: "RNAV_SID",
    status: "verified",
    variants: [
      pendingTracePreset({
        id: "SOSHU_ONE_RWY01",
        label: "SOSHU ONE RWY01",
        procedureId: "SOSHU_ONE_RWY01",
        chartId: "SOSHU_ONE",
        procedureType: "RNAV_SID",
        status: "verified",
        pendingTrace: false,
        routeFixes: ["CC01T", "CC02T", "CC03T", "CHE"],
        runwayIds: ["01L", "01R"],
        navSpec: "RNAV1",
        endpointId: "CHE",
        anchorFrame: {
          originId: "RJCC_RWY01_REPRESENTATIVE",
          axisToId: "CHE",
          startId: "RJCC_RWY01_REPRESENTATIVE",
          finalId: "CHE",
        },
        initialDisplayClimb: {
          type: "RUNWAY_HEADING_TO_ALTITUDE_GATE",
          gateId: "SOSHU_ONE_RWY01_500FT_GATE",
          role: "runway-heading-gate",
          headingDeg: 2,
          atOrAboveFt: 500,
          displayDistanceNm: 1.2,
          displayOnly: true,
          thenDirectToFixId: "CC01T",
          label: "HDG002 / >=500",
        },
        notes: "Validated P0 RNAV display route. Initial 500FT runway-heading gate is display-only; route geometry comes from fix sequence.",
      }),
      pendingTracePreset({
        id: "SOSHU_ONE_RWY19",
        label: "SOSHU ONE RWY19",
        procedureId: "SOSHU_ONE_RWY19",
        chartId: "SOSHU_ONE",
        procedureType: "RNAV_SID",
        status: "verified",
        pendingTrace: false,
        routeFixes: ["CHE"],
        runwayIds: ["19L", "19R"],
        navSpec: "RNAV1",
        endpointId: "CHE",
        anchorFrame: {
          originId: "RJCC_RWY19_REPRESENTATIVE",
          axisToId: "CHE",
          startId: "RJCC_RWY19_REPRESENTATIVE",
          finalId: "CHE",
        },
        initialDisplayClimb: {
          type: "RUNWAY_HEADING_TO_ALTITUDE_GATE",
          gateId: "SOSHU_ONE_RWY19_500FT_GATE",
          role: "runway-heading-gate",
          headingDeg: 182,
          atOrAboveFt: 500,
          displayDistanceNm: 1.2,
          displayOnly: true,
          thenDirectToFixId: "CHE",
          label: "HDG182 / >=500",
        },
        notes: "Validated P0 RNAV display route. Initial 500FT runway-heading gate is display-only; route geometry comes from fix sequence.",
      }),
    ],
  }),
  chartRecord("TEKKO_ONE"),
  chartRecord("TOBBY_EIGHT"),
  chartRecord("TOKACHI_TWO", {
    variants: [
      pendingTracePreset({
        id: "TOKACHI_TWO_BOKSO",
        label: "TOKACHI TWO BOKSO (TODO)",
        procedureId: "TOKACHI_TWO_BOKSO",
        chartId: "TOKACHI_TWO",
        endpointId: "BOKSO",
      }),
      pendingTracePreset({
        id: "TOKACHI_TWO_RAKNO",
        label: "TOKACHI TWO RAKNO (TODO)",
        procedureId: "TOKACHI_TWO_RAKNO",
        chartId: "TOKACHI_TWO",
        endpointId: "RAKNO",
      }),
    ],
  }),
  chartRecord("YOSAN_ONE"),
  chartRecord("YUFUTSU_FIVE"),
];

export const rjccDepartureChartOptions = rjccDepartureChartManifest.map((chart) => ({
  id: chart.chartId,
  label: chart.title,
  href: chart.imageUrl,
  width: chart.width,
  height: chart.height,
  status: chart.status,
  procedureType: chart.procedureType,
}));

export const rjccDepartureAuthoringPresets = rjccDepartureChartManifest.flatMap((chart) =>
  chart.variants.map((variant) => ({
    ...variant,
    chartTitle: variant.chartTitle || `${chart.title} DEPARTURE`,
    suggestedChartFilename: variant.suggestedChartFilename || chart.filename,
  })),
);
