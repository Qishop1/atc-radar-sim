import React, { useEffect, useMemo, useState } from "react";
import { fixes as rjccFixes } from "../../data/airspace/rjcc/fixes.js";
import { localizers as rjccLocalizers } from "../../data/airspace/rjcc/localizers.js";
import { navaids as rjccAirspaceNavaids } from "../../data/airspace/rjcc/navaids.js";
import { rawPoints } from "../../data/jaip/rjcc/acaPoints.js";
import { rawNavaids } from "../../data/jaip/rjcc/navaids.js";
import { hokkaidoRegionPackage } from "../../data/regions/hokkaido/regionPackage.js";
import { parseDMS } from "../../geo/dms.js";
import { buildProcedureRoutePreview, expandProcedureRouteEntries } from "../../core-v2/procedures/procedureRouteBuilder.js";
import { buildProcedureDisplayOptions, buildWaypointLookup, getAllProcedures } from "../../core-v2/procedures/procedureLookup.js";
import { getFirstAvailableChartOverlay } from "../../core-v2/procedures/chartOverlayLookup.js";
import { RjccJaipMapLayer } from "../../map/jaip/RjccJaipMapLayer.jsx";
import { makePathHelpers } from "../../map/jaip/pathHelpers.js";
import {
  defaultFixFilterState,
  defaultNavaidFilterState,
  filterFixes,
  filterLocalizers,
  filterNavaids,
  FIX_FILTERS,
  LABEL_MODES,
} from "../../map/jaip/semanticFilters.js";
import ClearanceComposerPanel from "./ClearanceComposerPanel.jsx";

const SVG = { width: 1000, height: 930 };
const defaultRadarLayerState = { coastline: true, contour: true, aca: true, airports: true, runways: true, navaids: true, fixes: true };
const radarLayerLabels = { coastline: "COAST", contour: "CONTOUR", aca: "ACA", airports: "AIRPORT", runways: "RWY", navaids: "NAVAID", fixes: "FIX" };
const PROCEDURE_DETAIL_MODES = ["path", "points", "labels"];
const USE_COASTLINE_BOUNDS_FOR_RADAR_MAP = true;
const FALLBACK_BOUNDS = { minLat: 41.0, maxLat: 45.8, minLon: 139.0, maxLon: 146.5 };

const toolbarButtonStyle = {
  border: "1px solid rgba(95, 168, 179, 0.55)",
  background: "rgba(3, 18, 22, 0.42)",
  color: "#9ed7df",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 8px",
  borderRadius: 3,
  cursor: "pointer",
  letterSpacing: "0.04em",
};

const filterPanelStyle = {
  position: "absolute",
  left: 14,
  top: 58,
  zIndex: 11,
  maxWidth: 392,
  display: "grid",
  gap: 5,
  padding: 7,
  background: "rgba(3,18,22,.72)",
  border: "1px solid rgba(95,168,179,.22)",
  borderRadius: 4,
  fontFamily: "monospace",
  userSelect: "none",
};

const filterGroupStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 4,
};

const filterLabelStyle = {
  color: "#5fa8b3",
  fontSize: 10,
  fontWeight: 900,
  minWidth: 44,
};

const filterStatusStyle = {
  color: "#5fa8b3",
  fontSize: 10,
  padding: "3px 2px",
};

function semanticButtonStyle(active) {
  return {
    ...toolbarButtonStyle,
    padding: "3px 6px",
    fontSize: 10,
    background: active ? "rgba(13,82,99,.56)" : "rgba(3,18,22,.34)",
    color: active ? "#d8fbff" : "#4f8790",
    borderColor: active ? "rgba(126,198,207,.62)" : "rgba(95,168,179,.24)",
  };
}

function getViewportAspect() {
  if (typeof window === "undefined") return SVG.width / SVG.height;
  return Math.max(0.1, window.innerWidth / Math.max(1, window.innerHeight));
}

