import { CENTER, RUNWAYS } from "./constants.js";
import { hdgVector } from "./geometry.js";

export function runwayPairName(runwayName) { return RUNWAYS[runwayName]?.pair || (String(runwayName).startsWith("19") ? "19" : "01"); }
export function runwayOrigin(runway) {
  const rw = typeof runway === "string" ? RUNWAYS[runway] : runway;
  const course = rw?.course ?? 10;
  const right = { x: -hdgVector(course).y, y: hdgVector(course).x };
  const off = rw?.offsetPx || 0;
  return { x: CENTER + right.x * off, y: CENTER + right.y * off };
}
export function runwayEndOptions(pair) { return pair === "19" ? ["19L", "19R"] : ["01L", "01R"]; }
export function defaultArrRunwayForPair(pair) { return pair === "19" ? "19R" : "01L"; }
export function defaultDepRunwayForPair(pair) { return pair === "19" ? "19L" : "01R"; }
export function runwayPairRunways(pair) {
  return { arr: defaultArrRunwayForPair(pair), dep: defaultDepRunwayForPair(pair) };
}
export function sameRunwayEnd(a, b) { return runwayPairName(a) === runwayPairName(b); }
export function normalizeRunwayList(list, fallback = "01L") {
  const clean = [...new Set((list || []).filter((r) => RUNWAYS[r]))];
  return clean.length ? clean : [fallback];
}
export function transitionRunwaySet(activeRunway, depRunway, candidate) {
  const sets = [{ arr: activeRunway, dep: depRunway, role: "CURRENT" }];
  if (candidate?.pair) {
    const pending = runwayPairRunways(candidate.pair);
    if (pending.arr !== activeRunway || pending.dep !== depRunway) sets.push({ ...pending, role: "PENDING" });
  }
  return sets;
}
