import { useEffect, useMemo, useRef, useState } from "react";
import MissionStatusPanel from "./components/MissionStatusPanel.jsx";
import ObjectivePanel from "./components/ObjectivePanel.jsx";
import RadioLog from "./components/RadioLog.jsx";
import CommandPanel from "./components/CommandPanel.jsx";
import ControlConsole from "./components/ControlConsole.jsx";
import RunwayControls from "./components/RunwayControls.jsx";
import SequenceStrip from "./components/SequenceStrip.jsx";
import SelectedAircraftPanel from "./components/SelectedAircraftPanel.jsx";
import StartScreen from "./components/StartScreen.jsx";
import {
  AIRPORT_RUNWAYS,
  CENTER,
  ILS_FAR_PX,
  ILS_NEAR_PX,
  MAX_TARGETS,
  OTHER_RUNWAY_VISUAL_NM,
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
  distancePointToSegment,
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
  weatherTiles,
  windVector,
} from "./simulator/weather.js";
import { SCENARIOS, scenarioObjectives, scenarioTrafficPlan, spawnRoutes } from "./simulator/scenarios.js";
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
  MISSION_AREAS,
  activeMissionCorridors,
  airportDepartureEnd,
  corridorPolygonPoints,
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

const I18N = {
  en: {
    langButton: "中文",
    systemAutomation: "System / Automation",
    pause: "Pause",
    run: "Run",
    spawnDep: "Spawn DEP",
    spawnApp: "Spawn APP",
    reset: "Reset",
    windMode: "Wind mode",
    wind: "Wind",
    runwayMode: "Runway mode",
    arrRwy: "ARR RWY",
    depRwy: "DEP RWY",
    parallelOps: "Parallel ops",
    appAuto: "APP auto",
    depAuto: "DEP auto",
    milAuto: "MIL auto",
    timeScale: "Time scale",
    wxRadar: "WX radar",
    twrAuto: "TWR auto",
    zoomOut: "Zoom -",
    zoomIn: "Zoom +",
    followOn: "Follow ON",
    followOff: "Follow OFF",
    radioLog: "Radio log",
    radar: "RADAR",
    twr: "TWR",
    controlConsole: "Control Console",
    vector: "Vector",
    mouseArmed: "Mouse ARMED",
    mouseVector: "Mouse vector",
    remove: "Remove",
    starVnav: "STAR / VNAV",
    directIf01: "Direct IF01",
    hold: "Hold",
    ilsApp: "ILS APP",
    visualApp: "Visual APP",
    toTwr: "To TWR",
    missedApp: "Missed APP",
    toRjch: "To RJCH",
    toRjsm: "To RJSM",
    divertAll: "Divert all",
    acceptArr: "Accept ARR",
    visualPattern: "Visual Pattern",
    clearLand: "Clear Land",
    goAround: "Go Around",
    lineUp: "Line Up",
    clearTkof: "Clear TKOF",
    releaseRwy: "Release RWY",
    resumeSid: "Resume SID",
    unrestAlt: "UNREST ALT",
    toAcc: "To ACC",
    spawnMil: "Spawn MIL",
    milVector: "MIL vector",
    recoverRjcj: "Recover RJCJ",
    missionDepart: "Mission depart",
    divertRjch: "Divert RJCH",
    weatherStatus: "Weather Status",
    scoreboard: "Scoreboard",
    airports: "Airports",
    on: "ON",
    off: "OFF",
    auto: "AUTO",
    manual: "MANUAL",
    sameRunway: "same runway",
    arrDepSplit: "ARR/DEP split",
    qnh: "QNH",
    statusLine: "Status",
    targetBrg: "BRG",
    targetAlt: "ALT",
    targetSpd: "SPD",
    targetHdg: "HDG",
    fuel: "FUEL",
    burn: "BURN",
    dest: "DEST",
    sid: "SID",
    rwy: "RWY",
    dme: "DME",
    loc: "LOC",
    vnav: "VNAV",
    status: "STATUS",
    contact: "CONTACT",
    spdLim: "SPD LIM",
    categoryArr: "ARR",
    categoryDep: "DEP",
    categoryMil: "MIL",
    twrPending: "TWR PENDING",
    landClr: "LAND CLR",
    noClr: "NO CLR",
    tkofClr: "TKOF CLR",
    rollout: "ROLLOUT",
    vacated: "VACATED",
    visual: "VISUAL",
    pattern: "PATTERN",
    normal: "NORMAL",
    required: "REQUIRED",
    wxOk: "WX OK",
    divertRequired: "DIVERT REQUIRED",
    next: "Next",
    inSeconds: "in",
    hw: "HW",
    tw: "TW",
    arrInTwr: "ARR in TWR",
    depQueue: "DEP queue",
    selected: "Selected",
    landClearanceShort: "Land CLR",
    tkof: "TKOF",
    yes: "YES",
    no: "NO",
    notTwr: "NOT TWR",
    weatherForecast: "Forecast",
    headwind: "Headwind",
    tailwind: "Tailwind",
    divertState: "Divert state",
    runwayModeNotice: "Runway mode may require planning before the phase change.",
    runwayChangePending: "Runway change pending",
    score: "Score",
    landed: "Landed",
    accHandoff: "ACC handoff",
    conflicts: "Conflicts",
    missedAppCount: "Missed APP",
    emergency: "Emergency",
    lowFuel: "Low fuel",
    rjccActiveRunway: "RJCC active runway",
    rjcjTraffic: "RJCJ traffic",
    arrivals: "Arrivals",
    departures: "Departures",
    mainCivilField: "main civil field",
    jasdfBase: "JASDF Chitose AB",
    hakodateAlt: "Hakodate alternate",
    misawaAlt: "Misawa alternate",
    activeRunwayLabel: "active RWY",
    towerViewNote: "TWR view: local display, runway occupancy, final / pattern / departure queue.",
  },
  zh: {
    langButton: "EN",
    systemAutomation: "系统 / 自动化",
    pause: "暂停",
    run: "运行",
    spawnDep: "生成离场",
    spawnApp: "生成进场",
    reset: "重置",
    windMode: "风向模式",
    wind: "风",
    runwayMode: "跑道模式",
    arrRwy: "进场跑道",
    depRwy: "离场跑道",
    parallelOps: "平行运行",
    appAuto: "进场自动",
    depAuto: "离场自动",
    milAuto: "军机自动",
    timeScale: "时间倍率",
    wxRadar: "天气雷达",
    twrAuto: "塔台自动",
    zoomOut: "缩小",
    zoomIn: "放大",
    followOn: "跟随 开",
    followOff: "跟随 关",
    radioLog: "无线电记录",
    radar: "雷达",
    twr: "塔台",
    controlConsole: "管制席位",
    vector: "雷达引导",
    mouseArmed: "鼠标引导待命",
    mouseVector: "鼠标引导",
    remove: "移除",
    starVnav: "进场程序 / VNAV",
    directIf01: "直飞 IF01",
    hold: "等待",
    ilsApp: "ILS 进近",
    visualApp: "目视进近",
    toTwr: "交给塔台",
    missedApp: "复飞程序",
    toRjch: "备降 RJCH",
    toRjsm: "备降 RJSM",
    divertAll: "全部备降",
    acceptArr: "接收进场",
    visualPattern: "目视航线",
    clearLand: "允许落地",
    goAround: "复飞",
    lineUp: "进跑道等待",
    clearTkof: "允许起飞",
    releaseRwy: "释放跑道",
    resumeSid: "恢复 SID",
    unrestAlt: "取消高度限制",
    toAcc: "交给区域",
    spawnMil: "生成军机",
    milVector: "军机引导",
    recoverRjcj: "返回 RJCJ",
    missionDepart: "任务离场",
    divertRjch: "备降 RJCH",
    weatherStatus: "天气状态",
    scoreboard: "计分板",
    airports: "机场",
    on: "开",
    off: "关",
    auto: "自动",
    manual: "手动",
    sameRunway: "同跑道",
    arrDepSplit: "进离场分跑道",
    qnh: "气压",
    statusLine: "状态",
    targetBrg: "方位",
    targetAlt: "高度",
    targetSpd: "速度",
    targetHdg: "航向",
    fuel: "燃油",
    burn: "耗油率",
    dest: "目的地",
    sid: "离场程序",
    rwy: "跑道",
    dme: "DME",
    loc: "航道偏差",
    vnav: "垂直剖面",
    status: "状态",
    contact: "频率",
    spdLim: "限速",
    categoryArr: "进场",
    categoryDep: "离场",
    categoryMil: "军机",
    twrPending: "待交塔台",
    landClr: "已许落地",
    noClr: "未许可",
    tkofClr: "已许起飞",
    rollout: "滑跑",
    vacated: "脱离跑道",
    visual: "目视",
    pattern: "航线",
    normal: "正常",
    required: "需要",
    wxOk: "天气可用",
    divertRequired: "必须备降",
    next: "下一变化",
    inSeconds: "秒后",
    hw: "顶风",
    tw: "顺风",
    arrInTwr: "塔台进场",
    depQueue: "离场队列",
    selected: "选中目标",
    landClearanceShort: "落地许可",
    tkof: "起飞",
    yes: "是",
    no: "否",
    notTwr: "未交塔台",
    weatherForecast: "预报",
    headwind: "顶风",
    tailwind: "顺风",
    divertState: "备降状态",
    runwayModeNotice: "跑道模式切换前需要提前规划流量。",
    runwayChangePending: "跑道换向等待",
    score: "得分",
    landed: "落地",
    accHandoff: "交给区域",
    conflicts: "冲突",
    missedAppCount: "复飞",
    emergency: "紧急情况",
    lowFuel: "低油量",
    rjccActiveRunway: "RJCC 当前跑道",
    rjcjTraffic: "RJCJ 军机流量",
    arrivals: "进场",
    departures: "离场",
    mainCivilField: "主民航机场",
    jasdfBase: "航空自卫队千岁基地",
    hakodateAlt: "函馆备降场",
    misawaAlt: "三泽备降场",
    activeRunwayLabel: "当前跑道",
    towerViewNote: "塔台视图：本场显示、跑道占用、五边/航线/离场队列。",
  },
};

function separationAssessment(a, b) {
  const dxNm = (b.x - a.x) / PX_PER_NM;
  const dyNm = (b.y - a.y) / PX_PER_NM;
  const lateralNm = Math.hypot(dxNm, dyNm);
  const verticalFt = Math.abs(a.altitude - b.altitude);
  const av = hdgVector(a.heading), bv = hdgVector(b.heading);
  const rvx = (b.speed * bv.x - a.speed * av.x) / 3600;
  const rvy = (b.speed * bv.y - a.speed * av.y) / 3600;
  const closingKts = lateralNm > 0 ? -((dxNm * rvx + dyNm * rvy) / lateralNm) * 3600 : 0;
  const tMinSec = closingKts > 1 ? Math.max(0, ((lateralNm - 3) / closingKts) * 3600) : Infinity;
  const predicted = closingKts > 1 && lateralNm < 8 && verticalFt < 1500 && tMinSec <= 90;
  const violation = lateralNm < 3 && verticalFt < 1000;
  const amber = !violation && (predicted || (lateralNm < 4.5 && verticalFt < 1200 && closingKts > 20));
  return { a: a.id, b: b.id, lateralNm, verticalFt, closingKts, tMinSec, level: violation ? "RED" : amber ? "AMBER" : "NONE", kind: "RADAR" };
}
function isGroundTraffic(ac) {
  return ac.touchdown || ac.runwayOccupancy || ac.altitude < 300 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(ac.mode);
}
function wakeAssessment(lead, trail, env) {
  if (isGroundTraffic(lead) || isGroundTraffic(trail)) return null;
  if (lead.category !== "ARR" || trail.category !== "ARR") return null;
  const finalWakeModes = new Set(["ILS", "FINAL", "FINAL_NO_CLEAR", "TWR_FINAL", "FINAL_LAND", "UNSTABLE_ILS"]);
  if (!finalWakeModes.has(lead.mode) || !finalWakeModes.has(trail.mode)) return null;
  if (lead.hold || trail.hold || lead.mode === "HOLD" || trail.mode === "HOLD") return null;
  if (lead.missed || trail.missed || String(lead.mode).includes("MISSED") || String(trail.mode).includes("MISSED")) return null;
  const rwLead = approachRunwayForAircraft(lead, env), rwTrail = approachRunwayForAircraft(trail, env);
  if (rwLead.name !== rwTrail.name) return null;
  if (Math.abs(shortestTurn(lead.heading, rwLead.course)) > 45 || Math.abs(shortestTurn(trail.heading, rwTrail.course)) > 45) return null;
  const gLead = finalGeometryAt(runwayOrigin(rwLead), rwLead.course, lead.x, lead.y);
  const gTrail = finalGeometryAt(runwayOrigin(rwTrail), rwTrail.course, trail.x, trail.y);
  if (Math.abs(gLead.crossPx) > 55 || Math.abs(gTrail.crossPx) > 55) return null;
  if (gLead.alongNm < 0.2 || gTrail.alongNm < 0.2 || gLead.alongNm > 16 || gTrail.alongNm > 16) return null;
  if (gLead.alongNm >= gTrail.alongNm) return null;
  const spacingNm = gTrail.alongNm - gLead.alongNm;
  const requiredNm = wakeMinNm(lead, trail);
  const closureKts = Math.max(0, trail.speed - lead.speed);
  const tMinSec = closureKts > 1 ? Math.max(0, ((spacingNm - requiredNm) / closureKts) * 3600) : Infinity;
  const violation = spacingNm < requiredNm;
  const amber = !violation && spacingNm < requiredNm + 1.5 && (closureKts > 5 || spacingNm < requiredNm + 0.8);
  return { a: lead.id, b: trail.id, lead: lead.id, trail: trail.id, runway: rwLead.name, spacingNm, requiredNm, closureKts, tMinSec, level: violation ? "RED" : amber ? "AMBER" : "NONE", kind: "WAKE" };
}
function wakeShort(wtc) { return wtc === "SUPER" ? "S" : wtc === "HEAVY" ? "H" : wtc === "LIGHT" ? "L" : "M"; }
function formatEta(sec) {
  if (!Number.isFinite(sec)) return "--:--";
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function formatJstTime(sec) {
  if (!Number.isFinite(sec)) return "--:--:--";
  const s = Math.max(0, Math.round(sec));
  const daySec = (9 * 3600 + s) % 86400;
  const h = Math.floor(daySec / 3600);
  const m = Math.floor((daySec % 3600) / 60);
  const ss = daySec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function formatSignedClock(sec) {
  if (!Number.isFinite(sec)) return "+--:--";
  const sign = sec >= 0 ? "+" : "-";
  return `${sign}${formatEta(Math.abs(sec))}`;
}
function arrivalPathDistanceNm(ac, env) {
  if (ac.category !== "ARR") return Infinity;
  const rw = approachRunwayForAircraft(ac, env);
  const nav = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  let dist = Math.max(0, geo.alongNm);
  if (ac.route?.length && ac.mode === "ROUTE") {
    let px = ac.x, py = ac.y;
    dist = 0;
    for (let i = ac.routeIndex || 0; i < ac.route.length; i++) {
      const fix = wp(nav, ac.route[i]);
      if (!fix) continue;
      dist += Math.hypot(px - fix.x, py - fix.y) / PX_PER_NM;
      px = fix.x; py = fix.y;
    }
    const lastGeo = finalGeometryAt(runwayOrigin(rw), rw.course, px, py);
    dist += Math.max(0, lastGeo.alongNm);
  } else if (ac.mode === "VECTOR" || ac.mode === "RADAR_CONTACT" || ac.mode === "DIRECT_FIX") {
    dist = Math.max(dist, xyToBearingRange(ac.x, ac.y).rangeNm * 0.55);
  } else if (ac.mode === "VISUAL_APP" || ac.mode === "TWR_PATTERN") {
    dist = Math.max(0, geo.alongNm) + Math.max(0, 5 - (ac.patternLeg || 0)) * 2.2;
  } else if (ac.mode === "MISSED_APP" || ac.mode === "MISSED" || ac.mode === "MISSED_TRANSFER_APP") {
    dist = Math.max(14, xyToBearingRange(ac.x, ac.y).rangeNm * 0.55);
  }
  return dist;
}
function estimateArrivalEtaSec(ac, env) {
  const dist = arrivalPathDistanceNm(ac, env);
  const spd = Math.max(90, Math.min(Math.max(ac.speed || 0, approachSpeedFor(ac)), cleanSpeedFor(ac)));
  return (dist / spd) * 3600;
}
function sequenceGapAssessment(lead, trail, env) {
  const leadEta = estimateArrivalEtaSec(lead, env);
  const trailEta = estimateArrivalEtaSec(trail, env);
  const timeDelta = trailEta - leadEta;
  const predictedNm = Math.max(0, (timeDelta / 3600) * Math.max(approachSpeedFor(trail), 90));
  const wakeReq = wakeMinNm(lead, trail);
  const radarReq = 3;
  const required = Math.max(wakeReq, radarReq);
  const level = predictedNm < required ? "RED" : predictedNm < required + 1.2 ? "AMBER" : "GREEN";
  return { leadEta, trailEta, timeDelta, predictedNm, wakeReq, radarReq, required, level };
}
function airportApproachGeometry(airportId, ac) {
  const ap = AIRPORTS.find((a) => a.id === airportId);
  if (!ap) return null;
  const rw = ac?.alternateRunway || (airportId === "RJCH" ? "12" : "RWY");
  const course = airportId === "RJCH" ? 120 : airportId === "RJSM" ? 100 : 180;
  const geo = finalGeometryAt({ x: ap.x, y: ap.y }, course, ac.x, ac.y);
  return { airport: ap, runway: rw, course, geo };
}
function alternateRunwayConfig(airportId, wind = null) {
  const candidates = AIRPORT_RUNWAYS[airportId] || AIRPORT_RUNWAYS.RJCH;
  const picked = wind ? candidates.reduce((best, r) => runwayHeadwind(wind, r.course) > runwayHeadwind(wind, best.course) ? r : best, candidates[0]) : candidates[0];
  return { airportId, runwayName: picked.name, course: picked.course };
}
function alternateRunwayPoint(airportId, dme, wind = null) {
  const ap = AIRPORTS.find((a) => a.id === airportId);
  const cfg = alternateRunwayConfig(airportId, wind);
  return ap ? runwayPointAt({ x: ap.x, y: ap.y }, cfg.course, dme) : { x: CENTER, y: CENTER };
}
function runwayPointForRunway(runwayName, dme) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const origin = runwayOrigin(rw);
  const v = hdgVector(rw.course);
  return { x: origin.x - v.x * dme * PX_PER_NM, y: origin.y - v.y * dme * PX_PER_NM };
}
function runwayPolygonPoints(runwayName, centerX = CENTER, centerY = CENTER, scale = 1, lenNm = RJCC_RUNWAY_VISUAL_NM, halfWidth = 4) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const origin = runwayOrigin(rw);
  const v = hdgVector(rw.course);
  const r = { x: -v.y, y: v.x };
  const len = lenNm * PX_PER_NM * scale;
  const offX = (origin.x - CENTER) * scale;
  const offY = (origin.y - CENTER) * scale;
  const cx = centerX + offX;
  const cy = centerY + offY;
  return [
    { x: cx - v.x * len + r.x * halfWidth, y: cy - v.y * len + r.y * halfWidth },
    { x: cx + v.x * len + r.x * halfWidth, y: cy + v.y * len + r.y * halfWidth },
    { x: cx + v.x * len - r.x * halfWidth, y: cy + v.y * len - r.y * halfWidth },
    { x: cx - v.x * len - r.x * halfWidth, y: cy - v.y * len - r.y * halfWidth },
  ];
}
function ilsTrapPoints(origin, course, nearNm = 0, farNm = 18, nearHalfPx = ILS_NEAR_PX, farHalfPx = ILS_FAR_PX) {
  const v = hdgVector(course);
  const r = { x: -v.y, y: v.x };
  const near = runwayPointAt(origin, course, nearNm);
  const far = runwayPointAt(origin, course, farNm);
  const leftNear = { x: near.x + r.x * nearHalfPx, y: near.y + r.y * nearHalfPx };
  const leftFar = { x: far.x + r.x * farHalfPx, y: far.y + r.y * farHalfPx };
  const rightFar = { x: far.x - r.x * farHalfPx, y: far.y - r.y * farHalfPx };
  const rightNear = { x: near.x - r.x * nearHalfPx, y: near.y - r.y * nearHalfPx };
  return [leftNear, leftFar, rightFar, rightNear];
}
function ilsBoundaryLines(origin, course, nearNm = 0, farNm = 18, nearHalfPx = ILS_NEAR_PX, farHalfPx = ILS_FAR_PX) {
  const pts = ilsTrapPoints(origin, course, nearNm, farNm, nearHalfPx, farHalfPx);
  return {
    polygon: pts,
    left: [pts[0], pts[1]],
    right: [pts[3], pts[2]],
    center: [runwayPointAt(origin, course, nearNm), runwayPointAt(origin, course, farNm)],
  };
}
function runwayPointEnv(env, dme) { return runwayPointForRunway(env.runway.name, dme); }
function finalGeometryRunway(env, x, y) { return finalGeometryAt(runwayOrigin(env.runway), env.runway.course, x, y); }
function nearestMissionAreaAhead(ac, heading) {
  if (!ac.avoidMissionAreas) return null;
  if (ac.category === "MIL" || isApproachMode(ac.mode) || ac.mode === "HOLD" || isAlternateMode(ac.mode)) return null;
  const lookaheadNm = Math.max(10, Math.min(22, (ac.speed || 220) / 13));
  const v = hdgVector(heading);
  const ahead = { x: ac.x + v.x * lookaheadNm * PX_PER_NM, y: ac.y + v.y * lookaheadNm * PX_PER_NM };
  let best = null;
  for (const area of MISSION_AREAS) {
    const p = missionAreaPoint(area);
    const along = ((p.x - ac.x) * v.x + (p.y - ac.y) * v.y) / PX_PER_NM;
    if (along < -1 || along > lookaheadNm) continue;
    const dPx = distancePointToSegment(p, { x: ac.x, y: ac.y }, ahead);
    const limitPx = (area.radiusNm + 3.0) * PX_PER_NM;
    const side = (p.x - ac.x) * (-v.y) + (p.y - ac.y) * v.x;
    if (dPx < limitPx && (!best || dPx < best.dPx)) best = { area, point: p, dPx, along, side };
  }
  return best;
}
function estimateBurnRate(ac, targetAltitude, targetSpeed) {
  const perf = perfFor(ac.type);
  if ((ac.fuelMinutes ?? 60) <= 0) return 0;
  const climbDemand = targetAltitude - ac.altitude;
  const speedDemand = (targetSpeed || ac.speed || 180) - (ac.speed || 180);
  const speedFactor = clamp(Math.pow((targetSpeed || ac.speed || 180) / 200, 1.15), 0.5, 1.75);
  const altitudeFactor = clamp(1.15 - ac.altitude / 52000, 0.55, 1.15);
  let rate = 0.72 * speedFactor * altitudeFactor * (perf.burn || 1);
  if ((ac.category === "MIL" || ac.milMission) && ac.mode === "RJCJ_MISSION") rate = Math.max(rate, 1.05 * speedFactor * (perf.burn || 1));
  if ((ac.category === "MIL" || ac.milMission) && ac.mode === "RJCJ_RTB") rate = Math.max(rate, 0.85 * speedFactor * (perf.burn || 1));
  if (climbDemand > 500) rate = Math.max(rate, 1.55 * speedFactor * altitudeFactor);
  if (climbDemand > 2500) rate = Math.max(rate, 2.05 * speedFactor * altitudeFactor);
  if (ac.category === "DEP" && ac.altitude < 3000 && climbDemand > 500) rate = Math.max(rate, 2.25 * speedFactor * altitudeFactor);
  if (ac.mode === "MISSED_APP") {
    const activeGoAround = climbDemand > 400 || speedDemand > 25 || ac.altitude < 2500;
    rate = Math.max(rate, (activeGoAround ? 2.45 : 0.9) * speedFactor * altitudeFactor);
  }
  if (climbDemand < -500) rate = Math.min(rate, 0.36 * speedFactor * altitudeFactor);
  if (ac.mode === "ILS" || isFinalMode(ac.mode)) rate = Math.min(rate, 0.48 * speedFactor * altitudeFactor);
  if (ac.mode === "HOLD") rate = Math.max(rate, 0.85 * speedFactor * altitudeFactor);
  return clamp(rate, 0.18, 3.2);
}
function militaryBingoFuelMinutes(ac, env) {
  const base = isRotor(ac) ? 10 : ac.type === "F-15J" ? 8 : 11;
  const rjcj = wp(env.nav, "RJCJ") || bearingToXY(285, 4.5);
  const distNm = Math.hypot(ac.x - rjcj.x, ac.y - rjcj.y) / PX_PER_NM;
  const cruiseKts = Math.max(90, Math.min(ac.type === "F-15J" ? 360 : isRotor(ac) ? 95 : 240, ac.assignedSpeed || ac.speed || 160));
  const timeHome = (distNm / cruiseKts) * 60;
  const recoveryReserve = isRotor(ac) ? 6 : 7;
  return clamp(Math.ceil(timeHome + recoveryReserve + base), 8, 28);
}
function shouldMilitaryRTB(ac, env) {
  if (ac.category !== "MIL") return false;
  if (["RJCJ_RTB", "RJCJ_RECOVERY", "RJCJ_FINAL", "RJCJ_HELO_RECOVERY"].includes(ac.mode)) return false;
  const bingo = ac.bingoFuelMinutes ?? militaryBingoFuelMinutes(ac, env);
  return (ac.fuelMinutes ?? 60) <= bingo;
}
function militaryRtbPatch(ac, env) {
  const rjcj = wp(env.nav, "RJCJ") || bearingToXY(285, 4.5);
  const h = headingToPoint(ac.x, ac.y, rjcj);
  return {
    mode: "RJCJ_RTB",
    assignedHeading: h,
    assignedAltitude: isRotor(ac) ? 1500 : 5000,
    assignedSpeed: isRotor(ac) ? 90 : Math.min(260, Math.max(180, ac.speed || 180)),
    destination: "RJCJ",
    missionComplete: false,
    rtbReason: "BINGO FUEL",
    color: "#fbbf24",
  };
}

