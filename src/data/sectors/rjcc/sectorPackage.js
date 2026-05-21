import { rjccAirportPackage } from "../../airports/rjcc/rjccAirportPackage.js";
import { rjcjAirportPackage } from "../../airports/rjcj/rjcjAirportPackage.js";
import { hokkaidoRegionPackage } from "../../regions/hokkaido/regionPackage.js";
import rjccAcaBoundary from "./boundaries/rjcc_aca.json";
import rjccAccPartialBoundary from "./boundaries/rjcc_acc_partial.json";
import { controllerRoles } from "./controllerRoles.js";
import { frequencies } from "./frequencies.js";
import { handoffRules } from "./handoffRules.js";
import { runwayConfigs } from "./runwayConfigs.js";
import { trafficFlows } from "./trafficFlows.js";
import { trafficStatus } from "./trafficStatus.js";

export const rjccSectorPackage = {
  id: "rjcc",
  type: "sector",
  status: "active",
  region: "hokkaido",
  regionPackage: hokkaidoRegionPackage,
  associatedAirports: ["RJCC", "RJCJ"],
  airportPackages: {
    RJCC: rjccAirportPackage,
    RJCJ: rjcjAirportPackage,
  },
  boundaries: {
    aca: rjccAcaBoundary,
    accPartial: rjccAccPartialBoundary,
  },
  controllerRoles,
  frequencies,
  runwayConfigs,
  trafficFlows,
  handoffRules,
  trafficStatus,
  compatibility: {
    legacyAirspacePath: "src/data/airspace/rjcc",
    legacyJaipPath: "src/data/jaip/rjcc",
  },
};

