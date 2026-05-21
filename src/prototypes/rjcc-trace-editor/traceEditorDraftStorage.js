export const TRACE_EDITOR_DRAFT_VERSION = 1;

const AIRPORT_ID = "RJCC";
const TOOL_ID = "rjcc-trace-editor";
const DRAFT_KEY_PREFIX = `${TOOL_ID}:draft`;
const LAST_PRESET_KEY = `${TOOL_ID}:lastPresetId`;

function normalizePresetId(presetId) {
  return String(presetId || "").trim().toUpperCase();
}

function storage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function validateDraft(draft, presetId) {
  if (!draft || typeof draft !== "object") return "Draft is not an object.";
  if (draft.version !== TRACE_EDITOR_DRAFT_VERSION) return `Unsupported draft version ${draft.version ?? "unknown"}.`;
  if (draft.airportId !== AIRPORT_ID) return `Draft airport ${draft.airportId || "unknown"} is not ${AIRPORT_ID}.`;
  if (draft.tool !== TOOL_ID) return `Draft tool ${draft.tool || "unknown"} is not ${TOOL_ID}.`;
  if (presetId && draft.presetId && normalizePresetId(draft.presetId) !== normalizePresetId(presetId)) {
    return `Draft preset ${draft.presetId} does not match ${presetId}.`;
  }
  return null;
}

export function getDraftKey(presetId) {
  return `${DRAFT_KEY_PREFIX}:${normalizePresetId(presetId)}`;
}

export function loadDraftWithMeta(presetId) {
  const localStorage = storage();
  if (!localStorage || !presetId) return { draft: null, error: null };
  const key = getDraftKey(presetId);
  const raw = localStorage.getItem(key);
  if (!raw) return { draft: null, error: null };
  try {
    const draft = JSON.parse(raw);
    const error = validateDraft(draft, presetId);
    if (error) return { draft: null, error };
    return { draft, error: null };
  } catch (error) {
    return { draft: null, error: error instanceof Error ? error.message : "Could not parse draft." };
  }
}

export function loadDraft(presetId) {
  return loadDraftWithMeta(presetId).draft;
}

export function saveDraft(presetId, draft) {
  const localStorage = storage();
  if (!localStorage || !presetId) return null;
  const normalizedPresetId = normalizePresetId(presetId);
  const nextDraft = {
    ...draft,
    version: TRACE_EDITOR_DRAFT_VERSION,
    airportId: AIRPORT_ID,
    tool: TOOL_ID,
    presetId: normalizedPresetId,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(getDraftKey(normalizedPresetId), JSON.stringify(nextDraft));
  localStorage.setItem(LAST_PRESET_KEY, normalizedPresetId);
  return nextDraft;
}

export function clearDraft(presetId) {
  const localStorage = storage();
  if (!localStorage || !presetId) return;
  localStorage.removeItem(getDraftKey(presetId));
}

export function hasDraft(presetId) {
  const localStorage = storage();
  return Boolean(localStorage && presetId && localStorage.getItem(getDraftKey(presetId)));
}

export function listDrafts() {
  const localStorage = storage();
  if (!localStorage) return [];
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key) => key?.startsWith(`${DRAFT_KEY_PREFIX}:`))
    .map((key) => key.slice(`${DRAFT_KEY_PREFIX}:`.length));
}

export function loadLastDraftPresetId() {
  return storage()?.getItem(LAST_PRESET_KEY) || null;
}

export function saveLastDraftPresetId(presetId) {
  const localStorage = storage();
  if (localStorage && presetId) localStorage.setItem(LAST_PRESET_KEY, normalizePresetId(presetId));
}
