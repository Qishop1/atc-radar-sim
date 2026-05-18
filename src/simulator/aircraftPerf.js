import { clamp } from "./geometry.js";

export const callsigns = ["ANA", "JAL", "SKY", "ADO", "APJ", "SNA", "DAL", "UAL", "KAL", "EVA"];
export const milCallsigns = ["CHITOSE", "EAGLE", "VIKING", "RESCUE", "COBRA", "SAMURAI"];
export const types = ["B738", "B763", "B772", "B789", "A320", "A321", "E170", "DH8D"];
export const milTypes = ["F-15J", "T-4", "U-125A", "C-2", "UH-60J"];

export const AIRCRAFT_PERF = {
  A320: { min: 120, app: 135, clean: 210, max: 340, accel: 2.8, decel: 3.4, climb: 2500, descent: 2800, turn: 3.0, burn: 1.0, wtc: "MEDIUM" },
  A321: { min: 125, app: 140, clean: 215, max: 335, accel: 2.5, decel: 3.1, climb: 2300, descent: 2600, turn: 2.8, burn: 1.08, wtc: "MEDIUM" },
  B738: { min: 125, app: 140, clean: 220, max: 340, accel: 2.6, decel: 3.0, climb: 2400, descent: 2600, turn: 2.8, burn: 1.05, wtc: "MEDIUM" },
  B763: { min: 130, app: 145, clean: 230, max: 330, accel: 2.1, decel: 2.4, climb: 2000, descent: 2400, turn: 2.4, burn: 1.24, wtc: "HEAVY" },
  B772: { min: 135, app: 150, clean: 240, max: 330, accel: 1.8, decel: 2.0, climb: 1800, descent: 2200, turn: 2.1, burn: 1.42, wtc: "HEAVY" },
  B789: { min: 135, app: 150, clean: 240, max: 335, accel: 1.9, decel: 2.1, climb: 1900, descent: 2300, turn: 2.2, burn: 1.36, wtc: "HEAVY" },
  E170: { min: 115, app: 130, clean: 200, max: 330, accel: 3.2, decel: 3.8, climb: 2700, descent: 3000, turn: 3.2, burn: 0.82, wtc: "MEDIUM" },
  DH8D: { min: 95, app: 115, clean: 170, max: 260, accel: 2.0, decel: 3.5, climb: 1500, descent: 1800, turn: 3.0, burn: 0.62, wtc: "LIGHT" },
  "F-15J": { min: 135, app: 170, clean: 300, max: 620, accel: 7.5, decel: 7.0, climb: 6500, descent: 6500, turn: 5.0, burn: 2.2, wtc: "MEDIUM" },
  "T-4": { min: 105, app: 130, clean: 220, max: 420, accel: 4.2, decel: 4.4, climb: 3200, descent: 3400, turn: 4.2, burn: 1.0, wtc: "LIGHT" },
  "U-125A": { min: 110, app: 125, clean: 210, max: 350, accel: 3.0, decel: 3.4, climb: 2400, descent: 2700, turn: 3.0, burn: 0.9, wtc: "LIGHT" },
  "C-2": { min: 120, app: 135, clean: 220, max: 330, accel: 2.1, decel: 2.6, climb: 1900, descent: 2400, turn: 2.3, burn: 1.25, wtc: "HEAVY" },
  "UH-60J": { min: 0, app: 55, clean: 110, max: 145, accel: 1.6, decel: 2.6, climb: 900, descent: 1100, turn: 4.0, burn: 0.55, rotor: true, wtc: "LIGHT" }
};

export const depFlightPlans = [
  { destination: "RJTT", sid: "SOUTH" },
  { destination: "RJAA", sid: "SOUTH" },
  { destination: "RJBB", sid: "SOUTH" },
  { destination: "RJFK", sid: "SOUTH" },
  { destination: "RKSI", sid: "SOUTH" },
  { destination: "PANC", sid: "NORTH" },
  { destination: "ZBAA", sid: "WEST" },
  { destination: "RCTP", sid: "SOUTH" },
];

export function speedLimitForAltitude(alt) { return alt < 10000 ? 250 : 340; }
export function depTargetSpeed(ac) {
  return ac.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(ac)) : companyCostIndexSpeed(ac);
}
export function perfFor(type) { return AIRCRAFT_PERF[type] || AIRCRAFT_PERF.A320; }
export function speedLimitForAircraft(ac, alt) {
  const p = perfFor(ac.type);
  const max = Math.max(p.max, ac.maxSpeedOverride || 0);
  if (p.rotor) return max;
  if (ac.category === "MIL") return max;
  return Math.min(max, speedLimitForAltitude(alt));
}
export function companyCostIndexSpeed(ac) {
  const p = perfFor(ac.type);
  const prefix = String(ac.id || "").replace(/[0-9]/g, "");
  const ci = { APJ: 0.98, SKY: 0.94, ADO: 0.92, ANA: 0.88, JAL: 0.86, SNA: 0.90, DAL: 0.90, UAL: 0.90, KAL: 0.88, EVA: 0.88 }[prefix] ?? 0.88;
  return Math.round(clamp(p.max * ci, Math.max(250, p.clean), p.max));
}
export function approachSpeedFor(ac) { return perfFor(ac.type).app; }
export function wakeCategory(ac) { return perfFor(ac.type).wtc || "MEDIUM"; }
export function wakeMinNm(lead, trail) {
  const leadW = wakeCategory(lead), trailW = wakeCategory(trail);
  if (leadW === "SUPER") return trailW === "SUPER" ? 4 : trailW === "HEAVY" ? 6 : 7;
  if (leadW === "HEAVY" && trailW === "HEAVY") return 4;
  if (leadW === "HEAVY" && trailW === "MEDIUM") return 6;
  if (leadW === "HEAVY" && trailW === "LIGHT") return 7;
  if (leadW === "MEDIUM" && trailW === "MEDIUM") return 3;
  if (leadW === "MEDIUM" && trailW === "LIGHT") return 5;
  return 3;
}
export function cleanSpeedFor(ac) { return perfFor(ac.type).clean; }
export function isRotor(ac) { return !!perfFor(ac.type).rotor; }
