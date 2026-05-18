import { isFinalMode } from "./arrivalApproach.js";

export function towerArrivalPatch(extra = {}) {
  return { ...extra, towerControlled: true, contact: "TWR", towerPending: false, emergencyTowerAccepted: true };
}

export function landingClearancePatch(ac) {
  const approachMode = ac.mode === "UNSTABLE_ILS" ? "ILS" : ac.mode;
  return {
    ...ac,
    towerControlled: true,
    contact: "TWR",
    towerPending: false,
    emergencyTowerAccepted: true,
    landingClearance: true,
    mode: isFinalMode(approachMode) ? "FINAL" : approachMode,
    approachRunway: ac.approachRunway || ac.routeRunway || ac.occupancyRunway,
  };
}

export function appReacquirePatch(selected, extra = {}) {
  return selected.depState === "MISSED_APP" || selected.mode === "MISSED_APP" || selected.mode === "MISSED_TRANSFER_APP"
    ? { category: "ARR", destination: "RJCC", sid: null, depState: null, missed: false, clearedILS: false, ...extra }
    : extra;
}
