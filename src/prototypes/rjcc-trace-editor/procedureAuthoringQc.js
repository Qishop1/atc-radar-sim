export const QC_LEVELS = {
  OK: "ok",
  WARN: "warn",
  ERROR: "error",
};

export const QC_STATUSES = {
  READY: "READY",
  PENDING_VERIFY: "PENDING_VERIFY",
  INCOMPLETE: "INCOMPLETE",
  ERROR: "ERROR",
  VERIFIED: "VERIFIED",
};

export const VALID_AUTHORING_STATUSES = new Set([
  "chart_only",
  "pending_trace",
  "traced",
  "pending_verify",
  "verified",
  "deprecated",
]);

const INCOMPLETE_WARNING_CODES = new Set([
  "CHART_OVERLAY_EXISTS",
  "DERIVED_PROCEDURE_EXISTS",
  "ROUTE_FIXES_PRESENT_FOR_RNAV",
  "START_ID_PRESENT",
  "NAVSPEC_PRESENT",
  "RUNWAY_IDS_PRESENT",
  "STATUS_PRESENT",
]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isFinitePoint(point) {
  if (!isObject(point)) return false;
  if (Number.isFinite(point.x) && Number.isFinite(point.y)) return true;
  return Number.isFinite(point.lat) && Number.isFinite(point.lon);
}

function normalizeId(id) {
  return String(id || "").trim().toUpperCase();
}

function isRnav(input) {
  const values = [
    input?.editorState?.navSpec,
    input?.derivedProcedure?.navSpec,
    input?.procedureRoutePreview?.navSpec,
    input?.preset?.navSpec,
    input?.preset?.procedureType,
  ];
  return values.some((value) => String(value || "").toUpperCase().includes("RNAV"));
}

function isConventional(input) {
  const values = [
    input?.editorState?.navSpec,
    input?.derivedProcedure?.navSpec,
    input?.procedureRoutePreview?.navSpec,
    input?.preset?.navSpec,
  ];
  return values.some((value) => String(value || "").toUpperCase() === "CONVENTIONAL");
}

function addCheck(checks, category, level, code, message, detail = {}) {
  checks.push({ category, level, code, message, detail });
}

function resolveWaypoint(id, input) {
  if (!id) return null;
  const normalized = normalizeId(id);
  const lookup = input?.waypointLookup || {};
  const snapTargets = input?.snapTargets || [];
  return lookup[id]
    || lookup[normalized]
    || snapTargets.find((target) => normalizeId(target.id) === normalized)
    || null;
}

function duplicateIds(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function diagnosticsHaveId(duplicates = [], id) {
  const normalized = normalizeId(id);
  return duplicates.some((item) => normalizeId(item.id) === normalized);
}

function routePointIds(input) {
  const previewPoints = input?.procedureRoutePreview?.points || [];
  if (previewPoints.length) return previewPoints.map((point) => point.id).filter(Boolean);
  return (input?.editorState?.points || []).map((point) => point.id).filter(Boolean);
}

function checkIdentity(checks, input) {
  const { preset, editorState = {}, registries = {} } = input;
  const presetId = preset?.id || editorState.presetId;
  const procedureId = editorState.procedureId || preset?.procedureId || presetId;

  addCheck(checks, "Identity", presetId ? "ok" : "error", "PRESET_ID_PRESENT", presetId ? `Preset id ${presetId} present.` : "Preset id is missing.", { presetId });
  addCheck(checks, "Identity", procedureId ? "ok" : "error", "PROCEDURE_ID_PRESENT", procedureId ? `Procedure id ${procedureId} present.` : "Procedure id is missing.", { procedureId });
  const expectedProcedureId = preset?.procedureId || presetId;
  addCheck(
    checks,
    "Identity",
    !expectedProcedureId || !procedureId || normalizeId(expectedProcedureId) === normalizeId(procedureId) ? "ok" : "error",
    "PRESET_PROCEDURE_ID_MATCH",
    !expectedProcedureId || !procedureId || normalizeId(expectedProcedureId) === normalizeId(procedureId) ? "Preset id and procedure id match." : `Preset expects ${expectedProcedureId}, but current procedure id is ${procedureId}.`,
    { presetId, expectedProcedureId, procedureId },
  );

  addCheck(
    checks,
    "Identity",
    preset ? "ok" : "warn",
    "MANIFEST_ENTRY_EXISTS",
    preset ? "Manifest preset found." : "No manifest preset found for this procedure.",
    { presetId },
  );

  const displayProcedure = input?.derivedProcedure || input?.procedureEntry || null;
  addCheck(
    checks,
    "Identity",
    displayProcedure ? "ok" : "warn",
    "DERIVED_PROCEDURE_EXISTS",
    displayProcedure ? "Display procedure entry is available for JAIP." : "No derived or explicit display procedure entry was found yet.",
    { procedureId, displayProcedureId: displayProcedure?.id || null },
  );

  const duplicateProcedureIds = duplicateIds(registries.procedureIds || []);
  addCheck(
    checks,
    "Identity",
    duplicateProcedureIds.includes(procedureId) ? "error" : "ok",
    "UNIQUE_PROCEDURE_ID",
    duplicateProcedureIds.includes(procedureId) ? `Duplicate procedure id ${procedureId} found.` : "Procedure id is unique in current options.",
    { procedureId, duplicateProcedureIds },
  );

  const manualDuplicates = registries.manualPreviewDiagnostics?.duplicates || [];
  const overlayDuplicates = registries.chartOverlayDiagnostics?.duplicates || [];
  addCheck(
    checks,
    "Identity",
    diagnosticsHaveId(manualDuplicates, procedureId) ? "error" : "ok",
    "UNIQUE_MANUAL_PREVIEW_ID",
    diagnosticsHaveId(manualDuplicates, procedureId) ? `Duplicate manual preview id ${procedureId} found.` : "No duplicate manual preview id for this procedure.",
    { duplicates: manualDuplicates.filter((item) => normalizeId(item.id) === normalizeId(procedureId)) },
  );
  addCheck(
    checks,
    "Identity",
    diagnosticsHaveId(overlayDuplicates, editorState.chartId || preset?.chartId) ? "error" : "ok",
    "UNIQUE_CHART_OVERLAY_ID",
    diagnosticsHaveId(overlayDuplicates, editorState.chartId || preset?.chartId) ? "Duplicate chart overlay id/chart id found." : "No duplicate chart overlay id for this chart.",
    { duplicates: overlayDuplicates },
  );

  addCheck(
    checks,
    "Identity",
    manualDuplicates.length || overlayDuplicates.length ? "warn" : "ok",
    "DUPLICATE_ID_WARNINGS",
    manualDuplicates.length || overlayDuplicates.length ? "Registry duplicate warnings exist." : "No registry duplicate warnings.",
    { manualDuplicates, overlayDuplicates },
  );
}

function checkChart(checks, input) {
  const { editorState = {}, chartAsset, chartOverlay } = input;
  const chartId = editorState.chartId || editorState.selectedChartId || input?.preset?.chartId;
  addCheck(checks, "Chart", chartId ? "ok" : "error", "CHART_ID_PRESENT", chartId ? `Chart id ${chartId} present.` : "Chart id is missing.", { chartId });
  addCheck(
    checks,
    "Chart",
    chartAsset ? "ok" : "error",
    "CHART_ASSET_EXISTS",
    chartAsset ? "Chart asset found in RJCC chart manifest/options." : "Chart asset was not found in RJCC chart manifest/options.",
    { chartId, chartAsset },
  );

  const draftOverlay = editorState.overlay && editorState.overlay.imageUrl;
  addCheck(
    checks,
    "Chart",
    chartOverlay || draftOverlay ? "ok" : "warn",
    "CHART_OVERLAY_EXISTS",
    chartOverlay ? "Saved chart overlay found." : draftOverlay ? "No saved chart overlay found. Current draft overlay can still be exported." : "No saved chart overlay or current draft overlay found.",
    { chartId, chartOverlayId: chartOverlay?.id || null },
  );
  if (!chartOverlay) {
    addCheck(
      checks,
      "Chart",
      "warn",
      "NO_SAVED_CHART_OVERLAY",
      draftOverlay ? "No saved chart overlay found. Current draft overlay can still be exported." : "No saved chart overlay found.",
      { chartId, hasDraftOverlay: Boolean(draftOverlay) },
    );
  }

  const overlayChartId = chartOverlay?.chartId || editorState.overlay?.chartId;
  addCheck(
    checks,
    "Chart",
    !overlayChartId || !chartId || overlayChartId === chartId ? "ok" : "warn",
    "CHART_OVERLAY_ID_MATCH",
    !overlayChartId || !chartId || overlayChartId === chartId ? "Chart overlay id matches chart id where available." : `Chart overlay chartId ${overlayChartId} differs from expected ${chartId}.`,
    { chartId, overlayChartId },
  );

  addCheck(checks, "Chart", "ok", "CHART_REFERENCE_ONLY", "Chart overlay is reference/ghost geometry only; route geometry should come from fixes or manual display trace.", { chartId });
}

function checkRoute(checks, input) {
  const { editorState = {}, procedureRoutePreview } = input;
  const rnav = isRnav(input);
  const routeFixes = editorState.routeFixes || [];
  const traceType = String(editorState.traceType || procedureRoutePreview?.traceType || "").toUpperCase();
  const routeIds = routePointIds(input);
  const startId = editorState.startId || editorState.anchorFrame?.startId || null;
  const finalId = editorState.finalId || editorState.anchorFrame?.finalId || null;
  const firstRouteFix = routeFixes[0] || null;
  const lastRouteFix = routeFixes.at(-1) || null;

  if (rnav) {
    addCheck(
      checks,
      "Route",
      routeFixes.length || (traceType.includes("SOLID") && (editorState.points || []).length >= 2) ? "ok" : "error",
      "ROUTE_FIXES_PRESENT_FOR_RNAV",
      routeFixes.length ? `${routeFixes.length} RNAV route fixes present.` : "RNAV route has no routeFixes or generated solid display route.",
      { routeFixes },
    );
  }

  const unresolved = routeFixes.filter((fixId) => !resolveWaypoint(fixId, input));
  addCheck(
    checks,
    "Route",
    unresolved.length ? "error" : "ok",
    "ROUTE_FIXES_RESOLVE",
    unresolved.length ? `Unresolved route fixes: ${unresolved.join(", ")}.` : `All ${routeFixes.length} route fixes resolved.`,
    { unresolved, routeFixes },
  );

  const nonFinite = routeFixes.filter((fixId) => {
    const waypoint = resolveWaypoint(fixId, input);
    return waypoint && !(Number.isFinite(waypoint.lat) && Number.isFinite(waypoint.lon));
  });
  addCheck(checks, "Route", nonFinite.length ? "error" : "ok", "ROUTE_FIXES_FINITE_COORDS", nonFinite.length ? `Route fixes without finite coordinates: ${nonFinite.join(", ")}.` : "All resolved route fixes have finite coordinates.", { nonFinite });

  const consecutiveDuplicates = routeFixes.filter((fixId, index) => index > 0 && fixId === routeFixes[index - 1]);
  addCheck(checks, "Route", consecutiveDuplicates.length ? "warn" : "ok", "ROUTE_FIXES_NO_DUPLICATES", consecutiveDuplicates.length ? `Suspicious consecutive duplicate fixes: ${consecutiveDuplicates.join(", ")}.` : "No consecutive duplicate route fixes.", { consecutiveDuplicates });

  addCheck(checks, "Route", startId ? "ok" : rnav ? "warn" : "ok", "START_ID_PRESENT", startId ? `Start id ${startId} present.` : "Start id is missing.", { startId });
  const startWaypoint = startId ? resolveWaypoint(startId, input) : null;
  addCheck(checks, "Route", !startId || startWaypoint ? "ok" : "error", "START_ID_RESOLVES", !startId || startWaypoint ? "Start id resolves when present." : `Start id ${startId} could not be resolved.`, { startId });

  addCheck(checks, "Route", finalId ? "ok" : "warn", "FINAL_ID_PRESENT", finalId ? `Final id ${finalId} present.` : "Final/endpoint id is missing; last routeFix will be used for route display.", { finalId });
  addCheck(
    checks,
    "Route",
    !finalId || !lastRouteFix || normalizeId(finalId) === normalizeId(lastRouteFix) ? "ok" : "warn",
    "FINAL_ID_MATCHES_LAST_ROUTE_FIX",
    !finalId || !lastRouteFix || normalizeId(finalId) === normalizeId(lastRouteFix) ? "Final id matches the last route fix where applicable." : `Final id ${finalId} differs from last route fix ${lastRouteFix}.`,
    { finalId, lastRouteFix },
  );

  if (rnav) {
    const approximateSegments = procedureRoutePreview?.approximateSegments || [];
    addCheck(checks, "Route", approximateSegments.length ? "error" : "ok", "RNAV_NO_APPROX_ARC", approximateSegments.length ? "RNAV route produced approximate curved segments." : "RNAV route has no approximate curved geometry.", { approximateSegmentCount: approximateSegments.length });
    addCheck(checks, "Route", traceType.includes("SOLID") || procedureRoutePreview?.traceType === "route-solid" ? "ok" : "error", "RNAV_SOLID_ROUTE", traceType.includes("SOLID") || procedureRoutePreview?.traceType === "route-solid" ? "RNAV display route is solid." : "RNAV display route is not marked route-solid.", { traceType: editorState.traceType, previewTraceType: procedureRoutePreview?.traceType });
    addCheck(
      checks,
      "Route",
      startId && firstRouteFix && routeIds[0] === startId && routeIds[1] === firstRouteFix ? "ok" : startId && routeIds.includes(startId) ? "warn" : "warn",
      "RNAV_START_CONNECTOR_PRESENT",
      startId && firstRouteFix && routeIds[0] === startId && routeIds[1] === firstRouteFix ? "RNAV start connector precedes first route fix." : "RNAV start connector could not be confirmed in the route point sequence.",
      { startId, firstRouteFix, routeIds: routeIds.slice(0, 6) },
    );
    addCheck(checks, "Route", routeIds.length >= 2 || routeFixes.length >= 2 ? "ok" : "error", "RNAV_ROUTE_HAS_MIN_POINTS", routeIds.length >= 2 || routeFixes.length >= 2 ? "RNAV route has at least two display points." : "RNAV route has fewer than two display points.", { pointCount: routeIds.length, routeFixCount: routeFixes.length });
  }
}

function checkConventional(checks, input) {
  if (!isConventional(input)) return;
  const { editorState = {}, manualPreview, procedureRoutePreview } = input;
  const traceType = String(editorState.traceType || manualPreview?.traceType || "").toUpperCase();
  addCheck(checks, "Conventional", traceType.includes("APPROX") || manualPreview?.approximate !== false ? "ok" : "warn", "CONVENTIONAL_APPROX_MARKED", "Conventional preview is allowed to use approximate/manual trace geometry.", { traceType });
  addCheck(checks, "Conventional", "ok", "CONVENTIONAL_CAN_USE_MANUAL_TRACE", "Manual trace is allowed for conventional SID preview.", {});
  addCheck(checks, "Conventional", "ok", "APPROX_SEGMENTS_NOT_AUTHORITATIVE", "Approximate segments are display-only and not authoritative.", { approximateSegmentCount: procedureRoutePreview?.approximateSegments?.length || 0 });
}

function checkManualPreview(checks, input) {
  const { editorState = {}, manualPreview } = input;
  const currentPoints = editorState.points || [];
  const savedPoints = manualPreview?.points || manualPreview?.rawProjectedPoints || [];
  addCheck(checks, "Manual Preview", manualPreview ? "ok" : currentPoints.length ? "warn" : "warn", "MANUAL_PREVIEW_EXISTS", manualPreview ? "Saved manual preview found." : currentPoints.length ? "Current draft has preview points but no saved manual preview file yet." : "No saved manual preview found.", { manualPreviewId: manualPreview?.id || null });

  const pointArraysValid = (!manualPreview || Array.isArray(manualPreview.points || manualPreview.rawProjectedPoints || [])) && Array.isArray(currentPoints);
  addCheck(checks, "Manual Preview", pointArraysValid ? "ok" : "error", "MANUAL_PREVIEW_POINTS_VALID", pointArraysValid ? "Manual preview point arrays are valid." : "Manual preview point fields are not arrays.", {});

  const allPoints = [...savedPoints, ...currentPoints];
  const invalidPoints = allPoints.filter((point) => !isFinitePoint(point));
  addCheck(checks, "Manual Preview", invalidPoints.length ? "error" : "ok", "MANUAL_PREVIEW_POINTS_FINITE", invalidPoints.length ? "Some manual preview points are not finite." : "Manual preview points are finite where present.", { invalidCount: invalidPoints.length });

  addCheck(checks, "Manual Preview", editorState.traceType || manualPreview?.traceType ? "ok" : "warn", "MANUAL_PREVIEW_TRACE_TYPE_PRESENT", editorState.traceType || manualPreview?.traceType ? "Trace type is present." : "No traceType found; renderer will infer a fallback.", { traceType: editorState.traceType || manualPreview?.traceType || null });

  const anchorFrame = editorState.anchorFrame || manualPreview?.anchorFrame || {};
  const invalidAnchorValues = ["startId", "finalId", "axisToId"].filter((key) => anchorFrame[key] != null && typeof anchorFrame[key] !== "string");
  addCheck(checks, "Manual Preview", invalidAnchorValues.length ? "error" : "ok", "MANUAL_PREVIEW_ANCHOR_FRAME_VALID", invalidAnchorValues.length ? `Invalid anchor frame fields: ${invalidAnchorValues.join(", ")}.` : "Manual preview anchor frame values are valid strings/null.", { anchorFrame });

  try {
    JSON.stringify(editorState.exportPayload || editorState);
    addCheck(checks, "Manual Preview", "ok", "MANUAL_PREVIEW_EXPORTABLE", "Current editor state can be serialized.", {});
  } catch (error) {
    addCheck(checks, "Manual Preview", "error", "MANUAL_PREVIEW_EXPORTABLE", "Current editor state cannot be serialized.", { error: String(error) });
  }
}

function checkDraft(checks, input) {
  const { draft, draftError, editorState = {} } = input;
  addCheck(checks, "Draft", draft ? "ok" : "warn", "DRAFT_EXISTS", draft ? "Local draft exists for current preset." : "No local draft exists for current preset.", { presetId: editorState.presetId });
  addCheck(checks, "Draft", draftError ? "error" : "ok", "DRAFT_SCHEMA_VALID", draftError ? `Draft schema problem: ${draftError}` : "Draft schema is valid or no draft is present.", { draftError });
  addCheck(checks, "Draft", !draft || !draft.presetId || normalizeId(draft.presetId) === normalizeId(editorState.presetId) ? "ok" : "error", "DRAFT_PRESET_MATCH", !draft || !draft.presetId || normalizeId(draft.presetId) === normalizeId(editorState.presetId) ? "Draft preset matches selected preset." : "Draft preset does not match selected preset.", { draftPresetId: draft?.presetId, selectedPresetId: editorState.presetId });
  try {
    JSON.stringify(draft || editorState);
    addCheck(checks, "Draft", "ok", "DRAFT_EXPORTABLE", "Draft/editor state can be serialized.", {});
  } catch (error) {
    addCheck(checks, "Draft", "error", "DRAFT_EXPORTABLE", "Draft/editor state cannot be serialized.", { error: String(error) });
  }
}

function checkDisplaySafety(checks, input) {
  const { derivedProcedure, editorState = {} } = input;
  const candidate = derivedProcedure || editorState.exportPayload || {};
  addCheck(checks, "Display Safety", candidate.displayOnly === true || editorState.displayOnly === true ? "ok" : "warn", "DISPLAY_ONLY_TRUE_FOR_DERIVED", "Display procedure should be marked displayOnly.", { displayOnly: candidate.displayOnly ?? editorState.displayOnly });
  addCheck(checks, "Display Safety", candidate.guidanceEnabled === false || editorState.guidanceEnabled === false ? "ok" : "warn", "GUIDANCE_DISABLED_FOR_DERIVED", "Display procedure should have guidance disabled.", { guidanceEnabled: candidate.guidanceEnabled ?? editorState.guidanceEnabled });
  addCheck(checks, "Display Safety", candidate.legs == null || candidate.displayOnly === true ? "ok" : "warn", "LEGS_NULL_OR_DISPLAY_ONLY", "Legs are null or display-only.", { legs: candidate.legs ?? null });
  addCheck(checks, "Display Safety", candidate.guidanceEnabled !== true && editorState.aircraftGuidanceEnabled !== true ? "ok" : "error", "NO_AIRCRAFT_GUIDANCE_FIELDS_ENABLED", "No aircraft guidance fields are enabled.", {});
  addCheck(checks, "Display Safety", !candidate.gameplayBinding && !editorState.gameplayBinding ? "ok" : "error", "NO_GAMEPLAY_BINDING", "No gameplay binding is attached to this display procedure.", {});
}

function checkMetadata(checks, input) {
  const { preset, editorState = {}, derivedProcedure } = input;
  const source = editorState.source || preset?.source || derivedProcedure?.source || null;
  const status = editorState.status || preset?.status || derivedProcedure?.status || null;
  const navSpec = editorState.navSpec || preset?.navSpec || derivedProcedure?.navSpec || null;
  const runwayIds = editorState.runwayIds || preset?.runwayIds || derivedProcedure?.runwayIds || [];
  const airacCycle = editorState.airac_cycle ?? preset?.airac_cycle ?? derivedProcedure?.airac_cycle ?? null;

  addCheck(checks, "Metadata", navSpec ? "ok" : "warn", "NAVSPEC_PRESENT", navSpec ? `navSpec ${navSpec} present.` : "navSpec is missing.", { navSpec });
  addCheck(checks, "Metadata", runwayIds.length ? "ok" : "warn", "RUNWAY_IDS_PRESENT", runwayIds.length ? `${runwayIds.length} runway ids present.` : "runwayIds are missing.", { runwayIds });
  addCheck(checks, "Metadata", source ? "ok" : "warn", "SOURCE_PRESENT", source ? "Source metadata present." : "Source metadata is missing.", { source });
  addCheck(checks, "Metadata", airacCycle ? "ok" : "warn", "AIRAC_CYCLE_PRESENT_OR_WARN", airacCycle ? "AIRAC cycle metadata present." : "AIRAC cycle metadata is missing or null.", { airac_cycle: airacCycle });
  addCheck(checks, "Metadata", status ? "ok" : "warn", "STATUS_PRESENT", status ? `Status ${status} present.` : "Status is missing.", { status });
  addCheck(checks, "Metadata", !status || VALID_AUTHORING_STATUSES.has(status) ? "ok" : "error", "STATUS_VALID", !status || VALID_AUTHORING_STATUSES.has(status) ? "Status value is allowed." : `Status ${status} is not allowed.`, { status, allowedStatuses: [...VALID_AUTHORING_STATUSES] });
}

export function summarizeQcChecks(checks = []) {
  return checks.reduce((summary, check) => {
    summary[check.level] = (summary[check.level] || 0) + 1;
    return summary;
  }, { ok: 0, warn: 0, error: 0 });
}

export function getQcStatus(checks = [], input = {}) {
  if (checks.some((check) => check.level === "error")) return QC_STATUSES.ERROR;
  if (checks.some((check) => check.level === "warn" && INCOMPLETE_WARNING_CODES.has(check.code))) return QC_STATUSES.INCOMPLETE;
  const status = input?.editorState?.status || input?.preset?.status || input?.derivedProcedure?.status || "";
  if (status === "verified") return QC_STATUSES.VERIFIED;
  if (checks.some((check) => check.level === "warn")) return QC_STATUSES.PENDING_VERIFY;
  return status === "pending_verify" || status === "traced" || status === "pending_trace" ? QC_STATUSES.PENDING_VERIFY : QC_STATUSES.READY;
}

export function runProcedureAuthoringQc(input = {}) {
  const checks = [];
  checkIdentity(checks, input);
  checkChart(checks, input);
  checkRoute(checks, input);
  checkConventional(checks, input);
  checkManualPreview(checks, input);
  checkDraft(checks, input);
  checkDisplaySafety(checks, input);
  checkMetadata(checks, input);

  const summary = summarizeQcChecks(checks);
  const status = getQcStatus(checks, input);
  return {
    presetId: input?.preset?.id || input?.editorState?.presetId || null,
    procedureId: input?.editorState?.procedureId || input?.preset?.procedureId || null,
    status,
    summary,
    checks,
  };
}

export function formatQcReport(report) {
  const checksByLevel = (level) => (report?.checks || []).filter((check) => check.level === level);
  const lines = [
    "RJCC Procedure Authoring QC Report",
    `Preset: ${report?.presetId || "unknown"}`,
    `Procedure: ${report?.procedureId || "unknown"}`,
    `Status: ${report?.status || "UNKNOWN"}`,
    `Summary: ${report?.summary?.ok || 0} OK / ${report?.summary?.warn || 0} WARN / ${report?.summary?.error || 0} ERROR`,
    "",
  ];
  for (const [label, level] of [["ERROR", "error"], ["WARN", "warn"], ["OK", "ok"]]) {
    const checks = checksByLevel(level);
    if (!checks.length) continue;
    lines.push(`${label}:`);
    checks.forEach((check) => lines.push(`- ${check.code}: ${check.message}`));
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function formatQcJson(report) {
  return JSON.stringify(report, null, 2);
}

export function unresolvedFixesFromQc(report) {
  return [...new Set((report?.checks || [])
    .filter((check) => check.code === "ROUTE_FIXES_RESOLVE")
    .flatMap((check) => check.detail?.unresolved || []))];
}

export function formatExportReadinessSummary(report) {
  if (!report) return "QC has not run.";
  if (report.status === QC_STATUSES.ERROR) return `Export allowed, but QC has errors (${report.summary.error}).`;
  if ((report.summary.warn || 0) > 0) return `Export allowed with warnings (${report.summary.warn}). QC status: ${report.status}.`;
  return `Export-ready. QC status: ${report.status}.`;
}
