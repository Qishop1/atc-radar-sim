import { formatEta } from "../simulator/formatting.js";
import {
  AIRPORT_RUNWAYS,
  CENTER,
  OTHER_RUNWAY_VISUAL_NM,
  PX_PER_NM,
  RADAR_SWEEP_SECONDS,
  RJCC_RUNWAY_VISUAL_NM,
} from "../simulator/constants.js";
import { hdgVector, ptsString } from "../simulator/geometry.js";
import { holdPatternPoints, wp } from "../simulator/airspaceRoutes.js";
import { ilsBoundaryLines, runwayPolygonPoints } from "../simulator/runwayGeometry.js";
import { corridorPolygonPoints, displayedMissionAreas, missionAreaPoint } from "../simulator/military.js";
import { adizRectCorners, foxhoundAdizArea } from "../simulator/interceptScenario.js";
import { weatherTiles } from "../simulator/weather.js";
import {
  missionAreaColor,
  priorityNoticeColor,
  radarRunwayOpacity,
  radarRunwayStrokeWidth,
  radarTargetColor,
  runwayRoleColor,
  weatherCellColor,
  weatherCellLabelColor,
} from "../simulator/radarDisplay.js";

export function WeatherOverlay({ weatherOn, weatherCells, zoom }) {
  return weatherOn ? weatherCells.map((c) => (
    <g key={c.id}>
      {weatherTiles(c).map((t, idx) => <rect key={`${c.id}-${idx}`} x={t.x} y={t.y} width={t.size} height={t.size} fill={weatherCellColor(c.level)} opacity={t.opacity} />)}
      <text x={c.x} y={c.y} fill={weatherCellLabelColor(c.level)} fontSize={10 / zoom} textAnchor="middle">{c.id} {Math.round(c.baseAlt ?? 0)}-{Math.round(c.topAlt ?? 60000)}FT</text>
    </g>
  )) : null;
}

export function RangeRingsOverlay() {
  return <>
    <rect x="0" y="0" width="720" height="720" fill="#061306" />
    {[10, 20, 30, 40, 50, 60, 80, 100].map((r) => <circle key={r} cx={CENTER} cy={CENTER} r={r * PX_PER_NM} fill="none" stroke="#0d5016" strokeWidth="1" opacity="0.7" />)}
    <line x1="0" y1={CENTER} x2="720" y2={CENTER} stroke="#0d5016" strokeWidth="1" opacity="0.65" />
    <line x1={CENTER} y1="0" x2={CENTER} y2="720" stroke="#0d5016" strokeWidth="1" opacity="0.65" />
    {[20, 40, 60, 80, 100].map((r) => <text key={r} x={CENTER + r * PX_PER_NM - 12} y={CENTER + 6} fill="#148a25" fontSize="12">{r}nm</text>)}
  </>;
}

export function RadarHeaderOverlay({ viewCenter, viewSize, zoom, seat, activeRunway, windObj, qnh, radarSweepAgeSec, snowRemovalNotice, rjcjPriorityNotice, fmt3 }) {
  return <>
    <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 26 / zoom} fill="#32ff4d" fontSize={14 / zoom} fontWeight="700">CHITOSE {seat} RWY {activeRunway}</text>
    <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 48 / zoom} fill="#148a25" fontSize={12 / zoom}>WIND {fmt3(windObj.dir)}/{windObj.speed} QNH {qnh} | SWEEP {RADAR_SWEEP_SECONDS}s AGE {radarSweepAgeSec.toFixed(1)}s</text>
    {snowRemovalNotice ? <text x={viewCenter.x - viewSize / 2 + 18 / zoom} y={viewCenter.y - viewSize / 2 + 72 / zoom} fill="#f59e0b" fontSize={15 / zoom} fontWeight="900">{snowRemovalNotice}</text> : null}
    {rjcjPriorityNotice ? (() => {
      const color = priorityNoticeColor(rjcjPriorityNotice.level);
      const x = viewCenter.x - 238 / zoom;
      const y = viewCenter.y - viewSize / 2 + 82 / zoom;
      return <g key="radar-rjcj-priority" pointerEvents="none"><rect x={x} y={y} width={476 / zoom} height={62 / zoom} rx={12 / zoom} fill="#020617" opacity="0.92" stroke={color} strokeWidth={2.4 / Math.sqrt(zoom)} /><text x={viewCenter.x} y={y + 23 / zoom} textAnchor="middle" fill={color} fontSize={18 / zoom} fontWeight="950">{rjcjPriorityNotice.title}</text><text x={viewCenter.x} y={y + 46 / zoom} textAnchor="middle" fill="#e5e7eb" fontSize={12.5 / zoom} fontWeight="800">{rjcjPriorityNotice.body}</text></g>;
    })() : null}
  </>;
}