function makeNav(runwayName) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  const pair = runwayPairName(runwayName);
  const course = rw.course;
  const origin = runwayOrigin(rw);
  const opposite = normHeading(course + 180);
  const eastDownwindBearing = pair === "19" ? normHeading(opposite + 62) : normHeading(opposite - 62);
  const westDownwindBearing = pair === "19" ? normHeading(opposite - 62) : normHeading(opposite + 62);
  const eastBaseBearing = pair === "19" ? normHeading(opposite + 40) : normHeading(opposite - 40);
  const westBaseBearing = pair === "19" ? normHeading(opposite - 40) : normHeading(opposite + 40);
  const rel = (bearing, rangeNm) => {
    const v = hdgVector(bearing);
    return { x: origin.x + v.x * rangeNm * PX_PER_NM, y: origin.y + v.y * rangeNm * PX_PER_NM };
  };
  const rwy = (dme) => runwayPointForRunway(rw.name, dme);
  return [
    { id: "CHITOSE", x: origin.x, y: origin.y, label: "RJCC" },
    { id: "FAF", ...rwy(7), label: "FAF" },
    { id: "IF01", ...rwy(14), label: "IF01" },
    { id: "IAF_N", ...rel(350, 44), label: "IAF_N" },
    { id: "IAF_E", ...rel(70, 44), label: "IAF_E" },
    { id: "IAF_W", ...rel(285, 44), label: "IAF_W" },
    { id: "IAF_S", ...rel(180, 46), label: "IAF_S" },
    { id: "DW_E", ...rel(eastDownwindBearing, 18), label: "DW_E" },
    { id: "DW_W", ...rel(westDownwindBearing, 18), label: "DW_W" },
    { id: "BASE_E", ...rel(eastBaseBearing, 17), label: "BASE_E" },
    { id: "BASE_W", ...rel(westBaseBearing, 17), label: "BASE_W" },
    { id: "HOLD_IN_N", ...rel(0, 54), label: "HOLD_IN_N" },
    { id: "HOLD_IN_NE", ...rel(45, 52), label: "HOLD_IN_NE" },
    { id: "HOLD_IN_E", ...rel(90, 54), label: "HOLD_IN_E" },
    { id: "HOLD_IN_SE", ...rel(135, 54), label: "HOLD_IN_SE" },
    { id: "HOLD_IN_S", ...rel(180, 56), label: "HOLD_IN_S" },
    { id: "HOLD_IN_SW", ...rel(225, 54), label: "HOLD_IN_SW" },
    { id: "HOLD_IN_W", ...rel(270, 54), label: "HOLD_IN_W" },
    { id: "HOLD_IN_NW", ...rel(315, 52), label: "HOLD_IN_NW" },
    { id: "HOLD_N", ...rel(0, 78), label: "HOLD_OUT_N" },
    { id: "HOLD_NE", ...rel(45, 74), label: "HOLD_OUT_NE" },
    { id: "HOLD_E", ...rel(90, 78), label: "HOLD_OUT_E" },
    { id: "HOLD_SE", ...rel(135, 76), label: "HOLD_OUT_SE" },
    { id: "HOLD_S", ...rel(180, 82), label: "HOLD_OUT_S" },
    { id: "HOLD_SW", ...rel(225, 76), label: "HOLD_OUT_SW" },
    { id: "HOLD_W", ...rel(270, 78), label: "HOLD_OUT_W" },
    { id: "HOLD_NW", ...rel(315, 74), label: "HOLD_OUT_NW" },
    { id: "DPN1", ...rel(18, 14), label: "DPN1" },
    { id: "DPN2", ...rel(18, 32), label: "DPN2" },
    { id: "DPN", ...rel(18, 58), label: "DPN" },
    { id: "DPE1", ...rel(70, 14), label: "DPE1" },
    { id: "DPE2", ...rel(70, 34), label: "DPE2" },
    { id: "DPE", ...rel(70, 58), label: "DPE" },
    { id: "DPS1", ...rel(165, 14), label: "DPS1" },
    { id: "DPS2", ...rel(165, 32), label: "DPS2" },
    { id: "DPS", ...rel(165, 58), label: "DPS" },
    { id: "DPW1", ...rel(295, 14), label: "DPW1" },
    { id: "DPW2", ...rel(295, 34), label: "DPW2" },
    { id: "DPW", ...rel(295, 58), label: "DPW" },
    { id: "RJCJ", ...bearingToXY(285, 4.5), label: "RJCJ" },
    { id: "RJCH", ...bearingToXY(212, 74), label: "RJCH" },
    { id: "RJSM", ...bearingToXY(190, 96), label: "RJSM" },
    { id: "MA1", ...rel(course, 8), label: "MA1" },
    { id: "MAHOLD", ...rel(normHeading(course + 35), 17), label: "MAHOLD" },
  ];
}
const navCache = new Map();
function makeNavCached(runwayName) {
  const key = runwayName || "01L";
  if (!navCache.has(key)) navCache.set(key, makeNav(key));
  return navCache.get(key);
}
function wp(nav, id) { return nav.find((w) => w.id === id); }
function holdInboundCourse(fixId, runwayName = "01L") {
  const pair = runwayPairName(runwayName);
  const base = pair === "19" ? 190 : 10;
  if (fixId.endsWith("_N")) return normHeading(base + 180);
  if (fixId.endsWith("_S")) return base;
  if (fixId.endsWith("_E")) return normHeading(base + 270);
  if (fixId.endsWith("_W")) return normHeading(base + 90);
  if (fixId.endsWith("_NE")) return normHeading(base + 225);
  if (fixId.endsWith("_SE")) return normHeading(base + 315);
  if (fixId.endsWith("_SW")) return normHeading(base + 45);
  if (fixId.endsWith("_NW")) return normHeading(base + 135);
  return base;
}
function holdPatternPoints(nav, fixId, runwayName = "01L") {
  const c = wp(nav, fixId);
  if (!c) return [];
  const inbound = holdInboundCourse(fixId, runwayName);
  const outbound = normHeading(inbound + 180);
  const v = hdgVector(outbound);
  const r = { x: -v.y, y: v.x };
  const legNm = 5.2;
  const halfNm = 1.65;
  return [
    { x: c.x + r.x * halfNm * PX_PER_NM, y: c.y + r.y * halfNm * PX_PER_NM, id: `${fixId}_IN` },
    { x: c.x + v.x * legNm * PX_PER_NM + r.x * halfNm * PX_PER_NM, y: c.y + v.y * legNm * PX_PER_NM + r.y * halfNm * PX_PER_NM, id: `${fixId}_OUT_A` },
    { x: c.x + v.x * legNm * PX_PER_NM - r.x * halfNm * PX_PER_NM, y: c.y + v.y * legNm * PX_PER_NM - r.y * halfNm * PX_PER_NM, id: `${fixId}_OUT_B` },
    { x: c.x - r.x * halfNm * PX_PER_NM, y: c.y - r.y * halfNm * PX_PER_NM, id: `${fixId}_IN_B` },
    { x: c.x + r.x * halfNm * PX_PER_NM, y: c.y + r.y * halfNm * PX_PER_NM, id: `${fixId}_IN` },
  ];
}
function makeRoutes(runwayName) {
  const pair = runwayPairName(runwayName);
  return pair === "01"
    ? { NORTH: ["IAF_N", "DW_W", "BASE_W", "IF01", "FAF"], EAST: ["IAF_E", "DW_E", "BASE_E", "IF01", "FAF"], WEST: ["IAF_W", "DW_W", "BASE_W", "IF01", "FAF"], SOUTH: ["IAF_S", "IF01", "FAF"], VECTORS_IF01: ["IF01", "FAF"], MISSED_RETURN: ["DW_E", "BASE_E", "IF01", "FAF"] }
    : { NORTH: ["IAF_N", "IF01", "FAF"], EAST: ["IAF_E", "DW_E", "BASE_E", "IF01", "FAF"], WEST: ["IAF_W", "DW_W", "BASE_W", "IF01", "FAF"], SOUTH: ["IAF_S", "DW_E", "BASE_E", "IF01", "FAF"], VECTORS_IF01: ["IF01", "FAF"], MISSED_RETURN: ["DW_W", "BASE_W", "IF01", "FAF"] };
}
function makeSids(runwayName) {
  return {
    NORTH: { label: `${runwayName}_NORTH`, route: ["DPN1", "DPN2", "DPN"], heading: 18, initialAlt: 5000, topAlt: 14000, speed: 200, exitBearing: 18, exitFix: "DPN" },
    EAST: { label: `${runwayName}_EAST`, route: ["DPE1", "DPE2", "DPE"], heading: 70, initialAlt: 6000, topAlt: 15000, speed: 200, exitBearing: 70, exitFix: "DPE" },
    SOUTH: { label: `${runwayName}_SOUTH`, route: ["DPS1", "DPS2", "DPS"], heading: 165, initialAlt: 5000, topAlt: 12000, speed: 200, exitBearing: 165, exitFix: "DPS" },
    WEST: { label: `${runwayName}_WEST`, route: ["DPW1", "DPW2", "DPW"], heading: 295, initialAlt: 6000, topAlt: 16000, speed: 200, exitBearing: 295, exitFix: "DPW" },
  };
}
function suggestRouteForBearing(b) { if (b > 315 || b < 45) return "NORTH"; if (b < 135) return "EAST"; if (b < 225) return "SOUTH"; return "WEST"; }
function suggestHoldForBearing(b) {
  if (b < 30 || b >= 330) return "HOLD_IN_N";
  if (b < 75) return "HOLD_IN_NE";
  if (b < 120) return "HOLD_IN_E";
  if (b < 165) return "HOLD_IN_SE";
  if (b < 210) return "HOLD_IN_S";
  if (b < 255) return "HOLD_IN_SW";
  if (b < 300) return "HOLD_IN_W";
  return "HOLD_IN_NW";
}

function pickWeightedSpawnRoute() {
  const total = spawnRoutes.reduce((s, r) => s + (r.weight || 1), 0);
  let roll = Math.random() * total;
  for (const r of spawnRoutes) {
    roll -= r.weight || 1;
    if (roll <= 0) return r;
  }
  return spawnRoutes[0];
}

