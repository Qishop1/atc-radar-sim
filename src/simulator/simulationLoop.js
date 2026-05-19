import { MAX_TARGETS } from "./constants.js";
import { shortestTurn } from "./geometry.js";
import { makeAircraft, makeRandomArrival } from "./aircraftFactory.js";
import { scenarioTrafficPlan, spawnRoutes } from "./scenarios.js";
import { makeDeparture, makeMilitary, normalizeAircraftState } from "./aircraftStep.js";

export function applyPendingCommands(ctx) {
  const { pendingCommands, tick, setPendingCommands, setAircraft, setLog } = ctx;
  const due = pendingCommands.filter((c) => tick >= c.dueTick);
  if (!due.length) return;
  setPendingCommands((p) => p.filter((c) => tick < c.dueTick));
  setAircraft((prev) => prev.map((a) => {
    let next = a;
    for (const c of due) {
      if (c.targetId !== a.id) continue;
      next = normalizeAircraftState({ ...next, ...c.patch, color: (c.patch.category ?? next.category) === "DEP" ? "#c084fc" : c.patch.category === "MIL" || next.category === "MIL" ? "#60a5fa" : "#f6e94d" });
    }
    return next;
  }));
  setLog((p) => [...due.map((c) => `${c.targetId}: ${c.label} executed.`), ...p].slice(0, 14));

}

export function runAutoTrafficSpawn(ctx) {
  const { running, gameMode, autoConfigRef, tick, setSeq, setAircraft, setLastDepTick, setLastMilTick, setLog } = ctx;
  if (!running) return;
  if (gameMode === "SCENARIO") return;
  const cfg = autoConfigRef.current;
  const arrInt = cfg.spawnRate === "low" ? 90 : cfg.spawnRate === "high" ? 45 : 60;
  const depInt = cfg.depRate === "low" ? 180 : cfg.depRate === "high" ? 90 : 120;
  const milInt = 420;
  const arrActive = cfg.aircraft.filter((a) => a.category === "ARR" && !a.handedOff).length;
  const depActive = cfg.aircraft.filter((a) => a.category === "DEP" && !a.handedOff).length;
  const milActive = cfg.aircraft.filter((a) => a.category === "MIL" && !a.handedOff).length;
  const capacity = cfg.aircraft.length < MAX_TARGETS;
  let spawned = false;
  if (!spawned && cfg.autoSpawn && capacity && arrActive < 5 && tick > 0 && tick % arrInt < cfg.timeScale) {
    const next = makeRandomArrival(cfg.seq);
    spawned = true;
    setSeq((s) => s + 1);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    setLog((o) => [`${next.id}: inbound, expect active runway ${cfg.activeRunway}.`, ...o].slice(0, 14));
  }
  if (!spawned && cfg.depAuto && capacity && depActive < 3 && tick > 0 && tick % depInt < cfg.timeScale && tick - cfg.lastDepTick >= 75) {
    const depChoice = (cfg.depRunways?.length ? cfg.depRunways : [cfg.depRunway || cfg.activeRunway])[cfg.seq % (cfg.depRunways?.length || 1)] || cfg.depRunway || cfg.activeRunway;
    const next = makeDeparture(cfg.seq + 50, cfg.env, depChoice);
    spawned = true;
    setSeq((s) => s + 1);
    setLastDepTick(tick);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    setLog((o) => [`Tower: ${next.id} ready for departure RWY ${next.depRunway}.`, `${next.id}: holding short, filed ${next.sid}, destination ${next.destination}.`, ...o].slice(0, 14));
  }
  if (!spawned && cfg.milAuto && capacity && milActive < 1 && tick > 0 && tick % milInt < cfg.timeScale && tick - cfg.lastMilTick >= 80) {
    const next = makeMilitary(cfg.seq + 90, cfg.aircraft, null, cfg.env);
    setSeq((s) => s + 1);
    setLastMilTick(tick);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    setLog((o) => [`RJCJ: ${next.id} ${next.type} ${next.mode === "RJCJ_DEP" ? "departing to training sector" : "recovering to base"}.`, ...o].slice(0, 14));
  }

}

