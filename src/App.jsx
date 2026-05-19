import { useEffect, useMemo, useRef, useState } from "react";
import MissionStatusPanel from "./components/MissionStatusPanel.jsx";
import ObjectivePanel from "./components/ObjectivePanel.jsx";
import RadioLog from "./components/RadioLog.jsx";
import CommandPanel from "./components/CommandPanel.jsx";
import ControlConsole from "./components/ControlConsole.jsx";
import RadarScope from "./components/RadarScope.jsx";
import RunwayControls from "./components/RunwayControls.jsx";
import SequenceStrip from "./components/SequenceStrip.jsx";
import SelectedAircraftPanel from "./components/SelectedAircraftPanel.jsx";
import StartScreen from "./components/StartScreen.jsx";
import { useCommandHandlers } from "./hooks/useCommandHandlers.js";
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
  ptsString,
  runwayPoint,
  runwayPointAt,
  shortestTurn,
  withSeededRandom,
  xyToBearingRange,
} from "./simulator/geometry.js";
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
import { buildRjccRunwayDisplaySet, computeRadarDisplayTargets, runwayLabelForRole as formatRunwayLabelForRole, runwayRoleOf as computeRunwayRoleOf, showAirportIls as shouldShowAirportIls } from "./simulator/radarState.js";
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
  const openArrRunways = useMemo(() => normalizeRunwayList(arrRunways.filter((r) => !closedRunways.includes(r)), activeRunway), [arrRunways, closedRunways, activeRunway]);
  const openDepRunways = useMemo(() => normalizeRunwayList(depRunways.filter((r) => !closedRunways.includes(r)), depRunway), [depRunways, closedRunways, depRunway]);
  const weatherCells = useMemo(
    () => makeWeatherCells(weatherTick / 60, weatherSeed, scenarioId),
    [weatherTick, weatherSeed, scenarioId]
  );
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
  const displayedRunwaySets = transitionRunwaySet(activeRunway, depRunway, runwayChangeCandidate);
  const pendingRunways = runwayChangeCandidate.pair ? runwayPairRunways(runwayChangeCandidate.pair) : null;
  const transitionOps = !!runwayChangeCandidate.pair;
  const runwayNoticeVisible = !!runwayChangeCandidate.pair || crosswindNeutral;
  const runwayNoticeAccent = runwayChangeCandidate.pair ? "#f59e0b" : "#38bdf8";
  const runwayNoticeTitle = runwayChangeCandidate.pair
    ? (lang === "zh" ? "跑道换向等待" : "RUNWAY CHANGE PENDING")
    : (lang === "zh" ? "侧风主导，保持当前跑道" : "CROSSWIND NEUTRAL — RUNWAY HELD");
  const runwayNoticeBody = runwayChangeCandidate.pair
    ? (lang === "zh"
      ? `过渡运行中：当前 ARR ${activeRunway} / DEP ${depRunway}，候选 ARR ${pendingRunways?.arr || "-"} / DEP ${pendingRunways?.dep || "-"}，剩余 ${Math.max(0, Math.ceil((240 - (tick - runwayChangeCandidate.since)) / 2))} 秒。当前方向保持自动运行，候选方向作为手动接入参考显示。`
      : `Transition ops: current ARR ${activeRunway} / DEP ${depRunway}, candidate ARR ${pendingRunways?.arr || "-"} / DEP ${pendingRunways?.dep || "-"}, ${Math.max(0, Math.ceil((240 - (tick - runwayChangeCandidate.since)) / 2))}s remaining. Current side remains automatic; candidate side is displayed for manual use.`)
    : (lang === "zh"
      ? `01/19 顶风分量接近对称；当前保持 ARR ${activeRunway} / DEP ${depRunway}`
      : `01/19 headwind component nearly neutral; holding ARR ${activeRunway} / DEP ${depRunway}`);
  const selected = aircraft.find((a) => a.id === selectedId) || aircraft[0] || makeEmptyAircraft();
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
  function svgEventToRadarPoint(e) { return getRadarPointFromEvent(e, svgRef.current, viewBox); }
  function handleRadarMove(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (p) setVectorPreview({ ...p, heading: headingToPoint(selected.x, selected.y, p) }); }
  function handleRadarClick(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (!p) return; applyVectorHeading(headingToPoint(selected.x, selected.y, p)); setMouseVectorMode(false); setVectorPreview(null); }
  function handleRadarMouseDown(e) { if (e.button !== 0 || mouseVectorMode || followSelected) return; e.preventDefault(); setRadarView((v) => ({ ...v, panning: true, lastX: e.clientX, lastY: e.clientY })); }
  function handleRadarMouseMove(e) { if (radarView.panning) { const svg = svgRef.current; const rect = svg?.getBoundingClientRect(); if (rect) { const dx = ((e.clientX - radarView.lastX) / rect.width) * viewSize; const dy = ((e.clientY - radarView.lastY) / rect.height) * viewSize; setRadarView((v) => ({ ...v, x: v.x - dx, y: v.y - dy, lastX: e.clientX, lastY: e.clientY })); } return; } handleRadarMove(e); }
  function stopRadarPan() { setRadarView((v) => ({ ...v, panning: false })); }
  function handleRadarMouseLeave() { stopRadarPan(); if (mouseVectorMode) setVectorPreview(null); }
  function handleRadarWheel(e) { e.preventDefault(); setZoom((z) => clamp(Number((z + (e.deltaY < 0 ? 0.35 : -0.35)).toFixed(2)), 0.55, 8)); }
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
  const runwayDisplaySet = useMemo(() => buildRjccRunwayDisplaySet({ runwayChangeCandidate, runwayNames: RJCC_RUNWAY_NAMES, runwayPairRunways, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway }), [runwayChangeCandidate, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway]);
  const viewSize = 900 / zoom, viewCenter = followSelected ? { x: selected.x, y: selected.y } : { x: radarView.x, y: radarView.y }, viewBox = `${viewCenter.x - viewSize / 2} ${viewCenter.y - viewSize / 2} ${viewSize} ${viewSize}`;
  const depCount = aircraft.filter((a) => a.category === "DEP").length, arrCount = aircraft.filter((a) => a.category !== "DEP").length;
  const delayPenalty = sequenceRows.reduce((sum, r) => sum + Math.floor((r.delay || 0) / 60) * 6, 0);
  const missionPenalty = missionAirspaceViolations.length * 65;
  const score = landedCount * 120 + handoffCount * 90 - conflictPairs.length * 80 - delayPenalty - missionPenalty + aircraft.reduce((sum, a) => sum + scoreAircraft(a), 0);
  const emergencyCount = aircraft.filter((a) => a.emergency || a.mode === "MAYDAY" || a.mode === "PANPAN").length;
  const lowFuelCount = aircraft.filter((a) => (a.fuelMinutes ?? 60) < 15).length;
  if (startScreen) {
    return (
      <StartScreen
        scenarios={SCENARIOS}
        lang={lang}
        tr={tr}
        buttonStyle={buttonStyle}
        onToggleLang={() => setLang((v) => v === "en" ? "zh" : "en")}
        onStartMode={startMode}
      />
    );
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#020617", color: "#e5e7eb", padding: 10, boxSizing: "border-box", position: "relative" }}>
      {scenarioEnded ? <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(2, 6, 23, 0.80)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
        <div style={{ border: `3px solid ${scenarioComplete ? "#22c55e" : "#ef4444"}`, background: "rgba(2, 6, 23, 0.97)", borderRadius: 28, padding: "34px 42px", minWidth: 560, maxWidth: 780, textAlign: "center", boxShadow: `0 0 55px ${scenarioComplete ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.32)"}` }}>
          <div style={{ fontSize: 48, fontWeight: 950, letterSpacing: 2, color: scenarioComplete ? "#22c55e" : "#ef4444", marginBottom: 12 }}>{scenarioComplete ? (lang === "zh" ? "任务完成" : "MISSION COMPLETE") : (lang === "zh" ? "任务失败" : "MISSION FAILED")}</div>
          <div style={{ fontFamily: "monospace", color: "#cbd5e1", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
            TIME {Math.floor(tick / 120)} / {Math.floor((scenarioObjective?.duration || 0) / 120)} min<br />
            LAND {landedCount}/{scenarioObjective?.landed ?? "-"} | ACC {handoffCount}/{scenarioObjective?.handoff ?? "-"}<br />
            CONFLICT {conflictPairs.length}/{scenarioObjective?.maxConflict ?? "-"} | MISSED {missedCount}/{scenarioObjective?.maxMissed ?? "-"}<br />
            {conflictDetails.length ? conflictDetails.map((p) => p.kind === "WAKE" ? `WAKE ${p.lead}>${p.trail} RWY ${p.runway} ${p.spacingNm.toFixed(1)}/${p.requiredNm.toFixed(1)}NM` : `RADAR ${p.a}/${p.b} ${p.lateralNm.toFixed(1)}NM ${Math.round(p.verticalFt)}FT`).join(" | ") : ""}<br />
            {scenarioFailed && fuelOutAircraft ? (lang === "zh" ? `失败原因：${fuelOutAircraft.id} 燃油耗尽。` : `Failure reason: ${fuelOutAircraft.id} fuel exhausted.`) : ""}<br />
            {scenarioFailed && conflictPairs.length > (scenarioObjective?.maxConflict ?? 99) ? (lang === "zh" ? "失败原因：管制冲突。" : "Failure reason: separation conflict.") : ""}<br />
            {scenarioFailed && missedCount > (scenarioObjective?.maxMissed ?? 99) ? (lang === "zh" ? "失败原因：复飞次数超限。" : "Failure reason: missed approach limit exceeded.") : ""}<br />
            {scenarioFailed && tick > (scenarioObjective?.duration || 0) + 240 ? (lang === "zh" ? "失败原因：超过任务时间。" : "Failure reason: mission time exceeded.") : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button style={{ ...buttonStyle, background: "#1d4ed8", fontSize: 16, padding: "13px 18px" }} onClick={reset}>{lang === "zh" ? "重试本关" : "Retry Scenario"}</button>
            <button style={{ ...buttonStyle, background: "#111827", fontSize: 16, padding: "13px 18px" }} onClick={backToMainMenu}>{lang === "zh" ? "返回主界面" : "Main Menu"}</button>
          </div>
        </div>
      </div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr 360px", gap: 10, width: "100%", height: "100%", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "calc(100vh - 20px)", overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 16, padding: 10, flex: "0 0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={{ ...buttonStyle, background: running ? "#7f1d1d" : "#1d4ed8", padding: "9px 10px" }} disabled={scenarioEnded} onClick={() => setRunning((v) => !v)}>{running ? tr("pause") : tr("run")}</button>
              <button style={{ ...buttonStyle, padding: "9px 10px" }} onClick={backToMainMenu}>{lang === "zh" ? "返回主界面" : "Main Menu"}</button>
            </div>
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>JST {formatJstTime(simSeconds)} | {running ? (lang === "zh" ? "运行中" : "RUNNING") : (lang === "zh" ? "暂停" : "PAUSED")}</div>
            {gameMode === "DEBUG" ? <div style={{ marginTop: 8, border: "1px solid #7c2d12", background: "#120a04", borderRadius: 10, padding: 7 }}>
              <div style={{ fontSize: 11, color: "#fed7aa", fontFamily: "monospace", marginBottom: 6 }}>{lang === "zh" ? "开发调试生成入口" : "DEVELOPER DEBUG SPAWN"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("ARR")}>ARR</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("DEP")}>DEP</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL")}>MIL</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "F-15J")}>F-15J</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "U-125A")}>U-125A</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "UH-60J")}>UH-60J</button>
              </div>
            </div> : null}
          </div>

          <SequenceStrip
            lang={lang}
            simSeconds={simSeconds}
            buttonStyle={buttonStyle}
            smallText={smallText}
            arrivalStripRows={arrivalStripRows}
            formatJstTime={formatJstTime}
            formatSignedClock={formatSignedClock}
            formatEta={formatEta}
            fmtFL={fmtFL}
            wakeCategory={wakeCategory}
            wakeShort={wakeShort}
            onResetAuto={resetSequenceAuto}
            onMove={moveInSequence}
          />

          <RadioLog
            title={tr("radioLog")}
            buttonStyle={buttonStyle}
            collapsed={radioCollapsed}
            lang={lang}
            log={log}
            onToggle={() => setRadioCollapsed((v) => !v)}
          />

          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 10, flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{tr("systemAutomation")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setLang((v) => v === "en" ? "zh" : "en")}>{tr("langButton")}</button>
                <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setSystemCollapsed((v) => !v)}>{systemCollapsed ? (lang === "zh" ? "展开" : "Show") : (lang === "zh" ? "收起" : "Hide")}</button>
              </div>
            </div>
            {!systemCollapsed ? <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginTop: 8 }}>
                <button style={{ ...buttonStyle, padding: "7px 8px" }} onClick={reset}>{tr("reset")}</button>
              </div>
              <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, marginTop: 8, color: "#bfdbfe", fontSize: 12, lineHeight: 1.38 }}>
                {tr("wind")}: {fmt3(windObj.dir)}/{windObj.speed} | {tr("headwind")}: {env.headwind.toFixed(1)} kt | {tr("tailwind")}: {env.tailwind.toFixed(1)} kt<br />
                ARR {activeRunway} / DEP {depRunway} | WX {weatherOn ? "ON" : "OFF"}<br />{lang === "zh" ? "指令延迟" : "CMD DELAY"} {commandDelayEnabled ? `${commandDelaySec}s` : (lang === "zh" ? "关" : "OFF")} | {lang === "zh" ? "待执行" : "PENDING"} {pendingCommands.length}
              </div>
              <label style={{ display: "block", fontSize: 12, marginTop: 8 }}>{tr("qnh")}<input value={qnh} onChange={(e) => setQnh(e.target.value)} style={inputStyle} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <button style={commandDelayEnabled ? activeButton : buttonStyle} onClick={() => setCommandDelayEnabled((v) => !v)}>{lang === "zh" ? "指令延迟" : "CMD DELAY"} {commandDelayEnabled ? (lang === "zh" ? "开" : "ON") : (lang === "zh" ? "关" : "OFF")}</button>
                <label style={{ fontSize: 12 }}>{lang === "zh" ? "延迟秒数" : "Delay sec"}<input value={commandDelaySec} onChange={(e) => setCommandDelaySec(clamp(Number(e.target.value) || 0, 0, 20))} style={inputStyle} /></label>
              </div>
              {pendingCommands.length ? <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#fbbf24", lineHeight: 1.35 }}>{pendingCommands.slice(-4).map((c) => `${c.targetId} ${c.label} T-${Math.max(0, ((c.dueTick - tick) / 2)).toFixed(1)}s`).join(" | ")}</div> : null}
            </> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "calc(100vh - 20px)", overflow: "hidden" }}>
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 800, fontFamily: "monospace" }}>{tr("radar")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "34px 56px 34px", gap: 4, alignItems: "center" }}>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.max(1, v / 2))}>-</button>
                <div style={{ border: "1px solid #374151", background: "#030712", borderRadius: 10, padding: "8px 0", textAlign: "center", fontFamily: "monospace", fontWeight: 900 }}>{timeScale}x</div>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.min(8, v * 2))}>+</button>
              </div>
            </div>
            <RadarScope
              svgRef={svgRef}
              viewBox={viewBox}
              viewCenter={viewCenter}
              viewSize={viewSize}
              zoom={zoom}
              seat={seat}
              activeRunway={activeRunway}
              windObj={windObj}
              qnh={qnh}
              radarSweepAgeSec={radarSweepAgeSec}
              snowRemovalNotice={snowRemovalNotice}
              rjcjPriorityNotice={rjcjPriorityNotice}
              fmt3={fmt3}
              fmtFL={fmtFL}
              weatherOn={weatherOn}
              env={env}
              runwayDisplaySet={runwayDisplaySet}
              runwayLabelForRole={runwayLabelForRole}
              showAirportIls={showAirportIls}
              rjcjHelipadPoint={rjcjHelipadPoint}
              aircraft={aircraft}
              alternateHandoffRadiusNm={alternateHandoffRadiusNm}
              alternateHandoffLabel={alternateHandoffLabel}
              activeCorridors={activeCorridors}
              scenarioId={scenarioId}
              scenarioEventsDone={scenarioEventsDone}
              lang={lang}
              directToWaypoint={directToWaypoint}
              directToWaypointForRunway={directToWaypointForRunway}
              mouseVectorMode={mouseVectorMode}
              vectorPreview={vectorPreview}
              selected={selected}
              radarDisplayTargets={radarDisplayTargets}
              selectedId={selectedId}
              conflictIds={conflictIds}
              cautionIds={cautionIds}
              selectAircraft={selectAircraft}
              vnavStatus={vnavStatus}
              modeText={modeText}
              radarView={radarView}
              handleRadarClick={handleRadarClick}
              handleRadarMouseDown={handleRadarMouseDown}
              handleRadarMouseMove={handleRadarMouseMove}
              handleRadarMouseLeave={handleRadarMouseLeave}
              stopRadarPan={stopRadarPan}
              handleRadarWheel={handleRadarWheel}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "calc(100vh - 20px)", overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
          <ControlConsole
            title={tr("controlConsole")}
            seat={seat}
            lang={lang}
            activeButton={activeButton}
            buttonStyle={buttonStyle}
            selectedId={selectedId}
            aircraft={aircraft}
            inputStyle={inputStyle}
            modeText={modeText}
            onSeatChange={setSeat}
            onSelectAircraft={selectAircraft}
            selectedPanel={<SelectedAircraftPanel
              selected={selected}
              selectedBR={selectedBR}
              selectedGeo={selectedGeo}
              selectedVnavStatus={selectedVnavStatus}
              selectedVnavAlt={selectedVnavAlt}
              env={env}
              activeRunway={activeRunway}
              tr={tr}
              lang={lang}
              fmt3={fmt3}
              fmtFL={fmtFL}
              catText={catText}
              seatForAircraft={seatForAircraft}
              militaryBingoFuelMinutes={militaryBingoFuelMinutes}
              vnavText={vnavText}
              modeText={modeText}
              contactText={contactText}
            />}
          >
            {seat !== "RJCJ" ? <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                <label style={{ fontSize: 12 }}>{tr("targetHdg")}<input value={heading} onChange={(e) => setHeading(e.target.value)} style={inputStyle} /></label>
                <label style={{ fontSize: 12 }}>{tr("targetAlt")}<input value={altitude} onChange={(e) => setAltitude(e.target.value)} style={inputStyle} /></label>
                <label style={{ fontSize: 12 }}>{tr("targetSpd")}<input value={speed} onChange={(e) => setSpeed(e.target.value)} style={inputStyle} /></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                <button style={buttonStyle} onClick={issueCommand}>{tr("vector")}</button>
                <button style={buttonStyle} onClick={() => { setMouseVectorMode((v) => !v); setVectorPreview(null); }}>{mouseVectorMode ? tr("mouseArmed") : tr("mouseVector")}</button>
                <button style={buttonStyle} onClick={altitudeOnly}>ALT</button>
                <button style={buttonStyle} onClick={speedOnly}>SPD</button>
                {!scenarioLocked ? <button style={dangerButtonStyle} onClick={deleteSelected}>{tr("remove")}</button> : null}
              </div>
            </> : <div style={{ border: "1px solid #334155", background: "#020617", borderRadius: 12, padding: 10, marginTop: 10, ...smallText }}>
              {lang === "zh" ? "RJCJ 任务状态为只读。本席位仅作为协调信息板，不提供战术引导、高度、速度、返场、备降、删除或生成军机等控制功能。" : "RJCJ MISSION STATUS is read-only. This seat is a coordination display only; no tactical vector, altitude, speed, recovery, diversion, deletion, or spawn controls are available here."}
            </div>}
            <CommandPanel>
              {seat === "APP" ? <>
                <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, marginBottom: 10 }}>
                  <div style={{ ...smallText, marginBottom: 6 }}>{lang === "zh" ? "进场目标跑道" : "Approach runway target"}: {approachRunwayChoice === "AUTO" ? `${lang === "zh" ? "自动" : "AUTO"} → ${preferredArrivalRunwayFor(selected)}` : approachRunwayChoice}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                    <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11, background: approachRunwayChoice === "AUTO" ? "#1d4ed8" : "#111827" }} onClick={() => setApproachRunwayChoice("AUTO")}>AUTO</button>
                    {RJCC_RUNWAY_NAMES.map((rw) => <button key={`app-rwy-${rw}`} disabled={!openArrRunways.includes(rw)} style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11, background: approachRunwayChoice === rw ? "#14532d" : "#111827", opacity: openArrRunways.includes(rw) ? 1 : 0.38 }} onClick={() => setApproachRunwayChoice(rw)}>{rw}</button>)}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 0 }}>
                  <button style={buttonStyle} onClick={assignRoute}>{tr("starVnav")}</button>
                  <button style={buttonStyle} onClick={holdAtFix}>{tr("hold")}</button>
                  <button style={buttonStyle} onClick={clearILS}>{lang === "zh" ? "ILS 自动" : "ILS AUTO"}</button>
                  <button style={buttonStyle} onClick={() => clearVisual("DOWNWIND")}>{tr("visualApp")}</button>
                  <button style={buttonStyle} onClick={goAround}>{tr("missedApp")}</button>
                  <button style={buttonStyle} onClick={() => divertSelected("RJCH")}>{tr("toRjch")}</button>
                  <button style={buttonStyle} onClick={() => divertSelected("RJSM")}>{tr("toRjsm")}</button>
                  <button style={dangerButtonStyle} onClick={divertAll}>{tr("divertAll")}</button>
                </div>
              </> : seat === "TWR" ? <>
                <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, ...smallText }}>
                  {tr("categoryArr")} {activeRunway} {runwayOccupied(aircraft, activeRunway) ? "OCC" : "CLR"} / {tr("categoryDep")} {depRunway} {runwayOccupied(aircraft, depRunway) ? "OCC" : "CLR"}<br />
                  {tr("arrInTwr")}: {towerQueue(aircraft, env).arrivals.length} | {tr("depQueue")}: {towerQueue(aircraft, env).departures.length}<br />
                  {tr("selected")}: {selected.towerControlled ? (lang === "zh" ? "塔台" : "TWR") : selected.towerPending ? tr("twrPending") : tr("notTwr")} | {tr("landClearanceShort")} {selected.landingClearance ? tr("yes") : tr("no")} | {tr("tkof")} {selected.takeoffClearance ? tr("yes") : tr("no")} | {tr("contact")} {contactText(selected.contact || "APP/DEP")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                  {selected.category === "ARR" ? <>
                    <button style={buttonStyle} onClick={() => clearVisual("DOWNWIND")}>{tr("visualPattern")}</button>
                    <button style={buttonStyle} onClick={towerClearLand}>{tr("clearLand")}</button>
                    <button style={buttonStyle} onClick={towerGoAround}>{tr("goAround")}</button>
                  </> : null}
                  {selected.category === "DEP" ? <>
                    <button style={buttonStyle} onClick={towerLineUpWait}>{tr("lineUp")}</button>
                    <button style={buttonStyle} onClick={towerTakeoffClear}>{tr("clearTkof")}</button>
                  </> : null}
                  {selected.category !== "ARR" && selected.category !== "DEP" ? <div style={{ gridColumn: "1 / -1", ...smallText }}>{lang === "zh" ? "该目标没有塔台可用指令。" : "No tower command available for this target."}</div> : null}
                </div>
              </> : seat === "DEP" ? <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? <div style={{ gridColumn: "1 / -1", border: "1px solid #7c2d12", background: "#120a04", color: "#fed7aa", borderRadius: 10, padding: 8, ...smallText }}>
                    {lang === "zh" ? "该离场仍在地面或塔台阶段。请在 TWR 执行 Line Up / Clear TKOF，离地并建立离场雷达识别后再交给 DEP。" : "This departure is still in local-control phase. Use TWR for Line Up / Clear TKOF; DEP takes over after airborne radar contact."}
                  </div> : null}
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={resumeSid}
                  >{tr("resumeSid")}</button>
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={unrestrictedClimbDep}
                  >{tr("unrestAlt")}</button>
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={handoffACC}
                  >{tr("toAcc")}</button>
                </div>
              </> : <>
                <div style={{ border: "1px solid #334155", background: "#020617", borderRadius: 14, padding: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#f59e0b", marginBottom: 6 }}>
                    {lang === "zh" ? "RJCJ 任务状态 / 仅协调信息" : "RJCJ MISSION STATUS / COORDINATION ONLY"}
                  </div>
                  <div style={{ ...smallText, marginBottom: 10 }}>
                    {lang === "zh" ? "只读信息板。RJCJ 军机为自主战术流量；RJCC 只负责让民航避开活跃移动走廊和任务管制空域。" : "Read-only board. RJCJ military traffic is autonomous; RJCC only protects civil traffic from active moving corridors and mission control areas."}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.9fr 0.8fr 0.9fr 0.9fr", gap: 4, fontFamily: "monospace", fontSize: 11, color: "#94a3b8", borderBottom: "1px solid #1f2937", paddingBottom: 5, marginBottom: 5 }}>
                    <b>{lang === "zh" ? "编号 / 机型" : "ID / TYPE"}</b>
                    <b>{lang === "zh" ? "模式" : "MODE"}</b>
                    <b>{lang === "zh" ? "燃油" : "FUEL"}</b>
                    <b>{lang === "zh" ? "任务区" : "AREA"}</b>
                    <b>{lang === "zh" ? "空域" : "AIRSPACE"}</b>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto" }}>
                    {aircraft.filter((a) => a.category === "MIL" && !a.handedOff && !a.landed).length ? aircraft.filter((a) => a.category === "MIL" && !a.handedOff && !a.landed).map((a) => {
                      const area = getAircraftMissionArea(a);
                      const corridor = activeCorridors.find((c) => c.aircraftId === a.id);
                      const bingo = Math.round(a.bingoFuelMinutes ?? militaryBingoFuelMinutes(a, env));
                      const fuel = Math.round(a.fuelMinutes ?? 0);
                      const fuelColor = fuel <= bingo ? "#ef4444" : fuel <= bingo + 8 ? "#f59e0b" : "#cbd5e1";
                      let airspace = lang === "zh" ? "无" : "NONE";
                      if (corridor?.kind === "AREA") airspace = lang === "zh" ? "任务管制区" : "CONTROL AREA";
                      if (corridor?.kind === "MOVING_CORRIDOR") airspace = lang === "zh" ? "移动走廊" : "MOVING CORRIDOR";
                      return <div key={`rjcj-status-${a.id}`} style={{ display: "grid", gridTemplateColumns: "1.05fr 0.9fr 0.8fr 0.9fr 0.9fr", gap: 4, alignItems: "center", border: `1px solid ${a.id === selectedId ? "#f6e94d" : "#1f2937"}`, background: a.id === selectedId ? "rgba(250,204,21,0.08)" : "#030712", borderRadius: 10, padding: 6, fontFamily: "monospace", fontSize: 11, cursor: "pointer" }} onClick={() => selectAircraft(a.id)}>
                        <div style={{ color: "#60a5fa", fontWeight: 900 }}>{a.id}<br /><span style={{ color: "#94a3b8", fontWeight: 600 }}>{a.type}</span></div>
                        <div style={{ color: a.mode === "RJCJ_RTB" ? "#f59e0b" : "#cbd5e1" }}>{a.mode}{a.rtbReason ? <><br /><span style={{ color: "#f59e0b" }}>{a.rtbReason}</span></> : null}</div>
                        <div style={{ color: fuelColor }}>{lang === "zh" ? "油量" : "FUEL"} {fuel}<br />BINGO {bingo}</div>
                        <div style={{ color: area?.dynamic ? "#f59e0b" : "#93c5fd" }}>{area?.id || "-"}<br />{area?.label || "-"}</div>
                        <div style={{ color: corridor ? "#f59e0b" : "#64748b" }}>{airspace}<br />{corridor?.kind === "MOVING_CORRIDOR" ? `${corridor.widthNm.toFixed(1)}NM` : corridor?.kind === "AREA" ? `${corridor.controlRadiusNm.toFixed(1)}NM` : "--"}</div>
                      </div>;
                    }) : <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 10, padding: 10, ...smallText }}>{lang === "zh" ? "当前没有活跃 RJCJ 军机流量。" : "No active RJCJ military traffic."}</div>}
                  </div>
                </div>
              </>}
            </CommandPanel>
          </ControlConsole>

          <RunwayControls
            lang={lang}
            buttonStyle={buttonStyle}
            smallText={smallText}
            openArrRunways={openArrRunways}
            openDepRunways={openDepRunways}
            closedRunways={closedRunways}
            runwayNames={RJCC_RUNWAY_NAMES}
            activeRunway={activeRunway}
            windObj={windObj}
            runways={RUNWAYS}
            parallelApproach={parallelApproach}
            runwayPairName={runwayPairName}
            runwayRoleOf={runwayRoleOf}
            runwayLabelForRole={runwayLabelForRole}
            runwayHeadwind={runwayHeadwind}
            onToggleParallel={() => setParallelApproach((v) => !v)}
            onSetRunwayRole={setRunwayRole}
            onSetRunwayEndPlan={setRunwayEndPlan}
          />
          {runwayNoticeVisible ? <div style={{ border: `2px solid ${runwayNoticeAccent}`, background: "rgba(2, 6, 23, 0.92)", borderRadius: 18, padding: "14px 16px", boxShadow: `0 0 22px ${runwayChangeCandidate.pair ? "rgba(245,158,11,0.28)" : "rgba(56,189,248,0.22)"}`, fontFamily: "monospace" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: runwayChangeCandidate.pair ? "#fbbf24" : "#7dd3fc", lineHeight: 1.2, marginBottom: 8 }}>{runwayNoticeTitle}</div>
            <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45 }}>{runwayNoticeBody}</div>
          </div> : null}
          <ObjectivePanel
            gameMode={gameMode}
            scenarioObjective={scenarioObjective}
            scenarioFailed={scenarioFailed}
            scenarioComplete={scenarioComplete}
            lang={lang}
            smallText={smallText}
            rjcjPriorityNotice={rjcjPriorityNotice}
            scenarioEventsDone={scenarioEventsDone}
            landedCount={landedCount}
            handoffCount={handoffCount}
            conflictPairs={conflictPairs}
            missedCount={missedCount}
            tick={tick}
            conflictDetails={conflictDetails}
            cautionDetails={cautionDetails}
          />
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{tr("weatherStatus")}</div>
            <div style={{ ...smallText }}>{tr("wxRadar")}: {onOff(weatherOn)}<br />{tr("wind")}: {fmt3(windObj.dir)}/{windObj.speed}<br />{tr("weatherForecast")}: {fmt3(windObj.nextDir ?? windObj.dir)}/{windObj.nextSpeed ?? windObj.speed} {lang === "zh" ? `${windObj.changeIn ?? 0}${tr("inSeconds")}` : `${tr("inSeconds")} ${windObj.changeIn ?? 0}s`}<br />{tr("headwind")}: {env.headwind.toFixed(1)} kt<br />{tr("tailwind")}: {env.tailwind.toFixed(1)} kt<br />{tr("divertState")}: {divertRequired(windObj) ? tr("required") : tr("normal")}<br />{tr("runwayModeNotice")}</div>
          </div>
          <MissionStatusPanel
            tr={tr}
            lang={lang}
            smallText={smallText}
            score={score}
            delayPenalty={delayPenalty}
            missionPenalty={missionPenalty}
            landedCount={landedCount}
            handoffCount={handoffCount}
            conflictPairs={conflictPairs}
            cautionDetails={cautionDetails}
            conflictDetails={conflictDetails}
            missionAirspaceViolations={missionAirspaceViolations}
            missedCount={missedCount}
            emergencyCount={emergencyCount}
            lowFuelCount={lowFuelCount}
            activeRunway={activeRunway}
            aircraft={aircraft}
            activeCorridors={activeCorridors}
            arrCount={arrCount}
            depCount={depCount}
          />
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{tr("airports")}</div>
            <div style={{ ...smallText }}>RJCC: {tr("mainCivilField")}, {tr("rwy")} {activeRunway}<br />RJCJ: {tr("jasdfBase")}, 18/36 recovery area<br />RJCH: {tr("hakodateAlt")}, {tr("activeRunwayLabel")} {env.airports.RJCH.name}<br />RJSM: {tr("misawaAlt")}, {tr("activeRunwayLabel")} {env.airports.RJSM.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
