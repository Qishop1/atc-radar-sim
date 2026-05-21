const RJCC_SEED_SOURCE = "existing_rjcc_seed";

function normalizeRecordSource(item) {
  return item?.source || RJCC_SEED_SOURCE;
}

function normalizeStatus(item) {
  return item?.status || "active";
}

function normalizeFir(item) {
  return item?.fir ?? null;
}

function normalizeAiracCycle(item) {
  return item?.airac_cycle ?? item?.airacCycle ?? null;
}

function normalizeNavaidType(type) {
  if (!type) return null;
  return String(type).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function airportRecord(item) {
  return {
    ...item,
    id: item.id,
    name: item.name ?? null,
    type: item.type || "AIRPORT",
    lat: item.lat,
    lon: item.lon,
    fir: normalizeFir(item),
    source: normalizeRecordSource(item),
    airac_cycle: normalizeAiracCycle(item),
    status: normalizeStatus(item),
  };
}

export function fixRecord(item) {
  return {
    ...item,
    id: item.id,
    name: item.name ?? null,
    type: item.type || "FIX",
    lat: item.lat,
    lon: item.lon,
    fir: normalizeFir(item),
    source: normalizeRecordSource(item),
    airac_cycle: normalizeAiracCycle(item),
    status: normalizeStatus(item),
  };
}

export function navaidRecord(item) {
  return {
    ...item,
    id: item.id,
    name: item.name ?? null,
    type: normalizeNavaidType(item.type),
    originalType: item.type || null,
    lat: item.lat,
    lon: item.lon,
    fir: normalizeFir(item),
    source: normalizeRecordSource(item),
    airac_cycle: normalizeAiracCycle(item),
    status: normalizeStatus(item),
  };
}