function makeViewByAspect(centerX, centerY, width, aspect) {
  const h = width / aspect;
  return { x: centerX - width / 2, y: centerY - h / 2, w: width, h };
}

function makeFullViewByAspect(aspect) {
  const svgAspect = SVG.width / SVG.height;
  if (aspect >= svgAspect) {
    const w = SVG.height * aspect;
    return makeViewByAspect(SVG.width / 2, SVG.height / 2, w, aspect);
  }
  return makeViewByAspect(SVG.width / 2, SVG.height / 2, SVG.width, aspect);
}

function decodeReferenceItems() {
  return [
    ...rawPoints.map(([id, latDms, lonDms]) => ({ id, kind: "point", latDms, lonDms, lat: parseDMS(latDms), lon: parseDMS(lonDms) })),
    ...rawNavaids.map(([id, latDms, lonDms]) => ({ id, kind: "navaid", latDms, lonDms, lat: parseDMS(latDms), lon: parseDMS(lonDms) })),
  ];
}

function boundsFromCoastlines(coastlines, marginRatio = 0.035) {
  const coords = coastlines.flat().filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
  if (!coords.length) return FALLBACK_BOUNDS;
  const lats = coords.map(([lat]) => lat);
  const lons = coords.map(([, lon]) => lon);
  const minLatRaw = Math.min(...lats);
  const maxLatRaw = Math.max(...lats);
  const minLonRaw = Math.min(...lons);
  const maxLonRaw = Math.max(...lons);
  const latMargin = Math.max((maxLatRaw - minLatRaw) * marginRatio, 0.05);
  const lonMargin = Math.max((maxLonRaw - minLonRaw) * marginRatio, 0.05);
  return { minLat: minLatRaw - latMargin, maxLat: maxLatRaw + latMargin, minLon: minLonRaw - lonMargin, maxLon: maxLonRaw + lonMargin };
}

function buildFixedBoundsProjection(bounds) {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const rawW = (maxLon - minLon) * cosLat;
  const rawH = maxLat - minLat;
  const scale = Math.min(SVG.width / rawW, SVG.height / rawH);
  const usedW = rawW * scale;
  const usedH = rawH * scale;
  const offsetX = (SVG.width - usedW) / 2;
  const offsetY = (SVG.height - usedH) / 2;
  const projectLatLon = (lat, lon) => ({ x: offsetX + (lon - minLon) * cosLat * scale, y: offsetY + (maxLat - lat) * scale });
  return { minLat, maxLat, minLon, maxLon, midLat, cosLat, scale, projectLatLon };
}

function projectReferenceItems(items, projection) {
  return items.map((pt) => ({ ...pt, ...projection.projectLatLon(pt.lat, pt.lon) }));
}

