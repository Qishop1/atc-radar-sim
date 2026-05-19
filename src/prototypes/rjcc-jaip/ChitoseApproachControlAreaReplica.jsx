import React, { useEffect, useMemo, useState } from "react";
import { rawPoints } from "../../data/jaip/rjcc/acaPoints.js";
import { rawNavaids } from "../../data/jaip/rjcc/navaids.js";
import rjccCoastlineHires from "../../data/jaip/rjcc/rjcc_coastline_hires.json";
import { parseDMS } from "../../geo/dms.js";
import { RjccJaipMapLayer } from "../../map/jaip/RjccJaipMapLayer.jsx";
import { makePathHelpers } from "../../map/jaip/pathHelpers.js";

const SVG = { width: 1000, height: 930 };
const defaultRadarLayerState = { coastline: true, contour: true, aca: true, airports: true, runways: true };
const radarLayerLabels = { coastline: "COAST", contour: "CONTOUR", aca: "ACA", airports: "AIRPORT", runways: "RWY" };
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
  const coastlines = importedCoastlines?.length ? importedCoastlines : rjccCoastlineHires;
  const [radarLayerState, setRadarLayerState] = useState(defaultRadarLayerState);
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

  const toggleLayer = (key) => setRadarLayerState((prev) => ({ ...prev, [key]: !prev[key] }));
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
          showAca={radarLayerState.aca}
          coastlines={coastlines}
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
