const manualPreviewModules = import.meta.glob("./*.js", { eager: true });

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeManualPreview(value) {
  return isObject(value)
    && (value.type === "MANUAL_TRACE" || Array.isArray(value.points) || Array.isArray(value.rawProjectedPoints))
    && (value.id || value.procedureId || value.presetId);
}

function previewIds(preview) {
  return [...new Set([preview.id, preview.procedureId, preview.presetId].filter(Boolean))];
}

function previewCandidatesFromExport(value) {
  if (looksLikeManualPreview(value)) return [value];
  if (!isObject(value)) return [];
  return Object.values(value).filter(looksLikeManualPreview);
}

function registerPreview(registry, diagnostics, preview, sourcePath) {
  for (const id of previewIds(preview)) {
    if (registry[id]) {
      diagnostics.duplicates.push({ id, keptSourcePath: registry[id].sourcePath, skippedSourcePath: sourcePath });
      continue;
    }
    registry[id] = { ...preview, sourcePath };
  }
}

function buildManualPreviewRegistry() {
  const registry = {};
  const diagnostics = {
    duplicates: [],
    modulesWithoutPreview: [],
  };

  for (const [path, module] of Object.entries(manualPreviewModules)) {
    if (path.endsWith("/index.js")) continue;
    const previews = Object.values(module).flatMap(previewCandidatesFromExport);
    if (!previews.length) {
      diagnostics.modulesWithoutPreview.push(path);
      continue;
    }
    previews.forEach((preview) => registerPreview(registry, diagnostics, preview, path));
  }

  return { registry, diagnostics };
}

const { registry, diagnostics } = buildManualPreviewRegistry();

if (diagnostics.modulesWithoutPreview.length) {
  console.warn("[RJCC manual previews] No recognizable preview export:", diagnostics.modulesWithoutPreview);
}

if (diagnostics.duplicates.length) {
  console.warn("[RJCC manual previews] Duplicate preview IDs skipped:", diagnostics.duplicates);
}

export const manualProcedurePreviews = registry;
export const manualPreviewDiagnostics = diagnostics;
