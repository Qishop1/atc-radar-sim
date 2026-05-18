import { approachSpeedFor } from "./aircraftPerf.js";
import { isAlternateMode, isFinalMode } from "./arrivalApproach.js";
import { landingClearancePatch } from "./commands.js";

export function applyTowerAutomation(aircraft, env, towerAuto, deps) {
  const { finalLandingState, inTowerAirspace, runwayOccupied } = deps;
  const autoTowerHandoff = (a) => {
    if (a.touchdown || a.mode === "ROLLOUT" || a.mode === "VACATED") return a;
    if (a.category !== "ARR") return a;
    if (isAlternateMode(a.mode)) return a;
    const approachLike = a.clearedILS || a.landingClearance || isFinalMode(a.mode) || a.mode === "ILS" || a.mode === "UNSTABLE_ILS" || a.mode === "VISUAL_APP" || a.mode === "TWR_PATTERN";
    const emergencyArrival = a.emergency || a.mode === "MAYDAY" || a.mode === "PANPAN";
    const lowEnough = a.altitude <= (emergencyArrival ? 6000 : 3600);
    if ((approachLike || emergencyArrival) && inTowerAirspace(a, env) && lowEnough && !a.towerControlled) {
      return { ...a, towerControlled: true, contact: "TWR", towerPending: false, emergencyTowerAccepted: !!emergencyArrival || a.emergencyTowerAccepted };
    }
    return { ...a, towerPending: false };
  };
  const towered = aircraft.map(autoTowerHandoff);
  if (!towerAuto) return towered;
  return towered.map((a) => {
    if (a.touchdown || a.mode === "ROLLOUT" || a.mode === "VACATED") return a;
    if (a.category === "ARR" && a.towerControlled && a.contact === "TWR" && !a.landingClearance) {
      const st = finalLandingState(a, env, 70, 900);
      const rw = a.approachRunway || a.routeRunway || env.runway.name;
      const runwayBusy = runwayOccupied(towered.filter((x) => x.id !== a.id), rw);
      const onApproach = a.clearedILS || a.mode === "ILS" || a.mode === "UNSTABLE_ILS" || a.mode === "VISUAL_APP" || a.mode === "TWR_PATTERN" || isFinalMode(a.mode);
      if (!runwayBusy && onApproach && st.geo.alongNm < 7.0 && st.geo.alongNm > 0.25 && Math.abs(st.geo.crossPx) < 120 && a.speed < approachSpeedFor(a) + 110) return landingClearancePatch(a);
      if (onApproach && a.altitude < 500 && st.geo.alongNm < 0.15 && !a.landingClearance) {
        return { ...a, touchdown: false, runwayOccupancy: false, occupancyRunway: null, towerControlled: false, contact: "DEP", category: "DEP", depState: "MISSED_APP", mode: "MISSED_APP", route: ["MA1", "MAHOLD"], routeIndex: 0, missed: true, clearedILS: false, landingClearance: false, assignedHeading: env.runway.course, assignedAltitude: 3000, assignedSpeed: 180, speedRestriction: 200, color: "#ff9f43" };
      }
    }
    return a;
  });
}
