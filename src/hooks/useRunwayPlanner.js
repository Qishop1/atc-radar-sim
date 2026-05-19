import { useEffect, useMemo } from "react";
import { RUNWAYS, RJCC_RUNWAY_NAMES } from "../simulator/constants.js";
import { finalGeometryAt, shortestTurn } from "../simulator/geometry.js";
import {
  defaultArrRunwayForPair,
  defaultDepRunwayForPair,
  normalizeRunwayList,
  runwayEndOptions,
  runwayOrigin,
  runwayPairName,
  runwayPairRunways,
  sameRunwayEnd,
  transitionRunwaySet,
} from "../simulator/navigation.js";
import { buildRjccRunwayDisplaySet, runwayRoleOf as computeRunwayRoleOf } from "../simulator/radarState.js";

export function useRunwayPlanner({
  activeRunway,
  depRunway,
  arrRunways,
  depRunways,
  closedRunways,
  approachRunwayChoice,
  parallelApproach,
  runwayMode,
  runwayChangeCandidate,
  rawAutoPair,
  crosswindNeutral,
  dualRunway,
  tick,
  gameMode,
  lang,
  selected,
  setActiveRunway,
  setDepRunway,
  setArrRunways,
  setDepRunways,
  setClosedRunways,
  setApproachRunwayChoice,
  setRunwayMode,
  setRunwayChangeCandidate,
  setLog,
}) {
  const openArrRunways = useMemo(() => normalizeRunwayList(arrRunways.filter((r) => !closedRunways.includes(r)), activeRunway), [arrRunways, closedRunways, activeRunway]);
  const openDepRunways = useMemo(() => normalizeRunwayList(depRunways.filter((r) => !closedRunways.includes(r)), depRunway), [depRunways, closedRunways, depRunway]);
  const runwayRoleOf = (rw) => computeRunwayRoleOf(rw, { closedRunways, openArrRunways, openDepRunways });

  function preferredArrivalRunwayFor(ac = selected) {
    if (approachRunwayChoice !== "AUTO" && openArrRunways.includes(approachRunwayChoice)) return approachRunwayChoice;
    const candidates = parallelApproach ? openArrRunways : [activeRunway];
    const sameEnd = candidates.filter((r) => sameRunwayEnd(r, activeRunway));
    const pool = sameEnd.length ? sameEnd : candidates;
    if (pool.length <= 1) return pool[0] || activeRunway;
    const sideScore = (rw) => {
      const geo = finalGeometryAt(runwayOrigin(RUNWAYS[rw]), RUNWAYS[rw].course, ac.x, ac.y);
      return Math.abs(geo.crossPx) + Math.abs(shortestTurn(ac.heading || ac.assignedHeading || RUNWAYS[rw].course, RUNWAYS[rw].course)) * 0.7;
    };
    return [...pool].sort((a, b) => sideScore(a) - sideScore(b))[0];
  }

  function applyRunwayPlan(nextArr, nextDep, nextClosed, opts = {}) {
    const arr = normalizeRunwayList(nextArr, activeRunway);
    const dep = normalizeRunwayList(nextDep, arr[0]);
    const closed = [...new Set(nextClosed || [])].filter((r) => RUNWAYS[r] && !arr.includes(r) && !dep.includes(r));
    setArrRunways(arr);
    setDepRunways(dep);
    setClosedRunways(closed);
    setActiveRunway(arr[0]);
    setDepRunway(dep[0] || arr[0]);
    if (opts.log !== false) setLog((p) => [`RJCC RUNWAY PLAN: ARR ${arr.join("/")} | DEP ${dep.join("/")} | CLOSED ${closed.length ? closed.join("/") : "NONE"}.`, ...p].slice(0, 14));
  }

  function setRunwayRole(rw, role) {
    if (approachRunwayChoice === rw && (role === "DEP" || role === "CLOSED")) setApproachRunwayChoice("AUTO");
    let arr = arrRunways.filter((r) => r !== rw);
    let dep = depRunways.filter((r) => r !== rw);
    let closed = closedRunways.filter((r) => r !== rw);
    if (role === "ARR" || role === "BOTH") arr.push(rw);
    if (role === "DEP" || role === "BOTH") dep.push(rw);
    if (role === "CLOSED") closed.push(rw);
    applyRunwayPlan(arr, dep, closed);
    setRunwayMode("MANUAL");
  }

  function setRunwayEndPlan(pair, mode = "SPLIT") {
    setApproachRunwayChoice("AUTO");
    const rwys = runwayEndOptions(pair);
    if (mode === "PARALLEL_ARR") applyRunwayPlan(rwys, [rwys[1]], []);
    else if (mode === "SINGLE_LEFT") applyRunwayPlan([rwys[0]], [rwys[0]], [rwys[1]]);
    else if (mode === "SINGLE_RIGHT") applyRunwayPlan([rwys[1]], [rwys[1]], [rwys[0]]);
    else applyRunwayPlan([defaultArrRunwayForPair(pair)], [defaultDepRunwayForPair(pair)], []);
    setRunwayMode("MANUAL");
  }

  useEffect(() => {
    if (gameMode !== "SCENARIO") return;
    if (closedRunways.length) return;
    if (crosswindNeutral) return;
    const currentPair = runwayPairName(activeRunway);
    const targetPair = rawAutoPair;
    const targetRunways = runwayEndOptions(targetPair);
    const currentAlreadyBoth = targetRunways.every((rw) => arrRunways.includes(rw) && depRunways.includes(rw)) && arrRunways.length === 2 && depRunways.length === 2;
    if (targetPair === currentPair && currentAlreadyBoth) return;
    setActiveRunway(defaultArrRunwayForPair(targetPair));
    setDepRunway(defaultDepRunwayForPair(targetPair));
    setArrRunways(targetRunways);
    setDepRunways(targetRunways);
    setApproachRunwayChoice("AUTO");
    setRunwayChangeCandidate({ pair: null, since: 0 });
    setLog((p) => [`SCENARIO RUNWAY AUTO: wind favors ${targetPair}, switching to ${targetRunways.join("/")} BOTH. Approaches already committed to the old end must go around.`, ...p].slice(0, 14));
  }, [gameMode, rawAutoPair, crosswindNeutral, activeRunway, arrRunways, depRunways, closedRunways]);

  useEffect(() => {
    if (runwayMode !== "AUTO") return;
    if (crosswindNeutral) {
      setRunwayChangeCandidate({ pair: null, since: 0 });
      return;
    }
    const currentPair = runwayPairName(activeRunway);
    if (rawAutoPair === currentPair) {
      setRunwayChangeCandidate({ pair: null, since: 0 });
      const nextArr = [defaultArrRunwayForPair(currentPair)];
      const nextDep = [dualRunway ? defaultDepRunwayForPair(currentPair) : defaultArrRunwayForPair(currentPair)];
      setDepRunway(nextDep[0]);
      setArrRunways(nextArr);
      setDepRunways(nextDep);
      setClosedRunways([]);
      return;
    }
    setRunwayChangeCandidate((prev) => {
      const started = prev.pair === rawAutoPair ? prev.since : tick;
      if (tick - started >= 240) {
        const nextArr = defaultArrRunwayForPair(rawAutoPair);
        const nextDep = dualRunway ? defaultDepRunwayForPair(rawAutoPair) : nextArr;
        setActiveRunway(nextArr);
        setDepRunway(nextDep);
        setArrRunways([nextArr]);
        setDepRunways([nextDep]);
        setClosedRunways([]);
        setLog((p) => [`CHITOSE: wind shift sustained, runway change to ARR ${nextArr} / DEP ${nextDep}.`, ...p].slice(0, 14));
        return { pair: null, since: 0 };
      }
      return { pair: rawAutoPair, since: started };
    });
  }, [runwayMode, rawAutoPair, crosswindNeutral, activeRunway, dualRunway, tick]);

  const displayedRunwaySets = transitionRunwaySet(activeRunway, depRunway, runwayChangeCandidate);
  const pendingRunways = runwayChangeCandidate.pair ? runwayPairRunways(runwayChangeCandidate.pair) : null;
  const transitionOps = !!runwayChangeCandidate.pair;
  const runwayNoticeVisible = !!runwayChangeCandidate.pair || crosswindNeutral;
  const runwayNoticeAccent = runwayChangeCandidate.pair ? "#f59e0b" : "#38bdf8";
  const runwayNoticeTitle = runwayChangeCandidate.pair
    ? (lang === "zh" ? "跑道换向等待" : "RUNWAY CHANGE PENDING")
    : (lang === "zh" ? "侧风主导，保持当前跑道" : "CROSSWIND NEUTRAL - RUNWAY HELD");
  const runwayNoticeBody = runwayChangeCandidate.pair
    ? (lang === "zh"
      ? `过渡运行中：当前 ARR ${activeRunway} / DEP ${depRunway}，候选 ARR ${pendingRunways?.arr || "-"} / DEP ${pendingRunways?.dep || "-"}，剩余 ${Math.max(0, Math.ceil((240 - (tick - runwayChangeCandidate.since)) / 2))} 秒。当前方向保持自动运行，候选方向作为手动接入参考显示。`
      : `Transition ops: current ARR ${activeRunway} / DEP ${depRunway}, candidate ARR ${pendingRunways?.arr || "-"} / DEP ${pendingRunways?.dep || "-"}, ${Math.max(0, Math.ceil((240 - (tick - runwayChangeCandidate.since)) / 2))}s remaining. Current side remains automatic; candidate side is displayed for manual use.`)
    : (lang === "zh"
      ? `01/19 顶风分量接近对称；当前保持 ARR ${activeRunway} / DEP ${depRunway}`
      : `01/19 headwind component nearly neutral; holding ARR ${activeRunway} / DEP ${depRunway}`);
  const runwayDisplaySet = useMemo(() => buildRjccRunwayDisplaySet({ runwayChangeCandidate, runwayNames: RJCC_RUNWAY_NAMES, runwayPairRunways, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway }), [runwayChangeCandidate, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway]);

  return {
    openArrRunways,
    openDepRunways,
    runwayRoleOf,
    preferredArrivalRunwayFor,
    applyRunwayPlan,
    setRunwayRole,
    setRunwayEndPlan,
    displayedRunwaySets,
    pendingRunways,
    transitionOps,
    runwayNoticeVisible,
    runwayNoticeAccent,
    runwayNoticeTitle,
    runwayNoticeBody,
    runwayDisplaySet,
  };
}
