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

export const QC_CATEGORY_LABELS = {
  Identity: "身份",
  Chart: "航图",
  Route: "路线",
  Conventional: "传统程序",
  "Manual Preview": "手动预览",
  Draft: "草稿",
  "Display Safety": "显示安全",
  Metadata: "元数据",
};

export const QC_LEVEL_LABELS = {
  ok: "通过",
  warn: "警告",
  error: "错误",
};

export const QC_STATUS_LABELS = {
  READY: "可导出",
  PENDING_VERIFY: "待复核",
  INCOMPLETE: "未完成",
  ERROR: "有错误",
  VERIFIED: "已验证",
};

const INCOMPLETE_WARNING_CODES = new Set([
  "DERIVED_PROCEDURE_EXISTS",
  "ROUTE_FIXES_PRESENT_FOR_RNAV",
  "START_ID_PRESENT",
  "NAVSPEC_PRESENT",
  "RUNWAY_IDS_PRESENT",
  "STATUS_PRESENT",
]);

function formatIdList(values = []) {
  return values.filter(Boolean).join(", ") || "无";
}

export function getQcCategoryLabel(category) {
  return QC_CATEGORY_LABELS[category] || category || "其他";
}

export function getQcLevelLabel(level) {
  return QC_LEVEL_LABELS[level] || level || "未知";
}

export function getQcStatusLabel(status) {
  return QC_STATUS_LABELS[status] || status || "未知";
}

export function formatQcStatus(status) {
  const label = getQcStatusLabel(status);
  return status && label !== status ? `${label} (${status})` : label;
}

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

