import React, { useEffect, useMemo, useRef, useState } from "react";
import { airports as rjccAirports } from "../../data/airspace/rjcc/airports.js";
import { fixes as rjccFixes } from "../../data/airspace/rjcc/fixes.js";
import { localizers as rjccLocalizers } from "../../data/airspace/rjcc/localizers.js";
import { navaids as rjccNavaids } from "../../data/airspace/rjcc/navaids.js";
import { runways as rjccRunways } from "../../data/airspace/rjcc/runways.js";
import { rawNavaids } from "../../data/jaip/rjcc/navaids.js";
import { rawPoints } from "../../data/jaip/rjcc/acaPoints.js";
import rjccCoastlineHires from "../../data/jaip/rjcc/rjcc_coastline_hires.json";
import { parseDMS } from "../../geo/dms.js";
import { buildProcedureDisplayOptions, getAllProcedures } from "../../core-v2/procedures/procedureLookup.js";
import { RjccJaipMapLayer } from "../../map/jaip/RjccJaipMapLayer.jsx";
import { makePathHelpers } from "../../map/jaip/pathHelpers.js";
import { LABEL_MODES, defaultFixFilterState, defaultNavaidFilterState, filterFixes, filterLocalizers, filterNavaids } from "../../map/jaip/semanticFilters.js";
import { buildAnchorFrame, anchorUvToProjected, normalizeTracePoints, projectedToAnchorUv } from "./anchorTraceTransform.js";
import { CHART_OVERLAY_OPTIONS, ChartOverlayLayer, DEFAULT_OVERLAY_TRANSFORM } from "./ChartOverlayLayer.jsx";
import { ConstructionOverlayLayer } from "./ConstructionOverlayLayer.jsx";
import { buildRadialDmePoint, projectPointToRadial, snapPointToDmeCircle, nearestPointOnPolyline } from "./constructionGeometry.js";
import { deriveProcedureTraceSetup } from "./deriveProcedureTraceSetup.js";
import { getManualPreviewPreset, manualPreviewPresets } from "./manualPreviewPresets.js";
import { getRepresentativeDepartureEnd, getRunwayEndById } from "./runwayAnchors.js";
import { TRACE_TYPES, TraceEditorLayer } from "./TraceEditorLayer.jsx";
import { buildWaypointSnapTargets, filterWaypointSnapTargets, findWaypointSnapTargetById } from "./waypointSnapTargets.js";

const SVG = { width: 1000, height: 930 };
const FALLBACK_BOUNDS = { minLat: 41.0, maxLat: 45.8, minLon: 139.0, maxLon: 146.5 };
const DEFAULT_TRACE_ID = "KURIS_SEVEN_RWY19";
const PROCEDURE_ID_PATTERN = /^[A-Z0-9_]+$/;
const ACCEPTED_CHART_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const CONSTRUCTION_PRESETS = ["NONE", "KURIS_7_RWY19", "KURIS_7_RWY01", "CHITOSE_4_RWY01", "CUSTOM"];
const STATION_IDS = ["CHE", "MKE", "SPE", "HWE"];
const DEFAULT_MAGNETIC_VARIATION_DEG = -9;
const ANCHOR_LABELS = {
  CHE: "CHE",
  KURIS: "KURIS",
  RJCC: "RJCC",
  RJCC_RWY01_REPRESENTATIVE: "RWY01代表离场端",
  RJCC_RWY19_REPRESENTATIVE: "RWY19代表离场端",
  RJCC_01L: "RWY01L",
  RJCC_01R: "RWY01R",
  RJCC_19L: "RWY19L",
  RJCC_19R: "RWY19R",
};
const PRESET_LABELS = {
  NONE: "无",
  KURIS_7_RWY19: "KURIS 7 RWY19",
  KURIS_7_RWY01: "KURIS 7 RWY01",
  CHITOSE_4_RWY01: "CHITOSE 4 RWY01",
  CUSTOM: "自定义",
};
const KIND_LABELS = {
  RADIAL: "径向线",
  DME_CIRCLE: "DME圆",
  DME_ARC: "DME弧",
  AUX_LINE: "辅助线",
  MARKER: "标记",
  ANCHOR: "锚点",
};
const TRACE_TYPE_LABELS = {
  SOLID_ROUTE: "实线路径",
  APPROX_TURN: "近似转弯",
  RADIAL: "径向段",
  CONNECTOR: "连接线",
};

const buttonStyle = {
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

const panelStyle = {
  position: "absolute",
  zIndex: 12,
  padding: 8,
  background: "rgba(3,18,22,.78)",
  border: "1px solid rgba(95,168,179,.26)",
  borderRadius: 4,
  fontFamily: "monospace",
  color: "#9ed7df",
  userSelect: "none",
};

const rowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 5,
  marginBottom: 5,
};

const inputStyle = {
  background: "#071c20",
  color: "#d8fbff",
  border: "1px solid rgba(95,168,179,.45)",
  padding: 4,
  fontFamily: "monospace",
  fontSize: 11,
};

const sectionStyle = {
  borderTop: "1px solid rgba(95,168,179,.2)",
  paddingTop: 7,
  marginTop: 7,
};

const summaryStyle = {
  color: "#d8fbff",
  cursor: "pointer",
  fontWeight: 900,
  marginBottom: 6,
 };

function activeButtonStyle(active) {
  return {
    ...buttonStyle,
    background: active ? "rgba(13,82,99,.62)" : "rgba(3,18,22,.38)",
    color: active ? "#d8fbff" : "#5f9da7",
    borderColor: active ? "rgba(126,198,207,.66)" : "rgba(95,168,179,.25)",
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
  if (aspect >= svgAspect) return makeViewByAspect(SVG.width / 2, SVG.height / 2, SVG.height * aspect, aspect);
  return makeViewByAspect(SVG.width / 2, SVG.height / 2, SVG.width, aspect);
}

function boundsFromCoastlines(coastlines, marginRatio = 0.035) {
  const coords = coastlines.flat().filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
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
  const xyToLatLon = (x, y) => ({
    lat: maxLat - ((y - offsetY) / scale),
    lon: minLon + ((x - offsetX) / (cosLat * scale)),
  });
  return { minLat, maxLat, minLon, maxLon, midLat, cosLat, scale, projectLatLon, xyToLatLon };
}

function decodeReferenceItems() {
  return [
    ...rawPoints.map(([id, latDms, lonDms]) => ({ id, lat: parseDMS(latDms), lon: parseDMS(lonDms) })),
    ...rawNavaids.map(([id, latDms, lonDms]) => ({ id, lat: parseDMS(latDms), lon: parseDMS(lonDms) })),
  ];
}

function projectReferenceItems(items, projection) {
  return items.map((point) => ({ ...point, ...projection.projectLatLon(point.lat, point.lon) }));
}

function clientToSvgPoint(event, view) {
  const rect = event.currentTarget.getBoundingClientRect();
  const sx = (event.clientX - rect.left) / rect.width;
  const sy = (event.clientY - rect.top) / rect.height;
  return { x: view.x + sx * view.w, y: view.y + sy * view.h };
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function makeTracePoint(point, projection, index, id) {
  const latLon = projection.xyToLatLon?.(point.x, point.y);
  return {
    id: id || `P${index + 1}`,
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
    lat: formatNumber(latLon?.lat),
    lon: formatNumber(latLon?.lon),
  };
}

function formatProjectedPoint(point) {
  return {
    x: round(point.x, 2),
    y: round(point.y, 2),
    ...(point.lat != null && point.lon != null ? { lat: point.lat, lon: point.lon } : {}),
  };
}

function serializeConstructionItem(item) {
  const data = { ...(item?.data || {}) };
  if (Array.isArray(data.points)) data.points = data.points.map((point) => ({ x: round(point.x, 2), y: round(point.y, 2) }));
  if (data.point) data.point = { x: round(data.point.x, 2), y: round(data.point.y, 2), lat: round(data.point.lat, 6), lon: round(data.point.lon, 6) };
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    visible: item.visible,
    locked: !!item.locked,
    createdBy: item.createdBy || "user",
    approximate: item.approximate !== false,
    data,
  };
}

function buildExportPayload({ traceId, traceType, points, notes, overlay, anchorExport, constructionItems, coordinateSpace }) {
  const rawProjectedPoints = points.map(formatProjectedPoint);
  const useAnchorNormalized = coordinateSpace === "anchor-normalized" && anchorExport?.points?.length === points.length;
  const base = {
    id: traceId || DEFAULT_TRACE_ID,
    type: "MANUAL_TRACE",
    traceType,
    approximate: true,
    source: "manual chart trace",
    coordinateSpace: useAnchorNormalized ? "anchor-normalized" : "rjcc-projected",
    points: useAnchorNormalized ? anchorExport.points : rawProjectedPoints,
    ...(useAnchorNormalized && anchorExport?.anchorFrame ? { anchorFrame: anchorExport.anchorFrame } : {}),
    rawProjectedPoints,
    constructionItems: (constructionItems || []).map(serializeConstructionItem),
    overlay,
    notes: notes || "Display-only traced preview; not authoritative navigation geometry.",
  };
  return base;
}

function validProcedureId(id) {
  return PROCEDURE_ID_PATTERN.test(id || "");
}

function normalizeChartFilename(filename, fallback = "chart.png") {
  const base = (filename || fallback).split(/[\\/]/).pop() || fallback;
  return base.replace(/\s+/g, "_").replace(/[^A-Za-z0-9._-]/g, "_");
}

function downloadTextFile(filename, content, mimeType = "text/javascript;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildManualPreviewFile({ procedureId, payload }) {
  const objectText = JSON.stringify(payload, null, 2);
  return `// src/data/airspace/rjcc/manual-previews/${procedureId}.js
// Display-only manual procedure preview geometry.
// Not authoritative navigation data. Not used by gameplay.

export const ${procedureId} = ${objectText};
`;
}

function buildChartOverlayFile({ chartId, chartOverlay }) {
  const constName = `${chartId}_CHART_OVERLAY`;
  const objectText = JSON.stringify(chartOverlay, null, 2);
  return `// src/data/airspace/rjcc/chart-overlays/${chartId}.chartOverlay.js
// Display-only shared chart image overlay transform.
// Not authoritative navigation data. Not used by gameplay.

export const ${constName} = ${objectText};
`;
}

function normalizeBearing(deg) {
  return ((deg % 360) + 360) % 360;
}

function trueBearingFromInput(radialDeg, bearingType, magneticVariationDeg) {
  return normalizeBearing(Number(radialDeg) + (bearingType === "MAGNETIC" ? Number(magneticVariationDeg) || 0 : 0));
}

function formatBearing(value) {
  return String(Math.round(normalizeBearing(value))).padStart(3, "0");
}

function radialLabel({ stationId, radialDeg, bearingType, magneticVariationDeg }) {
  const trueBearingDeg = trueBearingFromInput(radialDeg, bearingType, magneticVariationDeg);
  return `${stationId} R${formatBearing(radialDeg)} ${bearingType === "MAGNETIC" ? "MAG" : "TRUE"} / true ${formatBearing(trueBearingDeg)}°`;
}

function makeConstructionItem(kind, label, data, createdBy = "user") {
  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    kind,
    label,
    visible: true,
    locked: false,
    data,
    createdBy,
    approximate: true,
  };
}