export function runScenarioTrafficEvents(ctx) {
  const {
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
  } = ctx;
  if (!running || gameMode !== "SCENARIO") return;
  const plan = scenarioTrafficPlan(scenarioId);
  for (const item of plan) {
    if (tick >= item.at && !scenarioTrafficDone[item.at]) {
      setScenarioTrafficDone((p) => ({ ...p, [item.at]: true }));
      setAircraft((prev) => {
        let next = null;
        if (item.kind === "DEP") next = makeDeparture(item.seq || tick, env, depRunway);
        else if (item.kind === "MIL") next = makeMilitary(item.seq || tick, prev, item.type, env);
        else {
          const base = spawnRoutes.find((r) => Math.abs(shortestTurn(r.bearing, item.sector)) < 24) || spawnRoutes[0];
          next = makeAircraft(item.id, item.type, base.bearing, base.range, base.heading, item.spd, item.alt);
        }
        return [...prev, normalizeAircraftState(next)];
      });
      const trafficName = item.id || item.type || ("DEP-" + item.seq);
      setLog((p) => [`SCENARIO TRAFFIC: ${item.kind} ${trafficName} released by timetable.`, ...p].slice(0, 14));
    }
  }
  if (scenarioId === "wind_shift_19" && tick >= 510 && !scenarioEventsDone.windShift) {
    setWind("190/18");
    setScenarioEventsDone((p) => ({ ...p, windShift: true }));
    setLog((p) => ["SCENARIO EVENT: wind shift reported, expect runway transition toward 19.", ...p].slice(0, 14));
  }
  if (scenarioId === "snow_shower_final" && tick >= 360 && !scenarioEventsDone.wxPulse) {
    setWeatherOn(true);
    setWeatherSeed(0.81);
    setScenarioEventsDone((p) => ({ ...p, wxPulse: true }));
    setLog((p) => ["SCENARIO EVENT: snow shower cells building near the arrival flow.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && tick >= 60 && !scenarioEventsDone.sarAlert) {
    setScenarioEventsDone((p) => ({ ...p, sarAlert: true }));
    setLog((p) => ["SCENARIO EVENT: distress call east of Tsugaru Strait. RJCJ Air Rescue Wing SAR traffic priority active.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && tick >= 120 && !scenarioEventsDone.rjchDivertWindow) {
    setScenarioEventsDone((p) => ({ ...p, rjchDivertWindow: true }));
    setLog((p) => ["SCENARIO EVENT: first 30 minutes — arrivals may require RJCH diversion due to RJCC visibility and snow removal capacity.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && realTick >= 480 && !scenarioEventsDone.warnClose01L) {
    setScenarioEventsDone((p) => ({ ...p, warnClose01L: true }));
    setLog((p) => ["SNOW REMOVAL WARNING: RWY 01L will close in 60 compressed seconds. Prepare single-runway operation on 01R.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && realTick >= 600 && !scenarioEventsDone.close01L) {
    setActiveRunway("01R");
    setDepRunway("01R");
    setArrRunways(["01R"]);
    setDepRunways(["01R"]);
    setClosedRunways(["01L"]);
    setScenarioEventsDone((p) => ({ ...p, close01L: true }));
    setLog((p) => ["SNOW REMOVAL: RWY 01L closed. Single-runway operation on 01R until plowed and inspected.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && realTick >= 960 && !scenarioEventsDone.warnClose01R) {
    setScenarioEventsDone((p) => ({ ...p, warnClose01R: true }));
    setLog((p) => ["SNOW REMOVAL WARNING: RWY 01R will close in 60 compressed seconds. RWY 01L reopening expected before the switch.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && realTick >= 1080 && !scenarioEventsDone.close01R) {
    setActiveRunway("01L");
    setDepRunway("01L");
    setArrRunways(["01L"]);
    setDepRunways(["01L"]);
    setClosedRunways(["01R"]);
    setScenarioEventsDone((p) => ({ ...p, close01R: true }));
    setLog((p) => ["SNOW REMOVAL: RWY 01L reopened, RWY 01R closed for plowing. Continue single-runway operation.", ...p].slice(0, 14));
  }
  if (scenarioId === "winter_sar_front" && realTick >= 1680 && !scenarioEventsDone.reopenBoth) {
    setActiveRunway("01L");
    setDepRunway("01R");
    setArrRunways(["01L"]);
    setDepRunways(["01R"]);
    setClosedRunways([]);
    setScenarioEventsDone((p) => ({ ...p, reopenBoth: true }));
    setArrRunways(["01L", "01R"]);
    setDepRunways(["01L", "01R"]);
    setLog((p) => ["SNOW REMOVAL: both 01 runways available again as BOTH operation, but frontal snow bands still moving through the terminal area.", ...p].slice(0, 14));
  }

}
