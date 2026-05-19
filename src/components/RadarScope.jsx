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
} from "./RadarOverlays.jsx";
import { ILS_FAR_PX, ILS_NEAR_PX, RUNWAYS } from "../simulator/constants.js";
import { ptsString, runwayPointAt } from "../simulator/geometry.js";
import { makeNavCached, makeRoutes, wp } from "../simulator/airspaceRoutes.js";
import { runwayOrigin } from "../simulator/navigation.js";
import { ilsBoundaryLines } from "../simulator/runwayGeometry.js";

function MainRunwayIlsOverlay({ runwayName, role = "CURRENT", zoom, runwayLabelForRole }) {
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

function ApproachGuide({ runwayName, role = "CURRENT", zoom, directToWaypointForRunway }) {
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

export default function RadarScope({
  svgRef,
  viewBox,
  viewCenter,
  viewSize,
  zoom,
  seat,
  activeRunway,
  windObj,
  qnh,
  radarSweepAgeSec,
  snowRemovalNotice,
  rjcjPriorityNotice,
  fmt3,
  fmtFL,
  weatherOn,
  env,
  runwayDisplaySet,
  runwayLabelForRole,
  showAirportIls,
  rjcjHelipadPoint,
  aircraft,
  alternateHandoffRadiusNm,
  alternateHandoffLabel,
  activeCorridors,
  scenarioId,
  scenarioEventsDone,
  lang,
  directToWaypoint,
  directToWaypointForRunway,
  mouseVectorMode,
  vectorPreview,
  selected,
  radarDisplayTargets,
  selectedId,
  conflictIds,
  cautionIds,
  selectAircraft,
  vnavStatus,
  modeText,
  radarView,
  handleRadarClick,
  handleRadarMouseDown,
  handleRadarMouseMove,
  handleRadarMouseLeave,
  stopRadarPan,
  handleRadarWheel,
}) {
  return (
    <div style={{ position: "relative", width: "min(calc(100vw - 720px), calc(100vh - 86px), 1000px)", aspectRatio: "1 / 1", minWidth: 620, overflow: "hidden", borderRadius: 16, border: "1px solid #14532d", background: "#061306", margin: "0 auto" }}>
      <svg ref={svgRef} viewBox={viewBox} onClick={handleRadarClick} onMouseDown={handleRadarMouseDown} onMouseMove={handleRadarMouseMove} onMouseUp={stopRadarPan} onMouseLeave={handleRadarMouseLeave} onWheel={handleRadarWheel} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: "monospace", cursor: mouseVectorMode ? "crosshair" : radarView.panning ? "grabbing" : "default" }}>
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
        {runwayDisplaySet.map((set) => <MainRunwayIlsOverlay key={`main-ils-${set.runway}-${set.role}`} runwayName={set.runway} role={set.role} zoom={zoom} runwayLabelForRole={runwayLabelForRole} />)}
        <RadarRunwayOverlay runwayDisplaySet={runwayDisplaySet} />
        <AirportOverlay env={env} zoom={zoom} showAirportIls={showAirportIls} rjcjHelipadPoint={rjcjHelipadPoint} />
        <AlternateHandoffOverlay aircraft={aircraft} env={env} zoom={zoom} alternateHandoffRadiusNm={alternateHandoffRadiusNm} alternateHandoffLabel={alternateHandoffLabel} />
        <MissionOverlay activeCorridors={activeCorridors} aircraft={aircraft} scenarioId={scenarioId} scenarioEventsDone={scenarioEventsDone} zoom={zoom} lang={lang} />
        {runwayDisplaySet.filter((set) => ["CURRENT", "ARR", "BOTH", "PENDING"].includes(set.role)).map((set) => <ApproachGuide key={`approach-guide-${set.runway}-${set.role}`} runwayName={set.runway} role={set.role} zoom={zoom} directToWaypointForRunway={directToWaypointForRunway} />)}
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
  );
}
