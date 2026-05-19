export const FIX_FILTERS = [
  { id: "all", label: "FIX ALL" },
  { id: "rnav", label: "RNAV" },
  { id: "iafIfFaf", label: "IAF/IF/FAF" },
  { id: "star", label: "STAR" },
  { id: "sid", label: "SID" },
  { id: "approach", label: "APPROACH" },
];

export const LABEL_MODES = ["auto", "on", "off"];

export const defaultFixFilterState = {
  category: "all",
  includeApproximate: true,
  labelMode: "auto",
};

export const defaultNavaidFilterState = {
  vorDme: true,
  tacan: true,
  ilsLoc: true,
  labelMode: "auto",
};

function semanticText(item) {
  return [
    item?.id,
    item?.type,
    item?.notes,
    item?.altitudeConstraintText,
    item?.reference?.raw,
  ].filter(Boolean).join(" ").toUpperCase();
}

function isRnavFix(fix) {
  return semanticText(fix).includes("RNAV");
}

function isIafIfFafFix(fix) {
  return /\b(IAF|IF|FAF)\b/.test(semanticText(fix));
}

function isStarRelatedFix(fix) {
  return /\b(STAR|ARRIVAL)\b/.test(semanticText(fix));
}

function isSidRelatedFix(fix) {
  return /\b(SID|PATRUSH|JUGGLAR|YOSAN|HOKUTO|YUFUTSU|TOKACHI|SAVIT|TOBBY|TEKKO)\b/.test(semanticText(fix));
}

function isApproachRelatedFix(fix) {
  return /\b(APPROACH|ILS|LOC|RNP|VOR|FAF|IAF|IF|MAPT|MATF|SDF|VDP|RWY)\b/.test(semanticText(fix));
}

export function fixMatchesSemanticFilter(fix, category) {
  if (category === "rnav") return isRnavFix(fix);
  if (category === "iafIfFaf") return isIafIfFafFix(fix);
  if (category === "star") return isStarRelatedFix(fix);
  if (category === "sid") return isSidRelatedFix(fix);
  if (category === "approach") return isApproachRelatedFix(fix);
  return true;
}

export function filterFixes(fixes, filterState = defaultFixFilterState) {
  return (fixes || []).filter((fix) => {
    if (!filterState.includeApproximate && fix?.approximate) return false;
    return fixMatchesSemanticFilter(fix, filterState.category);
  });
}

export function filterNavaids(navaids, filterState = defaultNavaidFilterState) {
  return (navaids || []).filter((navaid) => {
    const type = String(navaid?.type || "").toUpperCase();
    if (type.includes("TACAN")) return !!filterState.tacan;
    if (type.includes("VOR/DME")) return !!filterState.vorDme;
    return true;
  });
}

export function filterLocalizers(localizers, filterState = defaultNavaidFilterState) {
  return filterState.ilsLoc ? (localizers || []) : [];
}