export function getQcCheckMessage(check = {}) {
  const detail = check.detail || {};
  switch (check.code) {
    case "PRESET_ID_PRESENT":
      return check.level === "ok" ? `预设 ID ${detail.presetId} 已设置。` : "缺少预设 ID。";
    case "PROCEDURE_ID_PRESENT":
      return check.level === "ok" ? `程序 ID ${detail.procedureId} 已设置。` : "缺少程序 ID。";
    case "PRESET_PROCEDURE_ID_MATCH":
      return check.level === "ok" ? "预设 ID 与当前程序 ID 匹配。" : `预设期望 ${detail.expectedProcedureId}，但当前程序 ID 是 ${detail.procedureId}。`;
    case "MANIFEST_ENTRY_EXISTS":
      return check.level === "ok" ? "已找到清单预设。" : "当前程序没有匹配的清单预设。";
    case "DERIVED_PROCEDURE_EXISTS":
      return check.level === "ok" ? "JAIP 可用的显示程序条目已存在。" : "还没有找到派生或显式显示程序条目。";
    case "UNIQUE_PROCEDURE_ID":
      return check.level === "ok" ? "当前程序 ID 没有重复。" : `发现重复程序 ID：${detail.procedureId}。`;
    case "UNIQUE_MANUAL_PREVIEW_ID":
      return check.level === "ok" ? "当前程序没有重复的手动预览 ID。" : `发现重复手动预览 ID：${detail.duplicates?.map((item) => item.id).join(", ") || detail.procedureId}。`;
    case "UNIQUE_CHART_OVERLAY_ID":
      return check.level === "ok" ? "当前航图没有重复的 overlay ID / chartId。" : "发现重复航图 overlay ID / chartId。";
    case "DUPLICATE_ID_WARNINGS":
      return check.level === "ok" ? "注册表没有重复 ID 警告。" : "注册表存在重复 ID 警告。";
    case "CHART_ID_PRESENT":
      return check.level === "ok" ? `航图 ID ${detail.chartId} 已设置。` : "缺少航图 ID。";
    case "CHART_ASSET_EXISTS":
      return check.level === "ok" ? "已在 RJCC 航图清单中找到航图资源。" : "RJCC 航图清单中找不到该航图资源。";
    case "CHART_OVERLAY_EXISTS":
      if (check.level === "ok" && detail.chartOverlayId) return "已找到保存的航图 overlay。";
      if (check.level === "ok") return "当前草稿已有航图 overlay，可导出保存。";
      return "没有保存的航图 overlay，也没有当前草稿 overlay。";
    case "NO_SAVED_CHART_OVERLAY":
      return detail.hasDraftOverlay ? "没有保存的航图 overlay；当前草稿 overlay 仍可导出。" : "没有保存的航图 overlay。";
    case "CHART_OVERLAY_ID_MATCH":
      return check.level === "ok" ? "航图 overlay 的 chartId 与预期匹配。" : `航图 overlay chartId ${detail.overlayChartId} 与预期 ${detail.chartId} 不一致。`;
    case "CHART_REFERENCE_ONLY":
      return "航图 overlay 仅作参考/ghost；路线几何应来自航点或手动显示轨迹。";
    case "ROUTE_FIXES_PRESENT_FOR_RNAV":
      return check.level === "ok" ? `RNAV 路线已有 ${detail.routeFixes?.length || 0} 个 routeFix。` : "RNAV 路线缺少 routeFixes 或生成的实体显示路线。";
    case "ROUTE_FIXES_RESOLVE":
      return check.level === "ok" ? `全部 ${detail.routeFixes?.length || 0} 个 routeFix 均可解析。` : `未解析 routeFix：${formatIdList(detail.unresolved)}。`;
    case "ROUTE_FIXES_FINITE_COORDS":
      return check.level === "ok" ? "已解析 routeFix 均有有效坐标。" : `以下 routeFix 坐标无效：${formatIdList(detail.nonFinite)}。`;
    case "ROUTE_FIXES_NO_DUPLICATES":
      return check.level === "ok" ? "routeFix 列表没有连续重复项。" : `发现可疑连续重复 fix：${formatIdList(detail.consecutiveDuplicates)}。`;
    case "START_ID_PRESENT":
      return check.level === "ok" ? `起点 ID ${detail.startId} 已设置。` : "缺少起点 ID。";
    case "START_ID_RESOLVES":
      return check.level === "ok" ? "起点 ID 可解析。" : `起点 ID ${detail.startId} 无法解析。`;
    case "FINAL_ID_PRESENT":
      return check.level === "ok" ? `终点 ID ${detail.finalId} 已设置。` : "缺少终点/endpoint ID；显示路线会使用最后一个 routeFix。";
    case "FINAL_ID_MATCHES_LAST_ROUTE_FIX":
      return check.level === "ok" ? "终点 ID 与最后一个 routeFix 匹配。" : `终点 ID ${detail.finalId} 与最后一个 routeFix ${detail.lastRouteFix} 不一致。`;
    case "RNAV_NO_APPROX_ARC":
      return check.level === "ok" ? "RNAV 路线没有生成近似曲线/大弧。" : "RNAV 路线生成了近似曲线段。";
    case "RNAV_SOLID_ROUTE":
      return check.level === "ok" ? "RNAV 显示路线已标记为实体路线。" : "RNAV 显示路线没有标记为 route-solid。";
    case "RNAV_START_CONNECTOR_PRESENT":
      return check.level === "ok" ? "RNAV 起点连接段位于第一个 routeFix 前。" : "无法确认 RNAV 起点连接段是否在路线点序列中。";
    case "RNAV_INITIAL_HEADING_GATE_PRESENT":
      return check.level === "ok" ? "RNAV 初始跑道航向 500FT gate 已出现在显示点序列中。" : "未确认 RNAV 初始跑道航向 gate；请检查 initialDisplayClimb 元数据。";
    case "RNAV_ROUTE_HAS_MIN_POINTS":
      return check.level === "ok" ? "RNAV 路线至少有两个显示点。" : "RNAV 路线少于两个显示点。";
    case "CONVENTIONAL_APPROX_MARKED":
      return "传统 SID 允许使用近似/手动画线显示。";
    case "CONVENTIONAL_CAN_USE_MANUAL_TRACE":
      return "传统 SID 预览允许使用手动轨迹。";
    case "APPROX_SEGMENTS_NOT_AUTHORITATIVE":
      return "近似几何仅用于显示，不是权威导航数据。";
    case "MANUAL_PREVIEW_EXISTS":
      if (check.level === "ok") return "已找到保存的手动预览。";
      return "没有保存的手动预览；当前草稿仍可继续编辑/导出。";
    case "MANUAL_PREVIEW_POINTS_VALID":
      return check.level === "ok" ? "手动预览点数组结构有效。" : "手动预览点字段不是数组。";
    case "MANUAL_PREVIEW_POINTS_FINITE":
      return check.level === "ok" ? "手动预览点坐标有效。" : "部分手动预览点坐标不是有限数值。";
    case "MANUAL_PREVIEW_TRACE_TYPE_PRESENT":
      return check.level === "ok" ? "traceType 已设置。" : "缺少 traceType；渲染器会推断默认类型。";
    case "MANUAL_PREVIEW_ANCHOR_FRAME_VALID":
      return check.level === "ok" ? "手动预览 anchor frame 字段有效。" : `anchor frame 字段无效：${formatIdList(detail.invalidAnchorValues)}。`;
    case "MANUAL_PREVIEW_EXPORTABLE":
      return check.level === "ok" ? "当前编辑状态可以序列化导出。" : "当前编辑状态无法序列化。";
    case "DRAFT_EXISTS":
      return check.level === "ok" ? "当前预设存在本地草稿。" : "当前预设没有本地草稿。";
    case "DRAFT_SCHEMA_VALID":
      return check.level === "ok" ? "草稿 schema 有效，或没有草稿。" : `草稿 schema 存在问题：${detail.draftError}。`;
    case "DRAFT_PRESET_MATCH":
      return check.level === "ok" ? "草稿 presetId 与当前预设匹配。" : "草稿 presetId 与当前预设不匹配。";
    case "DRAFT_EXPORTABLE":
      return check.level === "ok" ? "草稿/编辑状态可以序列化。" : "草稿/编辑状态无法序列化。";
    case "DISPLAY_ONLY_TRUE_FOR_DERIVED":
      return check.level === "ok" ? "显示程序已标记 displayOnly。" : "显示程序应标记为 displayOnly。";
    case "GUIDANCE_DISABLED_FOR_DERIVED":
      return check.level === "ok" ? "显示程序已禁用 guidance。" : "显示程序应禁用 guidance。";
    case "LEGS_NULL_OR_DISPLAY_ONLY":
      return check.level === "ok" ? "legs 为空，或仅用于显示。" : "legs 应为空或明确为 display-only。";
    case "NO_AIRCRAFT_GUIDANCE_FIELDS_ENABLED":
      return check.level === "ok" ? "未启用飞机引导字段。" : "检测到飞机引导字段被启用。";
    case "NO_GAMEPLAY_BINDING":
      return check.level === "ok" ? "没有绑定 gameplay 行为。" : "检测到 gameplay 绑定。";
    case "NAVSPEC_PRESENT":
      return check.level === "ok" ? `navSpec ${detail.navSpec} 已设置。` : "缺少 navSpec。";
    case "RUNWAY_IDS_PRESENT":
      return check.level === "ok" ? `已设置 ${detail.runwayIds?.length || 0} 个 runwayIds。` : "缺少 runwayIds。";
    case "SOURCE_PRESENT":
      return check.level === "ok" ? "source 元数据已设置。" : "缺少 source 元数据。";
    case "AIRAC_CYCLE_PRESENT_OR_WARN":
      return check.level === "ok" ? "AIRAC cycle 元数据已设置。" : "AIRAC cycle 元数据缺失或为 null。";
    case "STATUS_PRESENT":
      return check.level === "ok" ? `状态 ${detail.status} 已设置。` : "缺少状态。";
    case "STATUS_VALID":
      return check.level === "ok" ? "状态值合法。" : `状态 ${detail.status} 不在允许列表中。`;
    default:
      return check.message || "";
  }
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

function initialDisplayClimb(input) {
  const climb = input?.editorState?.initialDisplayClimb
    || input?.derivedProcedure?.initialDisplayClimb
    || input?.derivedProcedure?.routeBuilder?.initialDisplayClimb
    || input?.preset?.initialDisplayClimb
    || null;
  if (Array.isArray(climb)) return climb.find((item) => item?.type === "RUNWAY_HEADING_TO_ALTITUDE_GATE") || null;
  return climb;
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
  const gate = initialDisplayClimb(input);
  const gateId = gate?.gateId || null;
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
    const startConnectorOk = startId && firstRouteFix && (
      (routeIds[0] === startId && routeIds[1] === firstRouteFix)
      || (gateId && routeIds[0] === startId && routeIds[1] === gateId && routeIds[2] === firstRouteFix)
    );
    addCheck(
      checks,
      "Route",
      startConnectorOk ? "ok" : startId && routeIds.includes(startId) ? "warn" : "warn",
      "RNAV_START_CONNECTOR_PRESENT",
      startConnectorOk ? "RNAV start connector precedes first route fix." : "RNAV start connector could not be confirmed in the route point sequence.",
      { startId, firstRouteFix, gateId, routeIds: routeIds.slice(0, 6) },
    );
    if (gate) {
      addCheck(
        checks,
        "Route",
        gateId && routeIds.includes(gateId) ? "ok" : "warn",
        "RNAV_INITIAL_HEADING_GATE_PRESENT",
        gateId && routeIds.includes(gateId) ? "RNAV initial heading gate is present in display points." : "RNAV initial heading gate could not be confirmed in display points.",
        { gateId, headingDeg: gate.headingDeg, atOrAboveFt: gate.atOrAboveFt, routeIds: routeIds.slice(0, 6) },
      );
    }
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
  addCheck(checks, "Manual Preview", invalidAnchorValues.length ? "error" : "ok", "MANUAL_PREVIEW_ANCHOR_FRAME_VALID", invalidAnchorValues.length ? `Invalid anchor frame fields: ${invalidAnchorValues.join(", ")}.` : "Manual preview anchor frame values are valid strings/null.", { anchorFrame, invalidAnchorValues });

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

  const localizedChecks = checks.map((check) => {
    const messageZh = getQcCheckMessage(check);
    return {
      ...check,
      originalMessage: check.message,
      message: messageZh,
      categoryLabel: getQcCategoryLabel(check.category),
      levelLabel: getQcLevelLabel(check.level),
      messageZh,
    };
  });
  const summary = summarizeQcChecks(localizedChecks);
  const status = getQcStatus(localizedChecks, input);
  return {
    presetId: input?.preset?.id || input?.editorState?.presetId || null,
    procedureId: input?.editorState?.procedureId || input?.preset?.procedureId || null,
    status,
    statusLabel: getQcStatusLabel(status),
    summary,
    checks: localizedChecks,
  };
}

export function formatQcReport(report) {
  const checksByLevel = (level) => (report?.checks || []).filter((check) => check.level === level);
  const lines = [
    "RJCC 程序制作 QC 报告",
    `预设：${report?.presetId || "未知"}`,
    `程序：${report?.procedureId || "未知"}`,
    `状态：${formatQcStatus(report?.status)}`,
    `统计：${report?.summary?.ok || 0} 通过 / ${report?.summary?.warn || 0} 警告 / ${report?.summary?.error || 0} 错误`,
    "",
  ];
  for (const [label, level] of [["错误", "error"], ["警告", "warn"], ["通过", "ok"]]) {
    const checks = checksByLevel(level);
    if (!checks.length) continue;
    lines.push(`${label}:`);
    checks.forEach((check) => lines.push(`- ${check.code}: ${check.messageZh || getQcCheckMessage(check)}`));
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
  if (!report) return "QC 尚未运行。";
  if (report.status === QC_STATUSES.ERROR) return `允许导出，但 QC 有 ${report.summary.error} 个错误。`;
  if ((report.summary.warn || 0) > 0) return `允许导出，有 ${report.summary.warn} 个警告。QC 状态：${formatQcStatus(report.status)}。`;
  return `可导出。QC 状态：${formatQcStatus(report.status)}。`;
}
