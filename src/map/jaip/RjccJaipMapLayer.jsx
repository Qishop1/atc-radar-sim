import { hokkaidoRegionPackage } from "../../data/regions/hokkaido/regionPackage.js";
import { CanvasMapLayer } from "../canvas/CanvasMapLayer.jsx";
import { AcaOverlayLayer } from "./AcaOverlayLayer.jsx";
import { AirportLayer } from "./AirportLayer.jsx";
import { ChartOverlayLayer } from "./ChartOverlayLayer.jsx";
import { CoastlineLayer } from "./CoastlineLayer.jsx";
import { ContourLayer } from "./ContourLayer.jsx";
import { FixLayer } from "./FixLayer.jsx";
import { LocalizerLayer } from "./LocalizerLayer.jsx";
import { NavaidLayer } from "./NavaidLayer.jsx";
import { ProcedureRouteLayer } from "./ProcedureRouteLayer.jsx";
import { RunwayLayer } from "./RunwayLayer.jsx";

export function RjccJaipMapLayer({
  projection,
  view,
  zoom,
  uiScale,
  isZooming,
  showCoastline,
  showContour,
  showAirports,
  showRunways,
  showFixes,
  showNavaids,
  showLocalizers,
  showProcedures,
  showAca,
  coastlines = hokkaidoRegionPackage.coastline,
  contours = hokkaidoRegionPackage.contours,
  airports,
  runways,
  fixes,
  navaids,
  localizers,
  procedures,
  selectedProcedureIds,
  procedureLabelMode,
  procedureDetailMode,
  showApproximateProcedureGeometry,
  chartOverlay,
  showChartOverlay,
  chartOverlayOpacity,
  waypointLookup,
  suppressedFixLabelIds,
  fixLabelMode,
  navaidLabelMode,
  pointById,
  paths,
  staticLayerRenderer = "canvas",
}) {
  const useCanvasStaticLayers = staticLayerRenderer === "canvas";

  return (
    <>
      {useCanvasStaticLayers && (
        <CanvasMapLayer
          projection={projection}
          view={view}
          zoom={zoom}
          coastlines={coastlines}
          contours={contours}
          showCoastline={showCoastline}
          showContour={showContour}
        />
      )}
      {!useCanvasStaticLayers && showCoastline && <CoastlineLayer coastlines={coastlines} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      {!useCanvasStaticLayers && showContour && <ContourLayer contours={contours} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      <ChartOverlayLayer overlay={chartOverlay} enabled={showChartOverlay} opacityOverride={chartOverlayOpacity} />
      {showRunways && <RunwayLayer runways={runways} projection={projection} zoom={zoom} uiScale={uiScale} />}
      {showAirports && <AirportLayer airports={airports} projection={projection} uiScale={uiScale} />}
      {showFixes && <FixLayer fixes={fixes} projection={projection} view={view} zoom={zoom} uiScale={uiScale} labelMode={fixLabelMode} suppressedLabelIds={suppressedFixLabelIds} />}
      {showNavaids && <NavaidLayer navaids={navaids} projection={projection} view={view} zoom={zoom} uiScale={uiScale} labelMode={navaidLabelMode} />}
      {showLocalizers && <LocalizerLayer localizers={localizers} projection={projection} view={view} zoom={zoom} uiScale={uiScale} labelMode={navaidLabelMode} />}
      {showProcedures && <ProcedureRouteLayer procedures={procedures} selectedProcedureIds={selectedProcedureIds} waypointLookup={waypointLookup} projection={projection} view={view} zoom={zoom} uiScale={uiScale} detailMode={procedureDetailMode} showLabels={procedureLabelMode === "on" || (procedureLabelMode === "auto" && zoom >= 3.8)} showApproximateGeometry={showApproximateProcedureGeometry} />}
      {useCanvasStaticLayers && showAca && pointById && paths && (
        <CanvasMapLayer
          projection={projection}
          view={view}
          zoom={zoom}
          paths={paths}
          showAcaBoundary
        />
      )}
      {showAca && pointById && paths && <AcaOverlayLayer pointById={pointById} paths={paths} uiScale={uiScale} showBoundary={!useCanvasStaticLayers} />}
    </>
  );
}