function clampScale(scale) {
  return Math.max(0.02, Math.min(8, scale));
}

function isEditableTarget(target) {
  const tagName = target?.tagName?.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable;
}

function stationById(items, id) {
  return items.find((item) => item.id === id) || null;
}

function presetAnchors(preset) {
  if (preset === "KURIS_7_RWY01") return { originId: "CHE", axisTargetId: "KURIS", startId: "RJCC_RWY01_REPRESENTATIVE", finalId: "KURIS" };
  if (preset === "CHITOSE_4_RWY01") return { originId: "CHE", axisTargetId: "KURIS", startId: "RJCC_RWY01_REPRESENTATIVE", finalId: "CHE" };
  return { originId: "CHE", axisTargetId: "KURIS", startId: "RJCC_RWY19_REPRESENTATIVE", finalId: "KURIS" };
}

export default function RjccProcedureTraceEditor() {
  const [viewportAspect, setViewportAspect] = useState(getViewportAspect);
  const [view, setView] = useState(() => makeFullViewByAspect(getViewportAspect()));
  const [dragState, setDragState] = useState(null);
  const [isZooming, setIsZooming] = useState(false);
  const [interactionMode, setInteractionMode] = useState("trace");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [selectedChartId, setSelectedChartId] = useState(CHART_OVERLAY_OPTIONS[0].id);
  const [droppedChart, setDroppedChart] = useState(null);
  const [dropMessage, setDropMessage] = useState("拖入 PNG/JPG/WebP 航图");
  const [dragOver, setDragOver] = useState(false);
  const [overlayTransform, setOverlayTransform] = useState(DEFAULT_OVERLAY_TRANSFORM);
  const [nudgeStep, setNudgeStep] = useState(5);
  const [traceId, setTraceId] = useState(DEFAULT_TRACE_ID);
  const [traceType, setTraceType] = useState("APPROX_TURN");
  const [tracePoints, setTracePoints] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [mapLabelMode, setMapLabelMode] = useState("on");
  const [manualPresetId, setManualPresetId] = useState(DEFAULT_TRACE_ID);
  const [resolvedChartId, setResolvedChartId] = useState("KURIS_SEVEN");
  const [resolvedChartTitle, setResolvedChartTitle] = useState("KURIS SEVEN");
  const [resolvedChartFilename, setResolvedChartFilename] = useState("KURIS_SEVEN.png");
  const [resolvedCoordinateSpace, setResolvedCoordinateSpace] = useState("anchor-normalized");
  const [autoSetupWarnings, setAutoSetupWarnings] = useState([]);
  const [autoSetupStatus, setAutoSetupStatus] = useState("");
  const [showIdWorkflowHelp, setShowIdWorkflowHelp] = useState(false);
  const [constructionPreset, setConstructionPreset] = useState("NONE");
  const [showRadials, setShowRadials] = useState(true);
  const [showDme, setShowDme] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [showAux, setShowAux] = useState(true);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showConstructionLabels, setShowConstructionLabels] = useState(true);
  const [originAnchorId, setOriginAnchorId] = useState("CHE");
  const [axisTargetAnchorId, setAxisTargetAnchorId] = useState("KURIS");
  const [startAnchorId, setStartAnchorId] = useState("RJCC_RWY19_REPRESENTATIVE");
  const [finalAnchorId, setFinalAnchorId] = useState("KURIS");
  const [constructionStationId, setConstructionStationId] = useState("CHE");
  const [radialDegInput, setRadialDegInput] = useState(11);
  const [radialLengthNmInput, setRadialLengthNmInput] = useState(35);
  const [bearingType, setBearingType] = useState("MAGNETIC");
  const [magneticVariationDeg, setMagneticVariationDeg] = useState(DEFAULT_MAGNETIC_VARIATION_DEG);
  const [dmeRadiusNmInput, setDmeRadiusNmInput] = useState(2);
  const [arcRadiusNmInput, setArcRadiusNmInput] = useState(6);
  const [arcStartBearingInput, setArcStartBearingInput] = useState(330);
  const [arcEndBearingInput, setArcEndBearingInput] = useState(30);
  const [constructionItems, setConstructionItems] = useState([]);
  const [selectedConstructionItemId, setSelectedConstructionItemId] = useState(null);
  const [constructionClickMode, setConstructionClickMode] = useState("none");
  const [auxDraftPoint, setAuxDraftPoint] = useState(null);
  const [waypointSnapQuery, setWaypointSnapQuery] = useState("");
  const [selectedWaypointSnapTargetId, setSelectedWaypointSnapTargetId] = useState("KURIS");
  const [snapMessage, setSnapMessage] = useState("");
  const [notes, setNotes] = useState("Display-only traced preview; not authoritative navigation geometry.");
  const zoomEndTimerRef = useRef(null);
  const droppedObjectUrlRef = useRef(null);

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

  useEffect(() => () => {
    if (droppedObjectUrlRef.current) URL.revokeObjectURL(droppedObjectUrlRef.current);
  }, []);

  const fullView = useMemo(() => makeFullViewByAspect(viewportAspect), [viewportAspect]);
  const zoom = fullView.w / view.w;
  const uiScale = Math.min(1, Math.max(0.028, 1 / zoom));
  const selectedBaseChart = CHART_OVERLAY_OPTIONS.find((chart) => chart.id === selectedChartId) || CHART_OVERLAY_OPTIONS[0];
  const selectedChart = selectedChartId === "custom" && droppedChart ? droppedChart : selectedBaseChart;
  const selectedManualPreset = getManualPreviewPreset(manualPresetId);

  const chartData = useMemo(() => {
    const bounds = boundsFromCoastlines(rjccCoastlineHires);
    const projection = buildFixedBoundsProjection(bounds);
    const projectedItems = projectReferenceItems(decodeReferenceItems(), projection);
    const pointById = Object.fromEntries(projectedItems.map((point) => [point.id, point]));
    return { projection, pointById, paths: makePathHelpers(pointById) };
  }, []);

  const anchorData = useMemo(() => {
    const projection = chartData.projection;
    const fixById = Object.fromEntries(rjccFixes.map((fix) => [fix.id, fix]));
    const navaidById = Object.fromEntries(rjccNavaids.map((navaid) => [navaid.id, navaid]));
    const airportById = Object.fromEntries(rjccAirports.map((airport) => [airport.id, airport]));
    const rawAnchors = {
      CHE: { ...navaidById.CHE, label: "CHE" },
      KURIS: { ...fixById.KURIS, label: "KURIS" },
      RJCC: { ...airportById.RJCC, label: "RJCC" },
      RJCC_RWY01_REPRESENTATIVE: getRepresentativeDepartureEnd(rjccRunways, "RJCC", ["01L", "01R"]),
      RJCC_RWY19_REPRESENTATIVE: getRepresentativeDepartureEnd(rjccRunways, "RJCC", ["19L", "19R"]),
      RJCC_01L: getRunwayEndById(rjccRunways, "RJCC", "01L"),
      RJCC_01R: getRunwayEndById(rjccRunways, "RJCC", "01R"),
      RJCC_19L: getRunwayEndById(rjccRunways, "RJCC", "19L"),
      RJCC_19R: getRunwayEndById(rjccRunways, "RJCC", "19R"),
    };
    const anchors = Object.fromEntries(
      Object.entries(rawAnchors)
        .map(([id, anchor]) => {
          if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) return [id, null];
          const projected = projection.projectLatLon(anchor.lat, anchor.lon);
          if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return [id, null];
          return [id, { ...anchor, id, label: ANCHOR_LABELS[id] || anchor.label || id, ...projected }];
        })
        .filter(([, anchor]) => anchor)
    );
    const anchorOptions = Object.entries(anchors).map(([id, anchor]) => ({ id, label: anchor.label || id }));
    return { anchors, anchorOptions, fixById, navaidById, airportById };
  }, [chartData.projection]);

  const filteredFixes = useMemo(() => filterFixes(rjccFixes, { ...defaultFixFilterState, labelMode: "off" }), []);
  const filteredNavaids = useMemo(() => filterNavaids(rjccNavaids, { ...defaultNavaidFilterState, labelMode: "off" }), []);
  const filteredLocalizers = useMemo(() => filterLocalizers(rjccLocalizers, defaultNavaidFilterState), []);
  const stationOptions = useMemo(() => STATION_IDS.map((id) => stationById(rjccNavaids, id)).filter(Boolean), []);
  const procedureOptions = useMemo(() => buildProcedureDisplayOptions(), []);
  const proceduresForSetup = useMemo(() => getAllProcedures(), []);
  const waypointSnapTargets = useMemo(() => buildWaypointSnapTargets({
    fixes: rjccFixes,
    navaids: rjccNavaids,
    runways: rjccRunways,
    airports: rjccAirports,
    projection: chartData.projection,
  }), [chartData.projection]);
  const filteredWaypointSnapTargets = useMemo(
    () => filterWaypointSnapTargets(waypointSnapQuery, waypointSnapTargets),
    [waypointSnapQuery, waypointSnapTargets]
  );
  const selectedWaypointSnapTarget = useMemo(
    () => findWaypointSnapTargetById(selectedWaypointSnapTargetId, waypointSnapTargets) || filteredWaypointSnapTargets[0] || null,
    [filteredWaypointSnapTargets, selectedWaypointSnapTargetId, waypointSnapTargets]
  );
  const selectedStation = stationById(rjccNavaids, constructionStationId) || stationOptions[0];
  const anchorConfig = useMemo(() => ({
    originId: originAnchorId,
    axisTargetId: axisTargetAnchorId,
    startId: startAnchorId,
    finalId: finalAnchorId,
    origin: anchorData.anchors[originAnchorId],
    axisTarget: anchorData.anchors[axisTargetAnchorId],
    start: anchorData.anchors[startAnchorId],
    final: anchorData.anchors[finalAnchorId],
  }), [anchorData.anchors, axisTargetAnchorId, finalAnchorId, originAnchorId, startAnchorId]);
  const anchorFrame = useMemo(() => buildAnchorFrame({ originPoint: anchorConfig.origin, axisTargetPoint: anchorConfig.axisTarget }), [anchorConfig]);
  const selectedConstructionItem = constructionItems.find((item) => item.id === selectedConstructionItemId) || null;
  const anchorExport = useMemo(() => {
    if (!anchorFrame) return null;
    return {
      anchorFrame: {
        originId: originAnchorId,
        axisToId: axisTargetAnchorId,
        startId: startAnchorId,
        finalId: finalAnchorId,
      },
      points: normalizeTracePoints(tracePoints, anchorFrame),
    };
  }, [anchorFrame, axisTargetAnchorId, finalAnchorId, originAnchorId, startAnchorId, tracePoints]);
  const exportChartFilename = normalizeChartFilename(
    resolvedChartFilename || droppedChart?.fileName || selectedManualPreset?.suggestedChartFilename || selectedChart.fileName || selectedChart.label,
    `${traceId || DEFAULT_TRACE_ID}.png`
  );
  const overlayExport = useMemo(() => ({
    chartId: resolvedChartId || selectedManualPreset?.chartId || selectedChart.id,
    filename: exportChartFilename,
    imageUrl: `/charts/rjcc/${exportChartFilename}`,
    width: selectedChart.width || 520,
    height: selectedChart.height || 720,
    x: Number(overlayTransform.x.toFixed(2)),
    y: Number(overlayTransform.y.toFixed(2)),
    scale: Number(overlayTransform.scale.toFixed(4)),
    rotationDeg: Number(overlayTransform.rotationDeg.toFixed(2)),
    opacity: Number(overlayTransform.opacity.toFixed(3)),
  }), [exportChartFilename, overlayTransform, resolvedChartId, selectedChart.id, selectedManualPreset]);
  const exportPayload = useMemo(
    () => buildExportPayload({ traceId, traceType, points: tracePoints, notes, overlay: overlayExport, anchorExport, constructionItems, coordinateSpace: resolvedCoordinateSpace }),
    [anchorExport, constructionItems, notes, overlayExport, resolvedCoordinateSpace, traceId, tracePoints, traceType]
  );
  const jsonExport = useMemo(() => JSON.stringify(exportPayload, null, 2), [exportPayload]);
  const jsExport = useMemo(() => `export const manualProcedurePreviewGeometry = {\n  ${JSON.stringify(exportPayload.id)}: ${jsonExport}\n};\n`, [exportPayload.id, jsonExport]);
  const exportProcedureId = validProcedureId(traceId) ? traceId : DEFAULT_TRACE_ID;
  const manualPreviewFilePayload = useMemo(() => ({
    ...exportPayload,
    id: exportProcedureId,
    traceType,
    coordinateSpace: exportPayload.coordinateSpace,
    anchorFrame: exportPayload.anchorFrame,
    construction: {
      constructionItems: exportPayload.constructionItems,
    },
    overlay: overlayExport,
  }), [exportPayload, exportProcedureId, overlayExport, traceType]);
  const manualPreviewFileContent = useMemo(
    () => buildManualPreviewFile({ procedureId: exportProcedureId, payload: manualPreviewFilePayload }),
    [exportProcedureId, manualPreviewFilePayload]
  );
  const exportChartId = resolvedChartId || overlayExport.chartId || exportProcedureId;
  const chartOverlayPayload = useMemo(() => ({
    id: `${exportChartId}_CHART_OVERLAY`,
    chartId: exportChartId,
    procedureIds: [exportProcedureId],
    title: resolvedChartTitle || selectedManualPreset?.chartTitle || exportProcedureId.replace(/_/g, " "),
    imageUrl: overlayExport.imageUrl,
    width: overlayExport.width,
    height: overlayExport.height,
    approximate: true,
    source: "manual chart overlay transform",
    transform: {
      x: overlayExport.x,
      y: overlayExport.y,
      scale: overlayExport.scale,
      rotationDeg: overlayExport.rotationDeg,
      opacity: overlayExport.opacity,
    },
    notes: "Chart overlay is a visual reference only. AIP SID sketch is not georeferenced.",
  }), [exportChartId, exportProcedureId, overlayExport, resolvedChartTitle, selectedManualPreset]);
  const chartOverlayFileContent = useMemo(
    () => buildChartOverlayFile({ chartId: exportChartId, chartOverlay: chartOverlayPayload }),
    [chartOverlayPayload, exportChartId]
  );
  const manualIndexImportSnippet = `import { ${exportProcedureId} } from "./${exportProcedureId}.js";`;
  const manualIndexEntrySnippet = `[${exportProcedureId}.id]: ${exportProcedureId},`;
  const chartOverlayConstName = `${exportChartId}_CHART_OVERLAY`;
  const chartIndexImportSnippet = `import { ${chartOverlayConstName} } from "./${exportChartId}.chartOverlay.js";`;
  const chartIndexEntrySnippet = `[${chartOverlayConstName}.chartId]: ${chartOverlayConstName},`;

  const updateOverlay = (patch) => setOverlayTransform((prev) => ({ ...prev, ...patch }));
  const nudgeOverlay = (dx, dy) => setOverlayTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  const scaleOverlay = (factor, center) => setOverlayTransform((prev) => {
    const nextScale = clampScale(prev.scale * factor);
    const appliedFactor = nextScale / prev.scale;
    if (!center) return { ...prev, scale: nextScale };
    return {
      ...prev,
      x: center.x - (center.x - prev.x) * appliedFactor,
      y: center.y - (center.y - prev.y) * appliedFactor,
      scale: nextScale,
    };
  });
  const rotateOverlay = (delta) => setOverlayTransform((prev) => ({ ...prev, rotationDeg: prev.rotationDeg + delta }));
  const resetOverlay = () => setOverlayTransform(DEFAULT_OVERLAY_TRANSFORM);
  const resetView = () => setView(fullView);
  const applyResolvedSetup = (setup) => {
    if (!setup) return;
    if (setup.procedureId) setTraceId(setup.procedureId);
    if (setup.chartId) setResolvedChartId(setup.chartId);
    if (setup.chartTitle) setResolvedChartTitle(setup.chartTitle);
    if (setup.chartFilename) setResolvedChartFilename(setup.chartFilename);
    if (setup.traceType) setTraceType(setup.traceType);
    if (setup.coordinateSpace) setResolvedCoordinateSpace(setup.coordinateSpace);
    if (setup.anchorFrame?.originId) setOriginAnchorId(setup.anchorFrame.originId);
    if (setup.anchorFrame?.axisToId) setAxisTargetAnchorId(setup.anchorFrame.axisToId);
    if (setup.anchorFrame?.startId) setStartAnchorId(setup.anchorFrame.startId);
    if (setup.anchorFrame?.finalId) setFinalAnchorId(setup.anchorFrame.finalId);
    const construction = setup.constructionDefaults || {};
    if (construction.stationId) setConstructionStationId(construction.stationId);
    if (Number.isFinite(construction.radialDeg)) setRadialDegInput(construction.radialDeg);
    if (construction.bearingType) setBearingType(construction.bearingType);
    if (Number.isFinite(construction.magneticVariationDeg)) setMagneticVariationDeg(construction.magneticVariationDeg);
    if (construction.dmeNm?.length) setDmeRadiusNmInput(construction.dmeNm[0]);
  };
  const handleAutoDeriveSetup = () => {
    const result = deriveProcedureTraceSetup({
      procedureId: traceId,
      procedures: proceduresForSetup,
      fixes: rjccFixes,
      navaids: rjccNavaids,
      runways: rjccRunways,
      airports: rjccAirports,
    });
    applyResolvedSetup(result.setup);
    setAutoSetupWarnings(result.warnings || []);
    setAutoSetupStatus(result.warnings?.length ? "已自动解析，存在需要人工确认的项目" : "已自动解析");
  };
  const applyManualPreviewPreset = () => {
    const preset = selectedManualPreset;
    if (!preset) return;
    const anchorFrame = preset.anchorFrame || {};
    const constructionDefaults = preset.constructionDefaults || {};
    setTraceId(preset.procedureId);
    setTraceType(preset.traceType || "APPROX_TURN");
    if (anchorFrame.originId) setOriginAnchorId(anchorFrame.originId);
    if (anchorFrame.axisToId) setAxisTargetAnchorId(anchorFrame.axisToId);
    if (anchorFrame.startId) setStartAnchorId(anchorFrame.startId);
    if (anchorFrame.finalId) setFinalAnchorId(anchorFrame.finalId);
    setConstructionStationId(constructionDefaults.stationId || "CHE");
    if (Number.isFinite(constructionDefaults.radialDeg)) setRadialDegInput(constructionDefaults.radialDeg);
    setBearingType(constructionDefaults.bearingType || "MAGNETIC");
    setMagneticVariationDeg(constructionDefaults.magneticVariationDeg ?? DEFAULT_MAGNETIC_VARIATION_DEG);
    if (constructionDefaults.dmeNm?.length) setDmeRadiusNmInput(constructionDefaults.dmeNm[0]);
    setResolvedChartId(preset.chartId || preset.procedureId);
    setResolvedChartTitle(preset.chartTitle || preset.procedureId.replace(/_/g, " "));
    setResolvedChartFilename(preset.suggestedChartFilename || `${preset.chartId || preset.procedureId}.png`);
    setResolvedCoordinateSpace(preset.coordinateSpace || "anchor-normalized");
    setSelectedChartId(preset.chartOptionId || preset.chartId || preset.procedureId);
    setAutoSetupWarnings([]);
    setAutoSetupStatus("已应用预设");
    if (preset.id === "KURIS_SEVEN_RWY19") setConstructionPreset("KURIS_7_RWY19");
    else if (preset.id === "KURIS_SEVEN_RWY01") setConstructionPreset("KURIS_7_RWY01");
    else if (preset.id === "CHITOSE_FOUR_RWY01") setConstructionPreset("CHITOSE_4_RWY01");
    else setConstructionPreset("NONE");
  };
  const applyPreset = (preset) => {
    setConstructionPreset(preset);
    const anchors = presetAnchors(preset);
    setOriginAnchorId(anchors.originId);
    setAxisTargetAnchorId(anchors.axisTargetId);
    setStartAnchorId(anchors.startId);
    setFinalAnchorId(anchors.finalId);
    if (preset === "KURIS_7_RWY19") {
      setTraceId("KURIS_SEVEN_RWY19");
      setResolvedChartId("KURIS_SEVEN");
      setResolvedChartTitle("KURIS SEVEN");
      setResolvedChartFilename("KURIS_SEVEN.png");
      setResolvedCoordinateSpace("anchor-normalized");
      setConstructionStationId("CHE");
      setRadialDegInput(11);
      setBearingType("MAGNETIC");
      setMagneticVariationDeg(DEFAULT_MAGNETIC_VARIATION_DEG);
      setDmeRadiusNmInput(2);
    } else if (preset === "KURIS_7_RWY01") {
      setTraceId("KURIS_SEVEN_RWY01");
      setResolvedChartId("KURIS_SEVEN");
      setResolvedChartTitle("KURIS SEVEN");
      setResolvedChartFilename("KURIS_SEVEN.png");
      setResolvedCoordinateSpace("anchor-normalized");
      setConstructionStationId("CHE");
      setRadialDegInput(11);
      setBearingType("MAGNETIC");
      setMagneticVariationDeg(DEFAULT_MAGNETIC_VARIATION_DEG);
      setDmeRadiusNmInput(2);
    } else if (preset === "CHITOSE_4_RWY01") {
      setTraceId("CHITOSE_FOUR_RWY01");
      setResolvedChartId("CHITOSE_FOUR");
      setResolvedChartTitle("CHITOSE FOUR");
      setResolvedChartFilename("CHITOSE_FOUR.png");
      setResolvedCoordinateSpace("anchor-normalized");
      setConstructionStationId("CHE");
      setRadialDegInput(330);
      setBearingType("MAGNETIC");
      setMagneticVariationDeg(DEFAULT_MAGNETIC_VARIATION_DEG);
      setDmeRadiusNmInput(6.3);
    }
  };
  const addConstructionItems = (items) => {
    setConstructionItems((prev) => [...prev, ...items]);
    if (items[0]) setSelectedConstructionItemId(items[0].id);
  };
  const removeConstructionItem = (itemId) => {
    setConstructionItems((prev) => prev.filter((item) => item.id !== itemId));
    if (selectedConstructionItemId === itemId) setSelectedConstructionItemId(null);
  };
  const updateConstructionItem = (itemId, patch) => {
    setConstructionItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };
  const clearConstructionItems = (kind) => {
    setConstructionItems((prev) => (kind ? prev.filter((item) => item.kind !== kind) : []));
    setSelectedConstructionItemId(null);
  };
  const addAnchorItem = (anchorId, createdBy = "user") => {
    const anchor = anchorData.anchors[anchorId];
    if (!anchor) return null;
    return makeConstructionItem("ANCHOR", ANCHOR_LABELS[anchorId] || anchorId, { anchorId, point: anchor }, createdBy);
  };
  const addPresetAids = () => {
    const items = [];
    if (constructionPreset === "KURIS_7_RWY19" || constructionPreset === "KURIS_7_RWY01") {
      items.push(makeConstructionItem("RADIAL", radialLabel({ stationId: "CHE", radialDeg: 11, bearingType: "MAGNETIC", magneticVariationDeg: DEFAULT_MAGNETIC_VARIATION_DEG }), {
        stationId: "CHE",
        radialDeg: 11,
        bearingType: "MAGNETIC",
        magneticVariationDeg: DEFAULT_MAGNETIC_VARIATION_DEG,
        trueBearingDeg: trueBearingFromInput(11, "MAGNETIC", DEFAULT_MAGNETIC_VARIATION_DEG),
        lengthNm: 35,
      }, "preset"));
      if (constructionPreset === "KURIS_7_RWY19") {
        items.push(makeConstructionItem("DME_CIRCLE", "D2 CHE", { stationId: "CHE", radiusNm: 2 }, "preset"));
        items.push(makeConstructionItem("DME_CIRCLE", "D6 CHE", { stationId: "CHE", radiusNm: 6 }, "preset"));
      }
      [constructionPreset === "KURIS_7_RWY19" ? "RJCC_RWY19_REPRESENTATIVE" : "RJCC_RWY01_REPRESENTATIVE", "CHE", "KURIS"].forEach((anchorId) => {
        const item = addAnchorItem(anchorId, "preset");
        if (item) items.push(item);
      });
    } else if (constructionPreset === "CHITOSE_4_RWY01") {
      items.push(makeConstructionItem("DME_CIRCLE", "D6.3 CHE", { stationId: "CHE", radiusNm: 6.3 }, "preset"));
      items.push(makeConstructionItem("DME_CIRCLE", "D10 CHE", { stationId: "CHE", radiusNm: 10 }, "preset"));
      items.push(makeConstructionItem("RADIAL", radialLabel({ stationId: "MKE", radialDeg: 330, bearingType: "MAGNETIC", magneticVariationDeg: DEFAULT_MAGNETIC_VARIATION_DEG }), {
        stationId: "MKE",
        radialDeg: 330,
        bearingType: "MAGNETIC",
        magneticVariationDeg: DEFAULT_MAGNETIC_VARIATION_DEG,
        trueBearingDeg: trueBearingFromInput(330, "MAGNETIC", DEFAULT_MAGNETIC_VARIATION_DEG),
        lengthNm: 35,
      }, "preset"));
      ["RJCC_RWY01_REPRESENTATIVE", "CHE"].forEach((anchorId) => {
        const item = addAnchorItem(anchorId, "preset");
        if (item) items.push(item);
      });
    }
    if (items.length) addConstructionItems(items);
  };
  const downloadManualPreviewJs = () => {
    if (!validProcedureId(traceId)) return;
    downloadTextFile(`${exportProcedureId}.js`, manualPreviewFileContent);
  };
  const downloadChartOverlayJs = () => {
    if (!validProcedureId(traceId)) return;
    downloadTextFile(`${exportChartId}.chartOverlay.js`, chartOverlayFileContent);
  };
  const clearDroppedImage = () => {
    if (droppedObjectUrlRef.current) URL.revokeObjectURL(droppedObjectUrlRef.current);
    droppedObjectUrlRef.current = null;
    setDroppedChart(null);
    setDropMessage("已清除图片");
  };
  const loadDroppedFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_CHART_IMAGE_TYPES.has(file.type)) {
      setDropMessage(`不支持的文件: ${file.name || file.type || "unknown"}`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (droppedObjectUrlRef.current) URL.revokeObjectURL(droppedObjectUrlRef.current);
      droppedObjectUrlRef.current = objectUrl;
      setDroppedChart({
        id: "custom",
        label: "CUSTOM",
        fileName: file.name,
        href: objectUrl,
        width: image.naturalWidth || 520,
        height: image.naturalHeight || 720,
      });
      setSelectedChartId("custom");
      setOverlayTransform(DEFAULT_OVERLAY_TRANSFORM);
      setOverlayVisible(true);
      setInteractionMode("overlay");
      setDropMessage(`已载入: ${file.name}`);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setDropMessage(`无法载入图片: ${file.name}`);
    };
    image.src = objectUrl;
  };

  const zoomAt = (factor, center) => setView((prev) => {
    const nextW = Math.min(fullView.w, Math.max(fullView.w / 96, prev.w / factor));
    const nextH = nextW / viewportAspect;
    const rx = (center.x - prev.x) / prev.w;
    const ry = (center.y - prev.y) / prev.h;
    return { x: center.x - rx * nextW, y: center.y - ry * nextH, w: nextW, h: nextH };
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (interactionMode !== "overlay" || isEditableTarget(event.target)) return;
      const moveStep = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeOverlay(0, -moveStep);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeOverlay(0, moveStep);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeOverlay(-moveStep, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeOverlay(moveStep, 0);
      } else if (event.code === "BracketLeft") {
        event.preventDefault();
        rotateOverlay(event.shiftKey ? -5 : -0.5);
      } else if (event.code === "BracketRight") {
        event.preventDefault();
        rotateOverlay(event.shiftKey ? 5 : 0.5);
      } else if (event.code === "Minus") {
        event.preventDefault();
        scaleOverlay(0.99);
      } else if (event.code === "Equal") {
        event.preventDefault();
        scaleOverlay(1.01);
      } else if (event.key === "0") {
        event.preventDefault();
        resetOverlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interactionMode]);

  const addTracePoint = (point) => {
    const nextPoint = makeTracePoint(point, chartData.projection, tracePoints.length);
    setTracePoints((prev) => [...prev, nextPoint]);
    setSelectedPointId(nextPoint.id);
  };
  const replaceTracePoint = (pointId, nextPoint) => {
    setTracePoints((prev) => prev.map((point, index) => (
      point.id === pointId ? makeTracePoint(nextPoint, chartData.projection, index, point.id) : point
    )));
  };
  const replaceTracePointAt = (pointIndex, nextPoint) => {
    setTracePoints((prev) => prev.map((point, index) => (
      index === pointIndex ? makeTracePoint(nextPoint, chartData.projection, index, point.id) : point
    )));
  };
  const selectedPoint = tracePoints.find((point) => point.id === selectedPointId) || null;
  const undoPoint = () => setTracePoints((prev) => prev.slice(0, -1));
  const clearTrace = () => {
    setTracePoints([]);
    setSelectedPointId(null);
  };
  const deleteSelectedPoint = () => {
    if (!selectedPointId) return;
    setTracePoints((prev) => prev.filter((point) => point.id !== selectedPointId).map((point, index) => ({ ...point, id: `P${index + 1}` })));
    setSelectedPointId(null);
  };
  const addCustomRadial = () => {
    if (!selectedStation || !Number.isFinite(Number(radialDegInput))) return;
    const radialDeg = Number(radialDegInput);
    addConstructionItems([makeConstructionItem("RADIAL", radialLabel({ stationId: selectedStation.id, radialDeg, bearingType, magneticVariationDeg }), {
      stationId: selectedStation.id,
      radialDeg,
      bearingType,
      magneticVariationDeg,
      trueBearingDeg: trueBearingFromInput(radialDeg, bearingType, magneticVariationDeg),
      lengthNm: Number(radialLengthNmInput) || 35,
    })]);
  };
  const addCustomDmeCircle = () => {
    if (!selectedStation || !Number.isFinite(Number(dmeRadiusNmInput))) return;
    const radiusNm = Number(dmeRadiusNmInput);
    addConstructionItems([makeConstructionItem("DME_CIRCLE", `D${radiusNm} ${selectedStation.id}`, {
      stationId: selectedStation.id,
      radiusNm,
    })]);
  };
  const addCustomDmeArc = () => {
    if (!selectedStation || !Number.isFinite(Number(arcRadiusNmInput))) return;
    const radiusNm = Number(arcRadiusNmInput);
    const startBearingDeg = Number(arcStartBearingInput) || 0;
    const endBearingDeg = Number(arcEndBearingInput) || 360;
    addConstructionItems([makeConstructionItem("DME_ARC", `D${radiusNm} ${selectedStation.id} ${formatBearing(startBearingDeg)}-${formatBearing(endBearingDeg)}`, {
      stationId: selectedStation.id,
      radiusNm,
      startBearingDeg,
      endBearingDeg,
    })]);
  };
  const addMarkerAtSelectedPoint = () => {
    if (!selectedPoint) return;
    addConstructionItems([makeConstructionItem("MARKER", selectedPoint.id, { point: selectedPoint })]);
  };
  const snapSelectedToPoint = (point) => {
    if (!selectedPoint || !point) return;
    replaceTracePoint(selectedPoint.id, point);
  };
  const snapPointToWaypointTarget = (mode) => {
    if (!selectedWaypointSnapTarget) {
      setSnapMessage("请先选择航点/台站/跑道锚点");
      return;
    }
    if (mode === "selected") {
      if (!selectedPoint) {
        setSnapMessage("请先选择一个描线点");
        return;
      }
      replaceTracePoint(selectedPoint.id, selectedWaypointSnapTarget);
      setSnapMessage(`已吸附 ${selectedPoint.id} 到 ${selectedWaypointSnapTarget.id}`);
      return;
    }
    if (!tracePoints.length) {
      setSnapMessage("请先添加描线点");
      return;
    }
    if (mode === "first") {
      replaceTracePointAt(0, selectedWaypointSnapTarget);
      setSnapMessage(`首点已吸附到 ${selectedWaypointSnapTarget.id}`);
      return;
    }
    replaceTracePointAt(tracePoints.length - 1, selectedWaypointSnapTarget);
    setSnapMessage(`末点已吸附到 ${selectedWaypointSnapTarget.id}`);
  };
  const snapSelectedToAnchor = (anchorId) => snapSelectedToPoint(anchorData.anchors[anchorId]);
  const snapFirstToStart = () => {
    if (!tracePoints.length || !anchorConfig.start) return;
    replaceTracePointAt(0, anchorConfig.start);
  };
  const snapLastToFinal = () => {
    if (!tracePoints.length || !anchorConfig.final) return;
    replaceTracePointAt(tracePoints.length - 1, anchorConfig.final);
  };
  const snapSelectedToRadial = () => {
    if (!selectedPoint || !selectedStation) return;
    const radialData = selectedConstructionItem?.kind === "RADIAL" ? selectedConstructionItem.data : null;
    const station = stationById(rjccNavaids, radialData?.stationId) || selectedStation;
    const radialDeg = Number(radialData?.trueBearingDeg ?? trueBearingFromInput(Number(radialDegInput), bearingType, magneticVariationDeg));
    const snapped = projectPointToRadial({ point: selectedPoint, station, radialDeg, projection: chartData.projection });
    if (snapped) replaceTracePoint(selectedPoint.id, snapped);
  };
  const snapSelectedToAxis = () => {
    if (!selectedPoint || !anchorFrame) return;
    const uv = projectedToAnchorUv(selectedPoint, anchorFrame);
    const snapped = uv ? anchorUvToProjected({ u: uv.u, v: 0 }, anchorFrame) : null;
    if (snapped) replaceTracePoint(selectedPoint.id, snapped);
  };
  const snapSelectedToDme = () => {
    if (!selectedPoint || !selectedStation) return;
    const dmeData = selectedConstructionItem?.kind === "DME_CIRCLE" ? selectedConstructionItem.data : null;
    const station = stationById(rjccNavaids, dmeData?.stationId) || selectedStation;
    const snapped = snapPointToDmeCircle({ point: selectedPoint, station, radiusNm: Number(dmeData?.radiusNm ?? dmeRadiusNmInput), projection: chartData.projection });
    if (snapped) replaceTracePoint(selectedPoint.id, snapped);
  };
  const snapSelectedToRadialDme = () => {
    if (!selectedPoint || !selectedStation) return;
    const radialData = selectedConstructionItem?.kind === "RADIAL" ? selectedConstructionItem.data : null;
    const station = stationById(rjccNavaids, radialData?.stationId) || selectedStation;
    const radialDeg = Number(radialData?.trueBearingDeg ?? trueBearingFromInput(Number(radialDegInput), bearingType, magneticVariationDeg));
    const snapped = buildRadialDmePoint({ station, radialDeg, radiusNm: Number(dmeRadiusNmInput), projection: chartData.projection });
    if (snapped) replaceTracePoint(selectedPoint.id, snapped);
  };
  const snapSelectedToNearestAux = () => {
    const auxItems = constructionItems.filter((item) => item.kind === "AUX_LINE" && item.visible !== false);
    if (!selectedPoint || !auxItems.length) return;
    const candidates = auxItems.map((line) => nearestPointOnPolyline({ point: selectedPoint, polyline: line.data.points })).filter(Boolean);
    const nearest = candidates.sort((a, b) => Math.hypot(selectedPoint.x - a.x, selectedPoint.y - a.y) - Math.hypot(selectedPoint.x - b.x, selectedPoint.y - b.y))[0];
    if (nearest) replaceTracePoint(selectedPoint.id, nearest);
  };

  const handleWheel = (event) => {
    if (interactionMode === "overlay") {
      event.preventDefault();
      const center = clientToSvgPoint(event, view);
      if (event.shiftKey) rotateOverlay(event.deltaY < 0 ? 0.5 : -0.5);
      else scaleOverlay(event.deltaY < 0 ? 1.035 : 1 / 1.035, center);
      return;
    }
    setIsZooming(true);
    window.clearTimeout(zoomEndTimerRef.current);
    zoomEndTimerRef.current = window.setTimeout(() => setIsZooming(false), 140);
    zoomAt(event.deltaY < 0 ? 1.18 : 1 / 1.18, clientToSvgPoint(event, view));
  };
  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (constructionClickMode !== "none") return;
    if (interactionMode === "pan") {
      setDragState({ type: "pan", pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, viewAtStart: view });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (interactionMode === "overlay") {
      setDragState({ type: "overlay", pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, viewAtStart: view, transformAtStart: overlayTransform });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
  };
  const handlePointerMove = (event) => {
    if (!dragState) return;
    if (dragState.type === "overlay") {
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = ((event.clientX - dragState.startClientX) / rect.width) * dragState.viewAtStart.w;
      const dy = ((event.clientY - dragState.startClientY) / rect.height) * dragState.viewAtStart.h;
      setOverlayTransform({
        ...dragState.transformAtStart,
        x: dragState.transformAtStart.x + dx,
        y: dragState.transformAtStart.y + dy,
      });
      return;
    }
    if (dragState.type !== "pan") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragState.startClientX) / rect.width) * dragState.viewAtStart.w;
    const dy = ((event.clientY - dragState.startClientY) / rect.height) * dragState.viewAtStart.h;
    setView({ ...dragState.viewAtStart, x: dragState.viewAtStart.x - dx, y: dragState.viewAtStart.y - dy });
  };
  const stopDrag = (event) => {
    if (dragState?.pointerId !== undefined) event.currentTarget.releasePointerCapture?.(dragState.pointerId);
    setDragState(null);
  };
  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };
  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    loadDroppedFile(event.dataTransfer.files?.[0]);
  };
  const handleDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragOver(false);
  };
  const handleSvgClick = (event) => {
    const point = clientToSvgPoint(event, view);
    if (constructionClickMode === "marker") {
      addConstructionItems([makeConstructionItem("MARKER", `MARK ${constructionItems.filter((item) => item.kind === "MARKER").length + 1}`, { point })]);
      return;
    }
    if (constructionClickMode === "aux") {
      if (!auxDraftPoint) {
        setAuxDraftPoint(point);
      } else {
        addConstructionItems([makeConstructionItem("AUX_LINE", `AUX ${constructionItems.filter((item) => item.kind === "AUX_LINE").length + 1}`, { points: [auxDraftPoint, point] })]);
        setAuxDraftPoint(null);
      }
      return;
    }
    if (interactionMode !== "trace" || dragState) return;
    addTracePoint(point);
  };

  return (
    <div
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ width: "100vw", height: "100vh", margin: 0, overflow: "hidden", background: "#071c20", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div style={{ ...panelStyle, left: 14, top: 14, width: 470, maxHeight: "calc(100vh - 28px)", overflowY: "auto" }}>
        <div style={rowStyle}>
          <strong style={{ color: "#d8fbff", marginRight: 6 }}>RJCC 描线工具</strong>
          <button type="button" onClick={() => setInteractionMode("trace")} style={activeButtonStyle(interactionMode === "trace")}>描线</button>
          <button type="button" onClick={() => setInteractionMode("pan")} style={activeButtonStyle(interactionMode === "pan")}>平移地图</button>
          <button type="button" onClick={() => setInteractionMode("overlay")} style={activeButtonStyle(interactionMode === "overlay")}>调整航图</button>
          <button type="button" onClick={resetView} style={buttonStyle}>重置视图</button>
          <span>{zoom.toFixed(1)}x</span>
        </div>
        <div style={{
          marginBottom: 6,
          padding: "6px 8px",
          color: dragOver ? "#ffffff" : "#7fc6cf",
          background: dragOver ? "rgba(21,126,150,.42)" : "rgba(3,18,22,.36)",
          border: `1px dashed ${dragOver ? "rgba(216,251,255,.78)" : "rgba(95,168,179,.32)"}`,
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 800,
        }}>
          {dropMessage}
        </div>
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>程序预设</summary>
          <div style={rowStyle}>
            <span>程序</span>
            <select value={manualPresetId} onChange={(event) => setManualPresetId(event.target.value)} style={inputStyle}>
              {manualPreviewPresets.map((preset) => <option key={preset.id} value={preset.id} disabled={preset.enabled === false}>{preset.label}</option>)}
              <option value="CUSTOM">CUSTOM</option>
            </select>
            <button type="button" onClick={applyManualPreviewPreset} style={buttonStyle}>应用预设</button>
          </div>
          <div style={rowStyle}>
            <span>Procedure ID</span>
            <input
              value={traceId}
              onChange={(event) => setTraceId(event.target.value.toUpperCase())}
              placeholder="KURIS_SEVEN_RWY19"
              style={{ ...inputStyle, minWidth: 170 }}
            />
            <select value={procedureOptions.some((option) => option.id === traceId) ? traceId : ""} onChange={(event) => setTraceId(event.target.value)} style={{ ...inputStyle, minWidth: 190 }}>
              <option value="">选择已有程序</option>
              {procedureOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} / {option.id}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAutoDeriveSetup} style={buttonStyle}>自动解析</button>
            <button type="button" onClick={() => setShowIdWorkflowHelp((prev) => !prev)} style={buttonStyle}>只填ID工作流说明</button>
          </div>
          {showIdWorkflowHelp && (
            <div style={{ color: "#9ed7df", fontSize: 10, lineHeight: 1.35, marginBottom: 5 }}>
              通常只需要选择/输入 procedure ID，然后点自动解析。若终点、锚点或航图文件名不正确，再手动修改。
            </div>
          )}
          <div style={rowStyle}>
            <span>航图ID</span>
            <input value={resolvedChartId} onChange={(event) => setResolvedChartId(event.target.value.toUpperCase())} style={{ ...inputStyle, width: 120 }} />
            <span>文件</span>
            <input value={resolvedChartFilename} onChange={(event) => setResolvedChartFilename(event.target.value)} style={{ ...inputStyle, width: 150 }} />
            <span>标题</span>
            <input value={resolvedChartTitle} onChange={(event) => setResolvedChartTitle(event.target.value)} style={{ ...inputStyle, width: 150 }} />
            <span>坐标</span>
            <select value={resolvedCoordinateSpace} onChange={(event) => setResolvedCoordinateSpace(event.target.value)} style={inputStyle}>
              <option value="anchor-normalized">anchor-normalized</option>
              <option value="rjcc-projected">rjcc-projected</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 2, color: "#7fc6cf", fontSize: 11 }}>
            <span>当前ID: {traceId}</span>
            <span>航图ID: {resolvedChartId || selectedManualPreset?.chartId || selectedChart.id}</span>
            <span>航图文件: {exportChartFilename}</span>
            <span>类型: {traceType}</span>
            <span>坐标: {resolvedCoordinateSpace}</span>
            <span>锚点: {originAnchorId} → {axisTargetAnchorId} / start {startAnchorId} / final {finalAnchorId}</span>
            {!validProcedureId(traceId) && <span style={{ color: "#ffb7a8" }}>ID只能包含大写字母、数字和下划线</span>}
            {autoSetupStatus && <span style={{ color: autoSetupWarnings.length ? "#ffcf86" : "#9ed7df" }}>{autoSetupStatus} / 可手动覆盖</span>}
            {autoSetupWarnings.map((warning) => <span key={warning} style={{ color: "#ffcf86" }}>{warning}</span>)}
          </div>
        </details>
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>航图</summary>
        <div style={rowStyle}>
          <span>航图</span>
          <select value={selectedChartId} onChange={(event) => setSelectedChartId(event.target.value)} style={inputStyle}>
            {CHART_OVERLAY_OPTIONS.map((chart) => <option key={chart.id} value={chart.id}>{chart.label}</option>)}
          </select>
          <button type="button" onClick={() => setOverlayVisible((prev) => !prev)} style={activeButtonStyle(overlayVisible)}>航图显示 {overlayVisible ? "ON" : "OFF"}</button>
          {droppedChart && <button type="button" onClick={clearDroppedImage} style={buttonStyle}>清除图片</button>}
        </div>
        {droppedChart && (
          <div style={{ ...rowStyle, color: "#d8fbff", fontSize: 11 }}>
            已载入: {droppedChart.fileName}
          </div>
        )}
        <div style={rowStyle}>
          <span>地图标注</span>
          {LABEL_MODES.map((mode) => (
            <button key={mode} type="button" onClick={() => setMapLabelMode(mode)} style={activeButtonStyle(mapLabelMode === mode)}>{mode.toUpperCase()}</button>
          ))}
          <span style={{ color: "#5fa8b3", fontSize: 10 }}>FIX / NAVAID 名称</span>
        </div>
        <div style={rowStyle}>
          <span>透明度</span>
          <input type="range" min="0" max="1" step="0.02" value={overlayTransform.opacity} onChange={(event) => updateOverlay({ opacity: Number(event.target.value) })} />
          <span>{Math.round(overlayTransform.opacity * 100)}%</span>
        </div>
        <div style={rowStyle}>
          <span>步长</span>
          {[1, 5, 10, 50].map((step) => <button key={step} type="button" onClick={() => setNudgeStep(step)} style={activeButtonStyle(nudgeStep === step)}>{step}</button>)}
          <button type="button" onClick={() => nudgeOverlay(0, -nudgeStep)} style={buttonStyle}>上</button>
          <button type="button" onClick={() => nudgeOverlay(0, nudgeStep)} style={buttonStyle}>下</button>
          <button type="button" onClick={() => nudgeOverlay(-nudgeStep, 0)} style={buttonStyle}>左</button>
          <button type="button" onClick={() => nudgeOverlay(nudgeStep, 0)} style={buttonStyle}>右</button>
        </div>
        <div style={rowStyle}>
          <button type="button" onClick={() => scaleOverlay(0.9)} style={buttonStyle}>S -10%</button>
          <button type="button" onClick={() => scaleOverlay(0.99)} style={buttonStyle}>S -1%</button>
          <button type="button" onClick={() => scaleOverlay(1.01)} style={buttonStyle}>S +1%</button>
          <button type="button" onClick={() => scaleOverlay(1.1)} style={buttonStyle}>S +10%</button>
        </div>
        <div style={rowStyle}>
          {[-5, -1, -0.1, 0.1, 1, 5].map((delta) => (
            <button key={delta} type="button" onClick={() => rotateOverlay(delta)} style={buttonStyle}>R {delta > 0 ? "+" : ""}{delta}</button>
          ))}
          <button type="button" onClick={resetOverlay} style={buttonStyle}>重置航图</button>
          <span>x {overlayTransform.x.toFixed(1)} y {overlayTransform.y.toFixed(1)} scale {overlayTransform.scale.toFixed(2)} rot {overlayTransform.rotationDeg.toFixed(1)}</span>
        </div>
        </details>
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>描线</summary>
        <div style={rowStyle}>
          <span>描线</span>
          {TRACE_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setTraceType(type)} style={activeButtonStyle(traceType === type)}>{TRACE_TYPE_LABELS[type] || type}</button>
          ))}
        </div>
        <div style={rowStyle}>
          <button type="button" onClick={undoPoint} style={buttonStyle}>撤销</button>
          <button type="button" onClick={deleteSelectedPoint} style={buttonStyle}>删除选中点</button>
          <button type="button" onClick={clearTrace} style={buttonStyle}>清空描线</button>
          <button type="button" onClick={() => setShowPointLabels((prev) => !prev)} style={activeButtonStyle(showPointLabels)}>点号</button>
          <span>{tracePoints.length} 点</span>
        </div>
        </details>
        <div style={{ margin: "8px 0", padding: "7px 8px", border: "1px solid rgba(95,168,179,.22)", color: "#8fcbd4", fontSize: 10, lineHeight: 1.35 }}>
          AIP SID 小图不是严格地理比例图。不要试图让 CHE、KURIS、跑道和海岸线全部对齐。航图只当形状底稿；真实位置用径向线、DME、锚点和吸附工具确定。
        </div>
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>辅助线</summary>
          <div style={rowStyle}>
            <span>预设</span>
            <select value={constructionPreset} onChange={(event) => applyPreset(event.target.value)} style={inputStyle}>
              {CONSTRUCTION_PRESETS.map((preset) => <option key={preset} value={preset}>{PRESET_LABELS[preset] || preset}</option>)}
            </select>
            <button type="button" onClick={addPresetAids} style={buttonStyle}>添加预设辅助线</button>
          </div>
          <div style={rowStyle}>
            <button type="button" onClick={() => setShowRadials((prev) => !prev)} style={activeButtonStyle(showRadials)}>显示径向线</button>
            <button type="button" onClick={() => setShowDme((prev) => !prev)} style={activeButtonStyle(showDme)}>显示DME</button>
            <button type="button" onClick={() => setShowArcs((prev) => !prev)} style={activeButtonStyle(showArcs)}>显示弧线</button>
            <button type="button" onClick={() => setShowAux((prev) => !prev)} style={activeButtonStyle(showAux)}>显示辅助线</button>
            <button type="button" onClick={() => setShowAnchors((prev) => !prev)} style={activeButtonStyle(showAnchors)}>显示锚点</button>
            <button type="button" onClick={() => setShowConstructionLabels((prev) => !prev)} style={activeButtonStyle(showConstructionLabels)}>显示标签</button>
          </div>
          <div style={rowStyle}>
            <span>台站</span>
            <select value={constructionStationId} onChange={(event) => setConstructionStationId(event.target.value)} style={inputStyle}>
              {stationOptions.map((station) => <option key={station.id} value={station.id}>{station.id}</option>)}
            </select>
            <span>径向</span>
            <input type="number" value={radialDegInput} onChange={(event) => setRadialDegInput(Number(event.target.value))} style={{ ...inputStyle, width: 58 }} />
            <button type="button" onClick={() => setBearingType("MAGNETIC")} style={activeButtonStyle(bearingType === "MAGNETIC")}>MAG</button>
            <button type="button" onClick={() => setBearingType("TRUE")} style={activeButtonStyle(bearingType === "TRUE")}>TRUE</button>
            <span>VAR</span>
            <input type="number" value={magneticVariationDeg} onChange={(event) => setMagneticVariationDeg(Number(event.target.value))} style={{ ...inputStyle, width: 48 }} />
            <span>长度</span>
            <input type="number" value={radialLengthNmInput} onChange={(event) => setRadialLengthNmInput(Number(event.target.value))} style={{ ...inputStyle, width: 52 }} />
            <button type="button" onClick={addCustomRadial} style={buttonStyle}>添加径向线</button>
          </div>
          <div style={rowStyle}>
            <span>DME</span>
            <input type="number" step="0.1" value={dmeRadiusNmInput} onChange={(event) => setDmeRadiusNmInput(Number(event.target.value))} style={{ ...inputStyle, width: 58 }} />
            <button type="button" onClick={addCustomDmeCircle} style={buttonStyle}>添加DME圆</button>
            <span>弧线</span>
            <input type="number" step="0.1" value={arcRadiusNmInput} onChange={(event) => setArcRadiusNmInput(Number(event.target.value))} style={{ ...inputStyle, width: 50 }} />
            <input type="number" value={arcStartBearingInput} onChange={(event) => setArcStartBearingInput(Number(event.target.value))} style={{ ...inputStyle, width: 50 }} />
            <input type="number" value={arcEndBearingInput} onChange={(event) => setArcEndBearingInput(Number(event.target.value))} style={{ ...inputStyle, width: 50 }} />
            <button type="button" onClick={addCustomDmeArc} style={buttonStyle}>添加DME弧</button>
          </div>
          <div style={rowStyle}>
            <button type="button" onClick={() => setConstructionClickMode((prev) => prev === "aux" ? "none" : "aux")} style={activeButtonStyle(constructionClickMode === "aux")}>两点辅助线</button>
            <button type="button" onClick={() => setConstructionClickMode((prev) => prev === "marker" ? "none" : "marker")} style={activeButtonStyle(constructionClickMode === "marker")}>点击标记</button>
            <button type="button" onClick={addMarkerAtSelectedPoint} style={buttonStyle}>标记选中点</button>
            {auxDraftPoint && <span style={{ color: "#d8fbff" }}>辅助线第1点已设</span>}
          </div>
          <div style={{ marginTop: 6, fontWeight: 900, color: "#d8fbff" }}>辅助线列表</div>
          <div style={rowStyle}>
            <button type="button" onClick={() => selectedConstructionItemId && removeConstructionItem(selectedConstructionItemId)} style={buttonStyle}>删除选中</button>
            <button type="button" onClick={() => clearConstructionItems()} style={buttonStyle}>清空辅助线</button>
            <button type="button" onClick={() => setConstructionItems((prev) => prev.map((item) => ({ ...item, visible: false })))} style={buttonStyle}>隐藏全部</button>
            <button type="button" onClick={() => setConstructionItems((prev) => prev.map((item) => ({ ...item, visible: true })))} style={buttonStyle}>显示全部</button>
          </div>
          <div style={{ display: "grid", gap: 4, maxHeight: 150, overflowY: "auto" }}>
            {constructionItems.length === 0 && <div style={{ color: "#5fa8b3", fontSize: 11 }}>暂无辅助线。选择参数后点击添加，或点击“添加预设辅助线”。</div>}
            {constructionItems.map((item) => (
              <div key={item.id} onClick={() => setSelectedConstructionItemId(item.id)} style={{ display: "grid", gridTemplateColumns: "auto 58px 1fr auto", gap: 5, alignItems: "center", padding: "3px 4px", border: item.id === selectedConstructionItemId ? "1px solid rgba(216,251,255,.65)" : "1px solid rgba(95,168,179,.18)", background: item.id === selectedConstructionItemId ? "rgba(21,126,150,.22)" : "rgba(3,18,22,.18)", cursor: "pointer" }}>
                <input type="checkbox" checked={item.visible !== false} onChange={(event) => updateConstructionItem(item.id, { visible: event.target.checked })} onClick={(event) => event.stopPropagation()} />
                <span style={{ color: "#7fc6cf" }}>{KIND_LABELS[item.kind] || item.kind}</span>
                <span>{item.label}</span>
                <button type="button" onClick={(event) => { event.stopPropagation(); removeConstructionItem(item.id); }} style={buttonStyle}>删除</button>
              </div>
            ))}
          </div>
        </details>
        <details style={sectionStyle}>
          <summary style={summaryStyle}>锚点</summary>
          <div style={rowStyle}>
            <span>原点</span>
            <select value={originAnchorId} onChange={(event) => setOriginAnchorId(event.target.value)} style={inputStyle}>
              {anchorData.anchorOptions.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}
            </select>
          </div>
          <div style={rowStyle}>
            <span>轴线</span>
            <select value={axisTargetAnchorId} onChange={(event) => setAxisTargetAnchorId(event.target.value)} style={inputStyle}>
              {anchorData.anchorOptions.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}
            </select>
            <span>起点</span>
            <select value={startAnchorId} onChange={(event) => setStartAnchorId(event.target.value)} style={inputStyle}>
              {anchorData.anchorOptions.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}
            </select>
          </div>
          <div style={rowStyle}>
            <span>终点</span>
            <select value={finalAnchorId} onChange={(event) => setFinalAnchorId(event.target.value)} style={inputStyle}>
              {anchorData.anchorOptions.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}
            </select>
          </div>
        </details>
        <details style={sectionStyle}>
          <summary style={summaryStyle}>吸附</summary>
          <div style={rowStyle}>
            <button type="button" onClick={snapFirstToStart} style={buttonStyle}>首点吸附到起点</button>
            <button type="button" onClick={snapLastToFinal} style={buttonStyle}>末点吸附到终点</button>
            <button type="button" onClick={() => snapSelectedToAnchor("CHE")} style={buttonStyle}>选中点到CHE</button>
            <button type="button" onClick={() => snapSelectedToAnchor("KURIS")} style={buttonStyle}>选中点到KURIS</button>
          </div>
          <div style={rowStyle}>
            <button type="button" onClick={snapSelectedToRadial} style={buttonStyle}>选中点到径向线</button>
            <button type="button" onClick={snapSelectedToAxis} style={buttonStyle}>选中点到轴线</button>
            <button type="button" onClick={snapSelectedToDme} style={buttonStyle}>选中点到DME圆</button>
            <button type="button" onClick={snapSelectedToRadialDme} style={buttonStyle}>选中点到径向+DME</button>
            <button type="button" onClick={snapSelectedToNearestAux} style={buttonStyle}>选中点到辅助线</button>
          </div>
        </details>
        <details open style={sectionStyle}>
          <summary style={summaryStyle}>航点吸附</summary>
          <div style={rowStyle}>
            <input
              value={waypointSnapQuery}
              onChange={(event) => setWaypointSnapQuery(event.target.value)}
              placeholder="搜索航点 / FIX / NAVAID / RWY"
              style={{ ...inputStyle, minWidth: 210 }}
            />
            <span style={{ color: "#5fa8b3", fontSize: 10 }}>{filteredWaypointSnapTargets.length}/{waypointSnapTargets.length}</span>
          </div>
          <div style={rowStyle}>
            <select
              value={selectedWaypointSnapTarget?.id || ""}
              onChange={(event) => setSelectedWaypointSnapTargetId(event.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            >
              {filteredWaypointSnapTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.id} / {target.type}{target.name ? ` / ${target.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedWaypointSnapTarget && (
            <div style={{ color: "#7fc6cf", fontSize: 10, lineHeight: 1.35 }}>
              {selectedWaypointSnapTarget.label}
              {Number.isFinite(selectedWaypointSnapTarget.lat) && Number.isFinite(selectedWaypointSnapTarget.lon)
                ? ` / ${selectedWaypointSnapTarget.lat.toFixed(6)}, ${selectedWaypointSnapTarget.lon.toFixed(6)}`
                : ""}
            </div>
          )}
          <div style={rowStyle}>
            <button type="button" onClick={() => snapPointToWaypointTarget("selected")} style={buttonStyle}>选中点吸附到航点</button>
            <button type="button" onClick={() => snapPointToWaypointTarget("first")} style={buttonStyle}>首点吸附到航点</button>
            <button type="button" onClick={() => snapPointToWaypointTarget("last")} style={buttonStyle}>末点吸附到航点</button>
          </div>
          {snapMessage && <div style={{ color: "#d8fbff", fontSize: 10 }}>{snapMessage}</div>}
        </details>
      </div>

      <div style={{ ...panelStyle, right: 14, top: 14, width: 430, bottom: 14, display: "grid", gridTemplateRows: "auto auto auto 1fr 1fr", gap: 8 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label>
            <div>ID</div>
            <input value={traceId} onChange={(event) => setTraceId(event.target.value)} style={{ width: "100%", boxSizing: "border-box", background: "#071c20", color: "#d8fbff", border: "1px solid rgba(95,168,179,.45)", padding: 5 }} />
          </label>
          <label>
            <div>备注</div>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} style={{ width: "100%", boxSizing: "border-box", background: "#071c20", color: "#d8fbff", border: "1px solid rgba(95,168,179,.45)", padding: 5 }} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "#5fa8b3" }}>
          选中点: {selectedPointId || "无"} | 选中辅助线: {selectedConstructionItem?.label || "无"} | 仅显示预览，不作为导航数据。
        </div>
        <div style={{ display: "grid", gap: 5, border: "1px solid rgba(95,168,179,.22)", padding: 7 }}>
          <div style={rowStyle}>
            <button type="button" onClick={downloadManualPreviewJs} disabled={!validProcedureId(traceId)} style={buttonStyle}>下载航路JS</button>
            <button type="button" onClick={downloadChartOverlayJs} disabled={!validProcedureId(traceId)} style={buttonStyle}>下载航图叠加JS</button>
          </div>
          <div style={{ color: "#7fc6cf", fontSize: 10, lineHeight: 1.35 }}>
            下载后，把航路JS放入 src/data/airspace/rjcc/manual-previews/；把航图叠加JS放入 src/data/airspace/rjcc/chart-overlays/；把PNG放入 public/charts/rjcc/；然后把 import 和条目加入对应 index.js。
          </div>
          <label style={{ display: "grid", gap: 2, fontSize: 10 }}>
            复制航路 index import
            <input readOnly value={manualIndexImportSnippet} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 2, fontSize: 10 }}>
            复制航路 index 条目
            <input readOnly value={manualIndexEntrySnippet} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 2, fontSize: 10 }}>
            复制航图 index import
            <input readOnly value={chartIndexImportSnippet} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 2, fontSize: 10 }}>
            复制航图 index 条目
            <input readOnly value={chartIndexEntrySnippet} style={inputStyle} />
          </label>
        </div>
        <label style={{ display: "grid", gap: 4, minHeight: 0 }}>
          <div>JS 导出</div>
          <textarea readOnly value={jsExport} style={{ resize: "none", minHeight: 0, background: "#031216", color: "#d8fbff", border: "1px solid rgba(95,168,179,.35)", padding: 8, fontFamily: "monospace", fontSize: 11 }} />
        </label>
        <label style={{ display: "grid", gap: 4, minHeight: 0 }}>
          <div>JSON 导出</div>
          <textarea readOnly value={jsonExport} style={{ resize: "none", minHeight: 0, background: "#031216", color: "#d8fbff", border: "1px solid rgba(95,168,179,.35)", padding: 8, fontFamily: "monospace", fontSize: 11 }} />
        </label>
      </div>

      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={handleSvgClick}
        style={{ display: "block", cursor: interactionMode === "trace" ? "crosshair" : interactionMode === "overlay" ? "move" : dragState ? "grabbing" : "grab", touchAction: "none" }}
      >
        <rect x={view.x - view.w * 2} y={view.y - view.h * 2} width={view.w * 5} height={view.h * 5} fill="#071c20" />
        <RjccJaipMapLayer
          projection={chartData.projection}
          view={view}
          zoom={zoom}
          uiScale={uiScale}
          isZooming={isZooming}
          showCoastline
          showContour={false}
          showAirports
          showRunways
          showFixes
          showNavaids
          showLocalizers={false}
          showProcedures={false}
          showAca
          coastlines={rjccCoastlineHires}
          fixes={filteredFixes}
          navaids={filteredNavaids}
          localizers={filteredLocalizers}
          fixLabelMode={mapLabelMode}
          navaidLabelMode={mapLabelMode}
          pointById={chartData.pointById}
          paths={chartData.paths}
        />
        <ChartOverlayLayer chart={selectedChart} transform={overlayTransform} visible={overlayVisible} />
        <ConstructionOverlayLayer
          showRadials={showRadials}
          showDme={showDme}
          showArcs={showArcs}
          showAux={showAux}
          showAnchors={showAnchors}
          showLabels={showConstructionLabels}
          constructionItems={constructionItems}
          selectedItemId={selectedConstructionItemId}
          projection={chartData.projection}
          uiScale={uiScale}
          stationsById={anchorData.navaidById}
        />
        {selectedWaypointSnapTarget && Number.isFinite(selectedWaypointSnapTarget.x) && Number.isFinite(selectedWaypointSnapTarget.y) && (
          <g id="waypoint-snap-target-highlight" pointerEvents="none" stroke="#ffffff" fill="none" opacity="0.9" vectorEffect="non-scaling-stroke">
            <circle cx={selectedWaypointSnapTarget.x} cy={selectedWaypointSnapTarget.y} r={5 * uiScale} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d={`M ${selectedWaypointSnapTarget.x - 8 * uiScale} ${selectedWaypointSnapTarget.y} L ${selectedWaypointSnapTarget.x + 8 * uiScale} ${selectedWaypointSnapTarget.y} M ${selectedWaypointSnapTarget.x} ${selectedWaypointSnapTarget.y - 8 * uiScale} L ${selectedWaypointSnapTarget.x} ${selectedWaypointSnapTarget.y + 8 * uiScale}`} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            <text x={selectedWaypointSnapTarget.x + 7 * uiScale} y={selectedWaypointSnapTarget.y - 7 * uiScale} fill="#ffffff" stroke="none" fontFamily="monospace" fontSize={10 * uiScale} fontWeight="900">{selectedWaypointSnapTarget.id}</text>
          </g>
        )}
        <TraceEditorLayer
          points={tracePoints}
          selectedPointId={selectedPointId}
          traceType={traceType}
          uiScale={uiScale}
          showPointLabels={showPointLabels}
          onSelectPoint={setSelectedPointId}
        />
      </svg>
    </div>
  );
}