export default function ChitoseApproachControlAreaReplica({ importedCoastlines }) {
  const coastlines = importedCoastlines?.length ? importedCoastlines : hokkaidoRegionPackage.coastline;
  const [radarLayerState, setRadarLayerState] = useState(defaultRadarLayerState);
  const [fixFilters, setFixFilters] = useState(defaultFixFilterState);
  const [navaidFilters, setNavaidFilters] = useState(defaultNavaidFilterState);
  const [procedureState, setProcedureState] = useState({ show: true, labelMode: "on", detailMode: "path", approximateGeometry: true, selectedIds: ["YOSAN_ONE_DEPARTURE"] });
  const [chartOverlayState, setChartOverlayState] = useState({ mode: "off", opacity: 0.45 });
  const [viewportAspect, setViewportAspect] = useState(getViewportAspect);
  const [view, setView] = useState(() => makeFullViewByAspect(getViewportAspect()));
  const [dragState, setDragState] = useState(null);
  const [isZooming, setIsZooming] = useState(false);
  const zoomEndTimerRef = React.useRef(null);

  useEffect(() => {
    const onResize = () => {
      const nextAspect = getViewportAspect();
      setViewportAspect(nextAspect);
      setView((prev) => {
        const currentFull = makeFullViewByAspect(viewportAspect);
        const nextFull = makeFullViewByAspect(nextAspect);
        const currentZoom = currentFull.w / prev.w;
        const nextW = nextFull.w / currentZoom;
        return makeViewByAspect(prev.x + prev.w / 2, prev.y + prev.h / 2, nextW, nextAspect);
      });
    };

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fullView = useMemo(() => makeFullViewByAspect(viewportAspect), [viewportAspect]);
  const minZoom = 1;
  const maxZoom = 96;
  const zoom = fullView.w / view.w;

  const chartData = useMemo(() => {
    const referenceItems = decodeReferenceItems();
    const bounds = USE_COASTLINE_BOUNDS_FOR_RADAR_MAP ? boundsFromCoastlines(coastlines) : FALLBACK_BOUNDS;
    const projection = buildFixedBoundsProjection(bounds);
    const projectedItems = projectReferenceItems(referenceItems, projection);
    const pointById = Object.fromEntries(projectedItems.map((pt) => [pt.id, pt]));
    return { projection, pointById, paths: makePathHelpers(pointById) };
  }, [coastlines]);

  const nmPerSvgUnit = useMemo(() => {
    const p0 = chartData.projection.projectLatLon(chartData.projection.midLat, chartData.projection.minLon);
    const p1 = chartData.projection.projectLatLon(chartData.projection.midLat, chartData.projection.minLon + 1);
    const pxPerDegLon = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const nmPerDegLon = 60 * Math.cos((chartData.projection.midLat * Math.PI) / 180);
    return nmPerDegLon / pxPerDegLon;
  }, [chartData.projection]);

  const scaleBar = useMemo(() => {
    const visibleNm = view.w * nmPerSvgUnit;
    const targetNm = visibleNm * 0.18;
    const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    const nm = candidates.reduce((best, value) => Math.abs(value - targetNm) < Math.abs(best - targetNm) ? value : best, candidates[0]);
    return { nm };
  }, [view.w, nmPerSvgUnit]);

  const uiScale = Math.min(1, Math.max(0.028, 1 / zoom));
  const filteredFixes = useMemo(() => filterFixes(rjccFixes, fixFilters), [fixFilters]);
  const filteredNavaids = useMemo(() => filterNavaids(rjccAirspaceNavaids, navaidFilters), [navaidFilters]);
  const filteredLocalizers = useMemo(() => filterLocalizers(rjccLocalizers, navaidFilters), [navaidFilters]);
  const procedures = useMemo(() => getAllProcedures(), []);
  const procedureOptions = useMemo(() => buildProcedureDisplayOptions(), []);
  const waypointLookup = useMemo(() => buildWaypointLookup(), []);
  const selectedChartOverlay = useMemo(() => getFirstAvailableChartOverlay(procedureState.selectedIds), [procedureState.selectedIds]);
  const selectedProcedurePointIds = useMemo(() => {
    const selectedIds = new Set(procedureState.selectedIds);
    const pointIds = new Set();
    for (const procedure of expandProcedureRouteEntries(procedures)) {
      if (!selectedIds.has(procedure.id)) continue;
      const preview = buildProcedureRoutePreview({ procedure, waypointLookup });
      for (const point of preview.points || []) {
        if (point.id) pointIds.add(point.id);
      }
    }
    return pointIds;
  }, [procedures, procedureState.selectedIds, waypointLookup]);

  const toggleLayer = (key) => setRadarLayerState((prev) => ({ ...prev, [key]: !prev[key] }));
  const setFixCategory = (category) => setFixFilters((prev) => ({ ...prev, category }));
  const setFixLabelMode = (labelMode) => setFixFilters((prev) => ({ ...prev, labelMode }));
  const toggleApproximateFixes = () => setFixFilters((prev) => ({ ...prev, includeApproximate: !prev.includeApproximate }));
  const toggleNavaidFilter = (key) => setNavaidFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  const setNavaidLabelMode = (labelMode) => setNavaidFilters((prev) => ({ ...prev, labelMode }));
  const toggleProcedureVisible = () => setProcedureState((prev) => ({ ...prev, show: !prev.show }));
  const setProcedureLabelMode = (labelMode) => setProcedureState((prev) => ({ ...prev, labelMode }));
  const setProcedureDetailMode = (detailMode) => setProcedureState((prev) => ({ ...prev, detailMode }));
  const toggleApproximateProcedureGeometry = () => setProcedureState((prev) => ({ ...prev, approximateGeometry: !prev.approximateGeometry }));
  const toggleChartOverlayMode = () => setChartOverlayState((prev) => ({ ...prev, mode: prev.mode === "auto" ? "off" : "auto" }));
  const adjustChartOpacity = (delta) => setChartOverlayState((prev) => ({ ...prev, opacity: Math.min(1, Math.max(0.05, prev.opacity + delta)) }));
  const toggleProcedureSelection = (procedureId) => setProcedureState((prev) => {
    const selected = new Set(prev.selectedIds);
    if (selected.has(procedureId)) selected.delete(procedureId);
    else selected.add(procedureId);
    return { ...prev, selectedIds: [...selected] };
  });
  const clientToSvgPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = (event.clientX - rect.left) / rect.width;
    const sy = (event.clientY - rect.top) / rect.height;
    return { x: view.x + sx * view.w, y: view.y + sy * view.h };
  };
  const zoomAt = (factor, center) => setView((prev) => {
    const nextW = Math.min(fullView.w / minZoom, Math.max(fullView.w / maxZoom, prev.w / factor));
    const nextH = nextW / viewportAspect;
    const rx = (center.x - prev.x) / prev.w;
    const ry = (center.y - prev.y) / prev.h;
    return { x: center.x - rx * nextW, y: center.y - ry * nextH, w: nextW, h: nextH };
  });
  const handleWheel = (event) => {
    setIsZooming(true);
    window.clearTimeout(zoomEndTimerRef.current);
    zoomEndTimerRef.current = window.setTimeout(() => setIsZooming(false), 140);
    zoomAt(event.deltaY < 0 ? 1.18 : 1 / 1.18, clientToSvgPoint(event));
  };
  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    setDragState({ pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, viewAtStart: view });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleMouseMove = (event) => {
    if (!dragState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragState.startClientX) / rect.width) * dragState.viewAtStart.w;
    const dy = ((event.clientY - dragState.startClientY) / rect.height) * dragState.viewAtStart.h;
    setView({ ...dragState.viewAtStart, x: dragState.viewAtStart.x - dx, y: dragState.viewAtStart.y - dy });
  };
  const stopDrag = (event) => {
    if (dragState?.pointerId !== undefined) event.currentTarget.releasePointerCapture?.(dragState.pointerId);
    setDragState(null);
  };
  const resetView = () => setView(fullView);
  const zoomIn = () => zoomAt(1.35, { x: view.x + view.w / 2, y: view.y + view.h / 2 });
  const zoomOut = () => zoomAt(1 / 1.35, { x: view.x + view.w / 2, y: view.y + view.h / 2 });

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, overflow: "hidden", background: "#071c20", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}>
      <div style={{ position: "absolute", left: 14, top: 14, zIndex: 10, display: "flex", gap: 6, padding: 6, background: "rgba(3,18,22,.78)", border: "1px solid rgba(95,168,179,.22)", borderRadius: 4, fontFamily: "monospace", userSelect: "none" }}>
        {Object.keys(defaultRadarLayerState).map((key) => <button key={key} type="button" onClick={() => toggleLayer(key)} style={{ ...toolbarButtonStyle, background: radarLayerState[key] ? "rgba(13,82,99,.52)" : "rgba(3,18,22,.42)", color: radarLayerState[key] ? "#9ed7df" : "#38636a" }}>{radarLayerLabels[key]}</button>)}
        <div style={{ width: 1, background: "rgba(95,168,179,.22)", margin: "0 2px" }} />
        <button type="button" onClick={zoomOut} style={toolbarButtonStyle}>-</button>
        <button type="button" onClick={zoomIn} style={toolbarButtonStyle}>+</button>
        <button type="button" onClick={resetView} style={toolbarButtonStyle}>RST</button>
        <span style={{ color: "#5fa8b3", fontSize: 11, padding: "4px 4px" }}>{zoom.toFixed(1)}x</span>
      </div>

      <div style={filterPanelStyle}>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>FIX</span>
          {FIX_FILTERS.map((filter) => (
            <button key={filter.id} type="button" onClick={() => setFixCategory(filter.id)} style={semanticButtonStyle(fixFilters.category === filter.id)}>{filter.label}</button>
          ))}
          <span style={filterStatusStyle}>{filteredFixes.length}/{rjccFixes.length}</span>
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>FIX OPT</span>
          <button type="button" onClick={toggleApproximateFixes} style={semanticButtonStyle(fixFilters.includeApproximate)}>APPROX {fixFilters.includeApproximate ? "ON" : "OFF"}</button>
          <span style={filterStatusStyle}>LABEL</span>
          {LABEL_MODES.map((mode) => (
            <button key={mode} type="button" onClick={() => setFixLabelMode(mode)} style={semanticButtonStyle(fixFilters.labelMode === mode)}>{mode.toUpperCase()}</button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>NAVAID</span>
          <button type="button" onClick={() => toggleNavaidFilter("vorDme")} style={semanticButtonStyle(navaidFilters.vorDme)}>VOR/DME</button>
          <button type="button" onClick={() => toggleNavaidFilter("tacan")} style={semanticButtonStyle(navaidFilters.tacan)}>TACAN</button>
          <button type="button" onClick={() => toggleNavaidFilter("ilsLoc")} style={semanticButtonStyle(navaidFilters.ilsLoc)}>ILS/LOC</button>
          <span style={filterStatusStyle}>{filteredNavaids.length}/{rjccAirspaceNavaids.length} + LOC {filteredLocalizers.length}</span>
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>NAV LAB</span>
          {LABEL_MODES.map((mode) => (
            <button key={mode} type="button" onClick={() => setNavaidLabelMode(mode)} style={semanticButtonStyle(navaidFilters.labelMode === mode)}>{mode.toUpperCase()}</button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>PROC</span>
          <button type="button" onClick={toggleProcedureVisible} style={semanticButtonStyle(procedureState.show)}>PROC {procedureState.show ? "ON" : "OFF"}</button>
          <span style={filterStatusStyle}>LABEL</span>
          {LABEL_MODES.map((mode) => (
            <button key={mode} type="button" onClick={() => setProcedureLabelMode(mode)} style={semanticButtonStyle(procedureState.labelMode === mode)}>{mode.toUpperCase()}</button>
          ))}
          <button type="button" onClick={toggleApproximateProcedureGeometry} style={semanticButtonStyle(procedureState.approximateGeometry)}>APPROX TURN {procedureState.approximateGeometry ? "ON" : "OFF"}</button>
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>DETAIL</span>
          {PROCEDURE_DETAIL_MODES.map((mode) => (
            <button key={mode} type="button" onClick={() => setProcedureDetailMode(mode)} style={semanticButtonStyle(procedureState.detailMode === mode)}>{mode.toUpperCase()}</button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>CHART</span>
          <button type="button" onClick={toggleChartOverlayMode} style={semanticButtonStyle(chartOverlayState.mode === "auto")}>CHART {chartOverlayState.mode === "auto" ? "AUTO" : "OFF"}</button>
          <button type="button" onClick={() => adjustChartOpacity(-0.05)} style={semanticButtonStyle(false)}>OP -</button>
          <button type="button" onClick={() => adjustChartOpacity(0.05)} style={semanticButtonStyle(false)}>OP +</button>
          <span style={filterStatusStyle}>OPACITY {Math.round(chartOverlayState.opacity * 100)}%</span>
          <span style={filterStatusStyle}>{selectedChartOverlay ? `当前航图: ${selectedChartOverlay.title || selectedChartOverlay.chartId}` : "当前航图: none"}</span>
        </div>
        <div style={filterGroupStyle}>
          <span style={filterLabelStyle}>ROUTE</span>
          {procedureOptions.map((option) => (
            <button key={option.id} type="button" onClick={() => toggleProcedureSelection(option.id)} style={semanticButtonStyle(procedureState.selectedIds.includes(option.id))}>{option.label}</button>
          ))}
        </div>
      </div>

      <ClearanceComposerPanel />

      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" onWheel={handleWheel} onPointerDown={handleMouseDown} onPointerMove={handleMouseMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onDoubleClick={(event) => event.preventDefault()} style={{ display: "block", cursor: dragState ? "grabbing" : "grab", touchAction: "none" }}>
        <defs>
          <marker id="smallArrow" viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 6 3 L 0 6 z" fill="#5fa8b3" /></marker>
          <marker id="smallArrowStart" viewBox="0 0 6 6" refX="0.5" refY="3" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth"><path d="M 6 0 L 0 3 L 6 6 z" fill="#5fa8b3" /></marker>
        </defs>
        <rect x={view.x - view.w * 2} y={view.y - view.h * 2} width={view.w * 5} height={view.h * 5} fill="#071c20" />
        <RjccJaipMapLayer
          projection={chartData.projection}
          view={view}
          zoom={zoom}
          uiScale={uiScale}
          isZooming={isZooming}
          showCoastline={radarLayerState.coastline}
          showContour={radarLayerState.contour}
          showAirports={radarLayerState.airports}
          showRunways={radarLayerState.runways}
          showFixes={radarLayerState.fixes}
          showNavaids={radarLayerState.navaids}
          showLocalizers={radarLayerState.navaids && navaidFilters.ilsLoc}
          showProcedures={procedureState.show}
          showAca={radarLayerState.aca}
          coastlines={coastlines}
          fixes={filteredFixes}
          navaids={filteredNavaids}
          localizers={filteredLocalizers}
          procedures={procedures}
          selectedProcedureIds={procedureState.selectedIds}
          procedureLabelMode={procedureState.labelMode}
          procedureDetailMode={procedureState.detailMode}
          showApproximateProcedureGeometry={procedureState.approximateGeometry}
          chartOverlay={selectedChartOverlay}
          showChartOverlay={chartOverlayState.mode === "auto" && Boolean(selectedChartOverlay)}
          chartOverlayOpacity={chartOverlayState.opacity}
          waypointLookup={waypointLookup}
          suppressedFixLabelIds={selectedProcedurePointIds}
          fixLabelMode={fixFilters.labelMode}
          navaidLabelMode={navaidFilters.labelMode}
          pointById={chartData.pointById}
          paths={chartData.paths}
        />
      </svg>

      <div style={{ position: "absolute", left: 24, bottom: 22, zIndex: 10, color: "#5fa8b3", fontFamily: "monospace", fontSize: 11, userSelect: "none", pointerEvents: "none" }}>
        <svg width="220" height="34" viewBox="0 0 220 34" style={{ display: "block" }}>
          <line x1="0" y1="16" x2="110" y2="16" stroke="#5fa8b3" strokeWidth="1" />
          <line x1="0" y1="10" x2="0" y2="22" stroke="#5fa8b3" strokeWidth="1" />
          <line x1="110" y1="10" x2="110" y2="22" stroke="#5fa8b3" strokeWidth="1" />
          <text x="0" y="32" fill="#5fa8b3" fontFamily="monospace" fontSize="11">0</text>
          <text x="110" y="32" fill="#5fa8b3" fontFamily="monospace" fontSize="11" textAnchor="middle">{scaleBar.nm} NM</text>
        </svg>
      </div>
    </div>
  );
}
