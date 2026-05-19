import rjccCoastlineHires from "../../data/jaip/rjcc/rjcc_coastline_hires.json";
import hokkaidoContours from "../../data/jaip/rjcc/hokkaido_contours.json";
import { AcaOverlayLayer } from "./AcaOverlayLayer.jsx";
import { CoastlineLayer } from "./CoastlineLayer.jsx";
import { ContourLayer } from "./ContourLayer.jsx";

export function RjccJaipMapLayer({
  projection,
  view,
  zoom,
  uiScale,
  isZooming,
  showCoastline,
  showContour,
  showAca,
  coastlines = rjccCoastlineHires,
  contours = hokkaidoContours,
  pointById,
  paths,
}) {
  return (
    <>
      {showCoastline && <CoastlineLayer coastlines={coastlines} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      {showContour && <ContourLayer contours={contours} projection={projection} view={view} zoom={zoom} isZooming={isZooming} />}
      {showAca && pointById && paths && <AcaOverlayLayer pointById={pointById} paths={paths} uiScale={uiScale} />}
    </>
  );
}
