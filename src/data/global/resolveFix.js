import { airports } from "./airports.js";
import { fixes } from "./fixes.js";
import { navaids } from "./navaids.js";

function normalizeReference(ref) {
  if (typeof ref === "string") return ref;
  return ref?.id || ref?.fixId || ref?.navaidId || ref?.airportId || "";
}

function normalizeKind(kind) {
  if (!kind) return null;
  const text = String(kind).toLowerCase();
  if (text === "fix" || text === "fixes") return "fix";
  if (text === "navaid" || text === "navaids") return "navaid";
  if (text === "airport" || text === "airports") return "airport";
  return text;
}

function normalizeSource(source) {
  return source ? String(source).toLowerCase() : null;
}

function makeEntry(kind, item) {
  return {
    id: item.id,
    kind,
    type: item.type || null,
    item,
    source: item.source || null,
    airac_cycle: item.airac_cycle || null,
    status: item.status || null,
    fir: item.fir || null,
  };
}

const waypointEntries = [
  ...fixes.map((item) => makeEntry("fix", item)),
  ...navaids.map((item) => makeEntry("navaid", item)),
  ...airports.map((item) => makeEntry("airport", item)),
];

export const waypointEntriesById = waypointEntries.reduce((acc, entry) => {
  if (!entry.id) return acc;
  const id = String(entry.id).toUpperCase();
  acc[id] = [...(acc[id] || []), entry];
  return acc;
}, {});

export const waypointConflicts = Object.fromEntries(
  Object.entries(waypointEntriesById).filter(([, entries]) => entries.length > 1)
);

export const waypointById = Object.fromEntries(
  Object.entries(waypointEntriesById)
    .filter(([, entries]) => entries.length === 1)
    .map(([id, entries]) => [id, entries[0]])
);

function filtersFromRef(ref, options = {}) {
  return {
    kind: normalizeKind(options.kind || options.type || ref?.kind || ref?.recordKind),
    source: normalizeSource(options.source || ref?.source),
    airac_cycle: options.airac_cycle ?? options.airacCycle ?? ref?.airac_cycle ?? ref?.airacCycle ?? null,
  };
}

function applyFilters(entries, filters) {
  return entries.filter((entry) => {
    if (filters.kind && entry.kind !== filters.kind) return false;
    if (filters.source && normalizeSource(entry.source) !== filters.source) return false;
    if (filters.airac_cycle && entry.airac_cycle !== filters.airac_cycle) return false;
    return true;
  });
}

function conflictResult(id, matches) {
  return {
    id,
    kind: "conflict",
    conflict: true,
    matches,
    item: null,
    source: null,
    airac_cycle: null,
    status: null,
    fir: null,
  };
}

export function resolveFixCandidates(ref, options = {}) {
  const id = normalizeReference(ref).toUpperCase();
  if (!id) return [];
  return applyFilters(waypointEntriesById[id] || [], filtersFromRef(ref, options));
}

export function resolveFix(ref, options = {}) {
  const id = normalizeReference(ref).toUpperCase();
  if (!id) return null;

  const matches = resolveFixCandidates(ref, options);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return conflictResult(id, matches);
}

export function resolveFixDiagnostics(ref, options = {}) {
  const id = normalizeReference(ref).toUpperCase();
  const matches = resolveFixCandidates(ref, options);
  return {
    id,
    resolved: matches.length === 1 ? matches[0] : null,
    conflict: matches.length > 1,
    unresolved: matches.length === 0,
    matches,
  };
}
