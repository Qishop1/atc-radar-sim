const chartOverlayModules = import.meta.glob("./*.js", { eager: true });

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeChartOverlay(value) {
  return isObject(value)
    && Boolean(value.imageUrl)
    && Boolean(value.id || value.chartId || value.procedureId || value.procedureIds?.length);
}

function overlayCandidatesFromExport(value) {
  if (looksLikeChartOverlay(value)) return [value];
  if (!isObject(value)) return [];
  return Object.values(value).filter(looksLikeChartOverlay);
}

function registryKeysForOverlay(overlay) {
  return [...new Set([
    overlay.id,
    overlay.chartId,
    overlay.procedureId,
    ...(overlay.procedureIds || []),
  ].filter(Boolean))];
}

function registerOverlay(registry, diagnostics, overlay, sourcePath) {
  for (const id of registryKeysForOverlay(overlay)) {
    if (registry[id]) {
      diagnostics.duplicates.push({ id, keptSourcePath: registry[id].sourcePath, skippedSourcePath: sourcePath });
      continue;
    }
    registry[id] = { ...overlay, sourcePath };
  }
}

function buildChartOverlayRegistry() {
  const registry = {};
  const diagnostics = {
    duplicates: [],
    modulesWithoutOverlay: [],
  };

  for (const [path, module] of Object.entries(chartOverlayModules)) {
    if (path.endsWith("/index.js")) continue;
    const overlays = Object.values(module).flatMap(overlayCandidatesFromExport);
    if (!overlays.length) {
      diagnostics.modulesWithoutOverlay.push(path);
      continue;
    }
    overlays.forEach((overlay) => registerOverlay(registry, diagnostics, overlay, path));
  }

  return { registry, diagnostics };
}

const { registry, diagnostics } = buildChartOverlayRegistry();

if (diagnostics.modulesWithoutOverlay.length) {
  console.warn("[RJCC chart overlays] No recognizable overlay export:", diagnostics.modulesWithoutOverlay);
}

if (diagnostics.duplicates.length) {
  console.warn("[RJCC chart overlays] Duplicate overlay IDs skipped:", diagnostics.duplicates);
}

export const chartOverlays = registry;
export const chartOverlaysByChartId = Object.fromEntries(
  Object.values(registry)
    .filter((overlay, index, overlays) => overlay.chartId && overlays.findIndex((item) => item.chartId === overlay.chartId) === index)
    .map((overlay) => [overlay.chartId, overlay]),
);
export const chartOverlaysById = Object.fromEntries(
  Object.values(registry)
    .filter((overlay, index, overlays) => overlay.id && overlays.findIndex((item) => item.id === overlay.id) === index)
    .map((overlay) => [overlay.id, overlay]),
);
export const chartOverlayDiagnostics = diagnostics;