export function RadarRunwayOverlay({ runwayDisplaySet }) {
  return <>
    {runwayDisplaySet.map(({ runway: rw, role }) => {
      const pts = runwayPolygonPoints(rw, CENTER, CENTER, 1, RJCC_RUNWAY_VISUAL_NM, 3).map((p) => `${p.x},${p.y}`).join(" ");
      const color = runwayRoleColor(role);
      return <polygon key={`radar-rwy-${rw}`} points={pts} fill={color} opacity={radarRunwayOpacity(role)} stroke={color} strokeWidth={radarRunwayStrokeWidth(role)} />;
    })}
  </>;
}

export function AirportOverlay({ env, zoom, showAirportIls, rjcjHelipadPoint }) {
  return <>
    {["RJCJ", "RJCH", "RJSM"].filter(showAirportIls).map((id) => {
      const apt = wp(env.nav, id);
      const pad = id === "RJCJ" ? rjcjHelipadPoint(env) : null;
      const rwys = id === "RJCJ" ? AIRPORT_RUNWAYS.RJCJ : [id === "RJCH" ? { name: "12", course: 120 } : id === "RJSM" ? { name: "10", course: 100 } : env.airports[id]];
      return <g key={`apt-${id}`}>{id === "RJCJ" && pad ? <g key="rjcj-helipad-west"><circle cx={pad.x} cy={pad.y} r={4 / Math.sqrt(zoom)} fill="none" stroke="#60a5fa" strokeWidth={1.4 / Math.sqrt(zoom)} opacity="0.92" /><text x={pad.x - 42 / zoom} y={pad.y - 7 / zoom} fill="#60a5fa" fontSize={9 / zoom} opacity="0.9">RJCJ HELIPAD W</text></g> : null}{rwys.map((activeAptRunway) => {
        const course = activeAptRunway?.course ?? (id === "RJCJ" ? 180 : id === "RJCH" ? 120 : 100);
        const rv = hdgVector(course);
        const rr = { x: -rv.y, y: rv.x };
        const ils = ilsBoundaryLines(apt, course, 4, 12, 6, 18);
        const isActive = id !== "RJCJ" || activeAptRunway.name === env.airports.RJCJ.name;
        const color = isActive ? "#22c55e" : "#38bdf8";
        return <g key={`apt-${id}-${activeAptRunway.name}`}><polygon points={ptsString(ils.polygon)} fill={color} opacity={isActive ? "0.045" : "0.025"} stroke="none" /><polyline points={ptsString(ils.left)} fill="none" stroke={color} strokeWidth="1" strokeDasharray={isActive ? "4 5" : "9 6"} opacity={isActive ? "0.72" : "0.42"} /><polyline points={ptsString(ils.right)} fill="none" stroke={color} strokeWidth="1" strokeDasharray={isActive ? "4 5" : "9 6"} opacity={isActive ? "0.72" : "0.42"} /><line x1={apt.x - rr.x * 3} y1={apt.y - rr.y * 3} x2={apt.x + rr.x * 3} y2={apt.y + rr.y * 3} stroke="#9ca3af" strokeWidth="6" opacity={isActive ? "0.45" : "0.22"} /><line x1={apt.x - rv.x * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} y1={apt.y - rv.y * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} x2={apt.x + rv.x * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} y2={apt.y + rv.y * OTHER_RUNWAY_VISUAL_NM * PX_PER_NM} stroke={color} strokeWidth="2.6" opacity={isActive ? "0.95" : "0.52"} /><text x={apt.x + 8 / zoom} y={apt.y + (activeAptRunway.name === "36" ? 12 : -8) / zoom} fill={color} fontSize={10 / zoom}>{id === "RJCJ" ? `RJCJ RWY ${activeAptRunway.name}${isActive ? " ACTIVE" : ""}` : `${id} RWY ${activeAptRunway?.name || "-"} ILS`}</text></g>;
      })}</g>;
    })}
  </>;
}

export function AlternateHandoffOverlay({ env, aircraft, zoom, alternateHandoffRadiusNm, alternateHandoffLabel }) {
  return <>
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
  </>;
}

