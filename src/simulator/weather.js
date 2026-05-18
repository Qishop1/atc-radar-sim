import { AIRPORT_RUNWAYS, CENTER, PX_PER_NM } from "./constants.js";
import { clamp, distancePointToSegment, hdgVector, normHeading, shortestTurn } from "./geometry.js";

export function parseWind(text) {
  let s = String(text || "").toUpperCase().replaceAll(" ", "").replace("AT", "/").replace("KT", "");
  let dir = 360;
  let speed = 0;
  if (s.includes("/")) {
    const parts = s.split("/");
    dir = Number(parts[0]);
    speed = Number(parts[1]);
  } else if (s.length >= 4) {
    dir = Number(s.slice(0, 3));
    speed = Number(s.slice(3));
  }
  return { dir: Number.isFinite(dir) ? normHeading(dir) : 360, speed: Number.isFinite(speed) ? speed : 0 };
}
export function runwayHeadwind(wind, course) { return wind.speed * Math.cos((shortestTurn(course, wind.dir) * Math.PI) / 180); }
export function generatedWind(seed = 0) {
  const phaseLen = 6;
  const phase = Math.floor(seed / phaseLen);
  const inPhase = seed - phase * phaseLen;
  const progress = clamp(inPhase / phaseLen, 0, 0.999);
  const smooth = progress * progress * (3 - 2 * progress);

  const makePhaseWind = (p) => {
    const frontal = Math.sin(p / 5.2) > 0.86;
    const frontalShift = frontal ? 135 + Math.sin(p * 0.73) * 35 : 0;
    const dir = normHeading(330 + Math.sin(p * 1.7) * 28 + Math.sin(p * 0.61) * 36 + frontalShift);
    const base = 7 + Math.sin(p * 1.13) * 3 + Math.max(0, Math.sin(p * 2.1) * 5);
    const speed = clamp(Math.round(base + (frontal ? 10 + Math.max(0, Math.sin(p * 3.7) * 8) : 0)), 2, 34);
    return { dir, speed };
  };

  const current = makePhaseWind(phase);
  const next = makePhaseWind(phase + 1);
  const turn = shortestTurn(current.dir, next.dir);
  const dir = normHeading(current.dir + turn * smooth);
  const speed = Math.round(current.speed + (next.speed - current.speed) * smooth);
  const remainingSeed = Math.max(0.01, phaseLen - inPhase);

  return {
    dir,
    speed,
    nextDir: next.dir,
    nextSpeed: next.speed,
    changeIn: Math.max(1, Math.round(remainingSeed * 120)),
  };
}
export function windVector(wind) { return hdgVector(normHeading(wind.dir + 180)); }
export function divertRequired(wind) { return wind.speed >= 35; }
export function aircraftWithinWeatherAltitude(ac, cell) {
  const base = cell.baseAlt ?? 0;
  const top = cell.topAlt ?? 60000;
  const alt = ac?.altitude ?? 0;
  return alt >= base && alt <= top;
}
export function pointInWeatherCell(px, py, cell) {
  const angle = ((cell.angle || 0) * Math.PI) / 180;
  const dx = px - cell.x, dy = py - cell.y;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const lx = dx * ca + dy * sa;
  const ly = -dx * sa + dy * ca;
  const len = cell.len || cell.r || 40;
  const wid = cell.wid || cell.r || 25;
  return (lx * lx) / (len * len) + (ly * ly) / (wid * wid) < 1;
}
export function segmentIntersectsWeather(a, b, cell) {
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    if (pointInWeatherCell(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, cell)) return true;
  }
  return false;
}
export function intersectsRedWeather(a, b, weatherCells, ac = null) {
  return weatherCells.some((c) => c.level === "RED" && (!ac || aircraftWithinWeatherAltitude(ac, c)) && segmentIntersectsWeather(a, b, c));
}
export function nearestRedWeatherAhead(ac, heading, weatherCells) {
  const lookaheadNm = ac.category === "MIL" ? Math.max(16, Math.min(34, (ac.speed || 250) / 12)) : 10;
  const v = hdgVector(heading);
  const ahead = { x: ac.x + v.x * lookaheadNm * PX_PER_NM, y: ac.y + v.y * lookaheadNm * PX_PER_NM };
  let best = null;
  for (const c of weatherCells) {
    if (c.level !== "RED" || !aircraftWithinWeatherAltitude(ac, c)) continue;
    const d = distancePointToSegment({ x: c.x, y: c.y }, { x: ac.x, y: ac.y }, ahead);
    const along = ((c.x - ac.x) * v.x + (c.y - ac.y) * v.y) / PX_PER_NM;
    const side = (c.x - ac.x) * (-v.y) + (c.y - ac.y) * v.x;
    const threshold = Math.max(c.len || c.r || 35, c.wid || c.r || 25) * 0.72;
    if (along > -1 && along < lookaheadNm && d < threshold && (!best || d < best.d)) best = { cell: c, d, along, side };
  }
  return best;
}
export function makeWeatherCells(seed = 0, weatherSeed = 0, scenarioId = "") {
  const roll = weatherSeed % 1;
  const scenario = scenarioId === "winter_sar_front" ? "WINTER_SAR" : roll < 0.18 ? "VMC" : roll < 0.42 ? "SCATTERED" : roll < 0.76 ? "FRONTAL" : "SEVERE";
  if (scenario === "VMC") return [];

  const t = seed;
  const cycle = (Math.floor(seed * 1.4) + Math.floor(weatherSeed * 1000)) % 360;
  const baseAngle = 32 + Math.sin(weatherSeed * 17.13) * 28;
  const driftX = Math.sin(t * 0.11) * 58 + t * 0.018;
  const driftY = Math.cos(t * 0.09) * 42 + t * 0.012;
  const sx = Math.sin(weatherSeed * 41.7) * 150;
  const sy = Math.cos(weatherSeed * 37.3) * 130;
  const pulse = 0.72 + Math.max(0, Math.sin(t / 31 + weatherSeed * 23.5)) * 0.55;
  const severeScale = scenario === "SEVERE" ? 1.18 : 1.0;

  const alive = (start, end) => {
    if (start <= end) return cycle >= start && cycle <= end;
    return cycle >= start || cycle <= end;
  };

  if (scenario === "WINTER_SAR") {
    return [
      { id: "WXSNOW_FIELD", x: CENTER, y: CENTER, len: 185, wid: 150, angle: 18, level: "YELLOW", baseAlt: 0, topAlt: 6500, alive: true },
      { id: "WXVIS_CORE", x: CENTER + 18 + driftX * 0.35, y: CENTER - 8 + driftY * 0.35, len: 105, wid: 80, angle: 22, level: "RED", baseAlt: 0, topAlt: 3200, alive: true },
      { id: "WXFRONT_S", x: CENTER - 60 + driftX * 0.55, y: CENTER + 180 + driftY * 0.45, len: 360, wid: 68, angle: 78, level: "YELLOW", baseAlt: 1500, topAlt: 12000, alive: true },
      { id: "WXCB_SEA", x: CENTER + 70 + driftX * 0.45, y: CENTER + 250 + driftY * 0.55, len: 145, wid: 38, angle: 64, level: "RED", baseAlt: 2000, topAlt: 18000, alive: true },
    ];
  }

  if (scenario === "SCATTERED") {
    const cells = [
      {
        id: "WXSHRA1",
        x: CENTER - 170 + sx * 0.38 + driftX,
        y: CENTER - 105 + sy * 0.30 + driftY,
        len: 95 + pulse * 55,
        wid: 24 + pulse * 16,
        angle: baseAngle,
        level: "YELLOW",
        alive: true,
      },
      {
        id: "WXSHRA2",
        x: CENTER + 145 - sx * 0.25 + driftX * 0.55,
        y: CENTER + 135 - sy * 0.26 + driftY * 0.85,
        len: 82 + Math.abs(Math.cos(weatherSeed * 11 + t / 29)) * 65,
        wid: 22 + Math.abs(Math.sin(weatherSeed * 10 + t / 35)) * 18,
        angle: baseAngle - 68,
        level: "YELLOW",
        alive: alive(30, 310),
      },
      {
        id: "WXSHRA3",
        x: CENTER + Math.sin(t / 48 + weatherSeed * 5.2) * 235,
        y: CENTER - 255 + sy * 0.16 + driftY * 0.50,
        len: 70 + Math.abs(Math.sin(weatherSeed * 15 + t / 33)) * 70,
        wid: 18 + Math.abs(Math.cos(weatherSeed * 16 + t / 37)) * 16,
        angle: 8 + baseAngle * 0.22,
        level: "YELLOW",
        alive: alive(105, 350),
      },
      {
        id: "WXCB1",
        x: CENTER - 135 + sx * 0.42 + driftX * 0.95,
        y: CENTER - 90 + sy * 0.24 + driftY * 0.85,
        len: 42 + pulse * 30,
        wid: 13 + pulse * 10,
        angle: baseAngle + 5,
        level: "RED",
        alive: roll > 0.30 && alive(92, 225),
      },
    ];
    return cells.filter((c) => c.alive && c.len > 8 && c.wid > 6);
  }

  const frontShift = Math.sin(t / 58 + weatherSeed * 4.6) * 55;
  const frontLean = baseAngle + Math.sin(t / 70 + weatherSeed * 2.4) * 12;
  const redGate = scenario === "SEVERE" ? true : alive(80, 250);
  const cells = [
    {
      id: "WXFRONT1",
      x: CENTER - 225 + sx * 0.32 + driftX + frontShift * 0.55,
      y: CENTER - 170 + sy * 0.20 + driftY,
      len: (390 + pulse * 105) * severeScale,
      wid: (48 + pulse * 44) * severeScale,
      angle: frontLean,
      level: "YELLOW",
      alive: alive(0, 335),
    },
    {
      id: "WXFRONT2",
      x: CENTER + 110 - sx * 0.22 + driftX * 0.45 - frontShift * 0.35,
      y: CENTER + 145 - sy * 0.18 + driftY * 0.75,
      len: (355 + Math.abs(Math.cos(weatherSeed * 11 + t / 41)) * 115) * severeScale,
      wid: (44 + Math.abs(Math.sin(weatherSeed * 9 + t / 39)) * 42) * severeScale,
      angle: frontLean - 84,
      level: "YELLOW",
      alive: scenario === "SEVERE" || alive(20, 330),
    },
    {
      id: "WXFRONT3",
      x: CENTER + Math.sin(t / 60 + weatherSeed * 6.3) * 270 + driftX * 0.30,
      y: CENTER - 305 + sy * 0.18 + driftY * 0.35,
      len: (300 + Math.abs(Math.sin(weatherSeed * 5 + t / 36)) * 190) * severeScale,
      wid: (40 + Math.abs(Math.cos(weatherSeed * 17 + t / 44)) * 34) * severeScale,
      angle: 6 + baseAngle * 0.30,
      level: "YELLOW",
      alive: scenario === "SEVERE" ? alive(35, 350) : alive(125, 320),
    },
    {
      id: "WXRED1",
      x: CENTER - 190 + sx * 0.40 + driftX + frontShift * 0.45,
      y: CENTER - 138 + sy * 0.24 + driftY,
      len: (92 + pulse * 72) * severeScale,
      wid: (17 + pulse * 19) * severeScale,
      angle: frontLean + 4,
      level: "RED",
      alive: redGate && alive(35, 240),
    },
    {
      id: "WXRED2",
      x: CENTER + 150 - sx * 0.28 + driftX * 0.42 - frontShift * 0.28,
      y: CENTER + 128 - sy * 0.18 + driftY * 0.72,
      len: (86 + Math.abs(Math.sin(weatherSeed * 7 + t / 27)) * 78) * severeScale,
      wid: (16 + Math.abs(Math.cos(weatherSeed * 13 + t / 31)) * 18) * severeScale,
      angle: frontLean - 82,
      level: "RED",
      alive: redGate && alive(72, 275),
    },
    {
      id: "WXRED3",
      x: CENTER + Math.sin(t / 42 + weatherSeed * 8.1) * 250 + driftX * 0.26,
      y: CENTER - 295 + sy * 0.16 + driftY * 0.42,
      len: (70 + Math.abs(Math.sin(weatherSeed * 23 + t / 29)) * 74) * severeScale,
      wid: (14 + Math.abs(Math.cos(weatherSeed * 29 + t / 31)) * 14) * severeScale,
      angle: 9 + baseAngle * 0.25,
      level: "RED",
      alive: scenario === "SEVERE" && alive(150, 42),
    },
  ];
  return cells.filter((c) => c.alive && c.len > 8 && c.wid > 6);
}
export function wxHash(x, y, id) {
  let h = 2166136261;
  const s = `${id}:${x}:${y}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
export function weatherTiles(cell, tile = 9) {
  const tiles = [];
  const len = cell.len || cell.r || 40;
  const wid = cell.wid || cell.r || 25;
  const angle = ((cell.angle || 0) * Math.PI) / 180;
  const bound = Math.max(len, wid);
  const minX = Math.floor((cell.x - bound) / tile) * tile;
  const maxX = Math.ceil((cell.x + bound) / tile) * tile;
  const minY = Math.floor((cell.y - bound) / tile) * tile;
  const maxY = Math.ceil((cell.y + bound) / tile) * tile;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let x = minX; x <= maxX; x += tile) {
    for (let y = minY; y <= maxY; y += tile) {
      const cx = x + tile / 2, cy = y + tile / 2;
      const dx = cx - cell.x, dy = cy - cell.y;
      const lx = dx * ca + dy * sa;
      const ly = -dx * sa + dy * ca;
      const d = Math.sqrt((lx * lx) / (len * len) + (ly * ly) / (wid * wid));
      const noise = wxHash(Math.round(x / tile), Math.round(y / tile), cell.id);
      const edgeNoise = 0.2 + (noise - 0.5) * 0.42;
      if (d < 1.0 + edgeNoise && noise > 0.13) tiles.push({ x, y, size: tile * (0.72 + noise * 0.42), opacity: clamp(0.14 + (1 - d) * 0.26 + noise * 0.08, 0.08, 0.48) });
    }
  }
  return tiles;
}
export function activeAirportRunway(airportId, wind) {
  const candidates = AIRPORT_RUNWAYS[airportId] || AIRPORT_RUNWAYS.RJCH;
  return candidates.reduce((best, r) => runwayHeadwind(wind, r.course) > runwayHeadwind(wind, best.course) ? r : best, candidates[0]);
}