function makeEmptyAircraft() {
  return {
    id: "NO TARGET",
    type: "-",
    x: CENTER,
    y: CENTER,
    heading: 0,
    speed: 0,
    altitude: 0,
    assignedHeading: 0,
    assignedSpeed: 0,
    assignedAltitude: 0,
    speedRestriction: null,
    mode: "NO_TARGET",
    route: [],
    routeIndex: 0,
    hold: null,
    clearedILS: false,
    landed: false,
    missed: false,
    category: "ARR",
    destination: "RJCC",
    sid: null,
    depState: null,
    handedOff: false,
    fuelMinutes: 0,
    burnRate: 0,
    trail: [],
    color: "#64748b",
  };
}
function makeAircraft(id, type, bearing, range, heading, speed, altitude, color = "#32ff4d") {
  const p = perfFor(type);
  const pos = bearingToXY(bearing, range), limitedSpeed = speed <= 0 ? 0 : clamp(speed, p.min, p.max);
  return { id, type, x: pos.x, y: pos.y, heading, speed: limitedSpeed, altitude, assignedHeading: heading, assignedSpeed: limitedSpeed, assignedAltitude: altitude, speedRestriction: null, mode: "RADAR_CONTACT", route: [], routeIndex: 0, hold: null, clearedILS: false, landed: false, missed: false, category: "ARR", destination: "RJCC", sid: null, depState: null, handedOff: false, fuelMinutes: Math.round(35 + Math.random() * 55), trail: [], color };
}
function buildRouteAircraft(env, id, type, routeName, routeIndex, offset, altitude, speed) {
  const route = env.routes[routeName], target = wp(env.nav, route[routeIndex]), prev = routeIndex > 0 ? wp(env.nav, route[routeIndex - 1]) : null;
  const base = prev ? { x: prev.x + (target.x - prev.x) * offset, y: prev.y + (target.y - prev.y) * offset } : target;
  const br = xyToBearingRange(base.x, base.y);
  return { ...makeAircraft(id, type, br.bearing, br.rangeNm, headingToPoint(base.x, base.y, target), speed, altitude), x: base.x, y: base.y, mode: "ROUTE", route, routeIndex, routeRunway: env.runway.name, approachRunway: env.runway.name };
}
function buildFinalAircraft(env, id, type, dme, crossPx, altitude, speed) {
  const p = runwayPointEnv(env, dme), right = { x: -hdgVector(env.runway.course).y, y: hdgVector(env.runway.course).x };
  const x = p.x + right.x * crossPx, y = p.y + right.y * crossPx, br = xyToBearingRange(x, y);
  return { ...makeAircraft(id, type, br.bearing, br.rangeNm, env.runway.course, speed, altitude, "#4de1ff"), x, y, mode: "ILS", clearedILS: true, assignedHeading: env.runway.course, routeRunway: env.runway.name, approachRunway: env.runway.name };
}
function buildRadarContact(id, type, sectorBearing, altitude, speed) {
  const base = Number.isFinite(sectorBearing) ? (spawnRoutes.find((r) => Math.abs(shortestTurn(r.bearing, sectorBearing)) < 24) || pickWeightedSpawnRoute()) : pickWeightedSpawnRoute();
  return makeAircraft(id, type, normHeading(base.bearing + Math.random() * 8 - 4), base.range + Math.random() * 2 - 1, base.heading, speed, altitude);
}
function randomType(idx) { return types[(idx * 3 + Math.floor(Math.random() * types.length)) % types.length]; }
function makeInitialAircraft(env, depRunwayName = env.runway.name) {
  const pool = [];
  const finalDme = 7.5 + Math.random() * 5;
  pool.push(buildFinalAircraft(env, `${callsigns[Math.floor(Math.random() * callsigns.length)]}${200 + Math.floor(Math.random() * 700)}`, randomType(0), finalDme, Math.random() * 24 - 12, Math.round(finalDme * 320 / 100) * 100, 145 + Math.random() * 25));

  const routeNames = ["SOUTH", "SOUTH", "SOUTH", "WEST", "WEST", "NORTH", "EAST"];
  const routeCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < routeCount; i++) {
    const route = routeNames[Math.floor(Math.random() * routeNames.length)];
    const routeDef = env.routes[route];
    const routeIndex = clamp(1 + Math.floor(Math.random() * Math.max(1, routeDef.length - 2)), 0, routeDef.length - 1);
    pool.push(buildRouteAircraft(env, `${callsigns[(i + 1 + Math.floor(Math.random() * callsigns.length)) % callsigns.length]}${100 + Math.floor(Math.random() * 800)}`, randomType(i + 1), route, routeIndex, 0.2 + Math.random() * 0.65, 4000 + Math.floor(Math.random() * 7) * 1000, 185 + Math.random() * 45));
  }

  const radarCount = Math.random() < 0.55 ? 1 : 0;
  const sectors = [185, 185, 225, 285, 285, 330, 65];
  for (let i = 0; i < radarCount; i++) {
    pool.push(buildRadarContact(`${callsigns[(i + 4) % callsigns.length]}${100 + Math.floor(Math.random() * 800)}`, randomType(i + 4), sectors[Math.floor(Math.random() * sectors.length)], 8000 + Math.floor(Math.random() * 9) * 1000, 220 + Math.random() * 70));
  }

  if (Math.random() < 0.28 && pool.length < 4) pool.push(makeMilitary(80 + Math.floor(Math.random() * 40), pool, null, env));
  if (Math.random() < 0.22 && pool.length < 4) pool.push(makeDeparture(30 + Math.floor(Math.random() * 30), env, depRunwayName));
  return pool.slice(0, 4).map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
}
function makeScenarioInitialAircraft(env, scenarioId, depRunwayName = env.runway.name) {
  if (scenarioId === "morning_flow") {
    return [
      buildFinalAircraft(env, "ANA739", "DH8D", 9.8, -5, 3000, 152),
      buildRouteAircraft(env, "JAL214", "B738", "SOUTH", 1, 0.42, 7000, 205),
      buildRouteAircraft(env, "ADO560", "A321", "WEST", 1, 0.30, 9000, 210),
      makeDeparture(31, env, depRunwayName),
      makeDeparture(32, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "wind_shift_19") {
    return [
      buildFinalAircraft(env, "SKY376", "B789", 11.5, 10, 3700, 160),
      buildRouteAircraft(env, "ANA221", "B738", "SOUTH", 1, 0.28, 8000, 210),
      buildRouteAircraft(env, "APJ718", "B738", "WEST", 1, 0.55, 10000, 232),
      makeDeparture(41, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "snow_shower_final") {
    return [
      buildRouteAircraft(env, "JAL511", "B763", "SOUTH", 1, 0.35, 9000, 220),
      buildRouteAircraft(env, "ANA774", "A320", "WEST", 1, 0.26, 7000, 205),
      buildRadarContact("ADO246", "B738", 225, 12000, 250),
      makeDeparture(51, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  if (scenarioId === "winter_sar_front") {
    const initial = [
      buildRouteAircraft(env, "ANA861", "B772", "SOUTH", 1, 0.28, 11000, 235),
      buildRadarContact("JAL303", "B738", 225, 12000, 245),
    ];
    const u125 = makeMilitary(171, initial, "U-125A", env);
    const uh60 = makeMilitary(172, [...initial, u125], "UH-60J", env);
    return [
      ...initial,
      { ...u125, altitude: 3500, assignedAltitude: 3500, speed: 190, assignedSpeed: 210, rjcjWestGatePassed: false },
      { ...uh60, ...rjcjHelipadPoint(env), altitude: 0, assignedAltitude: 1000, speed: 0, assignedSpeed: 80, mode: "RJCJ_HELO_DEP", rjcjRunway: "HELIPAD", rjcjAirborne: false, rjcjWestGatePassed: false, heloGatePassed: false },
      makeDeparture(61, env, depRunwayName),
    ].map((a, idx) => ({ ...a, color: idx === 0 ? "#f6e94d" : a.color }));
  }
  return makeInitialAircraft(env, depRunwayName);
}
function makeRandomArrival(seq) {
  const c = callsigns[seq % callsigns.length], t = types[(seq * 3) % types.length], base = pickWeightedSpawnRoute();
  const id = `${c}${String(100 + ((seq * 47 + Math.floor(Math.random() * 300)) % 900))}`;
  return makeAircraft(id, t, normHeading(base.bearing + Math.random() * 10 - 5), base.range + Math.random() * 3 - 1.5, base.heading, base.speed, base.altitude);
}
function makeIntruderMig31(env, seq = 0) {
  const start = bearingToXY(315, 95);
  const adiz = bearingToXY(315, 48);
  const base = makeAircraft(`FOXHOUND${31 + (seq % 6)}`, "A320", 315, 95, headingToPoint(start.x, start.y, adiz), 320, 31000, "#ef4444");
  return normalizeAircraftState({ ...base, id: `FOXHOUND${31 + (seq % 6)}`, type: "MiG-31", speed: 520, assignedSpeed: 520, maxSpeedOverride: 900 });
}
function foxhoundAdizArea() {
  const center = bearingToXY(315, 48);
  return { id: "ADIZ-NW", label: "JASDF ADIZ", x: center.x, y: center.y, heading: 315, lengthNm: 30, widthNm: 15, radiusNm: 9.5 };
}
function adizRectCorners(area = foxhoundAdizArea()) {
  const v = hdgVector(area.heading || 315);
  const r = { x: -v.y, y: v.x };
  const hl = (area.lengthNm || 30) * PX_PER_NM / 2;
  const hw = (area.widthNm || 15) * PX_PER_NM / 2;
  return [
    { x: area.x + v.x * hl + r.x * hw, y: area.y + v.y * hl + r.y * hw },
    { x: area.x + v.x * hl - r.x * hw, y: area.y + v.y * hl - r.y * hw },
    { x: area.x - v.x * hl - r.x * hw, y: area.y - v.y * hl - r.y * hw },
    { x: area.x - v.x * hl + r.x * hw, y: area.y - v.y * hl + r.y * hw },
  ];
}
function adizLocalCoordsNm(x, y, area = foxhoundAdizArea()) {
  const v = hdgVector(area.heading || 315);
  const r = { x: -v.y, y: v.x };
  const dx = x - area.x;
  const dy = y - area.y;
  return {
    alongNm: (dx * v.x + dy * v.y) / PX_PER_NM,
    crossNm: (dx * r.x + dy * r.y) / PX_PER_NM,
  };
}
function pointInAdizRect(x, y, area = foxhoundAdizArea()) {
  const local = adizLocalCoordsNm(x, y, area);
  return Math.abs(local.alongNm) <= (area.lengthNm || 30) / 2 && Math.abs(local.crossNm) <= (area.widthNm || 15) / 2;
}
function foxhoundDeepPenetration(ac, area = foxhoundAdizArea()) {
  if (!pointInAdizRect(ac.x, ac.y, area)) return false;
  const local = adizLocalCoordsNm(ac.x, ac.y, area);
  return local.alongNm <= -2.0;
}
function distanceFromAdizCenterNm(ac, area = foxhoundAdizArea()) {
  return Math.hypot(ac.x - area.x, ac.y - area.y) / PX_PER_NM;
}
function isFoxhound(ac) {
  return ac?.type === "MiG-31" || ac?.mode === "FOXHOUND_INBOUND" || ac?.mode === "FOXHOUND_EGRESS" || ac?.mode === "FOXHOUND_FORMATION";
}
function isScenario05InterceptPair(a, b) {
  const ids = new Set([a?.id, b?.id]);
  const types = new Set([a?.type, b?.type]);
  const modes = new Set([a?.mode, b?.mode]);
  const eagleFoxhoundIds = ids.has("EAGLE01") && [...ids].some((id) => String(id || "").startsWith("FOXHOUND"));
  const f15FoxhoundTypes = types.has("F-15J") && types.has("MiG-31");
  const formationOrJoin = [...modes].some((m) => ["FOXHOUND_INBOUND", "FOXHOUND_FORMATION", "ADIZ_ESCORT", "RJCJ_DEP"].includes(m)) || a?.interceptPhase || b?.interceptPhase;
  return (eagleFoxhoundIds || f15FoxhoundTypes) && formationOrJoin;
}
function scenario05InterceptPlan(f15, mig) {
  const d = Math.hypot(f15.x - mig.x, f15.y - mig.y) / PX_PER_NM;
  const migHdg = mig.heading || mig.assignedHeading || 135;
  const migSpeed = mig.speed || mig.assignedSpeed || 520;
  const migV = hdgVector(migHdg);
  const migRight = { x: -migV.y, y: migV.x };
  const relX = (f15.x - mig.x) / PX_PER_NM;
  const relY = (f15.y - mig.y) / PX_PER_NM;
  const alongNm = relX * migV.x + relY * migV.y;
  const crossNm = relX * migRight.x + relY * migRight.y;
  const side = 1;
  let phase = "CUT_OFF";
  let aim;
  let assignedHeading;
  let assignedSpeed;
  let assignedAltitude = mig.altitude || 31000;

  if (d > 24) {
    phase = "CUT_OFF";
    const leadNm = clamp(d * 0.42, 10, 22);
    aim = {
      x: mig.x + migV.x * leadNm * PX_PER_NM + migRight.x * side * 4.0 * PX_PER_NM,
      y: mig.y + migV.y * leadNm * PX_PER_NM + migRight.y * side * 4.0 * PX_PER_NM,
    };
    assignedSpeed = f15.altitude < 10000 ? 520 : (f15.maxSpeedOverride || 880);
    assignedAltitude = 32000;
  } else if (d > 10) {
    phase = "CONVERT";
    const leadNm = clamp(d * 0.22, 3.5, 8.0);
    aim = {
      x: mig.x + migV.x * leadNm * PX_PER_NM + migRight.x * side * 2.6 * PX_PER_NM,
      y: mig.y + migV.y * leadNm * PX_PER_NM + migRight.y * side * 2.6 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 210);
  } else if (d > 5.5) {
    phase = "REJOIN";
    aim = {
      x: mig.x - migV.x * 3.2 * PX_PER_NM + migRight.x * side * 1.45 * PX_PER_NM,
      y: mig.y - migV.y * 3.2 * PX_PER_NM + migRight.y * side * 1.45 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 110);
  } else if (d > 2.2) {
    phase = "JOIN_STERN";
    aim = {
      x: mig.x - migV.x * 1.75 * PX_PER_NM + migRight.x * side * 0.9 * PX_PER_NM,
      y: mig.y - migV.y * 1.75 * PX_PER_NM + migRight.y * side * 0.9 * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 35);
  } else {
    phase = "VISUAL_ID";
    aim = {
      x: mig.x - migV.x * 1.45 * PX_PER_NM + migRight.x * side * 0.75 * PX_PER_NM,
      y: mig.y - migV.y * 1.45 * PX_PER_NM + migRight.y * side * 0.75 * PX_PER_NM,
    };
    assignedSpeed = migSpeed;
  }

  const overshot = alongNm > 1.8 && d < 10;
  if (overshot) {
    phase = "CONVERT";
    aim = {
      x: mig.x - migV.x * 2.2 * PX_PER_NM + migRight.x * side * (crossNm >= 0 ? 2.2 : 3.2) * PX_PER_NM,
      y: mig.y - migV.y * 2.2 * PX_PER_NM + migRight.y * side * (crossNm >= 0 ? 2.2 : 3.2) * PX_PER_NM,
    };
    assignedSpeed = Math.min(f15.maxSpeedOverride || 880, migSpeed + 65);
  }

  assignedHeading = phase === "VISUAL_ID" ? migHdg : headingToPoint(f15.x, f15.y, aim);
  return { phase, aim, assignedHeading, assignedSpeed, assignedAltitude, distanceNm: d, migHdg, migSpeed, alongNm, crossNm };
}
function makeFoxhoundIntruder(env, seq = 0) {
  const base = makeIntruderMig31(env, seq);
  const area = foxhoundAdizArea();
  return { ...base, category: "INTRUDER", mode: "FOXHOUND_INBOUND", destination: "ADIZ-NW", assignedHeading: headingToPoint(base.x, base.y, { x: area.x, y: area.y }), assignedAltitude: 31000, assignedSpeed: 520, speed: 520, altitude: 31000, adizArea: area, intercepted: false, hostileTrack: true, maxSpeedOverride: 900, color: "#ef4444" };
}
function makeScenario05Interceptor(env) {
  const rjcjRw = { name: "36", course: 360 };
  const dep = airportDepartureEnd(env, "RJCJ", rjcjRw.name);
  const area = { id: "INT-NW", label: "ADIZ INTERCEPT", bearing: 315, range: 48, radiusNm: 7.5, minAlt: 24000, maxAlt: 38000, dynamic: true };
  const ac = makeAircraft("EAGLE01", "F-15J", xyToBearingRange(dep.x, dep.y).bearing, xyToBearingRange(dep.x, dep.y).rangeNm, rjcjRw.course, 0, 0, "#60a5fa");
  return normalizeAircraftState({
    ...ac,
    x: dep.x,
    y: dep.y,
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    mode: "RJCJ_DEP",
    rjcjRunway: "36",
    rjcjCourse: 360,
    rjcjAirborne: false,
    rjcjWestGatePassed: true,
    missionArea: "ADIZ-NW",
    missionAreaObj: null,
    missionKind: "INTERCEPT",
    interceptTargetId: "FOXHOUND31",
    assignedHeading: rjcjRw.course,
    assignedAltitude: 32000,
    assignedSpeed: 850,
    fuelMinutes: 90,
    bingoFuelMinutes: 12,
    maxSpeedOverride: 880,
    noCommandDelay: true,
    color: "#60a5fa"
  });
}
function adizEscortComplete(ac) {
  if (!ac || ac.mode !== "ADIZ_ESCORT") return false;
  const area = ac.adizArea || foxhoundAdizArea();
  return !pointInAdizRect(ac.x, ac.y, area) && xyToBearingRange(ac.x, ac.y).rangeNm > 62;
}
function foxhoundEscortPatch(ac, env) {
  const rjcj = wp(env.nav, "RJCJ") || bearingToXY(285, 4.5);
  return {
    type: "F-15J",
    mode: "RJCJ_RTB",
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    assignedHeading: headingToPoint(ac.x, ac.y, rjcj),
    assignedAltitude: 8000,
    assignedSpeed: 320,
    missionKind: "INTERCEPT_RTB",
    interceptMerged: false,
    escortingMig: null,
    adizArea: null,
    maxSpeedOverride: 750,
    color: "#60a5fa"
  };
}
function makeMilitary(seq, existing = [], forcedType = null, env = null) {
  const id = `${milCallsigns[seq % milCallsigns.length]}${String(10 + (seq * 7) % 80)}`;
  let type = forcedType || milTypes[seq % milTypes.length];
  if (type === "U-125A" && existing.some((a) => a.type === "U-125A" && a.category === "MIL")) type = seq % 2 === 0 ? "UH-60J" : "T-4";
  const p = perfFor(type);
  const area = (type === "U-125A" || type === "UH-60J") ? makeSarMissionArea(seq, type) : missionForType(type, seq);
  const areaPoint = missionAreaPoint(area);
  const fallbackEnv = env || { nav: makeNavCached("01L"), wind: parseWind("360/03") };
  const rjcjRw = rjcjRunwayForType(fallbackEnv, type);
  const rjcjDep = airportDepartureEnd(fallbackEnv, "RJCJ", rjcjRw.name);
  const rjcjPad = rjcjHelipadPoint(fallbackEnv);
  const spawnRecovery = seq % 5 === 0;
  const fastJet = type === "F-15J";
  const start = spawnRecovery ? { x: areaPoint.x + Math.sin(seq) * area.radiusNm * PX_PER_NM, y: areaPoint.y + Math.cos(seq) * area.radiusNm * PX_PER_NM } : (p.rotor ? rjcjPad : rjcjDep);
  const br = xyToBearingRange(start.x, start.y);
  const missionAlt = p.rotor ? 1800 : type === "U-125A" ? 3500 : fastJet ? 18000 : 9000;
  const missionSpeed = p.rotor ? 95 : fastJet ? 330 : Math.min(220, p.clean);
  const depHeading = p.rotor ? headingToPoint(start.x, start.y, areaPoint) : rjcjDep.course;
  const ac = makeAircraft(id, type, br.bearing, br.rangeNm, depHeading, spawnRecovery ? missionSpeed : 0, spawnRecovery ? missionAlt : 0, "#60a5fa");
  return {
    ...ac,
    x: start.x,
    y: start.y,
    speed: spawnRecovery ? missionSpeed : 0,
    assignedSpeed: spawnRecovery ? missionSpeed : (p.rotor ? 65 : 130),
    assignedAltitude: spawnRecovery ? missionAlt : (p.rotor ? 700 : 1200),
    assignedHeading: depHeading,
    rjcjRunway: p.rotor ? "HELIPAD" : rjcjRw.name,
    rjcjCourse: p.rotor ? depHeading : rjcjRw.course,
    rjcjAirborne: spawnRecovery,
    category: "MIL",
    destination: "RJCJ",
    mode: spawnRecovery ? "RJCJ_MISSION" : (p.rotor ? "RJCJ_HELO_DEP" : "RJCJ_DEP"),
    missionArea: area.id,
    missionAreaObj: area.dynamic ? area : null,
    missionKind: fastJet ? "INTERCEPT" : (type === "U-125A" || type === "UH-60J") ? "SAR" : "TRAINING",
    missionTicks: 0,
    fuelMinutes: Math.round(95 + Math.random() * 90),
    bingoFuelMinutes: militaryBingoFuelMinutes({ ...ac, x: start.x, y: start.y, type, category: "MIL", speed: spawnRecovery ? missionSpeed : 0, assignedSpeed: spawnRecovery ? missionSpeed : (p.rotor ? 65 : 130), mode: spawnRecovery ? "RJCJ_MISSION" : (p.rotor ? "RJCJ_HELO_DEP" : "RJCJ_DEP") }, fallbackEnv),
  };
}
function departureRunwayEntry(runwayName) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01L"];
  return runwayPointForRunway(rw.name, 0.62);
}
function departureQueuePoint(runwayName, slot = 0) {
  const rw = RUNWAYS[runwayName] || RUNWAYS["01"];
  const entry = departureRunwayEntry(rw.name);
  const v = hdgVector(rw.course);
  const side = { x: -v.y, y: v.x };
  const stagger = (slot % 4) * 7;
  return { x: entry.x + side.x * (20 + stagger), y: entry.y + side.y * (20 + stagger) };
}
function makeDeparture(seq, env, runwayName = env.runway.name) {
  const depRunway = RUNWAYS[runwayName] || env.runway;
  const depSids = makeSids(depRunway.name);
  const plan = depFlightPlans[seq % depFlightPlans.length], sid = depSids[plan.sid] || depSids.NORTH;
  const id = `${callsigns[(seq + 2) % callsigns.length]}${String(300 + ((seq * 59 + Math.floor(Math.random() * 400)) % 600))}`;
  const q = departureQueuePoint(depRunway.name, seq);
  const br = xyToBearingRange(q.x, q.y);
  return { ...makeAircraft(id, types[(seq * 5) % types.length], br.bearing, br.rangeNm, depRunway.course, 0, 0, "#c084fc"), x: q.x, y: q.y, category: "DEP", destination: plan.destination, sid: plan.sid, depRunway: depRunway.name, mode: "DEP_READY", depState: "PENDING_TWR", towerControlled: true, takeoffClearance: false, runwayOccupancy: false, assignedHeading: depRunway.course, assignedAltitude: 0, assignedSpeed: 0, route: sid.route, routeIndex: 0, fuelMinutes: Math.round(120 + Math.random() * 90) };
}
function scoreAircraft(ac) {
  let score = 0;
  if (ac.landed) score += 120;
  if (ac.handedOff) score += 90;
  if (ac.emergency) score -= 160;
  if ((ac.fuelMinutes ?? 60) < 15) score -= 40;
  if (ac.mode === "FUEL_EXHAUSTED" || ac.mode === "DEADSTICK") score -= 220;
  if (ac.mode === "MISSED_APP" || ac.mode === "MISSED" || ac.missed) score -= 35;
  if (ac.mode === "HOLD") score -= 4;
  return score;
}
function depExitReady(ac, env) {
  if (ac.category !== "DEP" || !ac.sid) return false;
  const sid = env.sids[ac.sid] || env.sids.NORTH;
  const br = xyToBearingRange(ac.x, ac.y);
  const exitFix = sid.exitFix ? wp(env.nav, sid.exitFix) : null;
  const exitDist = exitFix ? Math.hypot(ac.x - exitFix.x, ac.y - exitFix.y) / PX_PER_NM : 99;
  const routeDone = ac.routeIndex >= (ac.route?.length || 0) || exitDist < 4.5 || br.rangeNm > 56;
  return routeDone && br.rangeNm > 42 && Math.abs(shortestTurn(br.bearing, sid.exitBearing)) < 28 && ac.altitude >= Math.min(10000, sid.initialAlt + 3000);
}
function shouldAutoMissed(ac, env) {
  if (ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || isAlternateMode(ac.mode)) return false;
  if (ac.category !== "ARR" || ac.clearedILS || ac.landingClearance || ac.mode === "VISUAL_APP" || ac.mode === "TWR_PATTERN" || ac.mode === "MISSED" || ac.mode === "APP_RETURN") return false;
  const rw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const aligned = Math.abs(shortestTurn(ac.heading, rw.course)) < 70;
  return geo.alongNm < -0.25 && geo.alongNm > -3 && Math.abs(geo.crossPx) < 90 && ac.altitude < 3500 && aligned;
}
function ilsGateState(ac, env) {
  const rw = approachRunwayForAircraft(ac, env);
  if (env.closedRunways?.includes(rw.name)) {
    const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
    return { rw, geo, inCone: false, capture: false, unstable: false, closed: true };
  }
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const locLimitPx = ILS_NEAR_PX + geo.alongNm * ((ILS_FAR_PX - ILS_NEAR_PX) / 18);
  const desiredAlt = geo.alongNm * 320;
  const gateAltOk = geo.alongNm > 9 ? ac.altitude <= 5000 : Math.abs(ac.altitude - desiredAlt) < 1200;
  const gateSpeedOk = ac.speed < approachSpeedFor(ac) + 85;
  const headingOk = Math.abs(shortestTurn(ac.heading, rw.course)) < 85 || Math.abs(shortestTurn(ac.assignedHeading ?? ac.heading, rw.course)) < 85;
  const inCone = geo.alongNm > 5 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx + 22;
  const capture = geo.alongNm > 5 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx && gateAltOk && gateSpeedOk && headingOk;
  const unstable = inCone && (!gateAltOk || !gateSpeedOk || !headingOk);
  return { rw, geo, inCone, capture, unstable };
}
function canClearILS(ac, env) {
  return ilsGateState(ac, env).capture;
}
function isIlsTerminalExcludedMode(mode) {
  return ["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) || isAlternateMode(mode);
}
function ilsMissedPatch(env, runwayName) {
  return missedApproachPatch(env, runwayName);
}
function resolveIlsCaptureState(ac, env, mode, clearedILS, routeIndex) {
  const gate = ilsGateState({ ...ac, mode, clearedILS }, env);
  const vappMode = mode === "VISUAL_APP" || mode === "TWR_PATTERN";
  const eligible = ac.category === "ARR" && ilsAutoEligible({ ...ac, mode, routeIndex }, mode) && !vappMode && !ac.touchdown && !isIlsTerminalExcludedMode(mode);
  if (!eligible) return { ac, mode, clearedILS, gate, action: "NONE" };
  if (!clearedILS && gate.capture) {
    return {
      ac: { ...ac, clearedILS: true, mode: "ILS", approachRunway: gate.rw.name, routeRunway: gate.rw.name, assignedHeading: gate.rw.course, assignedSpeed: Math.max(approachSpeedFor(ac) + 20, 150) },
      mode: "ILS",
      clearedILS: true,
      gate,
      action: "CAPTURE",
    };
  }
  if (!clearedILS && gate.unstable && (mode === "DIRECT_FIX" || isFinalMode(mode))) {
    return { ac, mode, clearedILS, gate, action: "MISSED", patch: ilsMissedPatch(env, gate.rw.name) };
  }
  return { ac, mode, clearedILS, gate, action: "MONITOR" };
}
function resolveIlsGuidanceState(ac, env, mode, clearedILS) {
  if (!clearedILS) return null;
  const ilsRw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const desiredAlt = geo.alongNm * 320;
  const locLimitPx = ILS_NEAR_PX + geo.alongNm * ((ILS_FAR_PX - ILS_NEAR_PX) / 18);
  const nearFinal = geo.alongNm > -0.35 && geo.alongNm < 16 && Math.abs(geo.crossPx) < locLimitPx + 12;
  const highOnGate = geo.alongNm < 8 && ac.altitude > desiredAlt + 900;
  const fastOnGate = geo.alongNm < 8 && ac.speed > approachSpeedFor(ac) + 55;
  const targetHeading = Math.abs(geo.crossPx) < 10 ? ilsRw.course : headingToPoint(ac.x, ac.y, runwayPointForAircraft(ac, env, clamp(geo.alongNm - 2, 0, 16)));
  const targetSpeed = geo.alongNm < 3 ? approachSpeedFor(ac) : Math.max(approachSpeedFor(ac) + 20, 150);
  const targetAltitude = clamp(desiredAlt + 50, 50, 3000);
  const nextMode = highOnGate || fastOnGate ? "UNSTABLE_ILS" : "ILS";
  const landState = finalLandingState(ac, env, 26, 180);
  const canTouchdown = ac.landingClearance && geo.alongNm < 1.25 && geo.alongNm > -3.0 && Math.abs(geo.crossPx) < 160 && ac.altitude < 1800;
  const lateTouchdown = ac.landingClearance && geo.alongNm < -2.2 && ac.altitude < 900;
  const mustMiss = ((landState.atThreshold || landState.overrun) && !ac.landingClearance) || (!ac.landingClearance && (!nearFinal || geo.alongNm < -1.85));
  return { ilsRw, geo, targetHeading, targetSpeed, targetAltitude, mode: nextMode, land: canTouchdown || lateTouchdown, missed: mustMiss, missedPatch: ilsMissedPatch(env, ac.approachRunway || ac.routeRunway || env.runway.name) };
}
function vnavConstraintForFix(id) {
  if (!id) return 6000;
  if (id.startsWith("IAF")) return 8000;
  if (id.startsWith("DW_")) return 6000;
  if (id.startsWith("BASE_")) return 5000;
  if (id === "IF01") return 3000;
  if (id === "FAF") return 2200;
  if (id.startsWith("HOLD")) return 6000;
  if (id.startsWith("MA")) return 3000;
  return 6000;
}
function vnavDescentToIaf(distNextNm) {
  if (distNextNm > 28) return 12000;
  if (distNextNm > 22) return 11000;
  if (distNextNm > 16) return 10000;
  if (distNextNm > 10) return 9000;
  return 8000;
}
function vnavTargetAltitude(ac, env, routeIndex = ac.routeIndex) {
  if (ac.category !== "ARR") return ac.assignedAltitude;
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const dme = Number.isFinite(geo.alongNm) ? geo.alongNm : 30;
  const absCrossNm = Math.abs(geo.crossPx) / PX_PER_NM;

  if (!ac.clearedILS && ac.route?.length && ac.mode === "ROUTE") {
    const routeNav = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
    const nextId = ac.route[Math.min(routeIndex, ac.route.length - 1)];
    const prevId = ac.route[Math.max(0, routeIndex - 1)];
    const nextFix = wp(routeNav, nextId);
    const nextAlt = vnavConstraintForFix(nextId);
    const prevAlt = vnavConstraintForFix(prevId);
    const distNext = nextFix ? Math.hypot(ac.x - nextFix.x, ac.y - nextFix.y) / PX_PER_NM : 99;
    let target = nextAlt;

    if (nextId === "FAF") target = distNext > 4 ? 3000 : 2200;
    else if (nextId === "IF01") target = distNext > 5 ? Math.max(4000, nextAlt) : nextAlt;
    else if (nextId?.startsWith("BASE_")) target = distNext > 5 ? 5500 : Math.max(5000, nextAlt);
    else if (nextId?.startsWith("DW_")) target = distNext > 6 ? 7000 : Math.max(6000, nextAlt);
    else if (nextId?.startsWith("IAF")) target = vnavDescentToIaf(distNext);
    else target = Math.max(nextAlt, Math.min(prevAlt, nextAlt + distNext * 180));

    return Math.round(clamp(target, 2200, 10000) / 100) * 100;
  }

  if (!ac.clearedILS && (isFinalMode(ac.mode) || ac.mode === "VECTOR" || ac.mode === "DIRECT_FIX")) {
    if (dme > 14) return 5000;
    if (dme > 10) return 4000;
    if (dme > 6.5) return 3000;
    return 2200;
  }

  let target;
  if (dme > 38) target = 12000;
  else if (dme > 32) target = 11000;
  else if (dme > 26) target = 10000;
  else if (dme > 22) target = 9000;
  else if (dme > 18) target = 7500;
  else if (dme > 14) target = 5000;
  else if (dme > 10) target = 4000;
  else if (dme > 7) target = 3000;
  else if (dme > 0) target = Math.max(0, dme * 320);
  else target = 0;
  if (absCrossNm > 10 && dme < 18 && !ac.clearedILS) target = Math.max(target, 4000);
  return Math.round(clamp(target, 0, 10000) / 100) * 100;
}
function vnavStatus(ac, env) {
  if (ac.category !== "ARR") return "-";
  const tgt = vnavTargetAltitude(ac, env);
  const diff = ac.altitude - tgt;
  if (diff > 900) return "HIGH";
  if (diff < -900) return "LOW";
  return "PATH";
}
function canClearVisual(ac, env) {
  return ac.category === "ARR" && ac.altitude <= 6000 && ac.speed < Math.max(250, approachSpeedFor(ac) + 110) && env.tailwind <= 7 && !divertRequired(env.wind);
}
function visualEntryType(ac, env, requested = "DOWNWIND") {
  return "DOWNWIND";
}
function visualDownwindEntry(env) {
  return visualPatternPoints(env)[0];
}
function patternLegName(ac) {
  const names = ["OVERHEAD", "UPWIND", "CROSSWIND", "DOWNWIND", "BASE", "FINAL"];
  return names[ac.patternLeg || 0] || "PATTERN";
}
function inTowerAirspace(ac, env) {
  const br = xyToBearingRange(ac.x, ac.y);
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  return br.rangeNm <= TWR_RADIUS_NM || (geo.alongNm < 8.5 && geo.alongNm > -1.5 && Math.abs(geo.crossPx) < 120 && ac.altitude < 3500);
}
function runwayOccupied(aircraft, runwayName = null) {
  return aircraft.some((a) => {
    if (a.handedOff || a.landed) return false;
    if (runwayName && a.occupancyRunway && a.occupancyRunway !== runwayName) return false;
    if (a.runwayOccupancy) return true;
    if (runwayName && a.depRunway && a.depRunway !== runwayName) return false;
    return a.towerControlled && a.altitude < 400 && xyToBearingRange(a.x, a.y).rangeNm < 1.2;
  });
}
function towerQueue(aircraft, env) {
  const arrivals = aircraft.filter((a) => a.category === "ARR" && !a.handedOff && !a.landed && (inTowerAirspace(a, env) || a.towerPending));
  const departures = aircraft.filter((a) => a.category === "DEP" && !a.handedOff && !a.landed && (a.mode === "DEP_READY" || a.mode === "LINEUP_WAIT" || a.mode === "TAKEOFF_ROLL"));
  const pattern = aircraft.filter((a) => a.mode === "TWR_PATTERN" || a.mode === "VISUAL_APP");
  return { arrivals, departures, pattern };
}
function isFinalMode(mode) {
  return mode === "FINAL" || mode === "FINAL_NO_CLEAR" || mode === "TWR_FINAL" || mode === "FINAL_LAND";
}
function isApproachMode(mode) {
  return isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN";
}
function ilsAutoEligible(ac, mode = ac.mode) {
  if (!ac || ac.category !== "ARR") return false;
  if (mode === "ILS" || mode === "UNSTABLE_ILS" || isFinalMode(mode)) return true;
  if (mode === "DIRECT_FIX") return ac.route?.[0] === "IF01" || ac.route?.[0] === "FAF";
  if (mode === "ROUTE") {
    const current = ac.route?.[ac.routeIndex || 0];
    const previous = ac.route?.[Math.max(0, (ac.routeIndex || 0) - 1)];
    return current === "FAF" || previous === "IF01";
  }
  return false;
}
function isAlternateMode(mode) {
  return ["DIVERT", "ALT_HANDOFF", "ALT_ROLLOUT"].includes(mode);
}
function alternateHandoffRadiusNm(airportId) {
  return airportId === "RJSM" ? 18 : 16;
}
function alternateHandoffLabel(airportId) {
  return `${airportId} APP HANDOFF`;
}
function alternateHandoffState(ac, env) {
  const altAirport = ac.destination || ac.alternate || "RJCH";
  const apt = wp(env.nav, altAirport);
  if (!apt) return null;
  const distNm = Math.hypot(ac.x - apt.x, ac.y - apt.y) / PX_PER_NM;
  const radiusNm = alternateHandoffRadiusNm(altAirport);
  return { altAirport, apt, distNm, radiusNm, inside: distNm <= radiusNm };
}
function alternateDivertStep(ac, env) {
  const st = alternateHandoffState(ac, env);
  if (!st) return null;
  const targetAltitude = st.distNm > 38 ? 9000 : st.distNm > 24 ? 7000 : 5000;
  const targetSpeed = st.distNm > 28 ? 230 : 210;
  return {
    ...st,
    mode: st.inside ? "ALT_HANDOFF" : "DIVERT",
    targetHeading: headingToPoint(ac.x, ac.y, st.apt),
    targetAltitude,
    targetSpeed,
  };
}
function alternateLocalizerHeading(course, crossPx, alongNm) {
  const maxIntercept = alongNm > 11 ? 42 : alongNm > 6 ? 32 : 22;
  const gain = alongNm > 11 ? 0.34 : alongNm > 6 ? 0.26 : 0.18;
  return normHeading(course - clamp(crossPx * gain, -maxIntercept, maxIntercept));
}
function alternateApproachFixes(apt, cfg) {
  return {
    ifPoint: runwayPointAt(apt, cfg.course, 18),
    capturePoint: runwayPointAt(apt, cfg.course, 14),
    interceptPoint: runwayPointAt(apt, cfg.course, 10),
    fafPoint: runwayPointAt(apt, cfg.course, 6.5),
  };
}
function alternateApproachStep(ac, env, mode) {
  return alternateDivertStep(ac, env);
}
function finalModeFor(ac) {
  return "FINAL";
}
function missedApproachPatch(env, runwayName = env.runway.name) {
  const rw = RUNWAYS[runwayName] || env.runway;
  return {
    runwayOccupancy: false,
    occupancyRunway: null,
    touchdown: false,
    towerControlled: false,
    landingClearance: false,
    contact: "DEP",
    category: "DEP",
    destination: "RJCC",
    sid: null,
    depState: "MISSED_APP",
    clearedILS: false,
    missed: true,
    mode: "MISSED_APP",
    route: ["MA1", "MAHOLD"],
    routeIndex: 0,
    hold: null,
    speedRestriction: 200,
    assignedHeading: rw.course,
    assignedAltitude: 3000,
    assignedSpeed: 180,
    routeRunway: rw.name,
    approachRunway: rw.name,
    color: "#ff9f43",
    missedTicks: 0,
  };
}
function missedApproachSafeToReturn(ac, env) {
  if (ac.category !== "DEP" || ac.depState !== "MISSED_APP") return false;
  const rw = RUNWAYS[ac.routeRunway || ac.approachRunway || env.runway.name] || env.runway;
  const origin = runwayOrigin(rw);
  const geo = finalGeometryAt(origin, rw.course, ac.x, ac.y);
  const distFromRunwayNm = Math.hypot(ac.x - origin.x, ac.y - origin.y) / PX_PER_NM;
  const ticks = ac.missedTicks || 0;
  const highEnough = ac.altitude >= 2600;
  const awayFromRunway = geo.alongNm < -4.8 || distFromRunwayNm >= 5.5 || ticks >= 90;
  const cleanState = !ac.touchdown && !ac.runwayOccupancy && ac.mode === "MISSED_APP";
  return cleanState && highEnough && awayFromRunway;
}
function missedApproachReturnPatch(ac, env, afterMove = null) {
  const rw = RUNWAYS[env.runway.name] || env.runway;
  const returnRoute = env.routes.MISSED_RETURN || env.routes.VECTORS_IF01 || [];
  const firstFix = returnRoute.length ? wp(env.nav, returnRoute[0]) : null;
  const h = firstFix ? headingToPoint(afterMove?.x ?? ac.x, afterMove?.y ?? ac.y, firstFix) : rw.course;
  return {
    category: "ARR",
    destination: "RJCC",
    sid: null,
    depState: null,
    missed: false,
    missedTicks: 0,
    clearedILS: false,
    landingClearance: false,
    towerControlled: false,
    contact: "APP",
    mode: returnRoute.length ? "ROUTE" : "VECTOR",
    route: returnRoute,
    routeIndex: 0,
    routeRunway: rw.name,
    approachRunway: rw.name,
    hold: null,
    speedRestriction: null,
    assignedHeading: h,
    assignedAltitude: Math.max(4000, Math.round((ac.altitude || 3000) / 100) * 100),
    assignedSpeed: 190,
    color: "#32ff4d",
  };
}
function towerArrivalPatch(extra = {}) {
  return { ...extra, towerControlled: true, contact: "TWR", towerPending: false, emergencyTowerAccepted: true };
}
function landingClearancePatch(ac) {
  const approachMode = ac.mode === "UNSTABLE_ILS" ? "ILS" : ac.mode;
  return {
    ...ac,
    towerControlled: true,
    contact: "TWR",
    towerPending: false,
    emergencyTowerAccepted: true,
    landingClearance: true,
    mode: isFinalMode(approachMode) ? "FINAL" : approachMode,
    approachRunway: ac.approachRunway || ac.routeRunway || ac.occupancyRunway,
  };
}
function normalizeAircraftState(ac) {
  const fromMode = ac.previousMode || ac.lastMode || ac.mode;
  if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) {
    const mode = canonicalMode(ac.mode);
    const invalidTransition = !isValidTransition(fromMode, mode);
    if (invalidTransition && typeof console !== "undefined") console.warn("Unexpected aircraft state transition", { id: ac.id, from: fromMode, to: mode, category: ac.category, type: ac.type });
    return { ...ac, previousMode: mode, invalidTransition, transitionFrom: invalidTransition ? fromMode : null, transitionTo: invalidTransition ? mode : null, mode, towerPending: false, landingClearance: false, towerControlled: false, contact: ac.contact || "RJCJ", takeoffClearance: false, emergencyTowerAccepted: false };
  }
  const mode = canonicalMode(ac.mode);
  const invalidTransition = !isValidTransition(fromMode, mode);
  if (invalidTransition && typeof console !== "undefined") console.warn("Unexpected aircraft state transition", { id: ac.id, from: fromMode, to: mode, category: ac.category, type: ac.type });
  const emergencyTowerAccepted = !!ac.emergencyTowerAccepted && !!(ac.emergency || ac.mode === "MAYDAY" || ac.mode === "PANPAN");
  const forcedTower = emergencyTowerAccepted || ac.towerControlled || ac.contact === "TWR";
  const towerPending = forcedTower ? false : !!ac.towerPending;
  const landingClearance = forcedTower ? !!ac.landingClearance : false;
  const takeoffClearance = ac.mode === "TAKEOFF_ROLL" || ac.mode === "LINEUP_WAIT" ? !!ac.takeoffClearance : ac.category === "DEP" ? !!ac.takeoffClearance : false;
  return { ...ac, previousMode: mode, invalidTransition, transitionFrom: invalidTransition ? fromMode : null, transitionTo: invalidTransition ? mode : null, mode, towerPending, landingClearance, takeoffClearance, emergencyTowerAccepted, towerControlled: forcedTower, contact: forcedTower ? "TWR" : ac.contact };
}
function canonicalMode(mode) {
  const m = isFinalMode(mode) ? "FINAL" : String(mode || "NO_TARGET");
  return STATE_ALIAS[m] || m;
}
function isValidTransition(fromMode, toMode) {
  const from = canonicalMode(fromMode);
  const to = canonicalMode(toMode);
  if (!from || from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return true;
  return allowed.map(canonicalMode).includes(to);
}
function applyTowerAutomation(aircraft, env, towerAuto) {
  const autoTowerHandoff = (a) => {
    if (a.touchdown || a.mode === "ROLLOUT" || a.mode === "VACATED") return a;
    if (a.category !== "ARR") return a;
    if (isAlternateMode(a.mode)) return a;
    const approachLike = a.clearedILS || a.landingClearance || isFinalMode(a.mode) || a.mode === "ILS" || a.mode === "UNSTABLE_ILS" || a.mode === "VISUAL_APP" || a.mode === "TWR_PATTERN";
    const emergencyArrival = a.emergency || a.mode === "MAYDAY" || a.mode === "PANPAN";
    const lowEnough = a.altitude <= (emergencyArrival ? 6000 : 3600);
    if ((approachLike || emergencyArrival) && inTowerAirspace(a, env) && lowEnough && !a.towerControlled) {
      return { ...a, towerControlled: true, contact: "TWR", towerPending: false, emergencyTowerAccepted: !!emergencyArrival || a.emergencyTowerAccepted };
    }
    return { ...a, towerPending: false };
  };
  const towered = aircraft.map(autoTowerHandoff);
  if (!towerAuto) return towered;
  return towered.map((a) => {
    if (a.touchdown || a.mode === "ROLLOUT" || a.mode === "VACATED") return a;
    if (a.category === "ARR" && a.towerControlled && a.contact === "TWR" && !a.landingClearance) {
      const st = finalLandingState(a, env, 70, 900);
      const rw = a.approachRunway || a.routeRunway || env.runway.name;
      const runwayBusy = runwayOccupied(towered.filter((x) => x.id !== a.id), rw);
      const onApproach = a.clearedILS || a.mode === "ILS" || a.mode === "UNSTABLE_ILS" || a.mode === "VISUAL_APP" || a.mode === "TWR_PATTERN" || isFinalMode(a.mode);
      if (!runwayBusy && onApproach && st.geo.alongNm < 7.0 && st.geo.alongNm > 0.25 && Math.abs(st.geo.crossPx) < 120 && a.speed < approachSpeedFor(a) + 110) return landingClearancePatch(a);
      if (onApproach && a.altitude < 500 && st.geo.alongNm < 0.15 && !a.landingClearance) {
        return { ...a, touchdown: false, runwayOccupancy: false, occupancyRunway: null, towerControlled: false, contact: "DEP", category: "DEP", depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, missed: true, clearedILS: false, landingClearance: false, assignedHeading: env.runway.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43" };
      }
    }
    return a;
  });
}
function displayMode(a) {
  if (a.category === "MIL" && a.mode === "RJCJ_DEP" && a.altitude < 80 && a.speed > 30) return "RJCJ TAKEOFF ROLL";
  if (a.category === "MIL" && a.mode === "RJCJ_DEP" && a.altitude < 80 && a.speed <= 30) return "RJCJ READY";
  if (a.towerPending && !a.towerControlled) return `${a.mode} / TWR PENDING`;
  if (a.mode === "ROLLOUT") return "ROLLOUT";
  if (a.mode === "VACATED") return "VACATED";
  if (a.landingClearance) {
    if (isFinalMode(a.mode)) return "FINAL / LAND CLR";
    if (a.mode === "ILS") return "ILS / LAND CLR";
    if (a.mode === "VISUAL_APP") return "VISUAL / LAND CLR";
    return `${a.mode} / LAND CLR`;
  }
  if (a.takeoffClearance) return `${a.mode} / TKOF CLR`;
  if (a.towerControlled) {
    if (isFinalMode(a.mode)) return "FINAL / NO CLR";
    if (a.mode === "TWR_PATTERN") return `TWR PATTERN / ${patternLegName(a)}`;
    return `${a.mode} / TWR`;
  }
  return a.mode;
}
function wrongRunwayTailwindMiss(ac, env) {
  if (ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || isAlternateMode(ac.mode)) return false;
  return (
    !ac.landingClearance &&
    (ac.clearedILS || ac.mode === "VISUAL_APP" || isFinalMode(ac.mode)) &&
    runwayHeadwind(env.wind, approachRunwayForAircraft(ac, env).course) < -5 &&
    ac.altitude < 500
  );
}
function approachRunwayForAircraft(ac, env) {
  return RUNWAYS[ac.approachRunway || ac.routeRunway || ac.occupancyRunway || env.runway.name] || env.runway;
}
function approachRunwayLocked(ac) {
  if (!ac || ac.category !== "ARR" || ac.touchdown || ac.landed || ac.handedOff || isAlternateMode(ac.mode)) return false;
  if (ac.clearedILS || ac.landingClearance || ac.towerControlled || ac.towerPending) return true;
  return ["ROUTE", "DIRECT_FIX", "ILS", "UNSTABLE_ILS", "VISUAL_APP", "TWR_PATTERN", "FINAL", "FINAL_NO_CLEAR", "TWR_FINAL", "FINAL_LAND"].includes(ac.mode);
}
function approachRunwayChangeRequiresMissed(ac, targetRunway) {
  if (!approachRunwayLocked(ac)) return false;
  const current = ac.approachRunway || ac.routeRunway || ac.occupancyRunway;
  return !!current && !!targetRunway && current !== targetRunway;
}
function finalGeometryForAircraft(ac, env, x = ac.x, y = ac.y) {
  const rw = approachRunwayForAircraft(ac, env);
  return finalGeometryAt(runwayOrigin(rw), rw.course, x, y);
}
function runwayPointForAircraft(ac, env, dme) {
  const rw = approachRunwayForAircraft(ac, env);
  return runwayPointAt(runwayOrigin(rw), rw.course, dme);
}
function finalLandingState(ac, env, crossLimit = 32, altLimit = 220) {
  const rw = approachRunwayForAircraft(ac, env);
  const geo = finalGeometryAt(runwayOrigin(rw), rw.course, ac.x, ac.y);
  const stable = Math.abs(geo.crossPx) < Math.max(crossLimit, 48) && Math.abs(shortestTurn(ac.heading, rw.course)) < 65 && ac.speed < approachSpeedFor(ac) + 105 && env.tailwind <= 10;
  const touchdownZone = geo.alongNm < 0.65 && geo.alongNm > -2.2;
  const atThreshold = touchdownZone && ac.altitude < Math.max(altLimit, 900);
  const overrun = geo.alongNm < -2.4 && ac.altitude < 900;
  return { geo, stable, atThreshold, overrun, runway: rw };
}
function rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, runwayName = null) {
  const rw = RUNWAYS[runwayName || ac.approachRunway || ac.routeRunway || ac.occupancyRunway || env.runway.name] || env.runway;
  return { ...ac, touchdown: true, landed: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: "RJCC", sid: null, depState: null, towerControlled: true, landingClearance: false, contact: "TWR", heading: rw.course, speed: Math.max(80, spd), altitude: 0, x: point.x, y: point.y, assignedHeading: rw.course, assignedSpeed: 25, assignedAltitude: 0, routeIndex: 0, route: [], patternLeg: 0, mode: "ROLLOUT", clearedILS: false, missed: false, speedRestriction: null, color: "#4ade80", runwayOccupancy: true, occupancyRunway: rw.name, approachRunway: rw.name, routeRunway: rw.name, rolloutTicks: 0, trail: [...ac.trail.slice(-55), trailPoint] };
}
function alternateRolloutPatch(ac, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, airportId, runwayName, course) {
  return { ...ac, touchdown: true, landed: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: airportId, alternate: airportId, sid: null, depState: null, towerControlled: true, landingClearance: false, contact: "ALT_APP", heading: course, speed: Math.max(70, spd), altitude: 0, x: point.x, y: point.y, assignedHeading: course, assignedSpeed: 0, assignedAltitude: 0, routeIndex: 0, route: [], patternLeg: 0, mode: "ALT_ROLLOUT", clearedILS: false, missed: false, speedRestriction: null, color: "#4ade80", runwayOccupancy: true, occupancyRunway: `${airportId}-${runwayName}`, approachRunway: null, routeRunway: null, rolloutTicks: 0, trail: [...ac.trail.slice(-55), trailPoint] };
}
function visualPatternPoints(env) {
  const v = hdgVector(env.runway.course);
  const origin = runwayOrigin(env.runway);
  const left = { x: v.y, y: -v.x };
  const lateral = 3.6 * PX_PER_NM;
  return [
    { id: "OVERHEAD", x: origin.x, y: origin.y, alt: PATTERN_ALT, speedAdd: 45 },
    { id: "UPWIND", x: origin.x + v.x * 2.4 * PX_PER_NM, y: origin.y + v.y * 2.4 * PX_PER_NM, alt: PATTERN_ALT, speedAdd: 42 },
    { id: "CROSSWIND", x: origin.x + v.x * 2.4 * PX_PER_NM + left.x * lateral, y: origin.y + v.y * 2.4 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 40 },
    { id: "DOWNWIND", x: origin.x - v.x * 0.6 * PX_PER_NM + left.x * lateral, y: origin.y - v.y * 0.6 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 35 },
    { id: "BASE", x: origin.x - v.x * 4.4 * PX_PER_NM + left.x * lateral, y: origin.y - v.y * 4.4 * PX_PER_NM + left.y * lateral, alt: PATTERN_ALT, speedAdd: 30 },
    { id: "FINAL", x: origin.x - v.x * 5.2 * PX_PER_NM, y: origin.y - v.y * 5.2 * PX_PER_NM, alt: 1500, speedAdd: 25 },
  ];
}
function isRolloutMode(ac) {
  return ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "ALT_ROLLOUT" || ac.mode === "VACATED";
}
function isFuelOutMode(ac) {
  return (ac.fuelMinutes ?? 60) <= 0 || ac.mode === "FUEL_EXHAUSTED" || ac.mode === "DEADSTICK";
}
function rjcjRolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, point, trailPoint, runwayName = null) {
  const rjcj = wp(env.nav, "RJCJ") || bearingToXY(285, 4.5);
  const rw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === (runwayName || ac.rjcjRunway || env.airports.RJCJ.name)) || env.airports.RJCJ || AIRPORT_RUNWAYS.RJCJ[0];
  return {
    ...ac,
    type: ac.type === "F-15J + MiG-31" ? "F-15J" : ac.type,
    touchdown: true,
    landed: false,
    fuelMinutes: nextFuelMinutes,
    burnRate,
    emergency,
    category: "MIL",
    destination: "RJCJ",
    contact: "RJCJ",
    towerControlled: false,
    landingClearance: false,
    heading: rw.course,
    speed: Math.max(80, spd),
    altitude: 0,
    x: point?.x ?? rjcj.x,
    y: point?.y ?? rjcj.y,
    assignedHeading: rw.course,
    assignedSpeed: 25,
    assignedAltitude: 0,
    routeIndex: 0,
    route: [],
    patternLeg: 0,
    mode: "RJCJ_ROLLOUT",
    clearedILS: false,
    missed: false,
    speedRestriction: null,
    color: "#60a5fa",
    runwayOccupancy: true,
    occupancyRunway: `RJCJ-${rw.name}`,
    rjcjRunway: rw.name,
    rolloutTicks: 0,
    trail: [...ac.trail.slice(-55), trailPoint || { x: ac.x, y: ac.y }]
  };
}
function stepRolloutMotion(ac, env) {
  if (ac.landed || ac.handedOff) return ac;
  if (ac.touchdown && ac.mode !== "ROLLOUT" && ac.mode !== "VACATED" && ac.mode !== "RJCJ_ROLLOUT" && ac.mode !== "ALT_ROLLOUT") {
    ac = {
      ...ac,
      category: "ARR",
      sid: null,
      depState: null,
      missed: false,
      clearedILS: false,
      landingClearance: false,
      towerControlled: true,
      contact: "TWR",
      runwayOccupancy: true,
      occupancyRunway: ac.occupancyRunway || env.runway.name,
      mode: "ROLLOUT",
    };
  }
  if (ac.mode === "ALT_ROLLOUT") {
    const nextSpeed = Math.max(0, (ac.speed || 80) - Math.max(4.0, perfFor(ac.type).decel * 1.5));
    const ticks = (ac.rolloutTicks || 0) + 1;
    const fullyStopped = ticks > 55 || nextSpeed <= 12;
    const v = hdgVector(ac.heading || ac.assignedHeading || 120);
    const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
    return { ...ac, touchdown: !fullyStopped, runwayOccupancy: !fullyStopped, angularRate: 0, speed: fullyStopped ? 0 : nextSpeed, altitude: 0, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, mode: fullyStopped ? "VACATED" : "ALT_ROLLOUT", handedOff: fullyStopped, landed: fullyStopped, rolloutTicks: ticks, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  if (ac.mode === "RJCJ_ROLLOUT") {
    const rw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ || AIRPORT_RUNWAYS.RJCJ[0];
    const v = hdgVector(rw.course);
    const nextSpeed = Math.max(16, (ac.speed || 90) - Math.max(4.2, perfFor(ac.type).decel * 1.5));
    const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
    const ticks = (ac.rolloutTicks || 0) + 1;
    const fullyStopped = ticks > 70 || nextSpeed <= 20;
    return { ...ac, touchdown: !fullyStopped, runwayOccupancy: !fullyStopped, angularRate: 0, speed: fullyStopped ? 0 : nextSpeed, altitude: 0, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, assignedSpeed: 0, assignedAltitude: 0, contact: "RJCJ", mode: fullyStopped ? "RJCJ_PARKED" : "RJCJ_ROLLOUT", handedOff: fullyStopped, landed: fullyStopped, rolloutTicks: ticks, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  const rw = RUNWAYS[ac.occupancyRunway || env.runway.name] || env.runway;
  const v = hdgVector(rw.course);
  const nextSpeed = Math.max(18, (ac.speed || 90) - Math.max(3.5, perfFor(ac.type).decel * 1.4));
  const distNm = (nextSpeed * SIM_STEP_SECONDS) / 3600;
  const ticks = (ac.rolloutTicks || 0) + 1;
  const slowEnoughToVacate = nextSpeed <= 60;
  const fullyStopped = ticks > 60 || nextSpeed <= 22;
  return { ...ac, touchdown: false, angularRate: 0, category: "ARR", sid: null, depState: null, missed: false, clearedILS: false, towerControlled: !fullyStopped, contact: fullyStopped ? null : "TWR", landingClearance: false, runwayOccupancy: !slowEnoughToVacate, occupancyRunway: slowEnoughToVacate ? null : rw.name, altitude: 0, assignedAltitude: 0, speed: fullyStopped ? 0 : nextSpeed, assignedSpeed: 0, heading: rw.course, assignedHeading: rw.course, x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM, rolloutTicks: ticks, mode: fullyStopped ? "VACATED" : "ROLLOUT", handedOff: fullyStopped, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
function stepFuelOutMotion(ac, env) {
  const v = hdgVector(ac.heading), deadstickSpeed = Math.max(0, ac.speed - 5), deadstickAlt = Math.max(0, ac.altitude - 120), distanceNm = (deadstickSpeed * SIM_STEP_SECONDS) / 3600, stopped = deadstickAlt <= 0 || deadstickSpeed <= 20;
  return { ...ac, fuelMinutes: 0, angularRate: 0, mode: stopped ? "FUEL_EXHAUSTED" : "DEADSTICK", speed: stopped ? 0 : deadstickSpeed, altitude: stopped ? 0 : deadstickAlt, x: stopped ? ac.x : ac.x + v.x * distanceNm * PX_PER_NM, y: stopped ? ac.y : ac.y + v.y * distanceNm * PX_PER_NM, assignedSpeed: 0, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
function aircraftStep(ac, env) {
  return aircraftCoreStep(ac, env);
}
function aircraftCoreStep(ac, env) {
  if (ac.landed || ac.handedOff) return ac;
  if (isFoxhound(ac)) return stepFoxhoundIntruder(ac, env);
  if (isRolloutMode(ac)) return stepRolloutAircraft(ac, env, stepRolloutMotion);
  if (isFuelOutMode(ac)) return stepFuelOutAircraft(ac, env, stepFuelOutMotion);
  if (isAlternateMode(ac.mode)) return stepAlternateAircraft(ac, env);
  if (ac.category === "MIL") return stepMilitaryAircraft(ac, env);
  if (ac.category === "DEP") return stepDepartureAircraft(ac, env);
  return stepArrivalAircraft(ac, env);
}
function stepFoxhoundIntruder(ac, env) {
  const area = ac.adizArea || foxhoundAdizArea();
  const targetHeading = ac.mode === "FOXHOUND_EGRESS" ? 315 : ac.mode === "FOXHOUND_FORMATION" ? (ac.assignedHeading ?? ac.heading) : headingToPoint(ac.x, ac.y, { x: area.x, y: area.y });
  const targetSpeed = ac.mode === "FOXHOUND_EGRESS" ? 620 : ac.mode === "FOXHOUND_FORMATION" ? (ac.assignedSpeed ?? ac.speed ?? 520) : 520;
  const targetAltitude = 31000;
  const maxSpd = Math.max(900, ac.maxSpeedOverride || 0);
  const hdg = normHeading(ac.heading + clamp(shortestTurn(ac.heading, targetHeading), -2.2, 2.2));
  const spd = ac.speed + clamp(targetSpeed - ac.speed, -8, 8);
  const alt = Math.max(0, ac.altitude + clamp(targetAltitude - ac.altitude, -450, 450));
  const v = hdgVector(hdg);
  const distNm = (spd * SIM_STEP_SECONDS) / 3600;
  const afterMove = { x: ac.x + v.x * distNm * PX_PER_NM, y: ac.y + v.y * distNm * PX_PER_NM };
  return { ...ac, heading: hdg, angularRate: shortestTurn(ac.heading, hdg) / SIM_STEP_SECONDS, speed: clamp(spd, 220, maxSpd), altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, adizArea: area, color: ac.mode === "FOXHOUND_EGRESS" ? "#f97316" : "#ef4444", trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}
function stepAlternateAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "ALTERNATE");
}
function stepMilitaryAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "MILITARY");
}
function stepDepartureAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "DEPARTURE");
}
function stepArrivalAircraft(ac, env) {
  return aircraftMotionStep(ac, env, "ARRIVAL");
}
function resolveMilitaryTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed) {
  const rjcj = wp(env.nav, "RJCJ");
  const rjcjRw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ;
  if (shouldMilitaryRTB(ac, env)) {
    const rtb = militaryRtbPatch(ac, env);
    mode = rtb.mode;
    targetHeading = rtb.assignedHeading;
    targetAltitude = rtb.assignedAltitude;
    targetSpeed = rtb.assignedSpeed;
    ac = { ...ac, ...rtb };
  }
  if (mode === "RJCJ_DEP") {
    const area = getAircraftMissionArea(ac);
    const adizArea = ac.missionKind === "INTERCEPT" ? foxhoundAdizArea() : null;
    const mp = ac.missionKind === "INTERCEPT" ? { x: adizArea.x, y: adizArea.y } : missionAreaPoint(area);
    const depRw = (AIRPORT_RUNWAYS.RJCJ || []).find((r) => r.name === ac.rjcjRunway) || env.airports.RJCJ;
    const westGate = rjcjDepartureGate(env, depRw.name, ac.type);
    const distGate = Math.hypot(ac.x - westGate.x, ac.y - westGate.y) / PX_PER_NM;
    const distMission = Math.hypot(ac.x - mp.x, ac.y - mp.y) / PX_PER_NM;
    const scrambleIntercept = ac.missionKind === "INTERCEPT" && ac.type === "F-15J" && ac.maxSpeedOverride >= 700;
    if (scrambleIntercept) {
      const rotate = 150;
      if (!ac.rjcjAirborne) {
        targetHeading = depRw.course;
        targetSpeed = ac.speed < rotate ? 290 : 430;
        targetAltitude = ac.speed >= rotate ? 8000 : 0;
        if (ac.speed >= rotate && ac.altitude > 60) ac = { ...ac, rjcjAirborne: true, rjcjWestGatePassed: true, takeoffClearance: false, towerControlled: false, contact: "RJCJ" };
      } else {
        ac = { ...ac, rjcjWestGatePassed: true, contact: "RJCJ" };
        const interceptPoint = ac.interceptTargetX !== undefined && ac.interceptTargetY !== undefined ? { x: ac.interceptTargetX, y: ac.interceptTargetY } : mp;
        const joinProfile = ["REJOIN", "JOIN_STERN", "VISUAL_ID", "FORMATION"].includes(ac.interceptPhase);
        targetHeading = ac.interceptJoinHeading ?? headingToPoint(ac.x, ac.y, interceptPoint);
        targetAltitude = joinProfile ? clamp(ac.assignedAltitude || 31000, 20000, 38000) : clamp(ac.assignedAltitude || 32000, 24000, 38000);
        targetSpeed = joinProfile ? clamp(ac.assignedSpeed || 600, 500, ac.maxSpeedOverride || 880) : ac.altitude < 10000 ? 470 : (ac.maxSpeedOverride || 850);
      }
    } else if (!ac.rjcjAirborne) {
      targetHeading = depRw.course;
      const rotate = Math.max(145, approachSpeedFor(ac) + 15);
      targetSpeed = ac.speed < rotate ? rotate + 12 : Math.max(165, cleanSpeedFor(ac));
      targetAltitude = ac.speed >= rotate ? Math.max(1200, ac.assignedAltitude || 1200) : 0;
      if (ac.speed >= rotate && ac.altitude > 40) ac = { ...ac, rjcjAirborne: true };
    } else if (!ac.rjcjWestGatePassed && distGate > 1.3) {
      targetHeading = headingToPoint(ac.x, ac.y, westGate);
      targetAltitude = Math.min(4000, clamp(ac.assignedAltitude, area.minAlt, area.maxAlt));
      targetSpeed = Math.min(ac.assignedSpeed, ac.type === "F-15J" ? 260 : 190);
    } else {
      ac = { ...ac, rjcjWestGatePassed: true };
      targetHeading = headingToPoint(ac.x, ac.y, mp);
      targetAltitude = clamp(ac.assignedAltitude, area.minAlt, area.maxAlt);
      targetSpeed = ac.assignedSpeed;
    }
    if (!scrambleIntercept && distMission < area.radiusNm * 0.8) mode = "RJCJ_MISSION";
  } else if (mode === "ADIZ_ESCORT") {
    const area = ac.adizArea || foxhoundAdizArea();
    const exit = bearingToXY(315, 78);
    targetHeading = headingToPoint(ac.x, ac.y, exit);
    targetAltitude = 31000;
    targetSpeed = 580;
    ac = { ...ac, contact: "RJCJ", assignedAltitude: 31000, assignedSpeed: 620 };
    if (adizEscortComplete(ac)) {
      const rtb = foxhoundEscortPatch(ac, env);
      mode = rtb.mode;
      targetHeading = rtb.assignedHeading;
      targetAltitude = rtb.assignedAltitude;
      targetSpeed = rtb.assignedSpeed;
      ac = { ...ac, ...rtb };
    }
  } else if (mode === "RJCJ_MISSION") {
    const area = getAircraftMissionArea(ac);
    const mp = missionAreaPoint(area);
    const dxNm = (ac.x - mp.x) / PX_PER_NM;
    const dyNm = (ac.y - mp.y) / PX_PER_NM;
    const angle = Math.atan2(dyNm, dxNm);
    const radiusNm = Math.hypot(dxNm, dyNm);
    const orbitRadius = area.radiusNm * (isRotor(ac) ? 0.45 : 0.62);
    const step = isRotor(ac) ? 0.48 : 0.62;
    const target = { x: mp.x + Math.cos(angle + step) * orbitRadius * PX_PER_NM, y: mp.y + Math.sin(angle + step) * orbitRadius * PX_PER_NM };
    targetHeading = radiusNm > area.radiusNm ? headingToPoint(ac.x, ac.y, mp) : headingToPoint(ac.x, ac.y, target);
    targetAltitude = clamp(ac.assignedAltitude, area.minAlt, area.maxAlt);
    targetSpeed = isRotor(ac) ? 85 : ac.type === "F-15J" ? 320 : 190;
    ac = { ...ac, missionTicks: (ac.missionTicks || 0) + 1 };
    if ((ac.missionTicks || 0) > (isRotor(ac) ? 720 : 900) && Math.random() < 0.003) mode = isRotor(ac) ? "RJCJ_HELO_RECOVERY" : "RJCJ_RECOVERY";
  } else if (mode === "RJCJ_WX_AVOID") {
    targetHeading = ac.wxResumeHeading ?? ac.assignedHeading;
    targetAltitude = ac.wxResumeAltitude ?? ac.assignedAltitude;
    targetSpeed = ac.wxResumeSpeed ?? ac.assignedSpeed;
    mode = ac.wxResumeMode || "RJCJ_DEP";
  } else if (mode === "RJCJ_RTB" || mode === "RJCJ_RECOVERY") {
    const finalFix = runwayPointAt(rjcj, rjcjRw.course, 11);
    const distFinal = Math.hypot(ac.x - finalFix.x, ac.y - finalFix.y) / PX_PER_NM;
    targetHeading = headingToPoint(ac.x, ac.y, finalFix);
    targetAltitude = 3500;
    targetSpeed = ac.type === "F-15J" ? 240 : cleanSpeedFor(ac);
    if (distFinal < 2.0) mode = "RJCJ_ILS";
  } else if (mode === "RJCJ_ILS") {
    const geo = finalGeometryAt(rjcj, rjcjRw.course, ac.x, ac.y);
    targetHeading = Math.abs(geo.crossPx) < 18 ? rjcjRw.course : headingToPoint(ac.x, ac.y, runwayPointAt(rjcj, rjcjRw.course, clamp(geo.alongNm - 2, 0, 10)));
    targetAltitude = clamp(geo.alongNm * 350, 0, 3000);
    targetSpeed = approachSpeedFor(ac);
    if (geo.alongNm < 0.35 && geo.alongNm > -1.2 && ac.altitude < 450 && Math.abs(geo.crossPx) < 70) {
      const touchdown = runwayPointAt(rjcj, rjcjRw.course, clamp(geo.alongNm, -0.08, 0.08));
      return { ac, mode, targetHeading, targetAltitude, targetSpeed, landed, directReturn: rjcjRolloutPatch(ac, env, Math.max(0, (ac.fuelMinutes ?? 60) - (estimateBurnRate(ac, 0, 25) * SIM_STEP_SECONDS) / 60), estimateBurnRate(ac, 0, 25), ac.emergency, ac.speed, touchdown, { x: ac.x, y: ac.y }, rjcjRw.name) };
    }
  } else if (mode === "RJCJ_VECTOR") {
    targetHeading = ac.assignedHeading;
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
  } else {
    targetHeading = ac.assignedHeading;
    targetAltitude = ac.assignedAltitude;
    targetSpeed = ac.assignedSpeed;
    if (xyToBearingRange(ac.x, ac.y).rangeNm > 80) mode = "RJCJ_OUTSIDE";
  }
  return { ac, mode, targetHeading, targetAltitude, targetSpeed, landed, directReturn: null };
}
function resolveArrivalTargetState(ac, env, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, navForAc) {
  const appRw = approachRunwayForAircraft(ac, env);
  if (isFinalMode(mode)) {
    const state = finalLandingState(ac, env, 36, 220);
    const finalRw = state.runway || appRw;
    targetHeading = finalRw.course;
    targetSpeed = Math.max(approachSpeedFor(ac) + 20, 150);
    targetAltitude = clamp(state.geo.alongNm * 320, 0, 3000);
    if (ac.landingClearance && state.geo.alongNm < 1.25 && state.geo.alongNm > -3.0 && Math.abs(state.geo.crossPx) < 160 && ac.altitude < 1800) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: finalRw.name, approachRunway: finalRw.name, routeRunway: finalRw.name };
    } else if ((state.atThreshold || state.overrun) && !ac.landingClearance) {
      const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
      missed = true;
      clearedILS = false;
      mode = "MISSED";
      targetHeading = missedRw.course;
      targetAltitude = 3000;
      targetSpeed = 180;
      ac = { ...ac, routeRunway: missedRw.name, approachRunway: missedRw.name };
    } else if (ac.landingClearance && state.geo.alongNm < -2.2 && ac.altitude < 900) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: finalRw.name, approachRunway: finalRw.name, routeRunway: finalRw.name };
    } else mode = finalModeFor(ac);
  } else if (mode === "HOLD" && ac.hold) {
    const fixId = ac.hold.fixId || "HOLD_SW";
    const pattern = holdPatternPoints(navForAc, fixId, ac.hold.navRunway || ac.routeRunway || env.runway.name);
    const leg = clamp(ac.hold.legIndex || 0, 0, Math.max(0, pattern.length - 1));
    const target = pattern[leg] || wp(navForAc, fixId) || wp(navForAc, "HOLD_SW");
    const distNm = target ? Math.hypot(ac.x - target.x, ac.y - target.y) / PX_PER_NM : 99;
    let nextLeg = leg;
    if (target && distNm < 0.75) nextLeg = leg >= pattern.length - 2 ? 0 : leg + 1;
    ac = { ...ac, hold: { ...ac.hold, legIndex: nextLeg } };
    const nextTarget = pattern[nextLeg] || target;
    targetHeading = nextTarget ? headingToPoint(ac.x, ac.y, nextTarget) : targetHeading;
    targetAltitude = ac.hold.altitude;
    targetSpeed = 190;
  } else if (mode === "ROUTE" && ac.route.length) {
    const fix = wp(navForAc, ac.route[routeIndex]);
    if (fix) {
      const distNm = Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM;
      const remaining = ac.route.length - routeIndex;
      const vnavAlt = vnavTargetAltitude(ac, env, routeIndex);
      const high = ac.altitude - vnavAlt > 900;
      const low = ac.altitude - vnavAlt < -900;
      targetHeading = headingToPoint(ac.x, ac.y, fix);
      targetSpeed = remaining <= 2 ? (high ? 160 : 170) : high ? 190 : low ? 210 : 200;
      targetAltitude = vnavAlt;
      if (fix.id?.startsWith("BASE_") && distNm < 2.8 && ac.route?.[routeIndex + 1]) {
        const nextFix = wp(navForAc, ac.route[routeIndex + 1]);
        if (nextFix) {
          routeIndex += 1;
          targetHeading = headingToPoint(ac.x, ac.y, nextFix);
          targetAltitude = vnavTargetAltitude(ac, env, routeIndex);
          targetSpeed = 180;
        }
      }
      if (distNm < 1.2) {
        if (routeIndex < ac.route.length - 1) routeIndex += 1;
        else {
          mode = finalModeFor(ac);
          targetHeading = approachRunwayForAircraft(ac, env).course;
          targetSpeed = 160;
          targetAltitude = vnavTargetAltitude(ac, env, routeIndex);
          ac = { ...ac, approachRunway: ac.approachRunway || ac.routeRunway || env.runway.name };
        }
      }
    }
  }
  const ilsGuidance = resolveIlsGuidanceState(ac, env, mode, clearedILS);
  if (ilsGuidance) {
    targetHeading = ilsGuidance.targetHeading;
    targetSpeed = ilsGuidance.targetSpeed;
    targetAltitude = ilsGuidance.targetAltitude;
    mode = ilsGuidance.mode;
    if (ilsGuidance.land) {
      landed = true;
      ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: ilsGuidance.ilsRw.name, approachRunway: ilsGuidance.ilsRw.name, routeRunway: ilsGuidance.ilsRw.name };
    } else if (ilsGuidance.missed) {
      missed = true;
      clearedILS = false;
      mode = "MISSED";
      targetHeading = ilsGuidance.missedPatch.assignedHeading;
      targetAltitude = ilsGuidance.missedPatch.assignedAltitude;
      targetSpeed = ilsGuidance.missedPatch.assignedSpeed;
      ac = { ...ac, routeRunway: ilsGuidance.missedPatch.routeRunway, approachRunway: ilsGuidance.missedPatch.approachRunway };
    }
  }
  return { ac, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg };
}
function resolveVisualTargetState(ac, env, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, appRw) {
  const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const patternEnv = appRw.name === env.runway.name ? env : { ...env, runway: appRw, nav: makeNavCached(appRw.name), routes: makeRoutes(appRw.name), sids: makeSids(appRw.name) };
  const pattern = visualPatternPoints(patternEnv);
  const leg = clamp(patternLeg || 0, 0, pattern.length - 1);
  const fix = pattern[leg];
  if (leg < pattern.length - 1) {
    const distNm = Math.hypot(ac.x - fix.x, ac.y - fix.y) / PX_PER_NM;
    targetHeading = headingToPoint(ac.x, ac.y, fix);
    targetAltitude = fix.alt;
    targetSpeed = Math.max(approachSpeedFor(ac) + fix.speedAdd, 145);
    mode = inTowerAirspace(ac, env) ? "TWR_PATTERN" : "VISUAL_APP";
    if (distNm < 1.0) {
      const nextLeg = Math.min(leg + 1, pattern.length - 1);
      patternLeg = nextLeg;
      if (fix.id === "DOWNWIND") ac = { ...ac, patternReport: "DOWNWIND" };
      if (inTowerAirspace(ac, env)) ac = { ...ac, towerControlled: true, contact: "TWR", towerPending: false };
    }
  } else {
    const finalFix = pattern[pattern.length - 1];
    const distFinal = Math.hypot(ac.x - finalFix.x, ac.y - finalFix.y) / PX_PER_NM;
    if (distFinal > 0.8 && geo.alongNm > 3.8) {
      targetHeading = headingToPoint(ac.x, ac.y, finalFix);
      targetAltitude = finalFix.alt;
      targetSpeed = Math.max(approachSpeedFor(ac) + 25, 145);
      mode = "TWR_PATTERN";
    } else {
      mode = "VISUAL_APP";
      const aim = runwayPointForAircraft(ac, env, clamp(geo.alongNm - 1.4, 0, 10));
      targetHeading = Math.abs(geo.crossPx) < 10 ? appRw.course : headingToPoint(ac.x, ac.y, aim);
      targetAltitude = clamp(geo.alongNm * 300, 0, 2500);
      targetSpeed = geo.alongNm < 3 ? approachSpeedFor(ac) : Math.max(approachSpeedFor(ac) + 20, 145);
    }
  }
  const state = finalLandingState(ac, env, 60, 320);
  const unstable = state.geo.alongNm < 2.2 && (Math.abs(state.geo.crossPx) > 85 || ac.speed > approachSpeedFor(ac) + 70 || Math.abs(ac.altitude - Math.max(0, state.geo.alongNm * 300)) > 1100);
  if (ac.landingClearance && patternLeg >= 5 && Math.abs(shortestTurn(ac.heading, appRw.course)) < 85 && state.geo.alongNm < 1.35 && state.geo.alongNm > -3.0 && Math.abs(state.geo.crossPx) < 170 && ac.altitude < 1900) {
    landed = true;
    ac = { ...ac, runwayOccupancy: true, towerControlled: true, occupancyRunway: appRw.name, approachRunway: appRw.name, routeRunway: appRw.name };
  } else if (!ac.landingClearance && (state.overrun || unstable) && ac.altitude < 700) {
    const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
    missed = true;
    clearedILS = false;
    mode = "MISSED";
    targetHeading = missedRw.course;
    targetAltitude = 3000;
    targetSpeed = 180;
    ac = { ...ac, routeRunway: missedRw.name, approachRunway: missedRw.name };
  }
  return { ac, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg };
}
function aircraftMotionStep(ac, env, stepKind = "ARRIVAL") {
  if (ac.landed || ac.handedOff) return ac;
  if (isRolloutMode(ac)) return stepRolloutMotion(ac, env);
  if (isFuelOutMode(ac)) return stepFuelOutMotion(ac, env);
  let targetHeading = ac.assignedHeading, targetSpeed = ac.assignedSpeed, targetAltitude = ac.assignedAltitude, mode = ac.mode, routeIndex = ac.routeIndex, clearedILS = ac.clearedILS, landed = false, missed = ac.missed, patternLeg = ac.patternLeg || 0;
  let alternateLanding = null;
  const navForAc = ac.routeRunway ? makeNavCached(ac.routeRunway) : env.nav;
  const routesForAc = ac.routeRunway ? makeRoutes(ac.routeRunway) : env.routes;

  const appRw = approachRunwayForAircraft(ac, env);
  const earlyGeo = finalGeometryForAircraft(ac, env, ac.x, ac.y);
  const closedRunwayApproachMissed = ac.category === "ARR" && !ac.touchdown && env.closedRunways?.includes(appRw.name) && !["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) && !isAlternateMode(mode) && (ac.clearedILS || isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || ac.approachRunway === appRw.name || ac.routeRunway === appRw.name);
  const forcedRunwayChangeMissed = ac.category === "ARR" && !ac.touchdown && !["MISSED", "MISSED_APP", "MISSED_TRANSFER_APP", "ROLLOUT", "VACATED"].includes(mode) && !isAlternateMode(mode) && (ac.clearedILS || isFinalMode(mode) || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN") && runwayPairName(appRw.name) !== runwayPairName(env.runway.name);
  if (closedRunwayApproachMissed || forcedRunwayChangeMissed) {
    return { ...ac, touchdown: false, runwayOccupancy: false, occupancyRunway: null, category: "DEP", destination: "RJCC", sid: null, depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, routeRunway: appRw.name, approachRunway: appRw.name, clearedILS: false, landingClearance: false, towerControlled: false, contact: "DEP", missed: true, assignedHeading: appRw.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43", missedTicks: 0 };
  }
  const vappMode = mode === "VISUAL_APP" || mode === "TWR_PATTERN";
  const ilsCapture = resolveIlsCaptureState(ac, env, mode, clearedILS, routeIndex);
  if (ilsCapture.action === "MISSED") return { ...ac, ...ilsCapture.patch };
  ac = ilsCapture.ac;
  mode = ilsCapture.mode;
  clearedILS = ilsCapture.clearedILS;
  const visualFinalReady = !vappMode || (patternLeg >= 5 && Math.abs(shortestTurn(ac.heading, appRw.course)) < 85);
  const earlyTouchdownAllowed =
    ac.category === "ARR" &&
    ac.landingClearance &&
    visualFinalReady &&
    (ac.clearedILS || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || isFinalMode(mode) || mode === "MISSED") &&
    earlyGeo.alongNm <= 1.25 &&
    earlyGeo.alongNm > -3.0 &&
    Math.abs(earlyGeo.crossPx) < 160 &&
    ac.altitude < 1800 &&
    ac.speed < approachSpeedFor(ac) + 190;
  if (earlyTouchdownAllowed) {
    const p = runwayPointForAircraft(ac, env, clamp(earlyGeo.alongNm, -0.15, 0.15));
    const br = estimateBurnRate(ac, 0, 25);
    return rolloutPatch(ac, env, Math.max(0, (ac.fuelMinutes ?? 60) - br / 60), br, ac.emergency, ac.speed, p, { x: ac.x, y: ac.y }, appRw.name);
  }

  if (shouldAutoMissed(ac, env) || wrongRunwayTailwindMiss(ac, env)) {
    const missedRunway = ac.approachRunway || ac.routeRunway || env.runway.name;
    const missedRw = RUNWAYS[missedRunway] || env.runway;
    return { ...ac, touchdown: false, runwayOccupancy: false, occupancyRunway: null, fuelMinutes: Math.max(0, (ac.fuelMinutes ?? 60) - (estimateBurnRate(ac, 3000, 180) * SIM_STEP_SECONDS) / 60), burnRate: estimateBurnRate(ac, 3000, 180), category: "DEP", destination: "RJCC", sid: null, depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, routeRunway: missedRw.name, approachRunway: missedRw.name, clearedILS: false, landingClearance: false, towerControlled: false, contact: "DEP", missed: true, assignedHeading: missedRw.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43", missedTicks: 0 };
  }

  if (mode === "VISUAL_APP" || mode === "TWR_PATTERN") {
    const visualState = resolveVisualTargetState(ac, env, mode, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, appRw);
    ac = visualState.ac;
    mode = visualState.mode;
    clearedILS = visualState.clearedILS;
    targetHeading = visualState.targetHeading;
    targetAltitude = visualState.targetAltitude;
    targetSpeed = visualState.targetSpeed;
    landed = visualState.landed;
    missed = visualState.missed;
    patternLeg = visualState.patternLeg;
  } else if (mode === "LINEUP_WAIT" || mode === "TAKEOFF_ROLL" || mode === "INITIAL_CLIMB") {
    const depGroundState = resolveDepartureGroundTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed);
    ac = depGroundState.ac;
    mode = depGroundState.mode;
    targetHeading = depGroundState.targetHeading;
    targetAltitude = depGroundState.targetAltitude;
    targetSpeed = depGroundState.targetSpeed;
  } else if (isRotor(ac) && (mode === "RJCJ_HELO_DEP" || mode === "RJCJ_HELO_RECOVERY" || mode === "RJCJ_HELO_VECTOR")) {
    const rotorState = resolveRotorTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed);
    ac = rotorState.ac;
    mode = rotorState.mode;
    targetHeading = rotorState.targetHeading;
    targetAltitude = rotorState.targetAltitude;
    targetSpeed = rotorState.targetSpeed;
    landed = rotorState.landed;
  } else if (mode === "DIRECT_FIX" && ac.route.length) {
    const directState = resolveDirectFixTargetState(ac, navForAc, mode, targetHeading, targetAltitude, targetSpeed);
    ac = directState.ac;
    mode = directState.mode;
    targetHeading = directState.targetHeading;
    targetAltitude = directState.targetAltitude;
    targetSpeed = directState.targetSpeed;
  } else if (["DIVERT", "ALT_HANDOFF"].includes(ac.mode)) {
    const altState = resolveAlternateTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, alternateDivertStep);
    ac = altState.ac;
    mode = altState.mode;
    targetHeading = altState.targetHeading;
    targetAltitude = altState.targetAltitude;
    targetSpeed = altState.targetSpeed;
  } else if (stepKind === "MILITARY") {
    const milState = resolveMilitaryTargetState(ac, env, mode, targetHeading, targetAltitude, targetSpeed, landed);
    if (milState.directReturn) return milState.directReturn;
    ac = milState.ac;
    mode = milState.mode;
    targetHeading = milState.targetHeading;
    targetAltitude = milState.targetAltitude;
    targetSpeed = milState.targetSpeed;
    landed = milState.landed;
  } else if (stepKind === "DEPARTURE") {
    const depState = resolveDepartureTargetState(ac, env, mode, routeIndex, targetHeading, targetAltitude, targetSpeed, {
      depExitReady,
      makeNavCached,
      missedApproachReturnPatch,
      missedApproachSafeToReturn,
    });
    ac = depState.ac;
    mode = depState.mode;
    routeIndex = depState.routeIndex;
    targetHeading = depState.targetHeading;
    targetAltitude = depState.targetAltitude;
    targetSpeed = depState.targetSpeed;
  } else if (stepKind === "ARRIVAL" || stepKind === "ALTERNATE") {
    const arrState = resolveArrivalTargetState(ac, env, mode, routeIndex, clearedILS, targetHeading, targetAltitude, targetSpeed, landed, missed, patternLeg, navForAc);
    ac = arrState.ac;
    mode = arrState.mode;
    routeIndex = arrState.routeIndex;
    clearedILS = arrState.clearedILS;
    targetHeading = arrState.targetHeading;
    targetAltitude = arrState.targetAltitude;
    targetSpeed = arrState.targetSpeed;
    landed = arrState.landed;
    missed = arrState.missed;
    patternLeg = arrState.patternLeg;
  }

  const missionConflict = nearestMissionAreaAhead(ac, targetHeading);
  if (missionConflict) {
    targetHeading = normHeading(targetHeading + (missionConflict.side >= 0 ? -28 : 28));
    if (ac.category === "ARR" && !isApproachMode(mode)) mode = "VECTOR";
  }
  if (ac.speedRestriction !== null && ac.speedRestriction !== undefined) targetSpeed = Math.min(targetSpeed, ac.speedRestriction);
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT") targetSpeed = 0;
  else if (mode === "TAKEOFF_ROLL") targetSpeed = clamp(targetSpeed, 0, speedLimitForAircraft(ac, Math.min(ac.altitude, targetAltitude)));
  else if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) targetSpeed = clamp(targetSpeed, 0, ac.maxSpeedOverride);
  else targetSpeed = clamp(targetSpeed, 90, speedLimitForAircraft(ac, Math.min(ac.altitude, targetAltitude)));
  if (ac.category === "MIL" && env.weatherOn && !isRotor(ac)) {
    const wx = nearestRedWeatherAhead(ac, targetHeading, env.weatherCells);
    if (wx) {
      const resumeMode = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeMode || "RJCJ_DEP") : mode;
      const resumeHeading = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeHeading ?? targetHeading) : targetHeading;
      const resumeAltitude = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeAltitude ?? targetAltitude) : targetAltitude;
      const resumeSpeed = mode === "RJCJ_WX_AVOID" ? (ac.wxResumeSpeed ?? targetSpeed) : targetSpeed;
      const avoidTurn = wx.side >= 0 ? -62 : 62;
      const hardTurn = wx.d < Math.max(wx.cell.wid || 20, 18) ? 82 : 62;
      targetHeading = normHeading(resumeHeading + (wx.side >= 0 ? -hardTurn : hardTurn));
      targetAltitude = resumeAltitude;
      targetSpeed = resumeSpeed;
      if (mode !== "RJCJ_RECOVERY" && mode !== "RJCJ_ILS") {
        mode = "RJCJ_WX_AVOID";
        ac = { ...ac, wxResumeMode: resumeMode, wxResumeHeading: resumeHeading, wxResumeAltitude: resumeAltitude, wxResumeSpeed: resumeSpeed, wxAvoidSide: avoidTurn };
      }
    } else if (mode === "RJCJ_WX_AVOID") {
      mode = ac.wxResumeMode || "RJCJ_DEP";
      targetHeading = ac.wxResumeHeading ?? targetHeading;
      targetAltitude = ac.wxResumeAltitude ?? targetAltitude;
      targetSpeed = ac.wxResumeSpeed ?? targetSpeed;
      ac = { ...ac, wxResumeMode: null, wxResumeHeading: null, wxResumeAltitude: null, wxResumeSpeed: null };
    }
  }
  const burnRate = estimateBurnRate(ac, targetAltitude, targetSpeed), nextFuelMinutes = Math.max(0, (ac.fuelMinutes ?? 60) - (burnRate * SIM_STEP_SECONDS) / 60);
  const perf = perfFor(ac.type);
  const altDelta = targetAltitude - ac.altitude;
  const scrambleProfile = ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700;
  const effectiveClimb = scrambleProfile ? (ac.altitude < 10000 ? 28000 : 42000) : perf.climb;
  const effectiveDescent = scrambleProfile ? Math.max(perf.descent, 18000) : perf.descent;
  const climbStep = altDelta >= 0 ? effectiveClimb : effectiveDescent;
  const secondsPerTick = SIM_STEP_SECONDS;
  const climbStepUp = (effectiveClimb / 60) * secondsPerTick;
  const climbStepDown = (effectiveDescent / 60) * secondsPerTick;
  const verticalStep = clamp(altDelta, -climbStepDown, climbStepUp);
  const climbRateFpm = (verticalStep / secondsPerTick) * 60;
  let accel = perf.accel, decel = perf.decel;
  if (climbRateFpm > 1000) accel *= 0.55;
  if (climbRateFpm > 2200) accel *= 0.32;
  if (scrambleProfile) {
    accel = Math.max(accel, ac.altitude < 10000 ? 26.0 : 36.0);
  }
  if (climbRateFpm < -1000) decel *= 0.58;
  if (climbRateFpm < -2200) decel *= 0.38;
  let hdg = normHeading(ac.heading + clamp(shortestTurn(ac.heading, targetHeading), -perf.turn, perf.turn)), spd = ac.speed + clamp(targetSpeed - ac.speed, -decel, accel), alt = Math.max(0, ac.altitude + verticalStep);
  if (ac.category !== "MIL" && alt < 10000 && spd > 250) spd = Math.max(250, spd - Math.max(3, perf.decel));
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT") spd = 0;
  else if (mode === "TAKEOFF_ROLL") spd = clamp(spd, 0, speedLimitForAircraft(ac, alt));
  else if (ac.category === "MIL" && ac.type === "F-15J" && ac.missionKind === "INTERCEPT" && ac.maxSpeedOverride >= 700) spd = clamp(spd, 0, ac.maxSpeedOverride);
  else spd = clamp(spd, perf.min, speedLimitForAircraft(ac, alt));
  const air = hdgVector(hdg), wv = windVector(env.wind), distanceAirNm = (spd * SIM_STEP_SECONDS) / 3600, distanceWindNm = (env.wind.speed * SIM_STEP_SECONDS) / 3600;
  let dx = (air.x * distanceAirNm + wv.x * distanceWindNm) * PX_PER_NM, dy = (air.y * distanceAirNm + wv.y * distanceWindNm) * PX_PER_NM;
  if (mode === "TAKEOFF_ROLL" && alt < 50) { dx = air.x * distanceAirNm * PX_PER_NM; dy = air.y * distanceAirNm * PX_PER_NM; }
  if (mode === "DEP_READY" || mode === "LINEUP_WAIT" || (ac.altitude <= 0 && spd <= 1 && !ac.takeoffClearance)) { dx = 0; dy = 0; }
  const beforeMove = { x: ac.x, y: ac.y };
  let afterMove = { x: ac.x + dx, y: ac.y + dy };
  let emergency = ac.emergency;
  if (env.weatherOn && ac.category === "ARR" && !isGroundTraffic(ac) && ac.altitude >= 500 && !["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "INITIAL_CLIMB", "DEP_RADAR_CONTACT", "SID", "ACC_READY", "ROLLOUT", "VACATED"].includes(mode) && intersectsRedWeather(beforeMove, afterMove, env.weatherCells, ac)) {
    const chance = ac.altitude < 6000 ? 0.1 : 0.055;
    if (!emergency && Math.random() < chance) emergency = ac.altitude < 6000 ? "MAYDAY" : "PANPAN";
    ac = { ...ac, wxExposure: (ac.wxExposure || 0) + 1 };
    if (emergency) {
      mode = emergency;
      clearedILS = false;
      targetAltitude = Math.max(3000, ac.altitude);
      targetSpeed = Math.min(ac.speed, 190);
    }
  }
  if (clearedILS) { const ilsRw = approachRunwayForAircraft(ac, env); const geo = finalGeometryForAircraft(ac, env, ac.x, ac.y), right = { x: -hdgVector(ilsRw.course).y, y: hdgVector(ilsRw.course).x }, correction = clamp(-geo.crossPx * 0.018, -0.55, 0.55); dx += right.x * correction; dy += right.y * correction; afterMove = { x: ac.x + dx, y: ac.y + dy }; }
  const protectedRollout = ac.touchdown || ac.mode === "ROLLOUT" || ac.mode === "VACATED" || mode === "ROLLOUT" || mode === "VACATED";
  const missedRw = RUNWAYS[ac.approachRunway || ac.routeRunway || env.runway.name] || env.runway;
  const twrMissedToDep = mode === "MISSED" && ac.category === "ARR" && !ac.landingClearance && !protectedRollout;
  const appReturn = mode === "MISSED_TRANSFER_APP" || missedApproachSafeToReturn(ac, env);
  const appReturnPatch = appReturn ? missedApproachReturnPatch(ac, env, afterMove) : null;
  const emergencyTowerControlled = !!emergency && (ac.emergencyTowerAccepted || ac.towerControlled || ac.contact === "TWR");
  const exitState = resolveExitState(ac, { protectedRollout, emergency, emergencyTowerControlled, appReturn, twrMissedToDep, appReturnPatch, missedRw, mode, routeIndex, clearedILS, missed, patternLeg, targetHeading, targetSpeed, targetAltitude });
  const nextCategory = exitState.category;
  const nextRoute = exitState.route;
  const nextRouteIndex = exitState.routeIndex;
  const nextDepState = exitState.depState;
  const nextClearedILS = exitState.clearedILS;
  const nextMode = exitState.mode;
  const nextMissed = exitState.missed;
  const nextDestination = exitState.destination;
  const nextSid = exitState.sid;
  const nextColor = exitState.color;
  const nextRouteRunway = exitState.routeRunway;
  const nextApproachRunway = exitState.approachRunway;
  if (landed) { const landRw = approachRunwayForAircraft(ac, env); const landGeo = finalGeometryAt(runwayOrigin(landRw), landRw.course, afterMove.x, afterMove.y); return rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, runwayPointAt(runwayOrigin(landRw), landRw.course, clamp(landGeo.alongNm, -0.15, 0.15)), { x: ac.x, y: ac.y }, landRw.name); }
  if (isAlternateMode(mode)) {
    const st = alternateHandoffState(ac, env);
    if (mode === "ALT_HANDOFF" || st?.inside) {
      return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: st?.altAirport || ac.destination, alternate: st?.altAirport || ac.alternate, sid: null, depState: null, towerControlled: false, landingClearance: false, contact: "ALT_APP", heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, routeIndex: 0, route: [], routeRunway: null, approachRunway: null, patternLeg: 0, mode: "ALT_HANDOFF", clearedILS: false, missed: false, speedRestriction: null, color: "#22c55e", landed: true, handedOff: true, runwayOccupancy: false, occupancyRunway: null, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
    }
    return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, emergency, category: "ARR", destination: ac.destination, alternate: ac.alternate, sid: null, depState: null, towerControlled: false, landingClearance: false, contact: "APP", heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: targetHeading, assignedSpeed: targetSpeed, assignedAltitude: targetAltitude, routeIndex: 0, route: [], routeRunway: null, approachRunway: null, patternLeg, mode: "DIVERT", clearedILS: false, missed: false, speedRestriction: null, color: "#f59e0b", landed: false, runwayOccupancy: false, occupancyRunway: null, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
  }
  const touchRw = approachRunwayForAircraft(ac, env);
  const preTouchGeo = finalGeometryAt(runwayOrigin(touchRw), touchRw.course, ac.x, ac.y);
  const postTouchGeo = finalGeometryAt(runwayOrigin(touchRw), touchRw.course, afterMove.x, afterMove.y);
  const touchdownAllowed = ac.category === "ARR" && ac.landingClearance && (clearedILS || mode === "ILS" || mode === "VISUAL_APP" || mode === "TWR_PATTERN" || isFinalMode(mode));
  const crossedTouchdown = preTouchGeo.alongNm > 0.18 && postTouchGeo.alongNm <= 0.18 && postTouchGeo.alongNm > -1.15;
  const nearTouchdownZone = postTouchGeo.alongNm <= 0.25 && postTouchGeo.alongNm > -1.15;
  const touchdownStable = Math.abs(postTouchGeo.crossPx) < 120 && Math.abs(shortestTurn(hdg, touchRw.course)) < 80 && spd < approachSpeedFor(ac) + 130 && alt < 900;
  const overTouchdownArea = postTouchGeo.alongNm <= 0.45 && postTouchGeo.alongNm > -2.4;
  if (!landed && touchdownAllowed && (crossedTouchdown || nearTouchdownZone || overTouchdownArea) && touchdownStable) landed = true;
  const rolloutPoint = runwayPointAt(runwayOrigin(touchRw), touchRw.course, clamp(postTouchGeo.alongNm, -0.15, 0.15));
  if (landed) return rolloutPatch(ac, env, nextFuelMinutes, burnRate, emergency, spd, rolloutPoint, { x: ac.x, y: ac.y }, touchRw.name);
  const nextEmergencyTowerAccepted = emergencyTowerControlled || (!!emergency && !!ac.emergencyTowerAccepted);
  return { ...ac, touchdown: false, fuelMinutes: nextFuelMinutes, burnRate, angularRate: shortestTurn(ac.heading, hdg) / SIM_STEP_SECONDS, emergency, emergencyTowerAccepted: nextEmergencyTowerAccepted, category: nextCategory, destination: nextDestination, sid: nextSid, depState: nextDepState, towerControlled: exitState.towerControlled, landingClearance: exitState.landingClearance, contact: exitState.contact, heading: hdg, speed: spd, altitude: alt, x: afterMove.x, y: afterMove.y, assignedHeading: exitState.assignedHeading, assignedSpeed: exitState.assignedSpeed, assignedAltitude: exitState.assignedAltitude, routeIndex: nextRouteIndex, route: nextRoute, routeRunway: nextRouteRunway, approachRunway: nextApproachRunway, patternLeg: exitState.patternLeg, mode: nextMode, clearedILS: nextClearedILS, missed: nextMissed, missedTicks: exitState.missedTicks, speedRestriction: exitState.speedRestriction, color: nextColor, landed: false, runwayOccupancy: exitState.runwayOccupancy, occupancyRunway: exitState.occupancyRunway, trail: [...ac.trail.slice(-55), { x: ac.x, y: ac.y }] };
}

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
  const runwayRoleOf = (rw) => {
    if (closedRunways.includes(rw)) return "CLOSED";
    const arr = openArrRunways.includes(rw);
    const dep = openDepRunways.includes(rw);
    if (arr && dep) return "BOTH";
    if (arr) return "ARR";
    if (dep) return "DEP";
    return "STANDBY";
  };
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
    return makeInitialAircraft(initEnv, initDep).map(normalizeAircraftState);
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
  const radarDisplayTargets = useMemo(() => radarTargets.map((a) => {
    const ageSec = Math.max(0, (tick - (a.radarSweepTick ?? tick)) * SIM_STEP_SECONDS);
    const extrapSec = running ? clamp(ageSec, 0, RADAR_SWEEP_SECONDS) : 0;
    const extrapHeading = normHeading((a.heading || 0) + (a.angularRate || 0) * extrapSec);
    const v = hdgVector(extrapHeading);
    const distNm = ((a.speed || 0) * extrapSec) / 3600;
    return {
      ...a,
      radarAgeSec: ageSec,
      displayHeading: extrapHeading,
      displayX: a.x + v.x * distNm * PX_PER_NM,
      displayY: a.y + v.y * distNm * PX_PER_NM,
    };
  }), [radarTargets, tick, running]);
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

  function seatForAircraft(ac) {
    if (!ac) return "APP";
    if (ac.category === "MIL") return "RJCJ";
    if (ac.category === "DEP") {
      const airborneDep = ac.mode === "DEP_RADAR_CONTACT" || ac.mode === "SID" || ac.mode === "DEP_VECTOR" || ac.mode === "ACC_READY" || ac.depState === "RELEASED" || ac.depState === "UNRESTRICTED" || ac.depState === "SID_CLIMB" || ac.altitude >= 700;
      return airborneDep ? "DEP" : "TWR";
    }
    if (ac.towerControlled || ac.mode === "TWR_PATTERN" || ac.towerPending) return "TWR";
    return "APP";
  }
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
        moved = applyTowerAutomation(moved, env, towerAuto).map(normalizeAircraftState);
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
  }, [running, gameMode, scenarioId, scenarioEventsDone.foxhoundFailed, scenarioEventsDone.foxhoundSuccess, tick, aircraft, env]);

  useEffect(() => {
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
  }, [tick, running, gameMode]);

  useEffect(() => {
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
        const wakeAB = wakeAssessment(a, b, env);
        const wakeBA = wakeAssessment(b, a, env);
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
        const etaSec = planned?.etaSec ?? (planned ? planned.at / 2 + 1080 : nowSec + (ac ? estimateArrivalEtaSec(ac, env) : 1200));
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
          const ap = a.manualPosition ?? 999 + estimateArrivalEtaSec(a.ac, env) / 100000;
          const bp = b.manualPosition ?? 999 + estimateArrivalEtaSec(b.ac, env) / 100000;
          return ap - bp;
        }
        return estimateArrivalEtaSec(a.ac, env) - estimateArrivalEtaSec(b.ac, env);
      });
    return ordered.map((row, idx) => {
      const etaRel = estimateArrivalEtaSec(row.ac, env);
      const eta = row.etaSec ?? (simSeconds + etaRel);
      const predictedAt = simSeconds + etaRel;
      const autoRank = [...ordered].sort((a, b) => estimateArrivalEtaSec(a.ac, env) - estimateArrivalEtaSec(b.ac, env)).findIndex((r) => r.id === row.id);
      const prev = idx > 0 ? ordered[idx - 1].ac : null;
      const gap = prev ? sequenceGapAssessment(prev, row.ac, env) : null;
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
  function appReacquirePatch(extra = {}) { return selected.depState === "MISSED_APP" || selected.mode === "MISSED_APP" || selected.mode === "MISSED_TRANSFER_APP" ? { category: "ARR", destination: "RJCC", sid: null, depState: null, missed: false, clearedILS: false, ...extra } : extra; }
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
  function svgEventToRadarPoint(e) { const svg = svgRef.current; if (!svg) return null; const rect = svg.getBoundingClientRect(), parts = viewBox.split(" ").map(Number); return { x: parts[0] + ((e.clientX - rect.left) / rect.width) * parts[2], y: parts[1] + ((e.clientY - rect.top) / rect.height) * parts[3] }; }
  function handleRadarMove(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (p) setVectorPreview({ ...p, heading: headingToPoint(selected.x, selected.y, p) }); }
  function handleRadarClick(e) { if (!mouseVectorMode) return; const p = svgEventToRadarPoint(e); if (!p) return; applyVectorHeading(headingToPoint(selected.x, selected.y, p)); setMouseVectorMode(false); setVectorPreview(null); }
  function handleRadarMouseDown(e) { if (e.button !== 0 || mouseVectorMode || followSelected) return; e.preventDefault(); setRadarView((v) => ({ ...v, panning: true, lastX: e.clientX, lastY: e.clientY })); }
  function handleRadarMouseMove(e) { if (radarView.panning) { const svg = svgRef.current; const rect = svg?.getBoundingClientRect(); if (rect) { const dx = ((e.clientX - radarView.lastX) / rect.width) * viewSize; const dy = ((e.clientY - radarView.lastY) / rect.height) * viewSize; setRadarView((v) => ({ ...v, x: v.x - dx, y: v.y - dy, lastX: e.clientX, lastY: e.clientY })); } return; } handleRadarMove(e); }
  function stopRadarPan() { setRadarView((v) => ({ ...v, panning: false })); }
  function handleRadarWheel(e) { e.preventDefault(); setZoom((z) => clamp(Number((z + (e.deltaY < 0 ? 0.35 : -0.35)).toFixed(2)), 0.55, 8)); }
  function svgEventTo3DGroundPoint(e) {
    const svg = svg3DRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 900;
    const sy = ((e.clientY - rect.top) / rect.height) * 900;
    const yaw = (view3D.yaw * Math.PI) / 180;
    const pitch = (view3D.pitch * Math.PI) / 180;
    const s = view3D.scale * 1.32;
    const cx = 450;
    const cy = 645;
    const focus = aircraft.find((a) => a.id === view3D.focusId);
    const ox = focus ? focus.x : (view3D.centerX ?? CENTER);
    const oy = focus ? focus.y : (view3D.centerY ?? CENTER);
    const y2 = (cy - sy) / s;
    const x1 = (sx - cx) / s;
    const sinPitch = Math.sin(pitch);
    const cosPitch = Math.cos(pitch);
    if (Math.abs(sinPitch) < 0.08 || s <= 0) return null;
    const z1 = -y2 / sinPitch;
    const X = x1 * Math.cos(yaw) + z1 * Math.sin(yaw);
    const Z = -x1 * Math.sin(yaw) + z1 * Math.cos(yaw);
    return { x: ox + X, y: oy + Z };
  }
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
      const nextAircraft = makeInitialAircraft(initEnv, initDep).map(normalizeAircraftState);
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
    const nextAircraft = withSeededRandom(sc.seed || sc.id, () => makeScenarioInitialAircraft(scenarioEnv, sc.id, sc.depRunway || "01R").map(normalizeAircraftState));
    setSeq(6);
    setAircraft(nextAircraft);
    setRadarTargets(nextAircraft.map((a) => ({ ...a, radarSweepTick: 0 })));
    setRadarLastSweepTick(0);
    setSelectedId(nextAircraft[0]?.id || "");
    setLog([`${sc.title}: scenario loaded.`, `Initial runway plan: ${scenarioBothRunways.join("/")} BOTH. Objective: maintain safe traffic flow, avoid conflicts, and complete runway/arrival tasks.`]);
  }
  function backToMainMenu() { setRunning(false); setStartScreen(true); setMouseVectorMode(false); setVectorPreview(null); }
  function reset() { if (gameMode === "SCENARIO" || gameMode === "DEBUG") { const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS.find((s) => s.kind === gameMode) || SCENARIOS[1]; startMode(sc); return; } setRunning(false); setWeatherTick(0); const nextSeed = Math.random(); const nextWindOffset = Math.random() * 120; setWeatherSeed(nextSeed); setWindOffset(nextWindOffset); const resetWind = generatedWind(nextWindOffset); const resetPair = runwayHeadwind(resetWind, 10) >= runwayHeadwind(resetWind, 190) ? "01" : "19"; const resetArr = defaultArrRunwayForPair(resetPair); const resetDep = dualRunway ? defaultDepRunwayForPair(resetPair) : resetArr; if (runwayMode === "AUTO") { setActiveRunway(resetArr); setDepRunway(resetDep); setArrRunways([resetArr]); setDepRunways([resetDep]); setClosedRunways([]); } const resetEnv = { runway: RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway], nav: makeNavCached(runwayMode === "AUTO" ? resetArr : activeRunway), routes: makeRoutes(runwayMode === "AUTO" ? resetArr : activeRunway), sids: makeSids(runwayMode === "AUTO" ? resetArr : activeRunway), wind: resetWind, headwind: runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course), tailwind: Math.max(0, -runwayHeadwind(resetWind, RUNWAYS[runwayMode === "AUTO" ? resetArr : activeRunway].course)), weatherOn, weatherCells: makeWeatherCells(0, nextSeed), airports: { RJCJ: activeAirportRunway("RJCJ", resetWind), RJCH: activeAirportRunway("RJCH", resetWind), RJSM: activeAirportRunway("RJSM", resetWind) } }; const nextAircraft = makeInitialAircraft(resetEnv, runwayMode === "AUTO" ? resetDep : depRunway); setAircraft(nextAircraft.map(normalizeAircraftState)); setRadarTargets(nextAircraft.map(normalizeAircraftState).map((a) => ({ ...a, radarSweepTick: 0 }))); setRadarLastSweepTick(0); setSelectedId(nextAircraft[0]?.id || ""); setLandedCount(0); setHandoffCount(0); setSeq(6 + Math.floor(Math.random() * 30)); setTick(0); setRealTick(0); setWeatherTick(0); setLastDepTick(-999); setLastMilTick(-999); setLog([`CHITOSE: reset. Wind ${fmt3(resetWind.dir)}/${resetWind.speed}. ARR RWY ${runwayMode === "AUTO" ? resetArr : activeRunway}, DEP RWY ${runwayMode === "AUTO" ? resetDep : depRunway}. New traffic and weather loaded.`]); }
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
  const showAirportIls = (id) => {
    if (id === "RJCJ") return seat === "RJCJ" || selected?.category === "MIL" || selected?.destination === "RJCJ";
    return selected?.destination === id || ["DIVERT", "ALT_HANDOFF"].includes(selected?.mode);
  };
  function runwayLabelForRole(role) {
    if (role === "PENDING") return lang === "zh" ? "候选" : "PENDING";
    if (role === "INACTIVE") return lang === "zh" ? "未用" : "STANDBY";
    if (role === "CLOSED") return lang === "zh" ? "关闭" : "CLOSED";
    if (role === "ARR") return lang === "zh" ? "进场" : "ARR";
    if (role === "BOTH") return lang === "zh" ? "混用" : "BOTH";
    if (role === "DEP") return lang === "zh" ? "离场" : "DEP";
    return lang === "zh" ? "当前" : "ACTIVE";
  }
  function rjccRunwayDisplaySet() {
    const pending = runwayChangeCandidate?.pair ? runwayPairRunways(runwayChangeCandidate.pair) : null;
    return RJCC_RUNWAY_NAMES.map((rw) => {
      if (closedRunways.includes(rw)) return { runway: rw, role: "CLOSED" };
      if (pending && (rw === pending.arr || rw === pending.dep) && !openArrRunways.includes(rw) && !openDepRunways.includes(rw)) return { runway: rw, role: "PENDING" };
      const arr = openArrRunways.includes(rw);
      const dep = openDepRunways.includes(rw);
      if (arr && dep) return { runway: rw, role: "BOTH" };
      if (arr) return { runway: rw, role: rw === activeRunway ? "CURRENT" : "ARR" };
      if (dep) return { runway: rw, role: rw === depRunway ? "DEP" : "DEP" };
      return { runway: rw, role: "INACTIVE" };
    });
  }
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
  const project3D = (x, y, alt = 0, large = false) => {
    const yaw = (view3D.yaw * Math.PI) / 180;
    const pitch = (view3D.pitch * Math.PI) / 180;
    const focus = aircraft.find((a) => a.id === view3D.focusId);
    const ox = focus ? focus.x : (view3D.centerX ?? CENTER);
    const oy = focus ? focus.y : (view3D.centerY ?? CENTER);
    const X = x - ox;
    const Z = y - oy;
    const Y = alt / 220;
    const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
    const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
    const y2 = Y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = Y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const s = view3D.scale * (large ? 1.32 : 1);
    const focal = large ? 2200 : 1500;
    const perspective = clamp(focal / (focal + z2 * 0.35), 0.82, 1.18);
    return { x: (large ? 450 : 200) + x1 * s * perspective, y: (large ? 645 : 248) - y2 * s * perspective, depth: z2, scale: perspective };
  };
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
  function ring3DPoints(radiusNm, large = true) { return Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * Math.PI * 2; const x = CENTER + Math.sin(a) * radiusNm * PX_PER_NM; const y = CENTER - Math.cos(a) * radiusNm * PX_PER_NM; const p = project3D(x, y, 0, large); return `${p.x},${p.y}`; }).join(" "); }
  function glidePath3D(course, sideNm = 0, origin = { x: CENTER, y: CENTER }, large = true) {
    const v = hdgVector(course);
    const r = { x: -v.y, y: v.x };
    return [18, 15, 12, 9, 6, 3, 0].map((d) => {
      const p = { x: origin.x - v.x * d * PX_PER_NM + r.x * sideNm * PX_PER_NM, y: origin.y - v.y * d * PX_PER_NM + r.y * sideNm * PX_PER_NM };
      return project3D(p.x, p.y, d * 320, large);
    });
  }
  function routeGlide3D(route, large = true) {
    const points = [];
    const first = wp(env.nav, route[0]);
    if (first && route[0]?.startsWith("IAF")) {
      const br = xyToBearingRange(first.x, first.y).bearing;
      const baseRange = xyToBearingRange(first.x, first.y).rangeNm;
      const outer120 = bearingToXY(br, baseRange + 26);
      const outer100 = bearingToXY(br, baseRange + 13);
      points.push(project3D(outer120.x, outer120.y, 12000, large));
      points.push(project3D(outer100.x, outer100.y, 10000, large));
    }
    route.forEach((id, idx) => {
      const w = wp(env.nav, id);
      if (!w) return;
      const alt = id.startsWith("IAF") ? 8000 : id.startsWith("DW_") ? 6000 : id.startsWith("BASE_") ? 5000 : id === "IF01" ? 3000 : id === "FAF" ? 2200 : Math.max(3500, 6500 - idx * 800);
      points.push(project3D(w.x, w.y, alt, large));
    });
    return points;
  }
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
                
                {(() => { return <g>{rjccRunwayDisplaySet().map(({ runway: rw, role }) => { const pts = runwayPolygonPoints(rw, CENTER, CENTER, 1, RJCC_RUNWAY_VISUAL_NM, 5).map((pt) => project3D(pt.x, pt.y, 0, true)).map((p) => `${p.x},${p.y}`).join(" "); const color = role === "CURRENT" ? "#22c55e" : role === "BOTH" ? "#84cc16" : role === "DEP" ? "#a855f7" : role === "PENDING" ? "#f59e0b" : role === "CLOSED" ? "#ef4444" : "#38bdf8"; return <polygon key={`3d-rwy-${rw}`} points={pts} fill={color} opacity={role === "CURRENT" ? "0.42" : role === "BOTH" ? "0.34" : role === "DEP" ? "0.28" : role === "PENDING" ? "0.24" : role === "CLOSED" ? "0.10" : "0.13"} stroke={color} strokeWidth={role === "CURRENT" ? "1.4" : "1"} />; })}</g>; })()}
                {(() => { const c = project3D(CENTER, CENTER, 0, true), n = project3D(bearingToXY(0, 22).x, bearingToXY(0, 22).y, 0, true); return <g><line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke="#f8fafc" strokeWidth="2" opacity="0.9" markerEnd="url(#northArrow3D)" /><text x={n.x + 6} y={n.y - 6} fill="#f8fafc" fontSize="14" fontWeight="800">N</text></g>; })()}
                {rjccRunwayDisplaySet().map((set) => renderMainRunwayIls3D(set.runway, set.role))}
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
                {rjccRunwayDisplaySet().filter((set) => ["CURRENT", "ARR", "BOTH", "PENDING"].includes(set.role)).map((set) => renderApproachGuide3D(set.runway, set.role))}
                {Object.entries(env.sids).map(([name, sid]) => <polyline key={`main3d-sid-${name}`} points={[{ x: CENTER, y: CENTER }, ...sid.route.map((id) => wp(env.nav, id)).filter(Boolean)].map((w, idx) => { const p = project3D(w.x, w.y, idx === 0 ? 0 : 2500, true); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="#a855f7" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.42" />)}
                {env.nav.filter((w) => !["CHITOSE", "MA1", "MAHOLD"].includes(w.id) && !w.id.startsWith("HOLD_")).map((w) => { const p = project3D(w.x, w.y, 0, true); const c = w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"; return <g key={`main3d-wp-${w.id}`} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><polygon points={`${p.x},${p.y - 5} ${p.x + 5},${p.y + 4} ${p.x - 5},${p.y + 4}`} fill="none" stroke={c} strokeWidth="1" opacity="0.7" /><text x={p.x + 7} y={p.y + 4} fill={c} fontSize="10" opacity="0.75">{w.label}</text></g>; })}
                {aircraft.slice().sort((a, b) => project3D(a.x, a.y, a.altitude, true).depth - project3D(b.x, b.y, b.altitude, true).depth).map((a) => { const isSel = a.id === selectedId; const p = project3D(a.x, a.y, a.altitude, true); const g = project3D(a.x, a.y, 0, true); const nextAlt = project3D(a.x, a.y, a.assignedAltitude, true); const color = conflictIds.has(a.id) ? "#ff1f1f" : cautionIds.has(a.id) ? "#f59e0b" : a.emergency ? "#ff4d4d" : isSel ? "#f6e94d" : isFoxhound(a) ? "#ef4444" : a.category === "MIL" ? "#60a5fa" : a.category === "DEP" ? "#c084fc" : a.clearedILS ? "#4de1ff" : "#32ff4d"; const trend = a.assignedAltitude > a.altitude + 300 ? "▲" : a.assignedAltitude < a.altitude - 300 ? "▼" : "→"; return <g key={`main3d-ac-${a.id}`} onClick={(e) => { e.stopPropagation(); selectAircraft(a.id); }} onDoubleClick={(e) => { e.stopPropagation(); setSelectedId(a.id); setView3D((v) => ({ ...v, focusId: v.focusId === a.id ? null : a.id, scale: Math.max(v.scale, 0.9) })); }} style={{ cursor: "pointer" }}><line x1={g.x} y1={g.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={isSel ? "2" : "1.4"} opacity="0.34" /><line x1={p.x} y1={p.y} x2={nextAlt.x} y2={nextAlt.y} stroke={color} strokeWidth="1.2" opacity="0.35" strokeDasharray="4 5" /><circle cx={g.x} cy={g.y} r={isSel ? "3" : "2"} fill={color} opacity="0.45" /><polygon points={`${p.x},${p.y - 7} ${p.x + 8},${p.y + 5} ${p.x - 8},${p.y + 5}`} fill={color} opacity="0.96" /><text x={p.x + 10} y={p.y - 8} fill={color} fontSize="12" fontWeight="700">{a.id} {trend}</text><text x={p.x + 10} y={p.y + 7} fill={color} fontSize="11">{a.type} {a.category} H{fmt3(a.heading)}</text><text x={p.x + 10} y={p.y + 21} fill={color} fontSize="11">{fmtFL(a.altitude)} → {fmtFL(a.assignedAltitude)} SPD {Math.round(a.speed)} F{Math.round(a.fuelMinutes ?? 0)}</text><text x={p.x + 10} y={p.y + 35} fill={color} fontSize="10">{modeText(a)}</text></g>; })}
                {mouseVectorMode && vectorPreview ? (() => { const sp = project3D(selected.x, selected.y, selected.altitude, true); const gp = project3D(vectorPreview.x, vectorPreview.y, 0, true); return <g pointerEvents="none"><line x1={sp.x} y1={sp.y} x2={gp.x} y2={gp.y} stroke="#f6e94d" strokeWidth="2" strokeDasharray="7 6" opacity="0.9" /><circle cx={gp.x} cy={gp.y} r="6" fill="none" stroke="#f6e94d" strokeWidth="2" /><text x={gp.x + 10} y={gp.y - 8} fill="#f6e94d" fontSize="13">HDG {fmt3(vectorPreview.heading)}</text></g>; })() : null}
                <g pointerEvents="none"><rect x="14" y="12" width="330" height="86" fill="#020617" opacity="0.72" stroke="#1f2937" rx="10" /><text x="28" y="32" fill="#94a3b8" fontSize="14" fontWeight="700">3D AIRSPACE / {seat} / RWY {activeRunway}</text><text x="28" y="50" fill="#64748b" fontSize="11">Wind {fmt3(windObj.dir)}/{windObj.speed} QNH {qnh} | HW {env.headwind.toFixed(1)} TW {env.tailwind.toFixed(1)}</text>
                  {snowRemovalNotice ? <text x="28" y="101" fill="#f59e0b" fontSize="13" fontWeight="900">{snowRemovalNotice}</text> : null}{rjcjPriorityNotice ? (() => { const color = rjcjPriorityNotice.level === "FAIL" ? "#ef4444" : rjcjPriorityNotice.level === "DANGER" ? "#f97316" : rjcjPriorityNotice.level === "WARN" ? "#facc15" : rjcjPriorityNotice.level === "DONE" ? "#22c55e" : "#38bdf8"; return <g key="3d-rjcj-priority" pointerEvents="none"><rect x="234" y="112" width="432" height="58" rx="12" fill="#020617" opacity="0.92" stroke={color} strokeWidth="2.4" /><text x="450" y="136" textAnchor="middle" fill={color} fontSize="18" fontWeight="950">{rjcjPriorityNotice.title}</text><text x="450" y="157" textAnchor="middle" fill="#e5e7eb" fontSize="12" fontWeight="800">{rjcjPriorityNotice.body}</text></g>; })() : null}<text x="28" y="67" fill="#64748b" fontSize="11">Yaw {Math.round(view3D.yaw)} Camera {Math.round(view3D.pitch)} Scale {view3D.scale.toFixed(2)} | L-drag pan / M-drag rotate / wheel zoom</text><text x="28" y="84" fill="#64748b" fontSize="11">Mouse vector: {mouseVectorMode ? "ARMED" : "OFF"} | dbl-click target focus {view3D.focusId ? `ON ${view3D.focusId}` : "OFF"}</text></g>
                <g pointerEvents="none"><rect x="620" y="16" width="252" height="108" fill="#020617" opacity="0.72" stroke="#1f2937" rx="10" /><text x="634" y="36" fill="#f6e94d" fontSize="13" fontWeight="800">{selected.id} SELECTED</text><text x="634" y="55" fill="#cbd5e1" fontSize="11">BRG {fmt3(selectedBR.bearing)} / {selectedBR.rangeNm.toFixed(1)}NM | HDG {fmt3(selected.heading)}</text><text x="634" y="73" fill="#cbd5e1" fontSize="11">ALT {fmtFL(selected.altitude)} → {fmtFL(selected.assignedAltitude)} | SPD {Math.round(selected.speed)}</text><text x="634" y="91" fill="#cbd5e1" fontSize="11">FUEL {Math.round(selected.fuelMinutes ?? 0)} | BURN {(selected.burnRate ?? 1).toFixed(1)} | {selected.category}</text><text x="634" y="109" fill="#cbd5e1" fontSize="11">{modeText(selected)}</text></g>
              </svg> : null}
              <svg ref={svgRef} viewBox={viewBox} onClick={handleRadarClick} onMouseDown={handleRadarMouseDown} onMouseMove={handleRadarMouseMove} onMouseUp={stopRadarPan} onMouseLeave={(e) => { stopRadarPan(); if (mouseVectorMode) setVectorPreview(null); }} onWheel={handleRadarWheel} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: "monospace", cursor: mouseVectorMode ? "crosshair" : radarView.panning ? "grabbing" : "default", opacity: scopeMode === "RADAR" ? 1 : 0, pointerEvents: scopeMode === "RADAR" ? "auto" : "none" }}>
                <rect x="0" y="0" width="720" height="720" fill="#061306" />
                {weatherOn ? env.weatherCells.map((c) => <g key={c.id}>{weatherTiles(c).map((t, idx) => <rect key={`${c.id}-${idx}`} x={t.x} y={t.y} width={t.size} height={t.size} fill={c.level === "RED" ? "#ef4444" : "#facc15"} opacity={t.opacity} />)}<text x={c.x} y={c.y} fill={c.level === "RED" ? "#fecaca" : "#fef3c7"} fontSize={10 / zoom} textAnchor="middle">{c.id} {Math.round(c.baseAlt ?? 0)}-{Math.round(c.topAlt ?? 60000)}FT</text></g>) : null}
                {[10, 20, 30, 40, 50, 60, 80, 100].map((r) => <circle key={r} cx={CENTER} cy={CENTER} r={r * PX_PER_NM} fill="none" stroke="#0d5016" strokeWidth="1" opacity="0.7" />)}
                <line x1="0" y1={CENTER} x2="720" y2={CENTER} stroke="#0d5016" strokeWidth="1" opacity="0.65" />
                <line x1={CENTER} y1="0" x2={CENTER} y2="720" stroke="#0d5016" strokeWidth="1" opacity="0.65" />
                {[20, 40, 60, 80, 100].map((r) => <text key={r} x={CENTER + r * PX_PER_NM - 12} y={CENTER + 6} fill="#148a25" fontSize="12">{r}nm</text>)}
                <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 26 / zoom} fill="#32ff4d" fontSize={14 / zoom} fontWeight="700">CHITOSE {seat} RWY {activeRunway}</text>
                <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 48 / zoom} fill="#148a25" fontSize={12 / zoom}>WIND {fmt3(windObj.dir)}/{windObj.speed} QNH {qnh} | SWEEP {RADAR_SWEEP_SECONDS}s AGE {radarSweepAgeSec.toFixed(1)}s</text>
                {snowRemovalNotice ? <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 72 / zoom} fill="#f59e0b" fontSize={15 / zoom} fontWeight="900">{snowRemovalNotice}</text> : null}
                {rjcjPriorityNotice ? (() => { const color = rjcjPriorityNotice.level === "FAIL" ? "#ef4444" : rjcjPriorityNotice.level === "DANGER" ? "#f97316" : rjcjPriorityNotice.level === "WARN" ? "#facc15" : rjcjPriorityNotice.level === "DONE" ? "#22c55e" : "#38bdf8"; const x = viewCenter.x - 238 / zoom; const y = viewCenter.y - viewSize / 2 + 82 / zoom; return <g key="radar-rjcj-priority" pointerEvents="none"><rect x={x} y={y} width={476 / zoom} height={62 / zoom} rx={12 / zoom} fill="#020617" opacity="0.92" stroke={color} strokeWidth={2.4 / Math.sqrt(zoom)} /><text x={viewCenter.x} y={y + 23 / zoom} textAnchor="middle" fill={color} fontSize={18 / zoom} fontWeight="950">{rjcjPriorityNotice.title}</text><text x={viewCenter.x} y={y + 46 / zoom} textAnchor="middle" fill="#e5e7eb" fontSize={12.5 / zoom} fontWeight="800">{rjcjPriorityNotice.body}</text></g>; })() : null}
                {rjccRunwayDisplaySet().map((set) => renderMainRunwayIlsOverlay(set.runway, set.role))}
                {rjccRunwayDisplaySet().map(({ runway: rw, role }) => { const pts = runwayPolygonPoints(rw, CENTER, CENTER, 1, RJCC_RUNWAY_VISUAL_NM, 3).map((p) => `${p.x},${p.y}`).join(" "); const color = role === "CURRENT" ? "#22c55e" : role === "BOTH" ? "#84cc16" : role === "DEP" ? "#a855f7" : role === "PENDING" ? "#f59e0b" : role === "CLOSED" ? "#ef4444" : "#38bdf8"; return <polygon key={`radar-rwy-${rw}`} points={pts} fill={color} opacity={role === "CURRENT" ? "0.30" : role === "BOTH" ? "0.25" : role === "DEP" ? "0.20" : role === "PENDING" ? "0.18" : role === "CLOSED" ? "0.08" : "0.10"} stroke={color} strokeWidth={role === "CURRENT" ? "1.45" : "1.05"} />; })}
                {["RJCJ", "RJCH", "RJSM"].filter(showAirportIls).map((id) => { const apt = wp(env.nav, id); const pad = id === "RJCJ" ? rjcjHelipadPoint(env) : null; const rwys = id === "RJCJ" ? AIRPORT_RUNWAYS.RJCJ : [id === "RJCH" ? { name: "12", course: 120 } : id === "RJSM" ? { name: "10", course: 100 } : env.airports[id]]; return <g key={`apt-${id}`}>{id === "RJCJ" && pad ? <g key="rjcj-helipad-west"><circle cx={pad.x} cy={pad.y} r={4 / Math.sqrt(zoom)} fill="none" stroke="#60a5fa" strokeWidth={1.4 / Math.sqrt(zoom)} opacity="0.92" /><text x={pad.x - 42 / zoom} y={pad.y - 7 / zoom} fill="#60a5fa" fontSize={9 / zoom} opacity="0.9">RJCJ HELIPAD W</text></g> : null}{rwys.map((activeAptRunway) => { const course = activeAptRunway?.course ?? (id === "RJCJ" ? 180 : id === "RJCH" ? 120 : 100); const rv = hdgVector(course); const rr = { x: -rv.y, y: rv.x }; const ils = ilsBoundaryLines(apt, course, 4, 12, 6, 18); const isActive = id !== "RJCJ" || activeAptRunway.name === env.airports.RJCJ.name; const color = isActive ? "#22c55e" : "#38bdf8"; return <g key={`apt-${id}-${activeAptRunway.name}`}><polygon points={ptsString(ils.polygon)} fill={color} opacity={isActive ? "0.045" : "0.025"} stroke="none" /><polyline points={ptsString(ils.left)} fill="none" stroke={color} strokeWidth="1" strokeDasharray={isActive ? "4 5" : "9 6"} opacity={isActive ? "0.72" : "0.42"} /><polyline points={ptsString(ils.right)} fill="none" stroke={color} strokeWidth="1" strokeDasharray={isActive ? "4 5" : "9 6"} opacity={isActive ? "0.72" : "0.42"} /><line x1={apt.x - rr.x * 3} y1={apt.y - rr.y * 3} x2={apt.x + rr.x * 3} y2={apt.y + rr.y * 3} stroke="#9ca3af" strokeWidth="6" opacity={isActive ? "0.45" : "0.22"} /><line x1={apt.x - rv.x * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} y1={apt.y - rv.y * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} x2={apt.x + rv.x * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} y2={apt.y + rv.y * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} stroke={color} strokeWidth="2.6" opacity={isActive ? "0.95" : "0.52"} /><text x={apt.x + 8 / zoom} y={apt.y + (activeAptRunway.name === "36" ? 12 : -8) / zoom} fill={color} fontSize={10 / zoom}>{id === "RJCJ" ? `RJCJ RWY ${activeAptRunway.name}${isActive ? " ACTIVE" : ""}` : `${id} RWY ${activeAptRunway?.name || "-"} ILS`}</text></g>; })}</g>; })}
                {["RJCH", "RJSM"].map((id) => {
                  const apt = wp(env.nav, id);
                  if (!apt) return null;
                  const radiusNm = alternateHandoffRadiusNm(id);
                  const activeDivert = aircraft.some((a) => !a.handedOff && !a.landed && (a.destination === id || a.alternate === id));
                  const color = activeDivert ? "#f59e0b" : "#38bdf8";
                  return <g key={`radar-alt-handoff-${id}`} pointerEvents="none">
                    <circle cx={apt.x} cy={apt.y} r={radiusNm * PX_PER_NM} fill="none" stroke={color} strokeWidth={1.5 / Math.sqrt(zoom)} strokeDasharray="10 7" opacity={activeDivert ? "0.90" : "0.45"} />
                    <circle cx={apt.x} cy={apt.y} r={2.8 / Math.sqrt(zoom)} fill={color} opacity="0.85" />
                    <text x={apt.x + 10 / zoom} y={apt.y + radiusNm * PX_PER_NM + 13 / zoom} fill={color} fontSize={11 / zoom} opacity={activeDivert ? "0.96" : "0.70"}>{alternateHandoffLabel(id)} {radiusNm}NM</text>
                  </g>;
                })}
                {activeCorridors.map((c) => {
                  if (c.kind === "AREA") return <g key={`radar-corridor-${c.id}`} pointerEvents="none"><circle cx={c.end.x} cy={c.end.y} r={c.controlRadiusNm * PX_PER_NM} fill={c.color} opacity="0.070" stroke={c.color} strokeWidth={1.8 / Math.sqrt(zoom)} strokeDasharray="5 5" /><text x={c.end.x + 8 / zoom} y={c.end.y + 14 / zoom} fill={c.color} fontSize={10 / zoom} opacity="0.95">{c.aircraftId} CONTROL AREA {c.areaId}</text></g>;
                  const poly = corridorPolygonPoints(c);
                  return <g key={`radar-corridor-${c.id}`} pointerEvents="none"><polygon points={ptsString(poly)} fill={c.color} opacity="0.090" stroke={c.color} strokeWidth={1.7 / Math.sqrt(zoom)} strokeDasharray="12 7" /><line x1={c.start.x} y1={c.start.y} x2={c.end.x} y2={c.end.y} stroke={c.color} strokeWidth={1.8 / Math.sqrt(zoom)} opacity="0.76" strokeDasharray="8 7" /><circle cx={c.position.x} cy={c.position.y} r={c.widthNm * PX_PER_NM} fill={c.color} opacity="0.060" stroke={c.color} strokeWidth={1.2 / Math.sqrt(zoom)} /><text x={(c.start.x + c.end.x) / 2 + 8 / zoom} y={(c.start.y + c.end.y) / 2 - 8 / zoom} fill={c.color} fontSize={11 / zoom} opacity="0.96">{c.aircraftId} MOVING CORRIDOR</text></g>;
                })}
                {displayedMissionAreas(aircraft).map((area) => { const p = missionAreaPoint(area); const color = area.dynamic ? "#f59e0b" : "#60a5fa"; return <g key={`radar-mission-${area.id}`}><circle cx={p.x} cy={p.y} r={area.radiusNm * PX_PER_NM} fill={color} opacity="0.055" stroke={color} strokeWidth={1.4 / Math.sqrt(zoom)} strokeDasharray="7 6" /><circle cx={p.x} cy={p.y} r={2.5 / Math.sqrt(zoom)} fill={color} opacity="0.85" /><text x={p.x + 8 / zoom} y={p.y - 8 / zoom} fill={color} fontSize={11 / zoom} opacity="0.95">{area.id} {area.label}</text></g>; })}
                {rjccRunwayDisplaySet().filter((set) => ["CURRENT", "ARR", "BOTH", "PENDING"].includes(set.role)).map((set) => renderApproachGuide(set.runway, set.role))}
                {Object.entries(env.sids).map(([name, sid]) => <polyline key={name} points={[{ x: CENTER, y: CENTER }, ...sid.route.map((id) => wp(env.nav, id)).filter(Boolean)].map((w) => `${w.x},${w.y}`).join(" ")} fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.28" strokeDasharray="3 6" />)}
                {env.nav.filter((w) => w.id.startsWith("HOLD_")).map((w) => {
                  const inner = w.id.startsWith("HOLD_IN_");
                  return <polyline key={`radar-hold-${w.id}`} points={ptsString(holdPatternPoints(env.nav, w.id, activeRunway))} fill="none" stroke="#f59e0b" strokeWidth={(inner ? 1.25 : 1.05) / Math.sqrt(zoom)} opacity={inner ? "0.54" : "0.34"} strokeDasharray={inner ? "8 5" : "14 8"} />;
                })}
                {env.nav.filter((w) => w.id !== "CHITOSE" && !w.id.startsWith("HOLD_")).map((w) => { const s = 5 / Math.sqrt(zoom); return <g key={w.id} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><polygon points={`${w.x},${w.y - s} ${w.x + s},${w.y + s * 0.8} ${w.x - s},${w.y + s * 0.8}`} fill="none" stroke={w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"} strokeWidth={1 / Math.sqrt(zoom)} opacity="0.75" /><text x={w.x + 7 / zoom} y={w.y + 4 / zoom} fill={w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"} fontSize={10 / zoom} opacity="0.85">{w.label}</text></g>; })}
                {env.nav.filter((w) => w.id.startsWith("HOLD_")).map((w) => { const s = 5 / Math.sqrt(zoom); return <g key={`hold-fix-${w.id}`} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><circle cx={w.x} cy={w.y} r={5.2 / Math.sqrt(zoom)} fill="#f59e0b" opacity="0.16" stroke="#f59e0b" strokeWidth={1.1 / Math.sqrt(zoom)} /><circle cx={w.x} cy={w.y} r={2.1 / Math.sqrt(zoom)} fill="#f59e0b" opacity="0.86" /><text x={w.x + 7 / zoom} y={w.y + 4 / zoom} fill="#f59e0b" fontSize={10 / zoom} opacity="0.82">{w.label}</text></g>; })}
                {mouseVectorMode && vectorPreview ? <g pointerEvents="none"><line x1={selected.x} y1={selected.y} x2={vectorPreview.x} y2={vectorPreview.y} stroke="#f6e94d" strokeWidth={1.6 / Math.sqrt(zoom)} strokeDasharray="5 5" opacity="0.9" /><circle cx={vectorPreview.x} cy={vectorPreview.y} r={4 / Math.sqrt(zoom)} fill="none" stroke="#f6e94d" strokeWidth={1.5 / Math.sqrt(zoom)} /><text x={vectorPreview.x + 8 / zoom} y={vectorPreview.y - 8 / zoom} fill="#f6e94d" fontSize={12 / zoom}>HDG {fmt3(vectorPreview.heading)}</text></g> : null}
                {radarDisplayTargets.map((a) => { const sx = a.displayX ?? a.x; const sy = a.displayY ?? a.y; const isSel = a.id === selectedId; const vectorLen = (a.speed / 60) * PX_PER_NM * 2; const v = hdgVector(a.displayHeading ?? a.heading); const lowFuel = (a.fuelMinutes ?? 60) < 15; const color = conflictIds.has(a.id) ? "#ff1f1f" : cautionIds.has(a.id) ? "#f59e0b" : a.emergency ? "#ff4d4d" : lowFuel ? "#ff4d4d" : isSel ? "#f6e94d" : isFoxhound(a) ? "#ef4444" : a.category === "MIL" ? "#60a5fa" : a.category === "DEP" ? "#c084fc" : a.clearedILS ? "#4de1ff" : a.mode === "HOLD" ? "#f59e0b" : "#32ff4d"; return <g key={a.id} onClick={(e) => { e.stopPropagation(); selectAircraft(a.id); }} style={{ cursor: "pointer" }}><line x1={sx} y1={sy} x2={sx + v.x * vectorLen} y2={sy + v.y * vectorLen} stroke={color} strokeWidth={1.5 / Math.sqrt(zoom)} opacity="0.85" /><circle cx={sx} cy={sy} r={isSel ? 4 / Math.sqrt(zoom) : 3.2 / Math.sqrt(zoom)} fill={color} /><text x={sx + 10 / zoom} y={sy - 16 / zoom} fill={color} fontSize={12 / zoom} fontWeight="700">{a.id}</text><text x={sx + 10 / zoom} y={sy - 2 / zoom} fill={color} fontSize={12 / zoom}>{a.type} {fmtFL(a.altitude)} {Math.round(a.speed)} F{Math.round(a.fuelMinutes ?? 0)} B{(a.burnRate ?? 1).toFixed(1)} {a.category === "ARR" ? vnavStatus(a, env) : ""}</text><text x={sx + 10 / zoom} y={sy + 12 / zoom} fill={color} fontSize={12 / zoom}>{a.category} H{fmt3(a.displayHeading ?? a.heading)} {modeText(a)}</text><text x={sx + 10 / zoom} y={sy + 26 / zoom} fill={color} fontSize={9 / zoom} opacity="0.66">HIT {formatEta(a.radarAgeSec ?? 0)} AGO / EXTRAP</text></g>; })}
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
