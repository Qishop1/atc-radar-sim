import { airportMarkers } from "./airportMarkers.js";
import coastline from "../../jaip/rjcc/rjcc_coastline_hires.json";
import contours from "../../jaip/rjcc/hokkaido_contours.json";

export const hokkaidoRegionPackage = {
  id: "hokkaido",
  type: "region",
  status: "active",
  coastline,
  contours,
  terrain: null,
  airportMarkers,
  compatibility: {
    legacyJaipPath: "src/data/jaip/rjcc",
  },
};