export function MissionOverlay({ activeCorridors, aircraft, scenarioId, scenarioEventsDone, zoom, lang }) {
  return <>
    {activeCorridors.map((c) => {
      if (c.kind === "AREA") return <g key={`radar-corridor-${c.id}`} pointerEvents="none"><circle cx={c.end.x} cy={c.end.y} r={c.controlRadiusNm * PX_PER_NM} fill={c.color} opacity="0.070" stroke={c.color} strokeWidth={1.8 / Math.sqrt(zoom)} strokeDasharray="5 5" /><text x={c.end.x + 8 / zoom} y={c.end.y + 14 / zoom} fill={c.color} fontSize={10 / zoom} opacity="0.95">{c.aircraftId} CONTROL AREA {c.areaId}</text></g>;
      const poly = corridorPolygonPoints(c);
      return <g key={`radar-corridor-${c.id}`} pointerEvents="none"><polygon points={ptsString(poly)} fill={c.color} opacity="0.090" stroke={c.color} strokeWidth={1.7 / Math.sqrt(zoom)} strokeDasharray="12 7" /><line x1={c.start.x} y1={c.start.y} x2={c.end.x} y2={c.end.y} stroke={c.color} strokeWidth={1.8 / Math.sqrt(zoom)} opacity="0.76" strokeDasharray="8 7" /><circle cx={c.position.x} cy={c.position.y} r={c.widthNm * PX_PER_NM} fill={c.color} opacity="0.060" stroke={c.color} strokeWidth={1.2 / Math.sqrt(zoom)} /><text x={(c.start.x + c.end.x) / 2 + 8 / zoom} y={(c.start.y + c.end.y) / 2 - 8 / zoom} fill={c.color} fontSize={11 / zoom} opacity="0.96">{c.aircraftId} MOVING CORRIDOR</text></g>;
    })}
    {displayedMissionAreas(aircraft).map((area) => {
      const p = missionAreaPoint(area);
      const color = missionAreaColor(area);
      return <g key={`radar-mission-${area.id}`}><circle cx={p.x} cy={p.y} r={area.radiusNm * PX_PER_NM} fill={color} opacity="0.055" stroke={color} strokeWidth={1.4 / Math.sqrt(zoom)} strokeDasharray="7 6" /><circle cx={p.x} cy={p.y} r={2.5 / Math.sqrt(zoom)} fill={color} opacity="0.85" /><text x={p.x + 8 / zoom} y={p.y - 8 / zoom} fill={color} fontSize={11 / zoom} opacity="0.95">{area.id} {area.label}</text></g>;
    })}
    {scenarioId === "foxhound_adiz_05" && scenarioEventsDone.foxhoundPreAlert && !scenarioEventsDone.foxhoundSuccess ? (() => {
      const area = foxhoundAdizArea();
      const pts = ptsString(adizRectCorners(area));
      return <g key="foxhound-adiz-zone-radar" pointerEvents="none"><polygon points={pts} fill="#ef4444" opacity="0.075" stroke="#ef4444" strokeWidth={1.9 / Math.sqrt(zoom)} strokeDasharray="10 6" /><text x={area.x + 8 / zoom} y={area.y - 10 / zoom} fill="#ef4444" fontSize={12 / zoom} opacity="0.96">{lang === "zh" ? "MiG-31 ADIZ 突入区" : "MiG-31 ADIZ PENETRATION ZONE"}</text></g>;
    })() : null}
  </>;
}

