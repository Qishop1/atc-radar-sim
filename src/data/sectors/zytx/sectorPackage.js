import { zytlAirportPackage } from "../../airports/zytl/zytlAirportPackage.js";
import { zytxAirportPackage } from "../../airports/zytx/zytxAirportPackage.js";
import { liaoningRegionPackage } from "../../regions/liaoning/regionPackage.js";
import { controllerRoles } from "./controllerRoles.js";

export const zytxSectorPackage = {
  id: "zytx",
  type: "sector",
  status: "placeholder",
  region: "liaoning",
  regionPackage: liaoningRegionPackage,
  associatedAirports: ["ZYTX", "ZYTL"],
  airportPackages: {
    ZYTX: zytxAirportPackage,
    ZYTL: zytlAirportPackage,
  },
  boundaries: {},
  controllerRoles,
  frequencies: [],
  runwayConfigs: [],
  trafficFlows: [],
  handoffRules: [],
  trafficStatus: {
    status: "future",
    notes: "Placeholder only. No Liaoning gameplay or procedures are implemented.",
  },
};

