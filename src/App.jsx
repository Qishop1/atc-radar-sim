import { useEffect, useMemo, useRef, useState } from "react";
import MissionStatusPanel from "./components/MissionStatusPanel.jsx";
import ObjectivePanel from "./components/ObjectivePanel.jsx";
import RadioLog from "./components/RadioLog.jsx";
import {
  AlternateHandoffOverlay,
  AirportOverlay,
  MissionOverlay,
  MouseVectorOverlay,
  ProcedureOverlay,
  RadarHeaderOverlay,
  RadarRunwayOverlay,
  RangeRingsOverlay,
  TargetLayer,
  WeatherOverlay,
} from "./components/RadarOverlays.jsx";
import CommandPanel from "./components/CommandPanel.jsx";
import ControlConsole from "./components/ControlConsole.jsx";
import RunwayControls from "./components/RunwayControls.jsx";
import SequenceStrip from "./components/SequenceStrip.jsx";
import SelectedAircraftPanel from "./components/SelectedAircraftPanel.jsx";
import StartScreen from "./components/StartScreen.jsx";
import { I18N } from "./i18n.js";
import { formatEta, formatJstTime, formatSignedClock, wakeShort } from "./simulator/formatting.js";
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
  RJCC_RUNWAY_VISUAL_NM,
  RUNWAYS,
  SIM_STEP_SECONDS,
  TWR_RADIUS_NM,
  TWR_SCALE,
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
import { glidePath3D as buildGlidePath3D, project3DPoint, ring3DPoints as buildRing3DPoints, routeGlide3D as buildRouteGlide3D } from "./simulator/radar3D.js";
import { svgEventTo3DGroundPoint as get3DGroundPointFromEvent, svgEventToRadarPoint as getRadarPointFromEvent } from "./simulator/radarInteractions.js";
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
  const svg3DRef = useRef(null);
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
  const [view3D, setView3D] = useState({ yaw: -38, pitch: 54, scale: 0.72, dragging: false, dragMode: null, lastX: 0, lastY: 0, centerX: CENTER, centerY: CENTER, focusId: null });
  const [scopeMode, setScopeMode] = useState("RADAR");
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

  const tr = (key) => I18N[lang]?.[key] || I18N.en[key] || key;
  const onOff = (v) => v ? tr("on") : tr("off");
  const catText = (cat) => lang === "zh" ? (cat === "ARR" ? tr("categoryArr") : cat === "DEP" ? tr("categoryDep") : cat === "MIL" ? tr("categoryMil") : cat) : cat;
  const vnavText = (s) => lang === "zh" ? (s === "HIGH" ? "偏高" : s === "LOW" ? "偏低" : s === "PATH" ? "在剖面" : s) : s;
  const contactText = (c) => lang === "zh" ? (c === "TWR" ? "塔台" : c === "APP" ? "进近" : c === "DEP" ? "离场" : c === "ACC" ? "区域" : c) : c;
  const modeText = (a) => {
    const raw = displayMode(a);
    if (lang !== "zh") return raw;
    return raw
      .replaceAll("TWR PENDING", tr("twrPending"))
      .replaceAll("LAND CLR", tr("landClr"))
      .replaceAll("TKOF CLR", tr("tkofClr"))
      .replaceAll("NO CLR", tr("noClr"))
      .replaceAll("ROLLOUT", tr("rollout"))
      .replaceAll("VACATED", tr("vacated"))
      .replaceAll("VISUAL", tr("visual"))
      .replaceAll("TWR PATTERN", `塔台${tr("pattern")}`)
      .replaceAll("PATTERN", tr("pattern"))
      .replaceAll("FINAL", "五边")
      .replaceAll("ILS", "ILS")
      .replaceAll("MISSED_APP", "复飞程序")
      .replaceAll("MISSED", "复飞")
      .replaceAll("DEP_READY", "离场待命")
      .replaceAll("LINEUP_WAIT", "跑道等待")
      .replaceAll("TAKEOFF_ROLL", "起飞滑跑")
      .replaceAll("DEP_RADAR_CONTACT", "离场雷达识别")
      .replaceAll("SID", "SID")
      .replaceAll("ROUTE", "航路")
      .replaceAll("VECTOR", "雷达引导")
      .replaceAll("HOLD", "等待")
      .replaceAll("DIRECT_FIX", "直飞点")
      .replaceAll("RADAR_CONTACT", "雷达识别");
  };
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
  const snowRemovalNotice = useMemo(() => {
    if (scenarioId !== "winter_sar_front") return "";
    if (closedRunways.length) return `RJCC ${closedRunways.join("/")} CLOSED DUE SNOWPLOW`;
    if (realTick >= 480 && realTick < 600) return `RJCC 01L WILL CLOSE IN ${Math.ceil((600 - realTick) / 2)}s DUE SNOWPLOW`;
    if (realTick >= 960 && realTick < 1080) return `RJCC 01R WILL CLOSE IN ${Math.ceil((1080 - realTick) / 2)}s DUE SNOWPLOW`;
    return "";
  }, [scenarioId, closedRunways, realTick]);
  const rjcjPriorityNotice = useMemo(() => {
    if (scenarioId !== "foxhound_adiz_05") return null;
    if (scenarioEventsDone.foxhoundSuccess && !scenarioEventsDone.eagleRecovered) return lang === "zh"
      ? { level: "INFO", title: "ADIZ 伴飞驱离完成", body: "FOXHOUND 已转向脱离 — EAGLE01 返回 RJCJ" }
      : { level: "INFO", title: "ADIZ ESCORT COMPLETE", body: "FOXHOUND OUTBOUND — EAGLE01 RTB RJCJ" };
    if (scenarioEventsDone.foxhoundFailed) {
      if (scenarioEventsDone.fuelOutFailed) return lang === "zh"
        ? { level: "FAIL", title: "任务失败", body: `${scenarioEventsDone.fuelOutId || "飞机"} 燃油耗尽` }
        : { level: "FAIL", title: "MISSION FAILED", body: `${scenarioEventsDone.fuelOutId || "AIRCRAFT"} FUEL EXHAUSTED` };
      return lang === "zh"
        ? { level: "FAIL", title: "任务失败", body: "FOXHOUND 已深入 ADIZ" }
        : { level: "FAIL", title: "MISSION FAILED", body: "FOXHOUND DEEP ADIZ PENETRATION" };
    }
    if (scenarioEventsDone.foxhoundSuccess && scenarioEventsDone.eagleRecovered) return lang === "zh"
      ? { level: "DONE", title: "RJCJ 截击任务完成", body: "EAGLE01 已返场" }
      : { level: "DONE", title: "RJCJ INTERCEPT COMPLETE", body: "EAGLE01 RECOVERED" };
    if (tick >= 780) return lang === "zh"
      ? { level: "DANGER", title: "紧急截击已启动", body: "FOXHOUND31 西北方向 — EAGLE01 截击中 / 民航避开 ADIZ-NW" }
      : { level: "DANGER", title: "SCRAMBLE FI ACTIVE", body: "FOXHOUND31 NW — EAGLE01 INTERCEPT / KEEP CIVIL CLEAR ADIZ-NW" };
    if (scenarioEventsDone.foxhoundPreAlert) return lang === "zh"
      ? { level: "WARN", title: "RJCJ 来电 — 截击预警", body: `FI 紧急起飞 T-${Math.max(0, Math.ceil((780 - tick) / 2))}s / ADIZ-NW 预留空域` }
      : { level: "WARN", title: "RJCJ CALL — SCRAMBLE NOTICE", body: `FI SCRAMBLE IN T-${Math.max(0, Math.ceil((780 - tick) / 2))}s / ADIZ-NW RESERVED` };
    return null;
  }, [scenarioId, scenarioEventsDone.foxhoundPreAlert, scenarioEventsDone.foxhoundSuccess, scenarioEventsDone.eagleRecovered, scenarioEventsDone.foxhoundFailed, tick, lang]);
  const sequenceRows = useMemo(() => {
    const byId = new Map(aircraft.map((a) => [a.id, a]));
    const anyManual = arrivalSequence.some((s) => s.manualPosition !== null && s.manualPosition !== undefined);
    const ordered = arrivalSequence
      .map((s) => ({ ...s, ac: byId.get(s.id) }))
      .filter((s) => s.ac && s.ac.category === "ARR" && !s.ac.handedOff && !s.ac.landed && !s.ac.hold && !["VACATED", "ROLLOUT", "HOLD", "MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "DIVERT", "ALT_HANDOFF", "MAYDAY", "PANPAN"].includes(s.ac.mode))
      .sort((a, b) => {
        if (anyManual) {
          const ap = a.manualPosition ?? 999 + estimateArrivalEtaSec(a.ac, env, SEQUENCING_DEPS) / 100000;
          const bp = b.manualPosition ?? 999 + estimateArrivalEtaSec(b.ac, env, SEQUENCING_DEPS) / 100000;
          return ap - bp;
        }
        return estimateArrivalEtaSec(a.ac, env, SEQUENCING_DEPS) - estimateArrivalEtaSec(b.ac, env, SEQUENCING_DEPS);
      });
    return ordered.map((row, idx) => {
      const etaRel = estimateArrivalEtaSec(row.ac, env, SEQUENCING_DEPS);
      const eta = row.etaSec ?? (simSeconds + etaRel);
      const predictedAt = simSeconds + etaRel;
      const autoRank = [...ordered].sort((a, b) => estimateArrivalEtaSec(a.ac, env, SEQUENCING_DEPS) - estimateArrivalEtaSec(b.ac, env, SEQUENCING_DEPS)).findIndex((r) => r.id === row.id);
      const prev = idx > 0 ? ordered[idx - 1].ac : null;
      const gap = prev ? sequenceGapAssessment(prev, row.ac, env, SEQUENCING_DEPS) : null;
      const delay = Math.max(0, predictedAt - eta, simSeconds > eta ? simSeconds - eta : 0);
      const scheduleLevel = simSeconds > eta ? "RED" : delay > 180 ? "AMBER" : "ONTIME";
      const geo = finalGeometryForAircraft(row.ac, env, row.ac.x, row.ac.y);
      const gapLevel = !gap ? "GREEN" : gap.level;
      const level = scheduleLevel === "RED" ? "RED" : scheduleLevel === "AMBER" && gapLevel === "GREEN" ? "AMBER" : gapLevel;
      const alertReason = scheduleLevel === "RED" ? "SCHEDULE_LATE" : scheduleLevel === "AMBER" && gapLevel === "GREEN" ? "SCHEDULE_DELAY" : gap?.level === "RED" || gap?.level === "AMBER" ? "SEPARATION" : "NONE";
      return { ...row, pos: idx + 1, eta, predictedAt, autoRank, delay, scheduleLevel, geo, gap, gapLevel, alertReason, level };
    });
  }, [arrivalSequence, aircraft, env, simSeconds]);
  function moveInSequence(id, direction) {
    setArrivalSequence((prev) => {
      const activeRows = arrivalStripRows.filter((r) => !r.inactive && prev.some((s) => s.id === r.id));
      const visible = activeRows.map((r) => r.id);
      const idx = visible.indexOf(id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= visible.length) return prev;
      const nextOrder = [...visible];
      [nextOrder[idx], nextOrder[target]] = [nextOrder[target], nextOrder[idx]];
      return prev.map((s) => nextOrder.includes(s.id) ? { ...s, manualPosition: nextOrder.indexOf(s.id) } : s);
    });
  }
  function resetSequenceAuto() { setArrivalSequence((prev) => prev.map((s) => ({ ...s, manualPosition: null }))); }
  const scenarioObjective = scenarioObjectives(scenarioId);
  const scenarioPlan = scenarioTrafficPlan(scenarioId);
  const arrivalStripRows = useMemo(() => {
    const future = gameMode === "SCENARIO" ? scenarioPlan
      .filter((i) => i.kind === "ARR" && !scenarioTrafficDone[i.at])
      .map((i) => {
        const eta = i.etaSec ?? (i.at / 2 + 1080);
        return {
          id: i.id,
          pos: 0,
          inactive: true,
          ac: { id: i.id, type: i.type, altitude: i.alt, speed: i.spd, category: "ARR", mode: "PREACTIVE" },
          eta,
          delay: 0,
          geo: { alongNm: Infinity },
          gap: null,
          level: "PENDING",
          activationSec: i.at / 2,
        };
      }) : [];
    const manual = arrivalSequence.some((s) => s.manualPosition !== null && s.manualPosition !== undefined);
    const combined = manual
      ? [...sequenceRows, ...future.sort((a, b) => a.eta - b.eta)]
      : [...sequenceRows, ...future].sort((a, b) => a.eta - b.eta);
    return combined.map((r, i) => ({ ...r, pos: i + 1 }));
  }, [sequenceRows, gameMode, scenarioPlan, scenarioTrafficDone, arrivalSequence]);
  const scenario05Complete = scenarioObjective?.special === "FOXHOUND_ADIZ" && !!scenarioEventsDone.foxhoundSuccess && !!scenarioEventsDone.eagleRecovered && landedCount >= scenarioObjective.landed && handoffCount >= scenarioObjective.handoff && conflictPairs.length <= scenarioObjective.maxConflict && missedCount <= scenarioObjective.maxMissed;
  const normalScenarioComplete = scenarioObjective?.special ? false : gameMode === "SCENARIO" && scenarioObjective && landedCount >= scenarioObjective.landed && handoffCount >= scenarioObjective.handoff && conflictPairs.length <= scenarioObjective.maxConflict && missedCount <= scenarioObjective.maxMissed;
  const scenarioComplete = !!(normalScenarioComplete || scenario05Complete);
  const scenarioFailed = gameMode === "SCENARIO" && scenarioObjective && (!!fuelOutAircraft || (scenarioObjective.special === "FOXHOUND_ADIZ" && scenarioEventsDone.foxhoundFailed) || (conflictPairs.length > scenarioObjective.maxConflict && conflictFailureReady) || missedCount > scenarioObjective.maxMissed || tick > scenarioObjective.duration + 240);
  const scenarioEnded = !!(scenarioComplete || scenarioFailed);
  useEffect(() => { if (scenarioEnded && running) setRunning(false); }, [scenarioEnded, running]);

  const buttonStyle = { border: "1px solid #2d3748", background: "#111827", color: "#e5e7eb", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontWeight: 700 };
  const activeButton = { ...buttonStyle, background: "#1d4ed8" }, dangerButtonStyle = { ...buttonStyle, background: "#3f1d1d", border: "1px solid #7f1d1d" };
  const inputStyle = { width: "100%", border: "1px solid #374151", background: "#030712", color: "#e5e7eb", padding: "8px 10px", borderRadius: 10, fontFamily: "monospace" };
  const smallText = { fontSize: 12, color: "#9ca3af", lineHeight: 1.45 };
  function pushRadio(cmd, rb) { setLog((p) => [cmd, rb, ...p].slice(0, 14)); }
  function rejectGroundApproachCommand(ac = selected, label = "approach command") {
    const ground = isGroundTraffic(ac) || ac.altitude < 500 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(ac.mode);
    if (!ground) return false;
    setLog((p) => [`${ac.id}: ${label} rejected — aircraft is on ground. Use TWR/DEP controls first.`, ...p].slice(0, 14));
    return true;
  }
  function assignedHoldAltitude(fixId) {
    const typed = Number(holdAltitude);
    if (Number.isFinite(typed) && typed >= 3000) return clamp(typed, 3000, 14000);
    const sameFix = aircraft.filter((a) => a.id !== selected.id && a.mode === "HOLD" && a.hold?.fixId === fixId && !a.handedOff && !a.landed);
    const used = new Set(sameFix.map((a) => Math.round((a.hold?.altitude || a.assignedAltitude || 6000) / 1000) * 1000));
    for (const alt of [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000]) {
      if (!used.has(alt)) return alt;
    }
    return 14000;
  }
  function setSelectedPatch(patch, opts = {}) {
    if (scenarioEnded) return;
    const targetId = opts.targetId || selectedId;
    const target = aircraft.find((a) => a.id === targetId) || selected;
    const delayed = commandDelayEnabled && !opts.immediate && target && !["FUEL_EXHAUSTED", "DEADSTICK"].includes(target.mode);
    if (delayed) {
      const delayTicks = Math.max(1, Math.round((Number(commandDelaySec) || 0) * 2));
      const cmd = { id: `${targetId}-${Date.now()}-${Math.random().toString(36).slice(2)}`, targetId, patch, dueTick: tick + delayTicks, createdTick: tick, label: opts.label || "COMMAND" };
      setPendingCommands((p) => [...p, cmd].slice(-20));
      setLog((p) => [`${targetId}: ${cmd.label} acknowledged, execution in ${Number(commandDelaySec) || 0}s.`, ...p].slice(0, 14));
      return;
    }
    setAircraft((prev) => prev.map((a) => a.id === targetId ? normalizeAircraftState({ ...a, ...patch, color: (patch.category ?? a.category) === "DEP" ? "#c084fc" : patch.category === "MIL" || a.category === "MIL" ? "#60a5fa" : "#f6e94d" }) : a));
  }
  function appReacquirePatch(extra = {}) { return buildAppReacquirePatch(selected, extra); }
  function applyVectorHeading(h) {
    if (selected.category === "MIL") {
      setLog((p) => [`RJCC ${seat}: no authority to vector ${selected.id}. RJCJ tactical traffic is protected by mission corridor only.`, ...p].slice(0, 14));
      return;
    }
    const alt = clamp(Number(altitude) || selected.assignedAltitude, 0, 45000), spd = clamp(Number(speed) || selected.assignedSpeed, 90, speedLimitForAircraft(selected, alt)), reacquire = selected.depState === "MISSED_APP" || selected.mode === "MISSED_APP" || selected.mode === "MISSED_TRANSFER_APP";
    const vectorMode = reacquire ? "VECTOR" : selected.category === "DEP" ? "DEP_VECTOR" : "VECTOR";
    setSelectedPatch(appReacquirePatch({ assignedHeading: h, assignedAltitude: alt, assignedSpeed: spd, speedRestriction: null, clearedILS: false, mode: vectorMode, route: [], hold: null }), { label: `HDG ${fmt3(h)} ALT ${Math.round(alt)} SPD ${Math.round(spd)}` });
    setHeading(fmt3(h)); setSpeed(String(Math.round(spd)));
    pushRadio(`${selected.id}, turn heading ${fmt3(h)}, maintain ${Math.round(alt)}, speed ${Math.round(spd)}.`, `${selected.id}: heading ${fmt3(h)}, maintain ${Math.round(alt)}, speed ${Math.round(spd)}.`);
  }
  function issueCommand() { applyVectorHeading(Number.isFinite(Number(heading)) ? normHeading(Number(heading)) : selected.assignedHeading); }
  function altitudeOnly() {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no altitude authority for ${selected.id}.`, ...p].slice(0, 14)); return; }
    const alt = clamp(Number(altitude) || selected.assignedAltitude, 0, 45000);
    const patch = selected.category === "DEP"
      ? { assignedAltitude: alt, requestedAltitude: alt, depState: selected.depState === "PENDING_TWR" ? selected.depState : "RELEASED" }
      : { assignedAltitude: alt };
    setSelectedPatch(patch, { label: `ALT ${Math.round(alt)}` });
    pushRadio(`${selected.id}, maintain ${Math.round(alt)}.`, `${selected.id}: maintain ${Math.round(alt)}.`);
  }
  function svgEventToRadarPoint(e) { return getRadarPointFromEvent(e, svgRef.current, viewBox); }
  function handleRadarMove(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (p) setVectorPreview({ ...p, heading: headingToPoint(selected.x, selected.y, p) }); }
  function handleRadarClick(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (!p) return; applyVectorHeading(headingToPoint(selected.x, selected.y, p)); setMouseVectorMode(false); setVectorPreview(null); }
  function handleRadarMouseDown(e) { if (e.button !== 0 || mouseVectorMode || followSelected) return; e.preventDefault(); setRadarView((v) => ({ ...v, panning: true, lastX: e.clientX, lastY: e.clientY })); }
  function handleRadarMouseMove(e) { if (radarView.panning) { const svg = svgRef.current; const rect = svg?.getBoundingClientRect(); if (rect) { const dx = ((e.clientX - radarView.lastX) / rect.width) * viewSize; const dy = ((e.clientY - radarView.lastY) / rect.height) * viewSize; setRadarView((v) => ({ ...v, x: v.x - dx, y: v.y - dy, lastX: e.clientX, lastY: e.clientY })); } return; } handleRadarMove(e); }
  function stopRadarPan() { setRadarView((v) => ({ ...v, panning: false })); }
  function handleRadarWheel(e) { e.preventDefault(); setZoom((z) => clamp(Number((z + (e.deltaY < 0 ? 0.35 : -0.35)).toFixed(2)), 0.55, 8)); }
  function svgEventTo3DGroundPoint(e) { return get3DGroundPointFromEvent(e, { svg: svg3DRef.current, view3D, aircraft }); }
  function handle3DVectorMove(e) { if (!mouseVectorMode) return; const p = svgEventTo3DGroundPoint(e); if (p) setVectorPreview({ ...p, heading: headingToPoint(selected.x, selected.y, p) }); }
  function handle3DVectorClick(e) { if (!mouseVectorMode) return; e.stopPropagation(); const p = svgEventTo3DGroundPoint(e); if (!p) return; applyVectorHeading(headingToPoint(selected.x, selected.y, p)); setMouseVectorMode(false); setVectorPreview(null); }
  function spawnNow() { if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`Sector saturated: maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14)); if (seat === "DEP" && tick - lastDepTick < 75) return setLog((p) => [`Tower: runway departure spacing not available yet.`, ...p].slice(0, 14)); const depChoice = openDepRunways[seq % openDepRunways.length] || depRunway; const next = seat === "DEP" ? makeDeparture(seq + 50, env, depChoice) : makeRandomArrival(seq); setSeq((s) => s + 1); if (seat === "DEP") setLastDepTick(tick); setAircraft((p) => [...p, normalizeAircraftState(next)]); selectAircraft(next.id); setLog((p) => [seat === "DEP" ? `Tower: ${next.id} ready for departure RWY ${next.depRunway}. Filed ${next.sid} to ${next.destination}.` : `${next.id}: new inbound target, radar contact.`, ...p].slice(0, 14)); }
  function startMode(scenario) {
    const sc = scenario || SCENARIOS[0];
    setRunning(false);
    setGameMode(sc.kind || "SANDBOX");
    setScenarioId(sc.id);
    setScenarioEventsDone({});
    setScenarioTrafficDone({});
    setClosedRunways([]);
    setConflictFirstTick(null);
    setArrivalSequence([]);
    setStartScreen(false);
    setSeat("APP");
    setScopeMode("RADAR");
    setTick(0);
    setRealTick(0);
    setWeatherTick(0);
    setLandedCount(0);
    setHandoffCount(0);
    setLastDepTick(-999);
    setLastMilTick(-999);
    setRunwayChangeCandidate({ pair: null, since: 0 });
    if (sc.kind === "DEBUG") {
      setWindMode("MANUAL");
      setRunwayMode("MANUAL");
      setAutoSpawn(false);
      setDepAuto(false);
      setMilAuto(false);
      setTowerAuto(false);
      setWeatherOn(false);
      setWeatherSeed(0);
      setWind(sc.wind || "350/00");
      setActiveRunway(sc.arrRunway || "01L");
      setDepRunway(sc.depRunway || "01R");
      setApproachRunwayChoice("AUTO");
      setArrRunways([sc.arrRunway || "01L"]);
      setDepRunways([sc.depRunway || "01R"]);
      setClosedRunways([]);
      setSeq(1);
      setAircraft([]);
      setRadarTargets([]);
      setRadarLastSweepTick(0);
      setSelectedId("");
      setPendingCommands([]);
      setLandedCount(0);
      setHandoffCount(0);
      setTick(0);
      setRealTick(0);
      setWeatherTick(0);
      setLastDepTick(-999);
      setLastMilTick(-999);
      setLog(["DEBUG LAB: clean manual test bench loaded. No aircraft, no weather, no automatic traffic."]);
      return;
    }
    if (sc.kind === "SANDBOX") {
      const nextSeed = Math.random();
      const nextWindOffset = Math.random() * 120;
      setWeatherSeed(nextSeed);
      setWindOffset(nextWindOffset);
      setWindMode("AUTO");
      setRunwayMode("AUTO");
      setAutoSpawn(true);
      setDepAuto(true);
      setMilAuto(true);
      setTowerAuto(true);
      setWeatherOn(true);
      const initWind = generatedWind(nextWindOffset);
      const initPair = runwayHeadwind(initWind, 10) >= runwayHeadwind(initWind, 190) ? "01" : "19";
      const initArr = defaultArrRunwayForPair(initPair);
      const initDep = dualRunway ? defaultDepRunwayForPair(initPair) : initArr;
      setActiveRunway(initArr);
      setDepRunway(initDep);
      setApproachRunwayChoice("AUTO");
      setArrRunways([initArr]);
      setDepRunways([initDep]);
      setClosedRunways([]);
      const initEnv = { runway: RUNWAYS[initArr], nav: makeNavCached(initArr), routes: makeRoutes(initArr), sids: makeSids(initArr), wind: initWind, headwind: runwayHeadwind(initWind, RUNWAYS[initArr].course), tailwind: Math.max(0, -runwayHeadwind(initWind, RUNWAYS[initArr].course)), weatherOn: true, weatherCells: makeWeatherCells(0, nextSeed), airports: { RJCJ: activeAirportRunway("RJCJ", initWind), RJCH: activeAirportRunway("RJCH", initWind), RJSM: activeAirportRunway("RJSM", initWind) } };
      const nextAircraft = makeInitialAircraft(initEnv, initDep, aircraftFactoryDeps()).map(normalizeAircraftState);
      setAircraft(nextAircraft);
      setRadarTargets(nextAircraft.map((a) => ({ ...a, radarSweepTick: 0 })));
      setRadarLastSweepTick(0);
      setSelectedId(nextAircraft[0]?.id || "");
      setLog(["CHITOSE: sandbox started. Random traffic, wind, weather and RJCJ activity enabled."]);
      return;
    }
    setWindMode("MANUAL");
    setRunwayMode("MANUAL");
    setActiveRunway(sc.arrRunway || "01L");
    setDepRunway(sc.depRunway || "01R");
    setApproachRunwayChoice("AUTO");
    const scenarioPair = runwayPairName(sc.arrRunway || "01L");
    const scenarioBothRunways = runwayEndOptions(scenarioPair);
    setArrRunways(scenarioBothRunways);
    setDepRunways(scenarioBothRunways);
    setClosedRunways([]);
    setWind(sc.wind || "350/08");
    setWeatherOn(!!sc.weatherOn);
    setWeatherSeed(sc.weatherSeed ?? 0.12);
    setAutoSpawn(sc.autoSpawn ?? true);
    setDepAuto(sc.depAuto ?? true);
    setMilAuto(sc.milAuto ?? false);
    setTowerAuto(sc.towerAuto ?? false);
    const scenarioWind = parseWind(sc.wind || "350/08");
    const scenarioEnv = { runway: RUNWAYS[sc.arrRunway || "01L"], nav: makeNavCached(sc.arrRunway || "01L"), routes: makeRoutes(sc.arrRunway || "01L"), sids: makeSids(sc.arrRunway || "01L"), wind: scenarioWind, headwind: runwayHeadwind(scenarioWind, RUNWAYS[sc.arrRunway || "01L"].course), tailwind: Math.max(0, -runwayHeadwind(scenarioWind, RUNWAYS[sc.arrRunway || "01L"].course)), weatherOn: !!sc.weatherOn, weatherCells: makeWeatherCells(0, sc.weatherSeed ?? 0.12), airports: { RJCJ: activeAirportRunway("RJCJ", scenarioWind), RJCH: activeAirportRunway("RJCH", scenarioWind), RJSM: activeAirportRunway("RJSM", scenarioWind) } };
    const nextAircraft = withSeededRandom(sc.seed || sc.id, () => makeScenarioInitialAircraft(scenarioEnv, sc.id, sc.depRunway || "01R", aircraftFactoryDeps()).map(normalizeAircraftState));
    setSeq(6);
    setAircraft(nextAircraft);
    setRadarTargets(nextAircraft.map((a) => ({ ...a, radarSweepTick: 0 })));
    setRadarLastSweepTick(0);
    setSelectedId(nextAircraft[0]?.id || "");
    setLog([`${sc.title}: scenario loaded.`, `Initial runway plan: ${scenarioBothRunways.join("/")} BOTH. Objective: maintain safe traffic flow, avoid conflicts, and complete runway/arrival tasks.`]);
  }
  function backToMainMenu() { setRunning(false); setStartScreen(true); setMouseVectorMode(false); setVectorPreview(null); }
  function reset() { if (gameMode === "SCENARIO" || gameMode === "DEBUG") { const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS.find((s) => s.kind === gameMode) || SCENARIOS[1]; startMode(sc); return; } setRunning(false); setWeatherTick(0); const nextSeed = Math.random(); const nextWindOffset = Math.random() * 120; setWeatherSeed(nextSeed); setWindOffset(nextWindOffset); const resetWind = generatedWind(nextWindOffset); const resetPair = runwayHeadwind(resetWind, 10) >= runwayHeadwind(resetWind, 190) ? "01" : "19"; const resetArr = defaultArrRunwayForPair(resetPair); const resetDep = dualRunway ? defaultDepRunwayForPair(resetPair) : resetArr; if (runwayMode === "AUTO") { setActiveRunway(resetArr); setDepRunway(resetDep); setArrRunways([resetArr]); setDepRunways([resetDep]); setClosedRunways([]); } const resetEnv = { runway: RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway], nav: makeNavCached(runwayMode === "AUTO" ? resetArr : activeRunway), routes: makeRoutes(runwayMode === "AUTO" ? resetArr : activeRunway), sids: makeSids(runwayMode === "AUTO" ? resetArr : activeRunway), wind: resetWind, headwind: runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course), tailwind: Math.max(0, -runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course)), weatherOn, weatherCells: makeWeatherCells(0, nextSeed), airports: { RJCJ: activeAirportRunway("RJCJ", resetWind), RJCH: activeAirportRunway("RJCH", resetWind), RJSM: activeAirportRunway("RJSM", resetWind) } }; const nextAircraft = makeInitialAircraft(resetEnv, runwayMode === "AUTO" ? resetDep : depRunway, aircraftFactoryDeps()); setAircraft(nextAircraft.map(normalizeAircraftState)); setRadarTargets(nextAircraft.map(normalizeAircraftState).map((a) => ({ ...a, radarSweepTick: 0 }))); setRadarLastSweepTick(0); setSelectedId(nextAircraft[0]?.id || ""); setLandedCount(0); setHandoffCount(0); setSeq(6 + Math.floor(Math.random() * 30)); setTick(0); setRealTick(0); setWeatherTick(0); setLastDepTick(-999); setLastMilTick(-999); setLog([`CHITOSE: reset. Wind ${fmt3(resetWind.dir)}/${resetWind.speed}. ARR RWY ${runwayMode === "AUTO" ? resetArr : activeRunway}, DEP RWY ${runwayMode === "AUTO" ? resetDep : depRunway}. New traffic and weather loaded.`]); }
  function spawnMil() {
    if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`Sector saturated: maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14));
    const next = makeMilitary(seq + 90, aircraft, null, env);
    setSeq((s) => s + 1);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    selectAircraft(next.id);
    setLog((p) => [`RJCJ: ${next.id} ${next.type} airborne / tactical traffic.`, ...p].slice(0, 14));
  }
  function debugSpawn(kind = "MIL", forcedType = null) {
    if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`DEBUG: sector saturated, maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14));
    let next;
    if (kind === "ARR") next = makeRandomArrival(seq + 700);
    else if (kind === "DEP") next = makeDeparture(seq + 750, env, openDepRunways[seq % openDepRunways.length] || depRunway);
    else next = makeMilitary(seq + 790, aircraft, forcedType, env);
    setSeq((s) => s + 1);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    selectAircraft(next.id);
    setLog((p) => [`DEBUG SPAWN: ${next.id} ${next.type} ${next.category} ${next.mode}.`, ...p].slice(0, 14));
  }
  function divertSelected(alternate = "AUTO") {
    if (selected.category !== "ARR") {
      setLog((p) => [`${selected.id}: divert rejected — only civil arrivals can be sent to RJCH/RJSM with this command.`, ...p].slice(0, 14));
      return;
    }
    const dest = alternate === "AUTO" ? (selectedBR.bearing > 180 ? "RJCH" : "RJSM") : alternate;
    const fix = wp(env.nav, dest);
    if (!fix) return;
    const h = headingToPoint(selected.x, selected.y, fix);
    setSelectedPatch({ destination: dest, alternate: dest, alternateRunway: null, alternateCourse: null, mode: "DIVERT", route: [], hold: null, clearedILS: false, landingClearance: false, towerControlled: false, contact: "APP", assignedHeading: h, assignedAltitude: 9000, assignedSpeed: 230 });
    pushRadio(`${selected.id}, divert to ${dest}, fly heading ${fmt3(h)}, maintain 9000. Contact ${dest} Approach within ${alternateHandoffRadiusNm(dest)} miles.`, `${selected.id}: diverting ${dest}, heading ${fmt3(h)}, maintain 9000.`);
  }
  function divertAll() {
    setAircraft((prev) => prev.map((a) => {
      if (a.category === "DEP" || a.category === "MIL" || a.handedOff) return a;
      const br = xyToBearingRange(a.x, a.y);
      const dest = br.bearing > 180 ? "RJCH" : "RJSM";
      const fix = wp(env.nav, dest);
      return { ...a, destination: dest, alternate: dest, alternateRunway: null, alternateCourse: null, mode: "DIVERT", route: [], hold: null, clearedILS: false, landingClearance: false, towerControlled: false, contact: "APP", assignedHeading: headingToPoint(a.x, a.y, fix), assignedAltitude: 9000, assignedSpeed: 230, color: "#f59e0b" };
    }));
    setLog((p) => [`CHITOSE APP: field condition unsafe, all civil arrivals divert RJCH/RJSM. RJCJ SAR/CAP traffic remains with RJCJ control.`, ...p].slice(0, 14));
  }

  function assignRoute() {
    if (rejectGroundApproachCommand(selected, "STAR/VNAV")) return;
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: runway change rejected — already committed to runway ${selected.approachRunway || selected.routeRunway}. Issue missed approach first.`, ...p].slice(0, 14));
      return;
    }
    const nav = makeNavCached(targetRunway);
    const routes = makeRoutes(targetRunway);
    const picked = suggestRouteForBearing(selectedBR.bearing);
    const route = routes[picked] || routes.SOUTH;
    const routeEnv = { ...env, runway: RUNWAYS[targetRunway], nav, routes, sids: makeSids(targetRunway) };
    const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", routeRunway: targetRunway, approachRunway: targetRunway }, routeEnv, 0);
    setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, routeRunway: targetRunway, approachRunway: targetRunway, clearedILS: false, hold: null, speedRestriction: null, assignedSpeed: 200, assignedAltitude: vnavAlt }));
    pushRadio(`${selected.id}, proceed via ${picked}, descend via profile, expect ILS runway ${targetRunway}.`, `${selected.id}: via ${picked}, descend via profile, expect ILS ${targetRunway}.`);
  }
  function vectorToIF01() {
    if (rejectGroundApproachCommand(selected, "direct IF01")) return;
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: direct IF01 runway ${targetRunway} rejected — approach locked to runway ${selected.approachRunway || selected.routeRunway}. Go around before reassigning runway.`, ...p].slice(0, 14));
      return;
    }
    const route = makeRoutes(targetRunway).VECTORS_IF01;
    const routeEnv = { ...env, runway: RUNWAYS[targetRunway], nav: makeNavCached(targetRunway), routes: makeRoutes(targetRunway), sids: makeSids(targetRunway) };
    const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", routeRunway: targetRunway, approachRunway: targetRunway }, routeEnv, 0);
    setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, routeRunway: targetRunway, approachRunway: targetRunway, clearedILS: false, hold: null, speedRestriction: null, assignedSpeed: 190, assignedAltitude: vnavAlt }));
    pushRadio(`${selected.id}, direct IF01 runway ${targetRunway}, descend via profile, expect intercept runway heading ${fmt3(RUNWAYS[targetRunway].course)}.`, `${selected.id}: direct IF01 runway ${targetRunway}, descend via profile.`);
  }
  function holdAtFix() { if (rejectGroundApproachCommand(selected, "hold/fix")) return; const fix = holdFix !== "AUTO" ? holdFix : suggestHoldForBearing(selectedBR.bearing), alt = assignedHoldAltitude(fix); setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: fix, altitude: alt }, route: [], clearedILS: false, speedRestriction: null, assignedSpeed: 190, assignedAltitude: alt })); pushRadio(`${selected.id}, hold at ${fix}, maintain ${alt}, speed 190.`, `${selected.id}: hold at ${fix}, maintain ${alt}, speed 190.`); }
  function clearILS() { if (rejectGroundApproachCommand(selected, "ILS/approach")) return; const gate = ilsGateState(selected, env); setLog((p) => [`${selected.id}: ILS is automatic. Capture ${gate.capture ? "available" : "not available"}; fly the published route or vector into the intercept cone.`, ...p].slice(0, 14)); }
  function clearVisual(requested = "DOWNWIND") {
    if (rejectGroundApproachCommand(selected, "visual approach")) return;
    if (!canClearVisual(selected, env)) return setLog((p) => [`${selected.id}, unable visual approach. Aircraft must be ARR, below FL060, speed controlled, and field/weather acceptable.`, ...p].slice(0, 14));
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: visual runway ${targetRunway} rejected — approach locked to runway ${selected.approachRunway || selected.routeRunway}. Use go-around first.`, ...p].slice(0, 14));
      return;
    }
    const visualEnv = { ...env, runway: RUNWAYS[targetRunway], nav: makeNavCached(targetRunway), routes: makeRoutes(targetRunway), sids: makeSids(targetRunway) };
    const entry = visualDownwindEntry(visualEnv);
    setSelectedPatch({ towerControlled: false, contact: "APP", landingClearance: false, clearedILS: false, mode: "VISUAL_APP", routeRunway: targetRunway, approachRunway: targetRunway, patternLeg: 0, patternReport: null, route: [], hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, entry), assignedAltitude: Math.max(PATTERN_ALT, Math.min(4500, selected.altitude)), assignedSpeed: Math.max(approachSpeedFor(selected) + 45, 170) });
    pushRadio(`${selected.id}, cleared visual approach runway ${targetRunway}, cross overhead at ${PATTERN_ALT}, continue upwind, left crosswind, report downwind, then contact Tower.`, `${selected.id}: visual approach runway ${targetRunway}, overhead, upwind, left pattern.`);
  }
  function handoffTower() {
    setLog((p) => [`${selected.id}: tower handoff is automatic inside TWR airspace below handoff altitude.`, ...p].slice(0, 14));
  }
  function towerAccept() {
    setLog((p) => [`${selected.id}: APP/TWR acceptance is automatic; no manual accept required.`, ...p].slice(0, 14));
  }
  function towerLineUpWait() { if (selected.category !== "DEP") return; const rw = selected.depRunway || depRunway; const depCourse = RUNWAYS[rw]?.course || env.runway.course; const entry = departureRunwayEntry(rw); const occ = runwayOccupied(aircraft, rw); if (occ) return setLog((p) => [`TWR: runway ${rw} occupied, ${selected.id} hold short.`, ...p].slice(0, 14)); setSelectedPatch({ x: entry.x, y: entry.y, heading: depCourse, towerControlled: true, runwayOccupancy: true, occupancyRunway: rw, mode: "LINEUP_WAIT", assignedHeading: depCourse, assignedAltitude: 0, assignedSpeed: 0, depRunway: rw }); pushRadio(`${selected.id}, line up and wait runway ${rw}.`, `${selected.id}: line up and wait ${rw}.`); }
  function towerGoAround() { setSelectedPatch(missedApproachPatch(env, selected.approachRunway || selected.routeRunway || activeRunway)); pushRadio(`${selected.id}, go around, fly runway heading, climb 3000, contact Departure.`, `${selected.id}: going around, Departure.`); }
  function towerExitRunway() {
    setLog((p) => [`TWR: manual runway release removed. Runway occupancy now clears automatically during rollout/vacating.`, ...p].slice(0, 14));
  }
  function towerClearLand() {
    if (selected.category !== "ARR" || !selected.towerControlled || selected.contact !== "TWR") return setLog((p) => [`TWR: ${selected.id} is not under Tower control. Handoff is automatic inside TWR airspace below handoff altitude.`, ...p].slice(0, 14));
    if (!isApproachMode(selected.mode)) return setLog((p) => [`TWR: ${selected.id} is not an arrival on approach.`, ...p].slice(0, 14));
    const rw = selected.approachRunway || selected.routeRunway || activeRunway;
    const occ = runwayOccupied(aircraft.filter((a) => a.id !== selectedId), rw);
    if (occ) return setLog((p) => [`TWR: unable landing clearance, runway ${rw} occupied.`, ...p].slice(0, 14));
    if (!openArrRunways.includes(rw) && !openDepRunways.includes(rw)) return setLog((p) => [`TWR: unable landing clearance, runway ${rw} is not open.`, ...p].slice(0, 14));
    setSelectedPatch(landingClearancePatch({ ...selected, approachRunway: rw, routeRunway: rw }));
    pushRadio(`${selected.id}, runway ${rw}, cleared to land.`, `${selected.id}: cleared to land ${rw}.`);
  }
  function towerTakeoffClear() { if (selected.category !== "DEP") return; const rw = selected.depRunway || depRunway; const depCourse = RUNWAYS[rw]?.course || env.runway.course; const entry = departureRunwayEntry(rw); const occ = runwayOccupied(aircraft.filter((a) => a.id !== selectedId), rw); if (occ && selected.mode !== "LINEUP_WAIT") return setLog((p) => [`TWR: unable takeoff clearance, runway ${rw} occupied.`, ...p].slice(0, 14)); const sid = env.sids[selected.sid] || env.sids.NORTH; const initialAlt = Math.max(4000, sid.initialAlt || 5000); setSelectedPatch({ x: selected.mode === "LINEUP_WAIT" ? selected.x : entry.x, y: selected.mode === "LINEUP_WAIT" ? selected.y : entry.y, heading: depCourse, speed: Math.min(selected.speed || 0, 5), altitude: 0, towerControlled: true, takeoffClearance: true, runwayOccupancy: true, occupancyRunway: rw, mode: "TAKEOFF_ROLL", assignedHeading: depCourse, assignedAltitude: initialAlt, assignedSpeed: 135, depRunway: rw }); pushRadio(`${selected.id}, runway ${rw}, cleared for takeoff, initial climb ${initialAlt}.`, `${selected.id}: cleared for takeoff ${rw}, initial climb ${initialAlt}.`); }
  function speedOnly() { if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no speed authority for ${selected.id}.`, ...p].slice(0, 14)); return; } const spd = clamp(Number(speed) || selected.assignedSpeed, 90, speedLimitForAircraft(selected, selected.altitude)); setSelectedPatch({ assignedSpeed: spd, speedRestriction: spd }, { label: `SPD ${Math.round(spd)}` }); setSpeed(String(Math.round(spd))); pushRadio(`${selected.id}, reduce speed ${Math.round(spd)}, continue present route.`, `${selected.id}: speed ${Math.round(spd)}, continuing route.`); }
  function goAround() { if (rejectGroundApproachCommand(selected, "missed approach")) return; setSelectedPatch(missedApproachPatch(env, selected.approachRunway || selected.routeRunway || activeRunway)); pushRadio(`${selected.id}, go around, fly missed approach, climb 3000, contact Departure.`, `${selected.id}: going around, Departure.`); }
  function resumeSid() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH; const spd = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ mode: "SID", depState: "SID_CLIMB", route: sid.route, routeIndex: 0, assignedHeading: sid.heading, assignedAltitude: sid.initialAlt, assignedSpeed: spd, speedRestriction: null }); pushRadio(`${selected.id}, resume filed ${selected.sid}, climb and maintain ${sid.initialAlt}.`, `${selected.id}: resume ${selected.sid}, climb ${sid.initialAlt}.`); }
  function climbDep() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH, requestedAlt = Number.isFinite(Number(altitude)) ? clamp(Number(altitude), sid.initialAlt, 24000) : sid.initialAlt, depSpeed = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ depState: "RELEASED", mode: "SID", assignedAltitude: requestedAlt, requestedAltitude: requestedAlt, assignedSpeed: depSpeed, speedRestriction: null }); setAltitude(String(Math.round(requestedAlt))); setSpeed(String(Math.round(depSpeed))); pushRadio(`${selected.id}, climb and maintain ${Math.round(requestedAlt)}, speed ${Math.round(depSpeed)}.`, `${selected.id}: climb ${Math.round(requestedAlt)}, speed ${Math.round(depSpeed)}.`); }
  function unrestrictedClimbDep() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH; const requestedAlt = sid.topAlt; const nextFix = selected.route?.length && selected.routeIndex < selected.route.length ? wp(env.nav, selected.route[selected.routeIndex]) : null; const sidHeading = nextFix ? headingToPoint(selected.x, selected.y, nextFix) : sid.exitBearing; const ciSpeed = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ depState: "UNRESTRICTED", mode: "SID", route: selected.route?.length ? selected.route : sid.route, routeIndex: selected.routeIndex || 0, assignedHeading: sidHeading, assignedAltitude: requestedAlt, requestedAltitude: requestedAlt, assignedSpeed: ciSpeed, speedRestriction: null }); setAltitude(String(Math.round(requestedAlt))); setSpeed(String(Math.round(ciSpeed))); setHeading(fmt3(sidHeading)); pushRadio(`${selected.id}, altitude restriction cancelled, climb via ${selected.sid} to ${Math.round(requestedAlt)}. Max 250 below FL100, then company cost-index speed.`, `${selected.id}: unrestricted climb via ${selected.sid} to ${Math.round(requestedAlt)}, company speed when able.`); }
  function handoffACC() { if (selected.category !== "DEP") return; const br = xyToBearingRange(selected.x, selected.y); if (!depExitReady(selected, env)) return setLog((p) => [`${selected.id}: not ready for ACC handoff. Need SID exit direction and 38+ NM; now ${br.rangeNm.toFixed(1)} NM / BRG ${fmt3(br.bearing)}.`, ...p].slice(0, 14)); setAircraft((prev) => prev.map((a) => a.id === selectedId ? { ...a, handedOff: true } : a)); setHandoffCount((c) => c + 1); setLog((p) => [`DEP: ${selected.id}, contact Sapporo Control.`, `${selected.id}: Sapporo Control, good day.`, ...p].slice(0, 14)); const next = aircraft.find((a) => a.id !== selectedId && !a.handedOff); if (next) selectAircraft(next.id); }
  function deleteSelected() { setAircraft((prev) => prev.filter((a) => a.id !== selectedId)); const next = aircraft.find((a) => a.id !== selectedId); if (next) selectAircraft(next.id); setLog((p) => [`${selected.id}: removed from sector.`, ...p].slice(0, 14)); }
  function directToWaypointForRunway(id, runwayName) {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no approach clearance authority for ${selected.id}.`, ...p].slice(0, 14)); return; }
    if (rejectGroundApproachCommand(selected, `direct ${id} runway ${runwayName}`)) return;
    if (approachRunwayChangeRequiresMissed(selected, runwayName)) {
      setLog((p) => [`${selected.id}: direct ${id}_${runwayName} rejected — already committed to runway ${selected.approachRunway || selected.routeRunway}. Go around before runway reassignment.`, ...p].slice(0, 14));
      return;
    }
    const nav = makeNavCached(runwayName);
    const routes = makeRoutes(runwayName);
    const fix = wp(nav, id);
    if (!fix) return;
    const h = headingToPoint(selected.x, selected.y, fix);
    if (id.startsWith("HOLD")) {
      const alt = assignedHoldAltitude(id);
      setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: id, altitude: alt, navRunway: runwayName }, route: [], clearedILS: false, speedRestriction: null, assignedHeading: h, assignedSpeed: 190, assignedAltitude: alt }));
      pushRadio(`${selected.id}, hold at ${id} for runway ${runwayName}, maintain ${alt}.`, `${selected.id}: hold ${id}, runway ${runwayName}.`);
      return;
    }
    if (selected.category === "ARR") {
      const containingRoute = Object.values(routes).find((r) => r.includes(id) && r.indexOf(id) < r.length - 1);
      let route = id === "IF01" ? routes.VECTORS_IF01 : containingRoute ? containingRoute.slice(containingRoute.indexOf(id)) : [];
      let routeIndex = 0;
      if (route.length && id.startsWith("BASE_")) {
        const selectedFix = wp(nav, id);
        const nextFix = route[1] ? wp(nav, route[1]) : null;
        const distSelected = selectedFix ? Math.hypot(selected.x - selectedFix.x, selected.y - selectedFix.y) / PX_PER_NM : 99;
        const distNext = nextFix ? Math.hypot(selected.x - nextFix.x, selected.y - nextFix.y) / PX_PER_NM : 99;
        const alreadyPastBase = distSelected < 2.8 || distNext < distSelected;
        if (alreadyPastBase && route.length > 1) routeIndex = 1;
      }
      const nextId = route[routeIndex] || id;
      const nextAlt = nextId === "FAF" ? 2200 : nextId === "IF01" ? 3000 : nextId.startsWith("BASE_") ? 5000 : nextId.startsWith("DW_") ? 6000 : selected.assignedAltitude;
      const nextFix = wp(nav, nextId) || fix;
      setSelectedPatch(appReacquirePatch({ mode: route.length ? "ROUTE" : "DIRECT_FIX", route, routeIndex, routeRunway: runwayName, approachRunway: runwayName, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, nextFix), assignedSpeed: nextId === "FAF" ? 170 : 190, assignedAltitude: nextAlt }));
      pushRadio(`${selected.id}, proceed ${id} for runway ${runwayName}, expect ILS ${runwayName}.`, `${selected.id}: ${id} runway ${runwayName}.`);
      return;
    }
    setSelectedPatch(appReacquirePatch({ mode: "DIRECT_FIX", route: [], routeRunway: runwayName, approachRunway: runwayName, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: h, assignedAltitude: selected.assignedAltitude, assignedSpeed: selected.assignedSpeed }));
    pushRadio(`${selected.id}, proceed direct ${id} for runway ${runwayName}.`, `${selected.id}: direct ${id} runway ${runwayName}.`);
  }
  function directToWaypoint(id) {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no direct clearance authority for ${selected.id}. Military traffic follows RJCJ mission corridor / BINGO RTB logic.`, ...p].slice(0, 14)); return; }
    const isGround = isGroundTraffic(selected) || selected.altitude < 500 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(selected.mode);
    const groundAllowed = (selected.category === "MIL" && id === "RJCJ") || id === selected.destination;
    if (isGround && !groundAllowed) {
      setLog((p) => [`${selected.id}: direct ${id} rejected — aircraft is on ground. Use TWR/DEP controls first.`, ...p].slice(0, 14));
      return;
    }
    const fix = wp(env.nav, id);
    if (!fix) return;
    if (id.startsWith("HOLD")) {
      const alt = assignedHoldAltitude(id);
      setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: id, altitude: alt }, route: [], clearedILS: false, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: 190, assignedAltitude: alt }));
      pushRadio(`${selected.id}, hold at ${id}, maintain ${alt}, speed 190.`, `${selected.id}: hold at ${id}, maintain ${alt}.`);
      return;
    }
    if (id === "RJCH" || id === "RJSM") return divertSelected(id);
    if (id === "RJCJ" && selected.category === "MIL") {
      setSelectedPatch({ mode: "RJCJ_RECOVERY", destination: "RJCJ", assignedAltitude: 3500, assignedSpeed: selected.type === "F-15J" || selected.type === "F-2A" ? 240 : 165 });
      pushRadio(`${selected.id}, proceed recovery RJCJ.`, `${selected.id}: recovery RJCJ.`);
      return;
    }
    if (selected.category !== "MIL" && id === "IF01") {
      vectorToIF01();
      return;
    }
    if (selected.category === "ARR") {
      const containingRoute = Object.values(env.routes).find((r) => r.includes(id) && r.indexOf(id) < r.length - 1);
      if (containingRoute && (id.startsWith("IAF") || id.startsWith("DW_") || id.startsWith("BASE_") || id === "FAF")) {
        const idx = containingRoute.indexOf(id);
        const route = containingRoute.slice(idx);
        const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", mode: "ROUTE" }, env, 0);
        setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: id === "FAF" ? 170 : 200, assignedAltitude: vnavAlt }));
        pushRadio(`${selected.id}, direct ${id}, continue published segment, descend via profile.`, `${selected.id}: direct ${id}, descend via profile.`);
        return;
      }
    }
    const matchingRoute = selected.category !== "MIL" ? Object.values(env.routes).find((r) => r[0] === id) : null;
    if (matchingRoute) {
      const vnavAlt = selected.category === "DEP" ? selected.assignedAltitude : vnavTargetAltitude({ ...selected, route: matchingRoute, routeIndex: 0, category: "ARR", mode: "ROUTE" }, env, 0);
      setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route: matchingRoute, routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: selected.category === "DEP" ? selected.assignedSpeed : 200, assignedAltitude: vnavAlt }));
      pushRadio(`${selected.id}, direct ${id}, then continue published route.`, `${selected.id}: direct ${id}.`);
      return;
    }
    setSelectedPatch(appReacquirePatch({ mode: "DIRECT_FIX", route: [id], routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedAltitude: selected.assignedAltitude, assignedSpeed: selected.assignedSpeed }));
    pushRadio(`${selected.id}, proceed direct ${id}.`, `${selected.id}: direct ${id}.`);
  }

  const p0 = runwayPointEnv(env, 0), p8 = runwayPointEnv(env, 8), p18 = runwayPointEnv(env, 18), right = { x: -hdgVector(env.runway.course).y, y: hdgVector(env.runway.course).x };
  const mainIls = ilsBoundaryLines(runwayOrigin(env.runway), env.runway.course, 0, 18, ILS_NEAR_PX, ILS_FAR_PX);
  const trap = ptsString(mainIls.polygon);
  const showAirportIls = (id) => shouldShowAirportIls(id, { seat, selected });
  const runwayLabelForRole = (role) => formatRunwayLabelForRole(role, lang);
  const runwayDisplaySet = useMemo(() => buildRjccRunwayDisplaySet({ runwayChangeCandidate, runwayNames: RJCC_RUNWAY_NAMES, runwayPairRunways, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway }), [runwayChangeCandidate, closedRunways, openArrRunways, openDepRunways, activeRunway, depRunway]);
  function renderMainRunwayIlsOverlay(runwayName, role = "CURRENT") {
    const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
    const origin = runwayOrigin(rw);
    const ils = ilsBoundaryLines(origin, rw.course, 0, 18, ILS_NEAR_PX, ILS_FAR_PX);
    const c0 = runwayPointAt(origin, rw.course, 0);
    const c18 = runwayPointAt(origin, rw.course, 18);
    const color = role === "PENDING" ? "#f59e0b" : role === "CLOSED" ? "#ef4444" : role === "INACTIVE" ? "#38bdf8" : role === "DEP" ? "#a855f7" : role === "BOTH" ? "#84cc16" : "#22c55e";
    const dash = role === "PENDING" ? "10 7" : role === "INACTIVE" ? "9 8" : role === "DEP" ? "7 6" : "5 6";
    const opacity = role === "PENDING" ? 0.56 : role === "CLOSED" ? 0.34 : role === "INACTIVE" ? 0.34 : role === "DEP" ? 0.58 : role === "BOTH" ? 0.76 : 0.86;
    return <g key={`main-ils-${runwayName}-${role}`}>
      <polygon points={ptsString(ils.polygon)} fill={color} opacity={role === "CURRENT" ? "0.08" : role === "BOTH" ? "0.065" : role === "DEP" ? "0.045" : role === "PENDING" ? "0.035" : role === "CLOSED" ? "0.014" : "0.018"} stroke="none" />
      <polyline points={ptsString(ils.left)} fill="none" stroke={color} strokeWidth={1.15 / Math.sqrt(zoom)} strokeDasharray={dash} opacity={opacity} />
      <polyline points={ptsString(ils.right)} fill="none" stroke={color} strokeWidth={1.15 / Math.sqrt(zoom)} strokeDasharray={dash} opacity={opacity} />
      <line x1={c0.x} y1={c0.y} x2={c18.x} y2={c18.y} stroke={color} strokeWidth={(role === "CURRENT" ? 2 : role === "BOTH" ? 1.8 : role === "DEP" ? 1.6 : 1.25) / Math.sqrt(zoom)} opacity={role === "CURRENT" ? 0.30 : role === "BOTH" ? 0.27 : role === "DEP" ? 0.24 : role === "PENDING" ? 0.20 : role === "CLOSED" ? 0.10 : 0.14} />
      <text x={c0.x + 8 / zoom} y={c0.y - (role === "PENDING" ? 26 : role === "DEP" ? 18 : role === "INACTIVE" ? 34 : 10) / zoom} fill={color} fontSize={10 / zoom} opacity={role === "INACTIVE" || role === "CLOSED" ? "0.70" : "0.95"}>RJCC {runwayName} ILS {runwayLabelForRole(role)}</text>
    </g>;
  }
  function renderApproachGuide(runwayName, role = "CURRENT") {
    const nav = makeNavCached(runwayName);
    const routes = makeRoutes(runwayName);
    const isPrimary = role === "CURRENT";
    const color = role === "PENDING" ? "#f59e0b" : role === "BOTH" ? "#84cc16" : role === "ARR" || role === "CURRENT" ? "#38bdf8" : "#2563eb";
    const dash = role === "PENDING" ? "2 7" : role === "CURRENT" ? "5 7" : "8 7";
    const opacity = role === "CURRENT" ? 0.46 : role === "ARR" || role === "BOTH" ? 0.58 : role === "PENDING" ? 0.52 : 0.22;
    const visibleFixes = ["IF01", "FAF", "DW_E", "DW_W", "BASE_E", "BASE_W", "IAF_N", "IAF_E", "IAF_W", "IAF_S"];
    const labelOffset = RUNWAYS[runwayName]?.offsetPx || 0;
    return <g key={`approach-guide-${runwayName}-${role}`}>
      {Object.entries(routes).filter(([name]) => name !== "MISSED_RETURN").map(([name, route], idx) => <polyline key={`${runwayName}-${role}-${name}-${idx}`} points={route.map((id) => wp(nav, id)).filter(Boolean).map((w) => `${w.x},${w.y}`).join(" ")} fill="none" stroke={color} strokeWidth={(isPrimary ? 1.25 : 1.55) / Math.sqrt(zoom)} opacity={opacity} strokeDasharray={dash} />)}
      {visibleFixes.map((id) => {
        const w = wp(nav, id);
        if (!w) return null;
        const suffix = `${id}_${runwayName}`;
        const yBump = id === "IF01" ? -10 : id === "FAF" ? 10 : 0;
        const xBump = labelOffset > 0 ? 8 : -46;
        return <g key={`${runwayName}-click-${id}`} onClick={(e) => { e.stopPropagation(); directToWaypointForRunway(id, runwayName); }} style={{ cursor: "pointer" }}>
          <circle cx={w.x} cy={w.y} r={5.2 / Math.sqrt(zoom)} fill={color} opacity={isPrimary ? "0.20" : "0.30"} stroke={color} strokeWidth={1.1 / Math.sqrt(zoom)} />
          <circle cx={w.x} cy={w.y} r={2.1 / Math.sqrt(zoom)} fill={color} opacity="0.92" />
          <text x={w.x + xBump / zoom} y={w.y + (yBump - 7) / zoom} fill={color} fontSize={9.5 / zoom} opacity="0.96">{suffix}</text>
        </g>;
      })}
    </g>;
  }
  function glidePath3DForRunway(runwayName, sideNm = 0, large = true) {
    const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
    const origin = runwayOrigin(rw);
    return [18, 15, 12, 9, 6, 3, 0].map((d) => {
      const v = hdgVector(rw.course);
      const r = { x: -v.y, y: v.x };
      const p = runwayPointAt(origin, rw.course, d);
      return project3D(p.x + r.x * sideNm * PX_PER_NM, p.y + r.y * sideNm * PX_PER_NM, d * 320, large);
    });
  }
  function renderMainRunwayIls3D(runwayName, role = "CURRENT") {
    const color = role === "PENDING" ? "#f59e0b" : role === "CLOSED" ? "#ef4444" : role === "INACTIVE" ? "#38bdf8" : role === "DEP" ? "#a855f7" : role === "BOTH" ? "#84cc16" : "#22c55e";
    const center = glidePath3DForRunway(runwayName, 0, true);
    const left = glidePath3DForRunway(runwayName, -0.45, true);
    const rightEdge = glidePath3DForRunway(runwayName, 0.45, true);
    const polygons = left.slice(0, -1).map((p, i) => `${p.x},${p.y} ${left[i + 1].x},${left[i + 1].y} ${rightEdge[i + 1].x},${rightEdge[i + 1].y} ${rightEdge[i].x},${rightEdge[i].y}`);
    return <g key={`3d-ils-${runwayName}-${role}`}>{polygons.map((pts, i) => <polygon key={`3d-ils-poly-${runwayName}-${role}-${i}`} points={pts} fill={color} opacity={role === "CURRENT" ? "0.055" : role === "DEP" ? "0.035" : role === "PENDING" ? "0.030" : "0.016"} stroke={color} strokeWidth="0.5" />)}<polyline points={center.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={role === "CURRENT" ? "2.4" : role === "DEP" ? "2.0" : "1.6"} strokeDasharray={role === "PENDING" ? "12 8" : role === "INACTIVE" ? "14 10" : "8 6"} opacity={role === "CURRENT" ? "0.92" : role === "DEP" ? "0.74" : role === "PENDING" ? "0.78" : "0.38"} /><text x={center[0].x + 6} y={center[0].y - 6} fill={color} fontSize="11">{runwayName} {runwayLabelForRole(role)}</text></g>;
  }
  function routeGlide3DForRunway(route, runwayName, large = true) {
    const nav = makeNavCached(runwayName);
    const points = [];
    const first = wp(nav, route[0]);
    if (first && route[0]?.startsWith("IAF")) {
      const br = xyToBearingRange(first.x, first.y).bearing;
      const baseRange = xyToBearingRange(first.x, first.y).rangeNm;
      const outer120 = bearingToXY(br, baseRange + 26);
      const outer100 = bearingToXY(br, baseRange + 13);
      points.push(project3D(outer120.x, outer120.y, 12000, large));
      points.push(project3D(outer100.x, outer100.y, 10000, large));
    }
    route.forEach((id, idx) => {
      const w = wp(nav, id);
      if (!w) return;
      const alt = id.startsWith("IAF") ? 8000 : id.startsWith("DW_") ? 6000 : id.startsWith("BASE_") ? 5000 : id === "IF01" ? 3000 : id === "FAF" ? 2200 : Math.max(3500, 6500 - idx * 800);
      points.push(project3D(w.x, w.y, alt, large));
    });
    return points;
  }
  function renderApproachGuide3D(runwayName, role = "CURRENT") {
    const routes = makeRoutes(runwayName);
    const nav = makeNavCached(runwayName);
    const color = role === "PENDING" ? "#f59e0b" : "#60a5fa";
    const lineDash = role === "PENDING" ? "2 8" : "5 7";
    const lineOpacity = role === "PENDING" ? 0.60 : 0.48;
    const pointOpacity = role === "PENDING" ? 0.88 : 0.78;
    const labelOpacity = role === "PENDING" ? 0.95 : 0.86;
    const visibleFixes = ["IF01", "FAF", "DW_E", "DW_W", "BASE_E", "BASE_W"];
    const fixAlt3D = (id) => {
      if (id === "FAF") return 2200;
      if (id === "IF01") return 3000;
      if (id.startsWith("BASE_")) return 5000;
      if (id.startsWith("DW_")) return 6000;
      return 4000;
    };
    return <g key={`3d-guide-${runwayName}-${role}`}>
      {Object.entries(routes).filter(([name]) => name !== "MISSED_RETURN").map(([name, route]) => {
        const pts = routeGlide3DForRunway(route, runwayName, true);
        return <g key={`3d-guide-${runwayName}-${role}-${name}`}>
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={role === "PENDING" ? "1.7" : "1.4"} strokeDasharray={lineDash} opacity={lineOpacity} />
        </g>;
      })}
      {visibleFixes.map((id) => {
        const w = wp(nav, id);
        if (!w) return null;
        const p = project3D(w.x, w.y, fixAlt3D(id), true);
        return <g key={`3d-fix-${runwayName}-${role}-${id}`} onClick={(e) => { e.stopPropagation(); directToWaypointForRunway(id, runwayName); }} style={{ cursor: "pointer" }}>
          <circle cx={p.x} cy={p.y} r={role === "PENDING" ? "6" : "5"} fill={color} opacity={role === "PENDING" ? "0.22" : "0.16"} stroke={color} strokeWidth="1.2" />
          <circle cx={p.x} cy={p.y} r={role === "PENDING" ? "2.8" : "2.4"} fill={color} opacity={pointOpacity} />
          <text x={p.x + 8} y={p.y - 7} fill={color} fontSize="10" opacity={labelOpacity}>{role === "PENDING" ? `${id}_${runwayName}` : id}</text>
        </g>;
      })}
    </g>;
  }
  const viewSize = 900 / zoom, viewCenter = followSelected ? { x: selected.x, y: selected.y } : { x: radarView.x, y: radarView.y }, viewBox = `${viewCenter.x - viewSize / 2} ${viewCenter.y - viewSize / 2} ${viewSize} ${viewSize}`;
  const depCount = aircraft.filter((a) => a.category === "DEP").length, arrCount = aircraft.filter((a) => a.category !== "DEP").length;
  const delayPenalty = sequenceRows.reduce((sum, r) => sum + Math.floor((r.delay || 0) / 60) * 6, 0);
  const missionPenalty = missionAirspaceViolations.length * 65;
  const score = landedCount * 120 + handoffCount * 90 - conflictPairs.length * 80 - delayPenalty - missionPenalty + aircraft.reduce((sum, a) => sum + scoreAircraft(a), 0);
  const emergencyCount = aircraft.filter((a) => a.emergency || a.mode === "MAYDAY" || a.mode === "PANPAN").length;
  const lowFuelCount = aircraft.filter((a) => (a.fuelMinutes ?? 60) < 15).length;
  const project3D = (x, y, alt = 0, large = false) => project3DPoint(x, y, alt, large, { view3D, aircraft });
  function start3DDrag(e) {
    if (mouseVectorMode) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    setView3D((v) => ({ ...v, dragging: true, dragMode: e.button === 1 ? "rotate" : "pan", lastX: e.clientX, lastY: e.clientY, focusId: e.button === 0 ? null : v.focusId }));
  }
  function move3DDrag(e) {
    if (!view3D.dragging) return;
    const dx = e.clientX - view3D.lastX, dy = e.clientY - view3D.lastY;
    if (view3D.dragMode === "pan") {
      const yaw = (view3D.yaw * Math.PI) / 180;
      const pitch = (view3D.pitch * Math.PI) / 180;
      const s = Math.max(0.001, view3D.scale * 1.32);
      const sinPitch = Math.max(0.08, Math.sin(pitch));
      const x1 = dx / s;
      const z1 = dy / (sinPitch * s);
      const worldDx = x1 * Math.cos(yaw) + z1 * Math.sin(yaw);
      const worldDy = -x1 * Math.sin(yaw) + z1 * Math.cos(yaw);
      setView3D((v) => ({ ...v, centerX: (v.centerX ?? CENTER) - worldDx, centerY: (v.centerY ?? CENTER) - worldDy, lastX: e.clientX, lastY: e.clientY }));
      return;
    }
    setView3D((v) => ({ ...v, yaw: v.yaw + dx * 0.45, pitch: clamp(v.pitch + dy * 0.28, 0, 86), lastX: e.clientX, lastY: e.clientY }));
  }
  function ring3DPoints(radiusNm, large = true) { return buildRing3DPoints(radiusNm, large, project3D); }
  function glidePath3D(course, sideNm = 0, origin = { x: CENTER, y: CENTER }, large = true) { return buildGlidePath3D(course, sideNm, origin, large, project3D); }
  function routeGlide3D(route, large = true) { return buildRouteGlide3D(route, large, env, project3D); }
  function stop3DDrag() { setView3D((v) => ({ ...v, dragging: false, dragMode: null })); }
  const runway3D = (() => {
    const a = runwayPointEnv(env, -2.5);
    const b = runwayPointEnv(env, 2.5);
    return { a: project3D(a.x, a.y, 0), b: project3D(b.x, b.y, 0) };
  })();
  const ils3D = [18, 12, 6, 0].map((d) => {
    const p = runwayPointEnv(env, d);
    return project3D(p.x, p.y, d * 320);
  });

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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, maxWidth: 520, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
                <button style={scopeMode === "RADAR" ? activeButton : buttonStyle} onClick={() => setScopeMode("RADAR")}>{tr("radar")}</button>
                <button style={scopeMode === "3D" ? activeButton : buttonStyle} onClick={() => setScopeMode("3D")}>3D</button>
                <button style={scopeMode === "TWR" ? activeButton : buttonStyle} onClick={() => setScopeMode("TWR")}>{tr("twr")}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "34px 56px 34px", gap: 4, alignItems: "center" }}>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.max(1, v / 2))}>-</button>
                <div style={{ border: "1px solid #374151", background: "#030712", borderRadius: 10, padding: "8px 0", textAlign: "center", fontFamily: "monospace", fontWeight: 900 }}>{timeScale}x</div>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.min(8, v * 2))}>+</button>
              </div>
            </div>
            <div style={{ position: "relative", width: "min(calc(100vw - 720px), calc(100vh - 86px), 1000px)", aspectRatio: "1 / 1", minWidth: 620, overflow: "hidden", borderRadius: 16, border: scopeMode === "3D" ? "1px solid #334155" : "1px solid #14532d", background: scopeMode === "3D" ? "#030712" : "#061306", margin: "0 auto" }}>
              {scopeMode === "TWR" ? <svg viewBox="0 0 900 900" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: "monospace", background: "#03120a", zIndex: 6 }}>
                <rect x="0" y="0" width="900" height="900" fill="#03120a" />
                {[1, 3, 5, 7, 9].map((r) => <circle key={`twr-ring-${r}`} cx="450" cy="450" r={r * 42} fill="none" stroke="#0d5016" strokeWidth="1" opacity="0.7" />)}
                <text x="20" y="32" fill="#32ff4d" fontSize="16" fontWeight="800">CHITOSE TOWER / LOCAL CONTROL / ARR {activeRunway} DEP {depRunway}</text>
                <text x="20" y="54" fill="#94a3b8" fontSize="12">AUTO TWR {towerAuto ? "ON" : "OFF"} | Tower airspace {TWR_RADIUS_NM}NM | AUTO accepts pending traffic, manual requires handoff</text>
                {snowRemovalNotice ? <text x="20" y="78" fill="#f59e0b" fontSize="16" fontWeight="900">{snowRemovalNotice}</text> : null}
                {(() => { const pattern = visualPatternPoints(env); const pts = pattern.map((pt) => ({ x: 450 + (pt.x - CENTER) * TWR_SCALE, y: 450 + (pt.y - CENTER) * TWR_SCALE, id: pt.id })); return <g opacity="0.85"><polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fbbf24" strokeWidth="1.7" strokeDasharray="8 7" />{pts.map((p) => <text key={`vapp-leg-${p.id}`} x={p.x + 8} y={p.y - 8} fill="#fbbf24" fontSize="12">{p.id}</text>)}</g>; })()}
                {(() => { const rwys = Array.from(new Set([activeRunway, depRunway])); return <g>{rwys.map((rw) => { const isArr = rw === activeRunway; const isDep = rw === depRunway; const pts = runwayPolygonPoints(rw, 450, 450, TWR_SCALE, 2.9, 11).map((p) => `${p.x},${p.y}`).join(" "); const o = runwayOrigin(rw); const labelX = 450 + (o.x - CENTER) * TWR_SCALE + 14; const labelY = 450 + (o.y - CENTER) * TWR_SCALE + (isArr && isDep ? 0 : isArr ? -10 : 16); return <g key={`twr-rwy-${rw}`}><polygon points={pts} fill={isArr ? "#94a3b8" : "#64748b"} opacity={isArr ? "0.72" : "0.48"} stroke={isArr ? "#e2e8f0" : "#a855f7"} strokeWidth="1.4" /><text x={labelX} y={labelY} fill={isArr ? "#020617" : "#c084fc"} fontSize="15" fontWeight="900">{rw}{isArr ? " ARR" : " DEP"}</text></g>; })}</g>; })()}
                {(() => { const arrOcc = runwayOccupied(aircraft, activeRunway); const depOcc = runwayOccupied(aircraft, depRunway); const occ = arrOcc || depOcc; return <g><rect x="660" y="20" width="210" height="112" fill="#020617" opacity="0.8" stroke={occ ? "#ef4444" : "#22c55e"} rx="10" /><text x="676" y="46" fill={occ ? "#ef4444" : "#22c55e"} fontSize="14" fontWeight="800">ARR {activeRunway}: {arrOcc ? "OCC" : "CLR"}</text><text x="676" y="66" fill={depOcc ? "#ef4444" : "#22c55e"} fontSize="14" fontWeight="800">DEP {depRunway}: {depOcc ? "OCC" : "CLR"}</text><text x="676" y="90" fill="#cbd5e1" fontSize="12">Inbound queue: {towerQueue(aircraft, env).arrivals.length}</text><text x="676" y="111" fill="#cbd5e1" fontSize="12">DEP queue: {towerQueue(aircraft, env).departures.length}</text></g>; })()}
                {aircraft.filter((a) => xyToBearingRange(a.x, a.y).rangeNm < 14).map((a) => { const br = xyToBearingRange(a.x, a.y); const p = { x: 450 + (a.x - CENTER) * TWR_SCALE, y: 450 + (a.y - CENTER) * TWR_SCALE }; const color = a.id === selectedId ? "#f6e94d" : a.category === "DEP" ? "#c084fc" : a.category === "MIL" ? "#60a5fa" : a.landingClearance ? "#4ade80" : "#32ff4d"; return <g key={`twr-${a.id}`} onClick={() => selectAircraft(a.id)} style={{ cursor: "pointer" }}><circle cx={p.x} cy={p.y} r="5" fill={color} /><line x1={p.x} y1={p.y} x2={p.x + hdgVector(a.heading).x * 34} y2={p.y + hdgVector(a.heading).y * 34} stroke={color} strokeWidth="2" /><text x={p.x + 10} y={p.y - 8} fill={color} fontSize="12" fontWeight="700">{a.id}</text><text x={p.x + 10} y={p.y + 8} fill={color} fontSize="11">{a.type} {fmtFL(a.altitude)} {Math.round(a.speed)} {modeText(a)}</text></g>; })}
                <text x="20" y="870" fill="#64748b" fontSize="12">TWR view: local display, runway occupancy, final / pattern / departure queue.</text>
              </svg> : null}
              {scopeMode === "3D" ? <svg viewBox="0 0 900 900" ref={svg3DRef} onMouseDown={(e) => { if (!mouseVectorMode) start3DDrag(e); }} onMouseMove={(e) => { if (mouseVectorMode) handle3DVectorMove(e); else move3DDrag(e); }} onClick={handle3DVectorClick} onMouseUp={stop3DDrag} onMouseLeave={(e) => { stop3DDrag(); if (mouseVectorMode) setVectorPreview(null); }} onWheel={(e) => { e.preventDefault(); setView3D((v) => ({ ...v, scale: clamp(v.scale + (e.deltaY < 0 ? 0.08 : -0.08), 0.18, 2.2) })); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: "monospace", cursor: view3D.dragging ? "grabbing" : "default", background: "#030712", userSelect: "none", zIndex: 5 }}>
                <defs>
                  <linearGradient id="main3dGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#020617" /></linearGradient>
                  <marker id="northArrow3D" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L7,3 z" fill="#f8fafc" /></marker>
                </defs>
                <rect x="0" y="0" width="900" height="900" fill="url(#main3dGround)" />
                {[10, 20, 40, 60, 80, 100].map((r) => <polyline key={`main3d-ring-${r}`} points={ring3DPoints(r, true)} fill="none" stroke="#0d5016" strokeWidth="1" opacity="0.72" />)}
                {[0, 90, 180, 270].map((brg) => { const a = project3D(CENTER, CENTER, 0, true); const b = project3D(bearingToXY(brg, 100).x, bearingToXY(brg, 100).y, 0, true); return <line key={`main3d-axis-${brg}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0d5016" strokeWidth="1" opacity="0.65" />; })}
                {[20, 40, 60, 80, 100].map((r) => { const p = project3D(CENTER + r * PX_PER_NM, CENTER, 0, true); return <text key={`main3d-ring-label-${r}`} x={p.x + 4} y={p.y - 2} fill="#148a25" fontSize="11">{r}nm</text>; })}
                {[5000, 10000, 15000, 20000].map((alt) => { const l = project3D(CENTER - 410, CENTER + 410, alt, true), r = project3D(CENTER + 410, CENTER + 410, alt, true); return <g key={`altband-${alt}`}><line x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke="#1e3a8a" strokeWidth="1" opacity="0.28" strokeDasharray="5 8" /><text x={l.x + 4} y={l.y - 3} fill="#64748b" fontSize="10">FL{Math.round(alt / 100)}</text></g>; })}
                
                {(() => { return <g>{runwayDisplaySet.map(({ runway: rw, role }) => { const pts = runwayPolygonPoints(rw, CENTER, CENTER, 1, RJCC_RUNWAY_VISUAL_NM, 5).map((pt) => project3D(pt.x, pt.y, 0, true)).map((p) => `${p.x},${p.y}`).join(" "); const color = role === "CURRENT" ? "#22c55e" : role === "BOTH" ? "#84cc16" : role === "DEP" ? "#a855f7" : role === "PENDING" ? "#f59e0b" : role === "CLOSED" ? "#ef4444" : "#38bdf8"; return <polygon key={`3d-rwy-${rw}`} points={pts} fill={color} opacity={role === "CURRENT" ? "0.42" : role === "BOTH" ? "0.34" : role === "DEP" ? "0.28" : role === "PENDING" ? "0.24" : role === "CLOSED" ? "0.10" : "0.13"} stroke={color} strokeWidth={role === "CURRENT" ? "1.4" : "1"} />; })}</g>; })()}
                {(() => { const c = project3D(CENTER, CENTER, 0, true), n = project3D(bearingToXY(0, 22).x, bearingToXY(0, 22).y, 0, true); return <g><line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke="#f8fafc" strokeWidth="2" opacity="0.9" markerEnd="url(#northArrow3D)" /><text x={n.x + 6} y={n.y - 6} fill="#f8fafc" fontSize="14" fontWeight="800">N</text></g>; })()}
                {runwayDisplaySet.map((set) => renderMainRunwayIls3D(set.runway, set.role))}
                {scenarioId === "foxhound_adiz_05" && scenarioEventsDone.foxhoundPreAlert && !scenarioEventsDone.foxhoundSuccess ? (() => { const area = foxhoundAdizArea(); const pts = adizRectCorners(area).map((pt) => { const p = project3D(pt.x, pt.y, 31000, true); return `${p.x},${p.y}`; }).join(" "); const label = project3D(area.x, area.y, 31000, true); return <g key="foxhound-adiz-zone" pointerEvents="none"><polygon points={pts} fill="#ef4444" opacity="0.075" stroke="#ef4444" strokeWidth="1.7" strokeDasharray="10 6" /><text x={label.x + 8} y={label.y - 10} fill="#ef4444" fontSize="12" opacity="0.96">{lang === "zh" ? "MiG-31 ADIZ 突入区" : "MiG-31 ADIZ PENETRATION ZONE"}</text></g>; })() : null}
                {scenarioId === "foxhound_adiz_05" && scenarioEventsDone.foxhoundPreAlert && !scenarioEventsDone.foxhoundSuccess ? (() => { const area = foxhoundAdizArea(); const pts = ptsString(adizRectCorners(area)); return <g key="foxhound-adiz-zone-radar" pointerEvents="none"><polygon points={pts} fill="#ef4444" opacity="0.075" stroke="#ef4444" strokeWidth={1.9 / Math.sqrt(zoom)} strokeDasharray="10 6" /><text x={area.x + 8 / zoom} y={area.y - 10 / zoom} fill="#ef4444" fontSize={12 / zoom} opacity="0.96">{lang === "zh" ? "MiG-31 ADIZ 突入区" : "MiG-31 ADIZ PENETRATION ZONE"}</text></g>; })() : null}
                {activeCorridors.map((c) => {
                  if (c.kind === "AREA") {
                    const center = c.center || c.end;
                    const pts = Array.from({ length: 73 }, (_, i) => { const a = (i / 72) * Math.PI * 2; const p = project3D(center.x + Math.sin(a) * c.controlRadiusNm * PX_PER_NM, center.y - Math.cos(a) * c.controlRadiusNm * PX_PER_NM, c.area.minAlt, true); return `${p.x},${p.y}`; }).join(" ");
                    const label = project3D(center.x, center.y, c.area.minAlt, true);
                    return <g key={`3d-corridor-${c.id}`}><polygon points={pts} fill={c.color} opacity="0.075" stroke={c.color} strokeWidth="1.4" strokeDasharray="7 6" /><text x={label.x + 8} y={label.y + 18} fill={c.color} fontSize="11" opacity="0.95">{c.aircraftId} CONTROL AREA</text></g>;
                  }
                  const a = project3D(c.start.x, c.start.y, 1800, true); const b = project3D(c.end.x, c.end.y, c.area.minAlt, true); const p = project3D(c.position.x, c.position.y, c.area.minAlt, true);
                  return <g key={`3d-corridor-${c.id}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.color} strokeWidth="2.2" opacity="0.72" strokeDasharray="12 7" /><circle cx={p.x} cy={p.y} r="12" fill={c.color} opacity="0.09" stroke={c.color} strokeWidth="1.2" /><text x={(a.x + b.x) / 2 + 8} y={(a.y + b.y) / 2 - 8} fill={c.color} fontSize="11" opacity="0.95">{c.aircraftId} MOVING CORRIDOR</text></g>;
                })}
                {displayedMissionAreas(aircraft).map((area) => { const c = missionAreaPoint(area); const pts = Array.from({ length: 73 }, (_, i) => { const a = (i / 72) * Math.PI * 2; const p = project3D(c.x + Math.sin(a) * area.radiusNm * PX_PER_NM, c.y - Math.cos(a) * area.radiusNm * PX_PER_NM, area.minAlt, true); return `${p.x},${p.y}`; }).join(" "); const label = project3D(c.x, c.y, area.minAlt, true); return <g key={`mission-${area.id}`}><polygon points={pts} fill={area.dynamic ? "#f59e0b" : "#60a5fa"} opacity="0.055" stroke={area.dynamic ? "#f59e0b" : "#60a5fa"} strokeWidth="1.2" strokeDasharray="6 6" /><text x={label.x + 8} y={label.y - 8} fill={area.dynamic ? "#f59e0b" : "#60a5fa"} fontSize="11" opacity="0.9">{area.id} {area.label}</text></g>; })}
                {runwayDisplaySet.filter((set) => ["CURRENT", "ARR", "BOTH", "PENDING"].includes(set.role)).map((set) => renderApproachGuide3D(set.runway, set.role))}
                {Object.entries(env.sids).map(([name, sid]) => <polyline key={`main3d-sid-${name}`} points={[{ x: CENTER, y: CENTER }, ...sid.route.map((id) => wp(env.nav, id)).filter(Boolean)].map((w, idx) => { const p = project3D(w.x, w.y, idx === 0 ? 0 : 2500, true); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="#a855f7" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.42" />)}
                {env.nav.filter((w) => !["CHITOSE", "MA1", "MAHOLD"].includes(w.id) && !w.id.startsWith("HOLD_")).map((w) => { const p = project3D(w.x, w.y, 0, true); const c = w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"; return <g key={`main3d-wp-${w.id}`} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><polygon points={`${p.x},${p.y - 5} ${p.x + 5},${p.y + 4} ${p.x - 5},${p.y + 4}`} fill="none" stroke={c} strokeWidth="1" opacity="0.7" /><text x={p.x + 7} y={p.y + 4} fill={c} fontSize="10" opacity="0.75">{w.label}</text></g>; })}
                {aircraft.slice().sort((a, b) => project3D(a.x, a.y, a.altitude, true).depth - project3D(b.x, b.y, b.altitude, true).depth).map((a) => { const isSel = a.id === selectedId; const p = project3D(a.x, a.y, a.altitude, true); const g = project3D(a.x, a.y, 0, true); const nextAlt = project3D(a.x, a.y, a.assignedAltitude, true); const color = conflictIds.has(a.id) ? "#ff1f1f" : cautionIds.has(a.id) ? "#f59e0b" : a.emergency ? "#ff4d4d" : isSel ? "#f6e94d" : isFoxhound(a) ? "#ef4444" : a.category === "MIL" ? "#60a5fa" : a.category === "DEP" ? "#c084fc" : a.clearedILS ? "#4de1ff" : "#32ff4d"; const trend = a.assignedAltitude > a.altitude + 300 ? "▲" : a.assignedAltitude < a.altitude - 300 ? "▼" : "→"; return <g key={`main3d-ac-${a.id}`} onClick={(e) => { e.stopPropagation(); selectAircraft(a.id); }} onDoubleClick={(e) => { e.stopPropagation(); setSelectedId(a.id); setView3D((v) => ({ ...v, focusId: v.focusId === a.id ? null : a.id, scale: Math.max(v.scale, 0.9) })); }} style={{ cursor: "pointer" }}><line x1={g.x} y1={g.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={isSel ? "2" : "1.4"} opacity="0.34" /><line x1={p.x} y1={p.y} x2={nextAlt.x} y2={nextAlt.y} stroke={color} strokeWidth="1.2" opacity="0.35" strokeDasharray="4 5" /><circle cx={g.x} cy={g.y} r={isSel ? "3" : "2"} fill={color} opacity="0.45" /><polygon points={`${p.x},${p.y - 7} ${p.x + 8},${p.y + 5} ${p.x - 8},${p.y + 5}`} fill={color} opacity="0.96" /><text x={p.x + 10} y={p.y - 8} fill={color} fontSize="12" fontWeight="700">{a.id} {trend}</text><text x={p.x + 10} y={p.y + 7} fill={color} fontSize="11">{a.type} {a.category} H{fmt3(a.heading)}</text><text x={p.x + 10} y={p.y + 21} fill={color} fontSize="11">{fmtFL(a.altitude)} → {fmtFL(a.assignedAltitude)} SPD {Math.round(a.speed)} F{Math.round(a.fuelMinutes ?? 0)}</text><text x={p.x + 10} y={p.y + 35} fill={color} fontSize="10">{modeText(a)}</text></g>; })}
                {mouseVectorMode && vectorPreview ? (() => { const sp = project3D(selected.x, selected.y, selected.altitude, true); const gp = project3D(vectorPreview.x, vectorPreview.y, 0, true); return <g pointerEvents="none"><line x1={sp.x} y1={sp.y} x2={gp.x} y2={gp.y} stroke="#f6e94d" strokeWidth="2" strokeDasharray="7 6" opacity="0.9" /><circle cx={gp.x} cy={gp.y} r="6" fill="none" stroke="#f6e94d" strokeWidth="2" /><text x={gp.x + 10} y={gp.y - 8} fill="#f6e94d" fontSize="13">HDG {fmt3(vectorPreview.heading)}</text></g>; })() : null}
                <g pointerEvents="none"><rect x="14" y="12" width="330" height="86" fill="#020617" opacity="0.72" stroke="#1f2937" rx="10" /><text x="28" y="32" fill="#94a3b8" fontSize="14" fontWeight="700">3D AIRSPACE / {seat} / RWY {activeRunway}</text><text x="28" y="50" fill="#64748b" fontSize="11">Wind {fmt3(windObj.dir)}/{windObj.speed} QNH {qnh} | HW {env.headwind.toFixed(1)} TW {env.tailwind.toFixed(1)}</text>
                  {snowRemovalNotice ? <text x="28" y="101" fill="#f59e0b" fontSize="13" fontWeight="900">{snowRemovalNotice}</text> : null}{rjcjPriorityNotice ? (() => { const color = rjcjPriorityNotice.level === "FAIL" ? "#ef4444" : rjcjPriorityNotice.level === "DANGER" ? "#f97316" : rjcjPriorityNotice.level === "WARN" ? "#facc15" : rjcjPriorityNotice.level === "DONE" ? "#22c55e" : "#38bdf8"; return <g key="3d-rjcj-priority" pointerEvents="none"><rect x="234" y="112" width="432" height="58" rx="12" fill="#020617" opacity="0.92" stroke={color} strokeWidth="2.4" /><text x="450" y="136" textAnchor="middle" fill={color} fontSize="18" fontWeight="950">{rjcjPriorityNotice.title}</text><text x="450" y="157" textAnchor="middle" fill="#e5e7eb" fontSize="12" fontWeight="800">{rjcjPriorityNotice.body}</text></g>; })() : null}<text x="28" y="67" fill="#64748b" fontSize="11">Yaw {Math.round(view3D.yaw)} Camera {Math.round(view3D.pitch)} Scale {view3D.scale.toFixed(2)} | L-drag pan / M-drag rotate / wheel zoom</text><text x="28" y="84" fill="#64748b" fontSize="11">Mouse vector: {mouseVectorMode ? "ARMED" : "OFF"} | dbl-click target focus {view3D.focusId ? `ON ${view3D.focusId}` : "OFF"}</text></g>
                <g pointerEvents="none"><rect x="620" y="16" width="252" height="108" fill="#020617" opacity="0.72" stroke="#1f2937" rx="10" /><text x="634" y="36" fill="#f6e94d" fontSize="13" fontWeight="800">{selected.id} SELECTED</text><text x="634" y="55" fill="#cbd5e1" fontSize="11">BRG {fmt3(selectedBR.bearing)} / {selectedBR.rangeNm.toFixed(1)}NM | HDG {fmt3(selected.heading)}</text><text x="634" y="73" fill="#cbd5e1" fontSize="11">ALT {fmtFL(selected.altitude)} → {fmtFL(selected.assignedAltitude)} | SPD {Math.round(selected.speed)}</text><text x="634" y="91" fill="#cbd5e1" fontSize="11">FUEL {Math.round(selected.fuelMinutes ?? 0)} | BURN {(selected.burnRate ?? 1).toFixed(1)} | {selected.category}</text><text x="634" y="109" fill="#cbd5e1" fontSize="11">{modeText(selected)}</text></g>
              </svg> : null}
              <svg ref={svgRef} viewBox={viewBox} onClick={handleRadarClick} onMouseDown={handleRadarMouseDown} onMouseMove={handleRadarMouseMove} onMouseUp={stopRadarPan} onMouseLeave={(e) => { stopRadarPan(); if (mouseVectorMode) setVectorPreview(null); }} onWheel={handleRadarWheel} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: "monospace", cursor: mouseVectorMode ? "crosshair" : radarView.panning ? "grabbing" : "default", opacity: scopeMode === "RADAR" ? 1 : 0, pointerEvents: scopeMode === "RADAR" ? "auto" : "none" }}>
                <RangeRingsOverlay />
                <WeatherOverlay weatherOn={weatherOn} weatherCells={env.weatherCells} zoom={zoom} />
                <RadarHeaderOverlay
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
                />
                {runwayDisplaySet.map((set) => renderMainRunwayIlsOverlay(set.runway, set.role))}
                <RadarRunwayOverlay runwayDisplaySet={runwayDisplaySet} />
                <AirportOverlay env={env} zoom={zoom} showAirportIls={showAirportIls} rjcjHelipadPoint={rjcjHelipadPoint} />
                <AlternateHandoffOverlay aircraft={aircraft} env={env} zoom={zoom} alternateHandoffRadiusNm={alternateHandoffRadiusNm} alternateHandoffLabel={alternateHandoffLabel} />
                <MissionOverlay activeCorridors={activeCorridors} aircraft={aircraft} scenarioId={scenarioId} scenarioEventsDone={scenarioEventsDone} zoom={zoom} lang={lang} />
                {runwayDisplaySet.filter((set) => ["CURRENT", "ARR", "BOTH", "PENDING"].includes(set.role)).map((set) => renderApproachGuide(set.runway, set.role))}
                <ProcedureOverlay env={env} activeRunway={activeRunway} zoom={zoom} directToWaypoint={directToWaypoint} />
                <MouseVectorOverlay mouseVectorMode={mouseVectorMode} vectorPreview={vectorPreview} selected={selected} zoom={zoom} fmt3={fmt3} />
                <TargetLayer
                  radarDisplayTargets={radarDisplayTargets}
                  selectedId={selectedId}
                  conflictIds={conflictIds}
                  cautionIds={cautionIds}
                  zoom={zoom}
                  selectAircraft={selectAircraft}
                  fmt3={fmt3}
                  fmtFL={fmtFL}
                  vnavStatus={vnavStatus}
                  env={env}
                  modeText={modeText}
                />
              </svg>
              <div style={{ pointerEvents: "none", position: "absolute", inset: 0, opacity: 0.5, backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "100% 4px" }} />
            </div>
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
