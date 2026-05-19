import rjccCoastlineHires from "../../data/jaip/rjcc/rjcc_coastline_hires.json";
import hokkaidoContours from "../../data/jaip/rjcc/hokkaido_contours.json";
import { AcaOverlayLayer } from "./AcaOverlayLayer.jsx";
import { AirportLayer } from "./AirportLayer.jsx";
import { CoastlineLayer } from "./CoastlineLayer.jsx";
import { ContourLayer } from "./ContourLayer.jsx";
import { FixLayer } from "./FixLayer.jsx";
import { NavaidLayer } from "./NavaidLayer.jsx";
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
  showAca,
  coastlines = rjccCoastlineHires,
  contours = hokkaidoContours,
  airports,
  runways,
  fixes,
  navaids,
  pointById,
  paths,
}) {
  return (
    <>
      {showCoastline && <CoastlineLayer coastlines={coastlines} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      {showContour && <ContourLayer contours={contours} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      {showRunways && <RunwayLayer runways={runways} projection={projection} zoom={zoom} uiScale={uiScale} />}
      {showAirports && <AirportLayer airports={airports} projection={projection} uiScale={uiScale} />}
      {showFixes && <FixLayer fixes={fixes} projection={projection} uiScale={uiScale} />}
      {showNavaids && <NavaidLayer navaids={navaids} projection={projection} uiScale={uiScale} />}
      {showAca && pointById && paths && <AcaOverlayLayer pointById={pointById} paths={paths} uiScale={uiScale} />}
    </>
  );
}
