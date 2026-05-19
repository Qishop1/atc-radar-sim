import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import { useCommandHandlers } from "./hooks/useCommandHandlers.js";
import { useRadarInteractions } from "./hooks/useRadarInteractions.js";
import { useRunwayPlanner } from "./hooks/useRunwayPlanner.js";
import { useSessionController } from "./hooks/useSessionController.js";
import { I18N } from "./i18n.js";
import { buildArrivalStripRows, buildSequenceRows, moveArrivalInSequence, resetArrivalSequenceAuto } from "./simulator/arrivalSequenceState.js";
import { categoryText, contactDisplayText, modeDisplayText, onOffText, translate, vnavDisplayText } from "./simulator/displayText.js";
import { formatEta, formatJstTime, formatSignedClock, wakeShort } from "./simulator/formatting.js";
import { buildRjcjPriorityNotice, buildSnowRemovalNotice, deriveScenarioStatus } from "./simulator/scenarioStatus.js";
import { isGroundTraffic, separationAssessment, wakeAssessment } from "./simulator/separation.js";
import { estimateArrivalEtaSec, sequenceGapAssessment } from "./simulator/sequencing.js";
import {
  AIRPORT_RUNWAYS,
  CENTER,
  ILS_FAR_PX,
  ILS_NEAR_PX,
  MAX_TARGETS,
  PATTERN_ALT,
  PX_PER_NM,
  RADAR_SWEEP_SECONDS,
  RADAR_SWEEP_TICKS,
  RJCC_RUNWAY_NAMES,
  RUNWAYS,
  SIM_STEP_SECONDS,
} from "./simulator/constants.js";
import {
  AIRPORTS,
  bearingToXY,
  clamp,
  finalGeometry,
  finalGeometryAt,
  fmt3,
  fmtFL,
  hdgVector,
  hashSeed,
  headingToPoint,
  normHeading,
  runwayPoint,
  withSeededRandom,
  xyToBearingRange,
} from "./simulator/geometry.js";
import {
  defaultArrRunwayForPair,
  defaultDepRunwayForPair,
  runwayEndOptions,
  runwayPairName,
} from "./simulator/navigation.js";
import {
  approachSpeedFor,
  callsigns,
  cleanSpeedFor,
  companyCostIndexSpeed,
  depFlightPlans,
  depTargetSpeed,
  isRotor,
  milCallsigns,
  milTypes,
  perfFor,
  speedLimitForAircraft,
  types,
  wakeCategory,
  wakeMinNm,
} from "./simulator/aircraftPerf.js";
import { STATE_ALIAS, VALID_TRANSITIONS } from "./simulator/stateMachine.js";
import {
  activeAirportRunway,
  aircraftWithinWeatherAltitude,
  divertRequired,
  generatedWind,
  intersectsRedWeather,
  makeWeatherCells,
  nearestRedWeatherAhead,
  parseWind,
  pointInWeatherCell,
  runwayHeadwind,
  segmentIntersectsWeather,
  windVector,
} from "./simulator/weather.js";
import { SCENARIOS, scenarioObjectives, scenarioTrafficPlan, spawnRoutes } from "./simulator/scenarios.js";
import {
  airportApproachGeometry,
  alternateRunwayConfig,
  alternateRunwayPoint,
  finalGeometryRunway,
  ilsBoundaryLines,
  runwayPointEnv,
  runwayPointForRunway,
  runwayPolygonPoints,
} from "./simulator/runwayGeometry.js";
import {
  makeAircraft,
  makeEmptyAircraft,
  makeInitialAircraft,
  makeRandomArrival,
  makeScenarioInitialAircraft,
} from "./simulator/aircraftFactory.js";
import {
  adizEscortComplete,
  adizRectCorners,
  distanceFromAdizCenterNm,
  foxhoundAdizArea,
  foxhoundDeepPenetration,
  foxhoundEscortPatch,
  isFoxhound,
  isScenario05InterceptPair,
  pointInAdizRect,
  scenario05InterceptPlan,
} from "./simulator/interceptScenario.js";
import {
  holdPatternPoints,
  makeNavCached,
  makeRoutes,
  makeSids,
  suggestHoldForBearing,
  suggestRouteForBearing,
  wp,
} from "./simulator/airspaceRoutes.js";
import {
  alternateHandoffLabel,
  alternateHandoffRadiusNm,
  approachRunwayChangeRequiresMissed,
  approachRunwayForAircraft,
  finalGeometryForAircraft,
  finalLandingState,
  ilsAutoEligible,
  isAlternateMode,
  isApproachMode,
  isFinalMode,
  runwayPointForAircraft,
  wrongRunwayTailwindMiss,
} from "./simulator/arrivalApproach.js";
import {
  resolveAlternateTargetState,
  resolveDepartureGroundTargetState,
  resolveDepartureTargetState,
  resolveDirectFixTargetState,
  resolveExitState,
  resolveRotorTargetState,
  stepFuelOutAircraft,
  stepRolloutAircraft,
} from "./simulator/engine.js";
import {
  activeMissionCorridors,
  airportDepartureEnd,
  displayedMissionAreas,
  getAircraftMissionArea,
  makeSarMissionArea,
  missionAreaPoint,
  missionForType,
  missionRestrictionViolation,
  rjcjDepartureGate,
  rjcjHelipadPoint,
  rjcjRunwayForType,
} from "./simulator/military.js";
import { militaryBingoFuelMinutes, militaryRtbPatch, nearestMissionAreaAhead, shouldMilitaryRTB } from "./simulator/militaryBoundary.js";
import { appReacquirePatch as buildAppReacquirePatch, landingClearancePatch, towerArrivalPatch } from "./simulator/commands.js";
import { applyTowerAutomation } from "./simulator/towerAutomation.js";
import { svgEventToRadarPoint as getRadarPointFromEvent } from "./simulator/radarInteractions.js";
import { computeRadarDisplayTargets, runwayLabelForRole as formatRunwayLabelForRole, showAirportIls as shouldShowAirportIls } from "./simulator/radarState.js";
import { runScenario05Orchestration } from "./simulator/scenario05.js";
import { applyPendingCommands, runAutoTrafficSpawn, runScenarioTrafficEvents } from "./simulator/simulationLoop.js";
import { seatForAircraft } from "./simulator/uiDerivedState.js";
import {
  aircraftFactoryDeps,
  aircraftStep,
  canClearVisual,
  departureRunwayEntry,
  depExitReady,
  displayMode,
  ilsGateState,
  inTowerAirspace,
  isFuelOutMode,
  makeDeparture,
  makeFoxhoundIntruder,
  makeMilitary,
  makeScenario05Interceptor,
  missedApproachPatch,
  normalizeAircraftState,
  runwayOccupied,
  scoreAircraft,
  towerQueue,
  visualDownwindEntry,
  visualPatternPoints,
  vnavStatus,
  vnavTargetAltitude,
} from "./simulator/aircraftStep.js";

