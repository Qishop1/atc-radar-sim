export function seatForAircraft(ac) {
  if (!ac) return "APP";
  if (ac.category === "MIL") return "RJCJ";
  if (ac.category === "DEP") {
    const airborneDep = ac.mode === "DEP_RADAR_CONTACT" || ac.mode === "SID" || ac.mode === "DEP_VECTOR" || ac.mode === "ACC_READY" || ac.depState === "RELEASED" || ac.depState === "UNRESTRICTED" || ac.depState === "SID_CLIMB" || ac.altitude >= 700;
    return airborneDep ? "DEP" : "TWR";
  }
  if (ac.towerControlled || ac.mode === "TWR_PATTERN" || ac.towerPending) return "TWR";
  return "APP";
}
