import { rjccDepartureAuthoringPresets } from "../../airports/rjcc/departureChartManifest.js";
import { chartOverlays, chartOverlaysByChartId } from "./chartOverlays.js";
import { manualProcedurePreviews } from "./manualProcedurePreviews.js";

function explicitProcedureIds(procedures = []) {
  const ids = new Set();
  for (const procedure of procedures) {
    if (procedure?.id) ids.add(procedure.id);
    for (const variant of procedure?.variants || []) {
      if (variant?.id) ids.add(variant.id);
    }
  }
  return ids;
}

function normalizeRouteFix(ref) {
  if (typeof ref === "string") return ref;
  return ref?.id || ref?.fixId || ref?.navaidId || ref?.airportId || "";
}

function routeFixesFrom(preview, preset) {
  const routeFixes = [
    ...(preview?.routeFixes || []),
    ...(preset?.routeFixes || []),
  ].map(normalizeRouteFix).filter(Boolean);
  return [...new Set(routeFixes)];
}

function legsFromRouteFixes(routeFixes) {
  return routeFixes.map((fixId, index) => ({
    type: index === 0 ? "HEADING_TO_FIX" : "FIX",
    fixId,
    notes: index === 0
      ? "P0 display preview uses first route fix as the initial endpoint; this is not aircraft guidance."
      : "P0 display fix-to-fix route leg; not aircraft guidance.",
  }));
}

function chartTitleFromId(chartId) {
  return String(chartId || "").replace(/_/g, " ");
}

function navSpecForPreset(preset, preview, routeFixes) {
  if (preview?.navSpec) return preview.navSpec;
  if (preset?.navSpec) return preset.navSpec;
  if (routeFixes.length || preset?.procedureType === "RNAV_SID") return "RNAV1";
  return null;
}

function buildDerivedProcedure(preset) {
  const id = preset.procedureId || preset.id;
  const preview = manualProcedurePreviews[id] || null;
  const overlay = chartOverlays[id] || chartOverlaysByChartId[preset.chartId] || null;
  const routeFixes = routeFixesFrom(preview, preset);

  if (!preview && !routeFixes.length) return null;

  const navSpec = navSpecForPreset(preset, preview, routeFixes);
  return {
    id,
    name: preset.label?.replace(" (TODO)", "") || `${chartTitleFromId(preset.chartId)} DISPLAY`,
    type: "SID",
    navSpec,
    airportId: "RJCC",
    runwayIds: preview?.runwayIds || preset.runwayIds || [],
    source: preview?.source || preset.source || "rjcc-procedure-authoring-p0-derived",
    airac_cycle: preview?.airac_cycle ?? preset.airac_cycle ?? null,
    status: preview ? "traced" : preset.status || "pending_trace",
    displayOnly: true,
    guidanceEnabled: false,
    legs: null,
    routeFixes,
    chartId: preset.chartId,
    presetId: preset.id,
    procedureId: id,
    manualPreviewId: preview?.id || null,
    chartOverlayId: overlay?.id || null,
    segments: routeFixes.length ? [{ id: "display-route", legs: legsFromRouteFixes(routeFixes) }] : [],
    notes: [
      "Derived P0 display-only procedure from RJCC departure authoring manifest.",
      "Not aircraft guidance. Not P2 procedure-leg semantics.",
      preview ? "Manual preview file is available." : "No manual preview file is available.",
      routeFixes.length ? "Route preview is generated from routeFixes." : "No routeFixes are available.",
    ],
  };
}

function presetFromPreview(preview) {
  const id = preview.procedureId || preview.id || preview.presetId;
  const chartId = preview.overlay?.chartId || preview.chartId || id;
  return {
    id,
    procedureId: id,
    label: preview.name || id,
    chartId,
    runwayIds: preview.runwayIds || [],
    navSpec: preview.navSpec || null,
    status: preview.status || "traced",
    routeFixes: preview.routeFixes || [],
    source: preview.source || "manual preview",
    airac_cycle: preview.airac_cycle ?? null,
  };
}

export function buildDerivedDepartureProcedures(explicitDepartures = []) {
  const explicitIds = explicitProcedureIds(explicitDepartures);
  const diagnostics = {
    skippedExplicitIds: [],
    duplicateDerivedIds: [],
  };
  const seen = new Set();
  const derived = [];

  for (const preset of rjccDepartureAuthoringPresets) {
    const id = preset.procedureId || preset.id;
    if (!id) continue;
    if (explicitIds.has(id)) {
      diagnostics.skippedExplicitIds.push(id);
      continue;
    }
    if (seen.has(id)) {
      diagnostics.duplicateDerivedIds.push(id);
      continue;
    }
    seen.add(id);
    const procedure = buildDerivedProcedure(preset);
    if (procedure) derived.push(procedure);
  }

  for (const preview of Object.values(manualProcedurePreviews)) {
    const id = preview.procedureId || preview.id || preview.presetId;
    if (!id || explicitIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const procedure = buildDerivedProcedure(presetFromPreview(preview));
    if (procedure) derived.push(procedure);
  }

  return { procedures: derived, diagnostics };
}