const WAKE_ASSESSMENT_DEPS = { approachRunwayForAircraft };
const SEQUENCING_DEPS = { approachRunwayForAircraft, makeNavCached, wp };

export default function ATCRadarSimulator() {
  const svgRef = useRef(null);
  const [startScreen, setStartScreen] = useState(true);
  const [gameMode, setGameMode] = useState("SANDBOX");
  const [scenarioId, setScenarioId] = useState("sandbox");
  const [scenarioEventsDone, setScenarioEventsDone] = useState({});
  const [scenarioTrafficDone, setScenarioTrafficDone] = useState({});
  const [conflictFirstTick, setConflictFirstTick] = useState(null);
  const [arrivalSequence, setArrivalSequence] = useState([]);
  const [seat, setSeat] = useState("APP");
  const [towerAirport, setTowerAirport] = useState("RJCC");
  const [runwayMode, setRunwayMode] = useState("AUTO");
  const [activeRunway, setActiveRunway] = useState("01L");
  const [depRunway, setDepRunway] = useState("01R");
  const [closedRunways, setClosedRunways] = useState([]);
  const [dualRunway, setDualRunway] = useState(true);
  const [arrRunways, setArrRunways] = useState(["01L"]);
  const [depRunways, setDepRunways] = useState(["01R"]);
  const [parallelApproach, setParallelApproach] = useState(true);
  const [approachRunwayChoice, setApproachRunwayChoice] = useState("AUTO");
  const [commandDelayEnabled, setCommandDelayEnabled] = useState(true);
  const [commandDelaySec, setCommandDelaySec] = useState(4);
  const [pendingCommands, setPendingCommands] = useState([]);
  const [wind, setWind] = useState("360/03");
  const [windMode, setWindMode] = useState("AUTO");
  const [windOffset, setWindOffset] = useState(() => Math.random() * 120);
  const [runwayChangeCandidate, setRunwayChangeCandidate] = useState({ pair: null, since: 0 });
  const [weatherOn, setWeatherOn] = useState(true);
  const [weatherSeed, setWeatherSeed] = useState(() => Math.random());
  const [weatherTick, setWeatherTick] = useState(0);
  const [landedCount, setLandedCount] = useState(0), [handoffCount, setHandoffCount] = useState(0), [seq, setSeq] = useState(6), [tick, setTick] = useState(0), [realTick, setRealTick] = useState(0), [lastDepTick, setLastDepTick] = useState(-999), [lastMilTick, setLastMilTick] = useState(-999);
  const manualWindObj = useMemo(() => parseWind(wind), [wind]);
  const autoWindObj = useMemo(() => generatedWind(tick / 120 + windOffset), [tick, windOffset]);
  const windObj = windMode === "AUTO" ? autoWindObj : manualWindObj;
  const hw01 = runwayHeadwind(windObj, 10);
  const hw19 = runwayHeadwind(windObj, 190);
  const rawAutoPair = hw01 >= hw19 ? "01" : "19";
  const crosswindNeutral = Math.abs(hw01) < 4.5 && Math.abs(hw19) < 4.5;
  const activePair = runwayPairName(activeRunway);
  const autoPair = crosswindNeutral ? activePair : rawAutoPair;
  const autoRunway = defaultArrRunwayForPair(autoPair);
  const autoDepRunway = defaultDepRunwayForPair(autoPair);
  const weatherCells = useMemo(
    () => makeWeatherCells(weatherTick / 60, weatherSeed, scenarioId),
    [weatherTick, weatherSeed, scenarioId]
  );
  const env = useMemo(() => {
    const runway = RUNWAYS[activeRunway];
    const nav = makeNavCached(activeRunway);
    return { runway, nav, routes: makeRoutes(activeRunway), sids: makeSids(activeRunway), wind: windObj, headwind: runwayHeadwind(windObj, runway.course), tailwind: Math.max(0, -runwayHeadwind(windObj, runway.course)), airports: { RJCJ: activeAirportRunway("RJCJ", windObj), RJCH: activeAirportRunway("RJCH", windObj), RJSM: activeAirportRunway("RJSM", windObj) }, weatherOn, weatherCells, closedRunways };
  }, [activeRunway, windObj, weatherOn, weatherCells, closedRunways]);

  const [aircraft, setAircraft] = useState(() => {
    const initOffset = Math.random() * 120;
    const initWind = generatedWind(initOffset);
    const initPair = runwayHeadwind(initWind, 10) >= runwayHeadwind(initWind, 190) ? "01" : "19";
    const initArr = defaultArrRunwayForPair(initPair);
    const initDep = defaultDepRunwayForPair(initPair);
    const initEnv = { runway: RUNWAYS[initArr], nav: makeNavCached(initArr), routes: makeRoutes(initArr), sids: makeSids(initArr), wind: initWind, headwind: runwayHeadwind(initWind, RUNWAYS[initArr].course), tailwind: Math.max(0, -runwayHeadwind(initWind, RUNWAYS[initArr].course)), weatherOn: true, weatherCells: makeWeatherCells(0, Math.random()), airports: { RJCJ: activeAirportRunway("RJCJ", initWind), RJCH: activeAirportRunway("RJCH", initWind), RJSM: activeAirportRunway("RJSM", initWind) } };
    return makeInitialAircraft(initEnv, initDep, aircraftFactoryDeps()).map(normalizeAircraftState);
  });
  const [radarTargets, setRadarTargets] = useState([]);
  const [radarLastSweepTick, setRadarLastSweepTick] = useState(0);
  const [selectedId, setSelectedId] = useState("SKY201");
  const [running, setRunning] = useState(false);
  const [heading, setHeading] = useState("010"), [altitude, setAltitude] = useState("3000"), [speed, setSpeed] = useState("160");
  const [routePreset, setRoutePreset] = useState("AUTO"), [holdAltitude, setHoldAltitude] = useState("AUTO"), [holdFix, setHoldFix] = useState("AUTO");
  const [depAuto, setDepAuto] = useState(true), [depRate, setDepRate] = useState("medium"), [qnh, setQnh] = useState("1013"), [autoSpawn, setAutoSpawn] = useState(true), [spawnRate, setSpawnRate] = useState("low"), [milAuto, setMilAuto] = useState(true);
  const autoConfigRef = useRef({ autoSpawn: true, spawnRate: "low", depAuto: true, depRate: "medium", milAuto: true, aircraft: [], seq: 6, lastDepTick: -999, lastMilTick: -999, env: null, activeRunway: "01", timeScale: 2 });
  const [timeScale, setTimeScale] = useState(2), [zoom, setZoom] = useState(1), [followSelected, setFollowSelected] = useState(false), [mouseVectorMode, setMouseVectorMode] = useState(false), [vectorPreview, setVectorPreview] = useState(null);
  const [radarView, setRadarView] = useState({ x: CENTER, y: CENTER, panning: false, lastX: 0, lastY: 0 });
  const [towerAuto, setTowerAuto] = useState(true);
  const [lang, setLang] = useState("en");
  const [log, setLog] = useState(["CHITOSE APP: runway auto mode available.", "Wind now affects runway selection, drift, and tailwind go-around."]);
  const [radioCollapsed, setRadioCollapsed] = useState(false);
  const [systemCollapsed, setSystemCollapsed] = useState(true);
  const activeCorridors = useMemo(() => activeMissionCorridors(aircraft, env), [aircraft, env]);
  const radarSweepAgeSec = Math.max(0, (tick - radarLastSweepTick) * SIM_STEP_SECONDS);
  const radarDisplayTargets = useMemo(() => computeRadarDisplayTargets(radarTargets, tick, running), [radarTargets, tick, running]);
  useEffect(() => {
    if (!aircraft.length) {
      setRadarTargets([]);
      setRadarLastSweepTick(tick);
      return;
    }
    if (radarTargets.length === 0 || !running || tick - radarLastSweepTick >= RADAR_SWEEP_TICKS) {
      setRadarTargets(aircraft.map((a) => ({ ...a, radarSweepTick: tick })));
      setRadarLastSweepTick(tick);
    }
  }, [aircraft, tick, running, radarLastSweepTick, radarTargets.length]);
  const missionAirspaceViolations = useMemo(() => aircraft.map((a) => missionRestrictionViolation(a, activeCorridors, isGroundTraffic)).filter(Boolean), [aircraft, activeCorridors]);
  const missionViolationIds = useMemo(() => new Set(missionAirspaceViolations.map((v) => v.id)), [missionAirspaceViolations]);

  useEffect(() => {
    autoConfigRef.current = { autoSpawn, spawnRate, depAuto, depRate, milAuto, aircraft, seq, lastDepTick, lastMilTick, env, activeRunway, depRunway, depRunways: openDepRunways, timeScale };
  }, [autoSpawn, spawnRate, depAuto, depRate, milAuto, aircraft, seq, lastDepTick, lastMilTick, env, activeRunway, depRunway, timeScale]);

  const tr = (key) => translate(I18N, lang, key);
  const onOff = (value) => onOffText(value, tr);
  const catText = (cat) => categoryText(cat, lang, tr);
  const vnavText = (status) => vnavDisplayText(status, lang);
  const contactText = (contact) => contactDisplayText(contact, lang);
  const modeText = (aircraft) => modeDisplayText(aircraft, { lang, tr, displayMode });
  const selected = aircraft.find((a) => a.id === selectedId) || aircraft[0] || makeEmptyAircraft();
  const {
    openArrRunways,
    openDepRunways,
    runwayRoleOf,
    preferredArrivalRunwayFor,
    setRunwayRole,
    setRunwayEndPlan,
    displayedRunwaySets,
    transitionOps,
    runwayNoticeVisible,
    runwayNoticeAccent,
    runwayNoticeTitle,
    runwayNoticeBody,
    runwayDisplaySet,
  } = useRunwayPlanner({
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
  });
  const scenarioLocked = gameMode === "SCENARIO";
  const selectedBR = xyToBearingRange(selected.x, selected.y), selectedGeo = finalGeometryForAircraft(selected, env, selected.x, selected.y);
  const selectedVnavAlt = vnavTargetAltitude(selected, env);
  const selectedVnavStatus = vnavStatus(selected, env);

  function selectAircraft(id) {
    const ac = aircraft.find((a) => a.id === id);
    setSelectedId(id);
    if (ac) setSeat(seatForAircraft(ac));
  }
  useEffect(() => {
    setHeading(fmt3(selected.assignedHeading));
    setAltitude(String(Math.round(selected.assignedAltitude)));
    setSpeed(String(Math.round(selected.assignedSpeed)));
  }, [selectedId]);
  useEffect(() => {
    applyPendingCommands({ pendingCommands, tick, setPendingCommands, setAircraft, setLog });
  }, [tick, pendingCommands]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setTick((t) => {
        const next = t + timeScale;
        if (Math.floor(next / 60) !== Math.floor(t / 60)) setWeatherTick(next);
        return next;
      });
      setRealTick((t) => t + timeScale);
      setAircraft((prev) => {
        let landedNow = 0, moved = prev;
        for (let i = 0; i < timeScale; i++) moved = moved.map((a) => { const n = normalizeAircraftState(aircraftStep(a, env)); if (!a.touchdown && n.touchdown) landedNow++; return n; });
        if (landedNow) { setLandedCount((c) => c + landedNow); setLog((old) => [`Tower: ${landedNow} aircraft touchdown RWY ${env.runway.name}, rollout.`, ...old].slice(0, 14)); }
        moved = applyTowerAutomation(moved, env, towerAuto, { finalLandingState, inTowerAirspace, runwayOccupied }).map(normalizeAircraftState);
        return moved.filter((a) => {
          if (a.landed || a.handedOff) return false;
          const br = xyToBearingRange(a.x, a.y);
          if (a.category === "DEP") return br.rangeNm < 180;
          return br.rangeNm < 110 && a.x > -220 && a.x < 940 && a.y > -220 && a.y < 940;
        });
      });
    }, 500);
    return () => window.clearInterval(interval);
  }, [running, timeScale, env]);
  useEffect(() => {
    runScenario05Orchestration({
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
    });
  }, [running, gameMode, scenarioId, scenarioEventsDone.foxhoundFailed, scenarioEventsDone.foxhoundSuccess, tick, aircraft, env]);

  useEffect(() => {
    runAutoTrafficSpawn({ running, gameMode, autoConfigRef, tick, setSeq, setAircraft, setLastDepTick, setLastMilTick, setLog });
  }, [tick, running, gameMode]);

  useEffect(() => {
    runScenarioTrafficEvents({
      running,
      gameMode,
      scenarioId,
      tick,
      realTick,
      scenarioEventsDone,
      scenarioTrafficDone,
      env,
      depRunway,
      setScenarioTrafficDone,
      setAircraft,
      setLog,
      setWind,
      setWeatherOn,
      setWeatherSeed,
      setActiveRunway,
      setDepRunway,
      setArrRunways,
      setDepRunways,
      setClosedRunways,
      setScenarioEventsDone,
    });
  }, [running, gameMode, scenarioId, tick, realTick, scenarioEventsDone, scenarioTrafficDone, env, depRunway]);

  const separationAlerts = useMemo(() => {
    const alerts = [];
    const sorted = [...aircraft].sort((a, b) => a.x - b.x);
    const lateralCutoffPx = 8 * PX_PER_NM;
    const finalWakeModes = new Set(["ILS", "FINAL", "FINAL_NO_CLEAR", "TWR_FINAL", "FINAL_LAND", "UNSTABLE_ILS"]);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (b.x - a.x > lateralCutoffPx) break;
        if (a.landed || a.handedOff || b.landed || b.handedOff) continue;
        if (isScenario05InterceptPair(a, b)) continue;
        if (a.category === "MIL" && b.category === "MIL") continue;
        if (isGroundTraffic(a) || isGroundTraffic(b)) continue;
        const radar = separationAssessment(a, b);
        if (radar.level !== "NONE") alerts.push(radar);
        const wakeCandidate = a.category === "ARR" && b.category === "ARR" && finalWakeModes.has(a.mode) && finalWakeModes.has(b.mode);
        if (!wakeCandidate) continue;
        const wakeAB = wakeAssessment(a, b, env, WAKE_ASSESSMENT_DEPS);
        const wakeBA = wakeAssessment(b, a, env, WAKE_ASSESSMENT_DEPS);
        if (wakeAB && wakeAB.level !== "NONE") alerts.push(wakeAB);
        if (wakeBA && wakeBA.level !== "NONE") alerts.push(wakeBA);
      }
    }
    return alerts;
  }, [aircraft, env]);
  const conflictDetails = useMemo(() => separationAlerts.filter((p) => p.level === "RED"), [separationAlerts]);
  const cautionDetails = useMemo(() => separationAlerts.filter((p) => p.level === "AMBER"), [separationAlerts]);
  const conflictPairs = useMemo(() => conflictDetails.map((p) => `${p.a}/${p.b}`), [conflictDetails]);
  const conflictIds = useMemo(() => new Set(conflictDetails.flatMap((p) => [p.a, p.b])), [conflictDetails]);
  const cautionIds = useMemo(() => new Set(cautionDetails.flatMap((p) => [p.a, p.b])), [cautionDetails]);
  useEffect(() => {
    if (gameMode !== "SCENARIO") { setConflictFirstTick(null); return; }
    if (conflictDetails.length > 0) setConflictFirstTick((v) => v ?? tick);
    else setConflictFirstTick(null);
  }, [gameMode, conflictDetails.length, tick]);
  useEffect(() => {
    const activeArrIds = aircraft.filter((a) => a.category === "ARR" && !a.handedOff && !a.landed && !a.hold && !["VACATED", "ROLLOUT", "HOLD", "MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "DIVERT", "ALT_HANDOFF", "MAYDAY", "PANPAN"].includes(a.mode)).map((a) => a.id);
    setArrivalSequence((prev) => {
      const kept = prev.filter((s) => activeArrIds.includes(s.id));
      const plan = scenarioTrafficPlan(scenarioId);
      const nowSec = tick / 2;
      const missing = activeArrIds.filter((id) => !kept.some((s) => s.id === id)).map((id) => {
        const ac = aircraft.find((a) => a.id === id);
        const planned = gameMode === "SCENARIO" ? plan.find((i) => i.id === id) : null;
        const etaSec = planned?.etaSec ?? (planned ? planned.at / 2 + 1080 : nowSec + (ac ? estimateArrivalEtaSec(ac, env, SEQUENCING_DEPS) : 1200));
        return { id, manualPosition: null, etaSec };
      });
      const next = [...kept, ...missing];
      return next.length === prev.length && next.every((s, i) => s.id === prev[i]?.id && s.manualPosition === prev[i]?.manualPosition) ? prev : next;
    });
  }, [aircraft, gameMode, scenarioId, tick, env]);
  const conflictFailureReady = conflictFirstTick !== null && tick - conflictFirstTick >= 12;
  const missedCount = aircraft.filter((a) => a.missed || a.mode === "MISSED_APP" || a.mode === "MISSED").length;
  const fuelOutAircraft = aircraft.find((a) => isFuelOutMode(a) && !a.landed && !a.handedOff);
  const simSeconds = tick / 2;
  const snowRemovalNotice = useMemo(() => buildSnowRemovalNotice({ scenarioId, closedRunways, realTick }), [scenarioId, closedRunways, realTick]);
  const rjcjPriorityNotice = useMemo(() => buildRjcjPriorityNotice({ scenarioId, scenarioEventsDone, tick, lang }), [scenarioId, scenarioEventsDone.foxhoundPreAlert, scenarioEventsDone.foxhoundSuccess, scenarioEventsDone.eagleRecovered, scenarioEventsDone.foxhoundFailed, scenarioEventsDone.fuelOutFailed, scenarioEventsDone.fuelOutId, tick, lang]);
  const sequenceRows = useMemo(() => buildSequenceRows({ arrivalSequence, aircraft, env, simSeconds, estimateArrivalEtaSec, sequenceGapAssessment, finalGeometryForAircraft, sequencingDeps: SEQUENCING_DEPS }), [arrivalSequence, aircraft, env, simSeconds]);
  function moveInSequence(id, direction) { setArrivalSequence((prev) => moveArrivalInSequence(prev, arrivalStripRows, id, direction)); }
  function resetSequenceAuto() { setArrivalSequence(resetArrivalSequenceAuto); }
  const scenarioObjective = scenarioObjectives(scenarioId);
  const scenarioPlan = scenarioTrafficPlan(scenarioId);
  const arrivalStripRows = useMemo(() => buildArrivalStripRows({ gameMode, scenarioPlan, scenarioTrafficDone, sequenceRows, arrivalSequence }), [sequenceRows, gameMode, scenarioPlan, scenarioTrafficDone, arrivalSequence]);
  const { scenario05Complete, normalScenarioComplete, scenarioComplete, scenarioFailed, scenarioEnded } = deriveScenarioStatus({ gameMode, scenarioObjective, scenarioEventsDone, landedCount, handoffCount, conflictPairs, conflictFailureReady, missedCount, fuelOutAircraft, tick });
  useEffect(() => { if (scenarioEnded && running) setRunning(false); }, [scenarioEnded, running]);

  const buttonStyle = { border: "1px solid #2d3748", background: "#111827", color: "#e5e7eb", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontWeight: 700 };
  const activeButton = { ...buttonStyle, background: "#1d4ed8" }, dangerButtonStyle = { ...buttonStyle, background: "#3f1d1d", border: "1px solid #7f1d1d" };
  const inputStyle = { width: "100%", border: "1px solid #374151", background: "#030712", color: "#e5e7eb", padding: "8px 10px", borderRadius: 10, fontFamily: "monospace" };
  const smallText = { fontSize: 12, color: "#9ca3af", lineHeight: 1.45 };
  const {
    applyVectorHeading,
    issueCommand,
    altitudeOnly,
    spawnNow,
    spawnMil,
    debugSpawn,
    divertSelected,
    divertAll,
    assignRoute,
    holdAtFix,
    clearILS,
    clearVisual,
    towerLineUpWait,
    towerGoAround,
    towerClearLand,
    towerTakeoffClear,
    speedOnly,
    goAround,
    resumeSid,
    climbDep,
    unrestrictedClimbDep,
    handoffACC,
    deleteSelected,
    directToWaypointForRunway,
    directToWaypoint,
  } = useCommandHandlers({
    MAX_TARGETS,
    PATTERN_ALT,
    PX_PER_NM,
    RUNWAYS,
    activeRunway,
    aircraft,
    altitude,
    alternateHandoffRadiusNm,
    approachRunwayChangeRequiresMissed,
    approachSpeedFor,
    buildAppReacquirePatch,
    canClearVisual,
    clamp,
    commandDelayEnabled,
    commandDelaySec,
    companyCostIndexSpeed,
    depExitReady,
    depRunway,
    departureRunwayEntry,
    env,
    fmt3,
    heading,
    headingToPoint,
    holdAltitude,
    holdFix,
    ilsGateState,
    isApproachMode,
    isGroundTraffic,
    landingClearancePatch,
    lastDepTick,
    makeDeparture,
    makeMilitary,
    makeNavCached,
    makeRandomArrival,
    makeRoutes,
    makeSids,
    missedApproachPatch,
    normHeading,
    normalizeAircraftState,
    openArrRunways,
    openDepRunways,
    preferredArrivalRunwayFor,
    runwayOccupied,
    scenarioEnded,
    seat,
    selected,
    selectedBR,
    selectedId,
    selectAircraft,
    seq,
    setAircraft,
    setAltitude,
    setHandoffCount,
    setHeading,
    setLastDepTick,
    setLog,
    setPendingCommands,
    setSeq,
    setSpeed,
    speed,
    speedLimitForAircraft,
    suggestHoldForBearing,
    suggestRouteForBearing,
    tick,
    visualDownwindEntry,
    vnavTargetAltitude,
    wp,
    xyToBearingRange,
  });
  const viewSize = 900 / zoom, viewCenter = followSelected ? { x: selected.x, y: selected.y } : { x: radarView.x, y: radarView.y }, viewBox = `${viewCenter.x - viewSize / 2} ${viewCenter.y - viewSize / 2} ${viewSize} ${viewSize}`;
  const {
    handleRadarClick,
    handleRadarMouseDown,
    handleRadarMouseMove,
    handleRadarMouseLeave,
    stopRadarPan,
    handleRadarWheel,
  } = useRadarInteractions({
    svgRef,
    viewBox,
    mouseVectorMode,
    selected,
    radarView,
    viewSize,
    followSelected,
    getRadarPointFromEvent,
    headingToPoint,
    applyVectorHeading,
    setMouseVectorMode,
    setVectorPreview,
    setRadarView,
    setZoom,
    clamp,
  });
  const { startMode, backToMainMenu, reset } = useSessionController({
    activeRunway,
    depRunway,
    dualRunway,
    gameMode,
    scenarioId,
    runwayMode,
    weatherOn,
    setActiveRunway,
    setAircraft,
    setApproachRunwayChoice,
    setArrivalSequence,
    setArrRunways,
    setAutoSpawn,
    setClosedRunways,
    setConflictFirstTick,
    setDepAuto,
    setDepRunway,
    setDepRunways,
    setGameMode,
    setHandoffCount,
    setLastDepTick,
    setLastMilTick,
    setLandedCount,
    setLog,
    setMilAuto,
    setMouseVectorMode,
    setPendingCommands,
    setRadarLastSweepTick,
    setRadarTargets,
    setRealTick,
    setRunwayChangeCandidate,
    setRunwayMode,
    setRunning,
    setScenarioEventsDone,
    setScenarioId,
    setScenarioTrafficDone,
    setSeat,
    setSelectedId,
    setSeq,
    setStartScreen,
    setTick,
    setTowerAuto,
    setVectorPreview,
    setWeatherOn,
    setWeatherSeed,
    setWeatherTick,
    setWind,
    setWindMode,
    setWindOffset,
  });
  const showAirportIls = (id) => shouldShowAirportIls(id, { seat, selected });
  const runwayLabelForRole = (role) => formatRunwayLabelForRole(role, lang);
  const depCount = aircraft.filter((a) => a.category === "DEP").length, arrCount = aircraft.filter((a) => a.category !== "DEP").length;
  const delayPenalty = sequenceRows.reduce((sum, r) => sum + Math.floor((r.delay || 0) / 60) * 6, 0);
  const missionPenalty = missionAirspaceViolations.length * 65;
  const score = landedCount * 120 + handoffCount * 90 - conflictPairs.length * 80 - delayPenalty - missionPenalty + aircraft.reduce((sum, a) => sum + scoreAircraft(a), 0);
  const emergencyCount = aircraft.filter((a) => a.emergency || a.mode === "MAYDAY" || a.mode === "PANPAN").length;
  const lowFuelCount = aircraft.filter((a) => (a.fuelMinutes ?? 60) < 15).length;
  return (
    <AppShell
      {...{
      RJCC_RUNWAY_NAMES, RUNWAYS, SCENARIOS, activeButton, activeCorridors, activeRunway, aircraft, alternateHandoffLabel, alternateHandoffRadiusNm, altitude, altitudeOnly, approachRunwayChoice,
      arrCount, arrivalStripRows, assignRoute, backToMainMenu, buttonStyle, catText, cautionDetails, unrestrictedClimbDep, svgRef, scenarioId, resumeSid, debugSpawn,
      clamp, cautionIds, clearILS, clearVisual, closedRunways, commandDelayEnabled, commandDelaySec, conflictDetails, conflictIds, conflictPairs, contactText, dangerButtonStyle,
      delayPenalty, deleteSelected, depCount, depRunway, directToWaypoint, directToWaypointForRunway, displayedRunwaySets, divertAll, divertRequired, divertSelected, emergencyCount, env,
      fmt3, fmtFL, followSelected, formatEta, formatJstTime, formatSignedClock, fuelOutAircraft, gameMode, getAircraftMissionArea, goAround, handleRadarClick, handleRadarMouseDown,
      handleRadarMouseLeave, handleRadarMouseMove, handleRadarWheel, handoffACC, handoffCount, heading, holdAtFix, inputStyle, issueCommand, landedCount, lang, log,
      lowFuelCount, militaryBingoFuelMinutes, missedCount, missionAirspaceViolations, missionPenalty, modeText, mouseVectorMode, moveInSequence, onOff, openArrRunways, openDepRunways, parallelApproach,
      pendingCommands, preferredArrivalRunwayFor, qnh, radarDisplayTargets, radarSweepAgeSec, radarView, radioCollapsed, reset, resetSequenceAuto, rjcjHelipadPoint, rjcjPriorityNotice, running,
      runwayChangeCandidate, runwayDisplaySet, runwayHeadwind, runwayLabelForRole, runwayNoticeAccent, runwayNoticeBody, runwayNoticeTitle, runwayNoticeVisible, runwayOccupied, runwayPairName, runwayRoleOf, scenarioComplete,
      scenarioEnded, scenarioEventsDone, scenarioFailed, scenarioLocked, scenarioObjective, score, seat, seatForAircraft, selectAircraft, selected, selectedBR, selectedGeo,
      selectedId, selectedVnavAlt, selectedVnavStatus, setAltitude, setApproachRunwayChoice, setCommandDelayEnabled, setCommandDelaySec, setFollowSelected, setHeading, setLang, setMouseVectorMode, setParallelApproach,
      setQnh, setRadioCollapsed, setRunning, setRunwayEndPlan, setRunwayRole, setSeat, setSpeed, setSystemCollapsed, setTimeScale, setVectorPreview, showAirportIls, simSeconds,
      smallText, snowRemovalNotice, spawnMil, spawnNow, speed, speedOnly, startMode, startScreen, stopRadarPan, systemCollapsed, tick, timeScale,
      towerAuto, towerClearLand, towerGoAround, towerLineUpWait, towerQueue, towerTakeoffClear, tr, transitionOps, vectorPreview, viewBox, viewCenter, viewSize,
      vnavStatus, vnavText, wakeCategory, wakeShort, weatherOn, windObj, zoom
      }}
    />
  );

}
