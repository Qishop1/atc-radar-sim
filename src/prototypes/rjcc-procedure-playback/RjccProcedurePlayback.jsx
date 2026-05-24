import { useEffect, useMemo, useRef, useState } from "react";
import { airports as rjccAirports } from "../../data/airspace/rjcc/airports.js";
import { fixes as rjccFixes } from "../../data/airspace/rjcc/fixes.js";
import { navaids as rjccNavaids } from "../../data/airspace/rjcc/navaids.js";
import { runways as rjccRunways } from "../../data/airspace/rjcc/runways.js";
import { hokkaidoRegionPackage } from "../../data/regions/hokkaido/regionPackage.js";
import { RjccJaipMapLayer } from "../../map/jaip/RjccJaipMapLayer.jsx";
import { ProcedurePlaybackLayer } from "./ProcedurePlaybackLayer.jsx";
import { RJCC_PROCEDURE_PLAYBACK_TESTS } from "./playbackTestCases.js";
import { resolveProcedurePlaybackRoute } from "./procedurePlaybackResolver.js";
import {
  createProcedurePlaybackState,
  displayRouteDistanceNm,
  PLAYBACK_STATES,
  startProcedurePlayback,
  stepProcedurePlayback,
} from "./procedurePlaybackStateMachine.js";

const SVG = { width: 1000, height: 930 };
const FALLBACK_BOUNDS = { minLat: 41, maxLat: 45.8, minLon: 139, maxLon: 146.5 };
const TIME_SCALE_OPTIONS = [1, 2, 4];
const SANDBOX_GROUND_SPEED_KT = 220;

function boundsFromCoastlines(coastlines, marginRatio = 0.035) {
  const coords = coastlines.flat().filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!coords.length) return FALLBACK_BOUNDS;
  const lats = coords.map(([lat]) => lat);
  const lons = coords.map(([, lon]) => lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    minLat: minLat - Math.max((maxLat - minLat) * marginRatio, 0.05),
    maxLat: maxLat + Math.max((maxLat - minLat) * marginRatio, 0.05),
    minLon: minLon - Math.max((maxLon - minLon) * marginRatio, 0.05),
    maxLon: maxLon + Math.max((maxLon - minLon) * marginRatio, 0.05),
  };
}

function buildProjection(bounds) {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const rawW = (maxLon - minLon) * cosLat;
  const rawH = maxLat - minLat;
  const scale = Math.min(SVG.width / rawW, SVG.height / rawH);
  const offsetX = (SVG.width - rawW * scale) / 2;
  const offsetY = (SVG.height - rawH * scale) / 2;
  return {
    scale,
    projectLatLon: (lat, lon) => ({
      x: offsetX + (lon - minLon) * cosLat * scale,
      y: offsetY + (maxLat - lat) * scale,
    }),
  };
}

function focusedView(points) {
  if (!points?.length) return { x: 0, y: 0, w: SVG.width, h: SVG.height };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = 20;
  let width = Math.max(82, Math.max(...xs) - Math.min(...xs) + padding * 2);
  let height = Math.max(72, Math.max(...ys) - Math.min(...ys) + padding * 2);
  const aspect = SVG.width / SVG.height;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height };
}

function panelStyle(side, compact = false) {
  if (compact) {
    return {
      width: "calc(100% - 32px)",
      margin: "12px 16px 0",
      padding: 12,
      color: "#a6dde5",
      background: "rgba(3, 18, 22, 0.88)",
      border: "1px solid rgba(95,168,179,.3)",
      borderRadius: 6,
      fontFamily: "monospace",
      fontSize: 12,
    };
  }
  return {
    position: "absolute",
    top: 68,
    [side]: 16,
    zIndex: 5,
    width: side === "left" ? 298 : 322,
    maxHeight: "calc(100vh - 86px)",
    overflowY: "auto",
    padding: 12,
    color: "#a6dde5",
    background: "rgba(3, 18, 22, 0.88)",
    border: "1px solid rgba(95,168,179,.3)",
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 12,
  };
}

const buttonStyle = {
  border: "1px solid rgba(95,168,179,.55)",
  borderRadius: 4,
  padding: "7px 10px",
  color: "#d8fbff",
  background: "rgba(13,82,99,.52)",
  cursor: "pointer",
  fontFamily: "monospace",
  fontWeight: 700,
};

