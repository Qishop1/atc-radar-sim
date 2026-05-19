import { PX_PER_NM } from "./constants.js";
import { clamp, hdgVector, shortestTurn, xyToBearingRange } from "./geometry.js";
import {
  adizEscortComplete,
  distanceFromAdizCenterNm,
  foxhoundAdizArea,
  foxhoundDeepPenetration,
  foxhoundEscortPatch,
  isFoxhound,
  pointInAdizRect,
  scenario05InterceptPlan,
} from "./interceptScenario.js";
import { isFuelOutMode, makeFoxhoundIntruder, makeScenario05Interceptor, normalizeAircraftState } from "./aircraftStep.js";

export function runScenario05Orchestration(ctx) {
  const {
    running,
    gameMode,
    scenarioId,
    scenarioEventsDone,
    tick,
    aircraft,
    env,
    setScenarioEventsDone,
    setLog,
    setAircraft,
    setSelectedId,
    setRunning,
  } = ctx;
  if (!running || gameMode !== "SCENARIO" || scenarioId !== "foxhound_adiz_05" || scenarioEventsDone.foxhoundFailed) return;
  const hasFoxhound = aircraft.some((a) => isFoxhound(a));
  const hasInterceptor = aircraft.some((a) => a.category === "MIL" && (a.type === "F-15J" || a.type === "F-15J + MiG-31"));
  if (tick >= 180 && !scenarioEventsDone.foxhoundPreAlert) {
    setScenarioEventsDone((p) => ({ ...p, foxhoundPreAlert: true }));
    setLog((p) => ["RJCJ CALL: possible VKS high-speed track northwest. Scramble FI required within 5 minutes; ADIZ avoidance rectangle marked for civil traffic.", ...p].slice(0, 14));
    return;
  }
  if (tick >= 780 && !scenarioEventsDone.foxhoundScrambleLaunched && !scenarioEventsDone.foxhoundSuccess && !scenarioEventsDone.eagleRecovered && !hasFoxhound && !hasInterceptor) {
    const mig = makeFoxhoundIntruder(env, tick);
    const f15 = makeScenario05Interceptor(env);
    setAircraft((p) => [...p.filter((a) => a.id !== "EAGLE01" && !String(a.id || "").startsWith("FOXHOUND")), mig, f15]);
    setSelectedId("EAGLE01");
    setScenarioEventsDone((p) => ({ ...p, foxhoundScrambleLaunched: true }));
    setLog((p) => ["SCRAMBLE: FOXHOUND31 active northwest. EAGLE01 launched from RJCJ, maximum intercept profile authorized.", ...p].slice(0, 14));
    return;
  }
  const mig = aircraft.find((a) => isFoxhound(a) && a.mode !== "FOXHOUND_EGRESS");
  const escort = aircraft.find((a) => a.mode === "ADIZ_ESCORT" && a.escortingMig);
  const eagle = aircraft.find((a) => a.id === "EAGLE01");
  const anyFuelOut = aircraft.find((a) => isFuelOutMode(a) && !a.landed && !a.handedOff);
  if (anyFuelOut && !scenarioEventsDone.fuelOutFailed) {
    setScenarioEventsDone((p) => ({ ...p, foxhoundFailed: true, fuelOutFailed: true, fuelOutId: anyFuelOut.id }));
    setRunning(false);
    setLog((p) => [`MISSION FAILED: ${anyFuelOut.id} fuel exhausted.`, ...p].slice(0, 14));
    return;
  }
  const f15s = aircraft.filter((a) => a.category === "MIL" && (a.type === "F-15J" || a.type === "F-15J + MiG-31") && !a.landed && !a.handedOff);
  if (scenarioEventsDone.foxhoundSuccess && !scenarioEventsDone.eagleRecovered && eagle && (eagle.mode === "RJCJ_PARKED" || eagle.mode === "RJCJ_ROLLOUT" || eagle.mode === "VACATED" || eagle.mode === "ROLLOUT" || eagle.landed || eagle.handedOff || (eagle.mode === "RJCJ_ILS" && eagle.altitude < 500 && xyToBearingRange(eagle.x, eagle.y).rangeNm < 8))) {
    setScenarioEventsDone((p) => ({ ...p, eagleRecovered: true }));
    setLog((p) => ["EAGLE01 RECOVERED: F-15J returned to RJCJ after ADIZ escort.", ...p].slice(0, 14));
    return;
  }
  if (escort && adizEscortComplete(escort)) {
    setAircraft((p) => p.map((a) => a.id === escort.id ? normalizeAircraftState({ ...a, ...foxhoundEscortPatch(a, env) }) : a));
    setScenarioEventsDone((p) => ({ ...p, foxhoundSuccess: true }));
    setLog((p) => ["ADIZ ESCORT COMPLETE: MiG-31 left the ADIZ and disappeared from scope. EAGLE01 returning to RJCJ.", ...p].slice(0, 14));
    return;
  }
  if (mig) {
    const area = mig.adizArea || foxhoundAdizArea();
    const distToAdiz = distanceFromAdizCenterNm(mig, area);
    const migInsideAdiz = pointInAdizRect(mig.x, mig.y, area);
    const migDeepPenetration = foxhoundDeepPenetration(mig, area);
    const nearest = f15s.map((f) => ({ f, d: Math.hypot(f.x - mig.x, f.y - mig.y) / PX_PER_NM })).sort((a, b) => a.d - b.d)[0];
    let plan = null;
    if (nearest?.f) {
      plan = scenario05InterceptPlan(nearest.f, mig);
      setAircraft((p) => p.map((a) => {
        if (a.id === nearest.f.id && a.mode !== "ADIZ_ESCORT") return {
          ...a,
          interceptTargetX: plan.aim.x,
          interceptTargetY: plan.aim.y,
          interceptTargetId: mig.id,
          interceptPhase: plan.phase,
          interceptJoinHeading: plan.assignedHeading,
          assignedHeading: plan.assignedHeading,
          assignedAltitude: plan.assignedAltitude,
          assignedSpeed: plan.assignedSpeed,
          noCommandDelay: true
        };
        if (a.id === mig.id && a.mode === "FOXHOUND_INBOUND") return { ...a, assignedSpeed: 520, maxSpeedOverride: 900 };
        return a;
      }));
      if (["CONVERT", "REJOIN", "JOIN_STERN", "VISUAL_ID"].includes(plan.phase) && !scenarioEventsDone.foxhoundJoin) {
        setScenarioEventsDone((p) => ({ ...p, foxhoundJoin: true }));
        setLog((p) => ["INTERCEPT JOIN: EAGLE01 cut off FOXHOUND31, now moving to stern/side position for visual identification.", ...p].slice(0, 14));
      }
    }
    const terminalVisual = nearest && plan && ["JOIN_STERN", "VISUAL_ID"].includes(plan.phase) && nearest.d < 4.0 && nearest.f.altitude > 12000;
    if (terminalVisual) {
      const migHdg = mig.heading || mig.assignedHeading || 135;
      const migV = hdgVector(migHdg);
      const migRight = { x: -migV.y, y: migV.x };
      const slot = { x: mig.x - migV.x * 1.45 * PX_PER_NM + migRight.x * 0.75 * PX_PER_NM, y: mig.y - migV.y * 1.45 * PX_PER_NM + migRight.y * 0.75 * PX_PER_NM };
      setAircraft((p) => p.map((a) => a.id === nearest.f.id ? { ...a, x: a.x + (slot.x - a.x) * 0.22, y: a.y + (slot.y - a.y) * 0.22, heading: migHdg, speed: a.speed + clamp((mig.speed || 520) - (a.speed || 520), -18, 18), altitude: a.altitude + clamp((mig.altitude || 31000) - (a.altitude || 31000), -500, 500), assignedHeading: migHdg, assignedSpeed: mig.speed, assignedAltitude: mig.altitude, interceptPhase: nearest.d < 2.8 ? "FORMATION" : "JOIN_STERN", formationTicks: nearest.d < 2.8 ? (a.formationTicks || 0) + 2 : (a.formationTicks || 0) } : a));
    }
    const altitudeMatched = nearest && Math.abs(nearest.f.altitude - mig.altitude) < 900;
    const speedMatched = nearest && Math.abs(nearest.f.speed - mig.speed) < 70;
    const headingMatched = nearest && Math.abs(shortestTurn(nearest.f.heading, mig.heading || mig.assignedHeading || 135)) < 14;
    const formationReady = nearest && nearest.f.altitude > 12000 && nearest.d < 2.8 && altitudeMatched && speedMatched && headingMatched && (terminalVisual || plan?.phase === "VISUAL_ID" || nearest.f.interceptPhase === "FORMATION");
    const interceptInProgress = nearest && nearest.f.altitude > 9000 && nearest.d < 16.0;
    if (formationReady && (nearest.f.formationTicks || 0) < 45) {
      setAircraft((p) => p.map((a) => {
        if (a.id === nearest.f.id) return { ...a, interceptPhase: "FORMATION", formationTicks: (a.formationTicks || 0) + 1, interceptJoinHeading: mig.heading, assignedHeading: mig.heading, assignedAltitude: mig.altitude, assignedSpeed: mig.speed, speed: mig.speed, altitude: mig.altitude };
        if (isFoxhound(a)) return { ...a, mode: "FOXHOUND_FORMATION", assignedHeading: a.heading, assignedAltitude: a.altitude, assignedSpeed: a.speed, color: "#f97316" };
        return a;
      }));
    } else if (formationReady && (nearest.f.formationTicks || 0) >= 45) {
      setAircraft((p) => p.filter((a) => !isFoxhound(a)).map((a) => a.id === nearest.f.id ? normalizeAircraftState({ ...a, type: "F-15J + MiG-31", mode: "ADIZ_ESCORT", escortingMig: mig.id, interceptMerged: true, interceptPhase: "MERGED_ESCORT", adizArea: area, assignedHeading: 315, assignedAltitude: 31000, assignedSpeed: 620, speed: 620, altitude: 31000, color: "#f59e0b" }) : a));
      setLog((p) => ["INTERCEPT MERGE: EAGLE01 stabilized beside FOXHOUND31, tracks fused, escorting northwest out of the ADIZ.", ...p].slice(0, 14));
    } else if (migDeepPenetration && !interceptInProgress) {
      setScenarioEventsDone((p) => ({ ...p, foxhoundFailed: true }));
      setRunning(false);
      setAircraft((p) => p.map((a) => isFoxhound(a) ? { ...a, mode: "FOXHOUND_EGRESS", assignedHeading: 315, assignedSpeed: 620, color: "#ef4444" } : a));
      setLog((p) => ["MISSION FAILED: MiG-31 crossed deep into the ADIZ before successful F-15J interception.", ...p].slice(0, 14));
    } else if (migInsideAdiz && !migDeepPenetration) {
      setLog((p) => ["ADIZ WARNING: MiG-31 crossed the outer ADIZ boundary. Intercept still valid until deep penetration.", ...p].slice(0, 14));
    } else if (migDeepPenetration && interceptInProgress) {
      setLog((p) => ["ADIZ WARNING: MiG-31 is deep inside the ADIZ, but EAGLE01 is close enough for immediate merge.", ...p].slice(0, 14));
    }
  }

}