export function ProcedureOverlay({ env, activeRunway, zoom, directToWaypoint }) {
  return <>
    {Object.entries(env.sids).map(([name, sid]) => <polyline key={name} points={[{ x: CENTER, y: CENTER }, ...sid.route.map((id) => wp(env.nav, id)).filter(Boolean)].map((w) => `${w.x},${w.y}`).join(" ")} fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.28" strokeDasharray="3 6" />)}
    {env.nav.filter((w) => w.id.startsWith("HOLD_")).map((w) => {
      const inner = w.id.startsWith("HOLD_IN_");
      return <polyline key={`radar-hold-${w.id}`} points={ptsString(holdPatternPoints(env.nav, w.id, activeRunway))} fill="none" stroke="#f59e0b" strokeWidth={(inner ? 1.25 : 1.05) / Math.sqrt(zoom)} opacity={inner ? "0.54" : "0.34"} strokeDasharray={inner ? "8 5" : "14 8"} />;
    })}
    {env.nav.filter((w) => w.id !== "CHITOSE" && !w.id.startsWith("HOLD_")).map((w) => {
      const s = 5 / Math.sqrt(zoom);
      return <g key={w.id} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><polygon points={`${w.x},${w.y - s} ${w.x + s},${w.y + s * 0.8} ${w.x - s},${w.y + s * 0.8}`} fill="none" stroke={w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"} strokeWidth={1 / Math.sqrt(zoom)} opacity="0.75" /><text x={w.x + 7 / zoom} y={w.y + 4 / zoom} fill={w.id.startsWith("DP") ? "#c084fc" : "#38bdf8"} fontSize={10 / zoom} opacity="0.85">{w.label}</text></g>;
    })}
    {env.nav.filter((w) => w.id.startsWith("HOLD_")).map((w) => {
      const s = 5 / Math.sqrt(zoom);
      return <g key={`hold-fix-${w.id}`} onClick={(e) => { e.stopPropagation(); directToWaypoint(w.id); }} style={{ cursor: "pointer" }}><circle cx={w.x} cy={w.y} r={5.2 / Math.sqrt(zoom)} fill="#f59e0b" opacity="0.16" stroke="#f59e0b" strokeWidth={1.1 / Math.sqrt(zoom)} /><circle cx={w.x} cy={w.y} r={2.1 / Math.sqrt(zoom)} fill="#f59e0b" opacity="0.86" /><text x={w.x + 7 / zoom} y={w.y + 4 / zoom} fill="#f59e0b" fontSize={10 / zoom} opacity="0.82">{w.label}</text></g>;
    })}
  </>;
}

export function MouseVectorOverlay({ mouseVectorMode, vectorPreview, selected, zoom, fmt3 }) {
  return mouseVectorMode && vectorPreview ? <g pointerEvents="none"><line x1={selected.x} y1={selected.y} x2={vectorPreview.x} y2={vectorPreview.y} stroke="#f6e94d" strokeWidth={1.6 / Math.sqrt(zoom)} strokeDasharray="5 5" opacity="0.9" /><circle cx={vectorPreview.x} cy={vectorPreview.y} r={4 / Math.sqrt(zoom)} fill="none" stroke="#f6e94d" strokeWidth={1.5 / Math.sqrt(zoom)} /><text x={vectorPreview.x + 8 / zoom} y={vectorPreview.y - 8 / zoom} fill="#f6e94d" fontSize={12 / zoom}>HDG {fmt3(vectorPreview.heading)}</text></g> : null;
}

export function TargetLayer({ radarDisplayTargets, selectedId, conflictIds, cautionIds, zoom, selectAircraft, fmt3, fmtFL, vnavStatus, env, modeText }) {
  return <>
    {radarDisplayTargets.map((a) => {
      const sx = a.displayX ?? a.x;
      const sy = a.displayY ?? a.y;
      const isSel = a.id === selectedId;
      const vectorLen = (a.speed / 60) * PX_PER_NM * 2;
      const v = hdgVector(a.displayHeading ?? a.heading);
      const color = radarTargetColor(a, { conflictIds, cautionIds, selectedId });
      return <g key={a.id} onClick={(e) => { e.stopPropagation(); selectAircraft(a.id); }} style={{ cursor: "pointer" }}><line x1={sx} y1={sy} x2={sx + v.x * vectorLen} y2={sy + v.y * vectorLen} stroke={color} strokeWidth={1.5 / Math.sqrt(zoom)} opacity="0.85" /><circle cx={sx} cy={sy} r={isSel ? 4 / Math.sqrt(zoom) : 3.2 / Math.sqrt(zoom)} fill={color} /><text x={sx + 10 / zoom} y={sy - 16 / zoom} fill={color} fontSize={12 / zoom} fontWeight="700">{a.id}</text><text x={sx + 10 / zoom} y={sy - 2 / zoom} fill={color} fontSize={12 / zoom}>{a.type} {fmtFL(a.altitude)} {Math.round(a.speed)} F{Math.round(a.fuelMinutes ?? 0)} B{(a.burnRate ?? 1).toFixed(1)} {a.category === "ARR" ? vnavStatus(a, env) : ""}</text><text x={sx + 10 / zoom} y={sy + 12 / zoom} fill={color} fontSize={12 / zoom}>{a.category} H{fmt3(a.displayHeading ?? a.heading)} {modeText(a)}</text><text x={sx + 10 / zoom} y={sy + 26 / zoom} fill={color} fontSize={9 / zoom} opacity="0.66">HIT {formatEta(a.radarAgeSec ?? 0)} AGO / EXTRAP</text></g>;
    })}
  </>;
}
