import { DESCENT } from "./flightPhases.js";

export function createSampleAircraft() {
  return {
    id: "ANA11",
    callsign: "ANA11",
    spokenName: "All Nippon 11",
    aircraftType: "B789",
    position: { lat: 42.95, lon: 142.20 },
    altitudeFt: 11000,
    headingTrueDeg: 270,
    groundSpeedKt: 280,
    phase: DESCENT,
    destination: "RJCC",
    assignedRunwayId: null,
    expectedApproachId: null,
    clearance: [],
    guidance: {
      lateralMode: null,
      verticalMode: null,
      speedMode: null,
      assignedHeadingDeg: null,
      assignedAltitudeFt: null,
      assignedSpeedKt: null,
      directFixId: null,
    },
    fuel: {
      fuelKg: 6200,
      reserveKg: 1800,
    },
  };
}