function StatusRows({ label, values, tone = "#8fcbd5" }) {
  if (!values?.length) return null;
  return (
    <div style={{ marginTop: 10, color: tone }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {values.map((value) => <div key={value} style={{ marginBottom: 3 }}>- {value}</div>)}
    </div>
  );
}

export default function RjccProcedurePlayback() {
  const [procedureId, setProcedureId] = useState(RJCC_PROCEDURE_PLAYBACK_TESTS[0].procedureId);
  const [playing, setPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [compactLayout, setCompactLayout] = useState(() => typeof window !== "undefined" && window.innerWidth < 980);
  const frameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const projection = useMemo(() => buildProjection(boundsFromCoastlines(hokkaidoRegionPackage.coastline)), []);
  const route = useMemo(() => resolveProcedurePlaybackRoute({ procedureId, projection }), [procedureId, projection]);
  const [machine, setMachine] = useState(() => createProcedurePlaybackState(route, { groundSpeedKt: SANDBOX_GROUND_SPEED_KT }));
  const view = useMemo(() => focusedView(route.points), [route.points]);
  const zoom = SVG.width / view.w;
  const uiScale = Math.min(1, Math.max(0.08, 1 / zoom));
  const routeDistanceNm = useMemo(() => displayRouteDistanceNm(route.points), [route.points]);
  const playbackDurationMinutes = routeDistanceNm / (SANDBOX_GROUND_SPEED_KT * speedMultiplier) * 60;
  const activeTarget = machine.activePointIndex != null ? route.points[machine.activePointIndex] : null;

  useEffect(() => {
    const handleResize = () => setCompactLayout(window.innerWidth < 980);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMachine(createProcedurePlaybackState(route, { groundSpeedKt: SANDBOX_GROUND_SPEED_KT }));
    setPlaying(false);
    lastTimeRef.current = null;
  }, [route]);

  useEffect(() => {
    if (!playing) return undefined;
    const animate = (time) => {
      const previous = lastTimeRef.current ?? time;
      const deltaSeconds = Math.min(0.08, (time - previous) / 1000);
      lastTimeRef.current = time;
      setMachine((current) => stepProcedurePlayback(current, route, {
        deltaSeconds,
        groundSpeedKt: SANDBOX_GROUND_SPEED_KT,
        timeScale: speedMultiplier,
      }));
      frameRef.current = window.requestAnimationFrame(animate);
    };
    frameRef.current = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [playing, route, speedMultiplier]);

  useEffect(() => {
    if (machine.state === PLAYBACK_STATES.COMPLETE || machine.state === PLAYBACK_STATES.ERROR) setPlaying(false);
  }, [machine.state]);

  const start = () => {
    lastTimeRef.current = null;
    setMachine((current) => startProcedurePlayback(current, route));
    if (route.ok && machine.state !== PLAYBACK_STATES.COMPLETE) setPlaying(true);
  };
  const reset = () => {
    setPlaying(false);
    lastTimeRef.current = null;
    setMachine(createProcedurePlaybackState(route, { groundSpeedKt: SANDBOX_GROUND_SPEED_KT }));
  };

  return (
    <div style={{ width: "100vw", height: compactLayout ? "auto" : "100vh", minHeight: "100vh", overflow: compactLayout ? "auto" : "hidden", position: "relative", background: "#071c20", color: "#d8fbff", paddingTop: compactLayout ? 12 : 0 }}>
      <header style={{ position: compactLayout ? "relative" : "absolute", left: compactLayout ? "auto" : 16, right: compactLayout ? "auto" : 16, top: compactLayout ? "auto" : 12, margin: compactLayout ? "0 16px" : 0, zIndex: 5, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 18, padding: "10px 14px", background: "rgba(3,18,22,.9)", border: "1px solid rgba(95,168,179,.3)", borderRadius: 6, fontFamily: "monospace" }}>
        <strong style={{ color: "#d8fbff", fontSize: 16 }}>RJCC Procedure Playback Sandbox</strong>
        <strong style={{ color: "#ffe28a", fontSize: 12 }}>DISPLAY PLAYBACK SANDBOX ONLY / NOT AIRCRAFT GUIDANCE</strong>
      </header>

      <div style={panelStyle("left", compactLayout)}>
        <div style={{ color: "#5fa8b3", fontWeight: 700, marginBottom: 7 }}>DISPLAY PROCEDURE</div>
        <select value={procedureId} onChange={(event) => setProcedureId(event.target.value)} style={{ width: "100%", minHeight: 38, color: "#d8fbff", background: "#09252b", border: "1px solid rgba(95,168,179,.52)", borderRadius: 4, padding: 7, fontFamily: "monospace" }}>
          {RJCC_PROCEDURE_PLAYBACK_TESTS.map((test) => <option key={test.procedureId} value={test.procedureId}>{test.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
          <button type="button" onClick={start} style={buttonStyle}>START</button>
          <button type="button" onClick={() => setPlaying(false)} style={buttonStyle}>PAUSE</button>
          <button type="button" onClick={reset} style={buttonStyle}>RESET</button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 14 }}>
          <span style={{ color: "#5fa8b3" }}>TIME SCALE</span>
          {TIME_SCALE_OPTIONS.map((speed) => (
            <button key={speed} type="button" onClick={() => setSpeedMultiplier(speed)} style={{ ...buttonStyle, background: speedMultiplier === speed ? "rgba(26,113,128,.8)" : "rgba(3,18,22,.3)" }}>{speed}x</button>
          ))}
        </div>
        <div style={{ marginTop: 10, color: "#8fcbd5", lineHeight: 1.6 }}>
          Sandbox GS: {SANDBOX_GROUND_SPEED_KT} KT<br />
          Display distance: {routeDistanceNm.toFixed(1)} NM<br />
          Playback duration: {playbackDurationMinutes.toFixed(1)} min<br />
          Timing: distance / (GS x time scale)
        </div>
        <label style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
          Route labels
        </label>
        <label style={{ display: "flex", gap: 8, marginTop: 9, alignItems: "center" }}>
          <input type="checkbox" checked={showDiagnostics} onChange={(event) => setShowDiagnostics(event.target.checked)} />
          Diagnostics panel
        </label>
        <div style={{ marginTop: 16, padding: 10, border: "1px solid rgba(255,226,138,.35)", background: "rgba(94,72,18,.22)", color: "#ffe28a", lineHeight: 1.6 }}>
          displayOnly: {String(route.safety.displayOnly)}<br />
          guidanceEnabled: {String(route.safety.guidanceEnabled)}<br />
          legs: {String(route.safety.legs)}<br />
          sandboxOnly: {String(route.safety.sandboxOnly)}<br />
          display timing only: true
        </div>
      </div>

      <div style={compactLayout
        ? { position: "relative", height: "56vh", minHeight: 370, margin: "12px 16px", overflow: "hidden", border: "1px solid rgba(95,168,179,.12)", borderRadius: 6 }
        : { position: "absolute", left: 328, right: showDiagnostics ? 340 : 16, top: 68, bottom: 12, overflow: "hidden", border: "1px solid rgba(95,168,179,.12)", borderRadius: 6 }}>
        <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
          <rect x={view.x - view.w} y={view.y - view.h} width={view.w * 3} height={view.h * 3} fill="#071c20" />
          <RjccJaipMapLayer
            projection={projection}
            view={view}
            zoom={zoom}
            uiScale={uiScale}
            isZooming={false}
            showCoastline
            showContour
            showAirports={false}
            showRunways
            showFixes={false}
            showNavaids={false}
            showLocalizers={false}
            showProcedures={false}
            showAca={false}
            coastlines={hokkaidoRegionPackage.coastline}
            contours={hokkaidoRegionPackage.contours}
            airports={rjccAirports}
            runways={rjccRunways}
            fixes={rjccFixes}
            navaids={rjccNavaids}
            staticLayerRenderer="canvas"
          />
          <ProcedurePlaybackLayer route={route} machine={machine} showLabels={showLabels} uiScale={uiScale} />
        </svg>
      </div>

      {showDiagnostics && (
        <div style={panelStyle("right", compactLayout)} aria-label="Playback diagnostics">
          <div style={{ fontWeight: 800, color: route.ok ? "#7be1bb" : "#ff9e9e", marginBottom: 10 }}>{route.ok ? "READY FOR DISPLAY PLAYBACK" : "ERROR"}</div>
          <div>ID: {route.procedureId}</div>
          <div>Name: {route.procedureName}</div>
          <div>Runway: {route.runway || "-"}</div>
          <div>navSpec: {route.navSpec || "-"}</div>
          <div>sourceKind: {route.sourceKind}</div>
          <div>points: {route.points.length}</div>
          <div>distance: {routeDistanceNm.toFixed(2)} NM</div>
          <div>duration: {playbackDurationMinutes.toFixed(2)} min at {speedMultiplier}x</div>
          <hr style={{ borderColor: "rgba(95,168,179,.2)", margin: "10px 0" }} />
          <div>state: <strong style={{ color: "#ffe28a" }}>{machine.state}</strong></div>
          <div>activeTarget: {activeTarget?.label || "-"}</div>
          <div>heading: {machine.aircraft ? `${Math.round(machine.aircraft.headingDeg)} deg` : "-"}</div>
          <div>sandbox GS: {machine.aircraft ? `${machine.aircraft.groundSpeedKt} kt at ${speedMultiplier}x` : "-"}</div>
          <div>distance flown: {machine.aircraft ? `${machine.aircraft.distanceFlownNm.toFixed(2)} NM` : "-"}</div>
          <div>sandbox altitude: {machine.aircraft ? `${Math.round(machine.aircraft.altitudeFt)} ft` : "-"}</div>
          <div>progress: {machine.routeProgress.currentPointIndex + 1}/{machine.routeProgress.totalPoints}</div>
          <StatusRows label="UNRESOLVED" values={route.unresolvedFixes} tone="#ff9e9e" />
          <StatusRows label="AMBIGUOUS" values={route.ambiguousFixes} tone="#ffe28a" />
          <StatusRows label="WARNINGS" values={route.warnings} tone="#ffe28a" />
          <StatusRows label="ERRORS" values={route.errors} tone="#ff9e9e" />
        </div>
      )}
    </div>
  );
}
