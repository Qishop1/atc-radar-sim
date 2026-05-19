import { RUNWAYS } from "../simulator/constants.js";
import { fmt3, withSeededRandom } from "../simulator/geometry.js";
import { defaultArrRunwayForPair, defaultDepRunwayForPair, runwayEndOptions, runwayPairName } from "../simulator/navigation.js";
import { activeAirportRunway, generatedWind, makeWeatherCells, parseWind, runwayHeadwind } from "../simulator/weather.js";
import { makeNavCached, makeRoutes, makeSids } from "../simulator/airspaceRoutes.js";
import { makeInitialAircraft, makeScenarioInitialAircraft } from "../simulator/aircraftFactory.js";
import { aircraftFactoryDeps, normalizeAircraftState } from "../simulator/aircraftStep.js";
import { SCENARIOS } from "../simulator/scenarios.js";

export function useSessionController(ctx) {
  const {
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
  } = ctx;

  function startMode(scenario) {
    const sc = scenario || SCENARIOS[0];
    setRunning(false);
    setGameMode(sc.kind || "SANDBOX");
    setScenarioId(sc.id);
    setScenarioEventsDone({});
    setScenarioTrafficDone({});
    setClosedRunways([]);
    setConflictFirstTick(null);
    ctx.setArrivalSequence([]);
    setStartScreen(false);
    ctx.setSeat("APP");
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

  function backToMainMenu() {
    setRunning(false);
    setStartScreen(true);
    setMouseVectorMode(false);
    setVectorPreview(null);
  }

  function reset() {
    if (gameMode === "SCENARIO" || gameMode === "DEBUG") {
      const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS.find((s) => s.kind === gameMode) || SCENARIOS[1];
      startMode(sc);
      return;
    }
    setRunning(false);
    setWeatherTick(0);
    const nextSeed = Math.random();
    const nextWindOffset = Math.random() * 120;
    setWeatherSeed(nextSeed);
    setWindOffset(nextWindOffset);
    const resetWind = generatedWind(nextWindOffset);
    const resetPair = runwayHeadwind(resetWind, 10) >= runwayHeadwind(resetWind, 190) ? "01" : "19";
    const resetArr = defaultArrRunwayForPair(resetPair);
    const resetDep = dualRunway ? defaultDepRunwayForPair(resetPair) : resetArr;
    if (runwayMode === "AUTO") {
      setActiveRunway(resetArr);
      setDepRunway(resetDep);
      setArrRunways([resetArr]);
      setDepRunways([resetDep]);
      setClosedRunways([]);
    }
    const resetEnv = { runway: RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway], nav: makeNavCached(runwayMode === "AUTO" ? resetArr : activeRunway), routes: makeRoutes(runwayMode === "AUTO" ? resetArr : activeRunway), sids: makeSids(runwayMode === "AUTO" ? resetArr : activeRunway), wind: resetWind, headwind: runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course), tailwind: Math.max(0, -runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course)), weatherOn, weatherCells: makeWeatherCells(0, nextSeed), airports: { RJCJ: activeAirportRunway("RJCJ", resetWind), RJCH: activeAirportRunway("RJCH", resetWind), RJSM: activeAirportRunway("RJSM", resetWind) } };
    const nextAircraft = makeInitialAircraft(resetEnv, runwayMode === "AUTO" ? resetDep : depRunway, aircraftFactoryDeps());
    setAircraft(nextAircraft.map(normalizeAircraftState));
    setRadarTargets(nextAircraft.map(normalizeAircraftState).map((a) => ({ ...a, radarSweepTick: 0 })));
    setRadarLastSweepTick(0);
    setSelectedId(nextAircraft[0]?.id || "");
    setLandedCount(0);
    setHandoffCount(0);
    setSeq(6 + Math.floor(Math.random() * 30));
    setTick(0);
    setRealTick(0);
    setWeatherTick(0);
    setLastDepTick(-999);
    setLastMilTick(-999);
    setLog([`CHITOSE: reset. Wind ${fmt3(resetWind.dir)}/${resetWind.speed}. ARR RWY ${runwayMode === "AUTO" ? resetArr : activeRunway}, DEP RWY ${runwayMode === "AUTO" ? resetDep : depRunway}. New traffic and weather loaded.`]);
  }

  return { startMode, backToMainMenu, reset };
}
