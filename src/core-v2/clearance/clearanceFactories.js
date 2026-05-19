import {
  ALTITUDE,
  CLEARED_APPROACH,
  CLEARED_TO_LAND,
  CONTACT_FREQUENCY,
  CONTINUE_APPROACH,
  DIRECT_FIX,
  EXPECT_APPROACH,
  GO_AROUND,
  HOLD,
  RADAR_CONTACT,
  SPEED,
  VECTOR_HEADING,
} from "./clearanceTypes.js";

export function radarContact() { return { type: RADAR_CONTACT }; }
export function expectApproach({ approachId, runwayId, approachName }) { return { type: EXPECT_APPROACH, approachId, runwayId, approachName }; }
export function continueApproach() { return { type: CONTINUE_APPROACH }; }
export function descendAndMaintain(altitudeFt) { return { type: ALTITUDE, mode: "DESCEND_AND_MAINTAIN", altitudeFt }; }
export function climbAndMaintain(altitudeFt) { return { type: ALTITUDE, mode: "CLIMB_AND_MAINTAIN", altitudeFt }; }
export function maintainAltitude(altitudeFt) { return { type: ALTITUDE, mode: "MAINTAIN", altitudeFt }; }
export function crossFixAtOrAbove({ fixId, altitudeFt }) { return { type: ALTITUDE, mode: "CROSS_FIX_AT_OR_ABOVE", fixId, altitudeFt }; }
export function crossFixAt({ fixId, altitudeFt }) { return { type: ALTITUDE, mode: "CROSS_FIX_AT", fixId, altitudeFt }; }
export function reduceSpeedTo(speedKt) { return { type: SPEED, mode: "REDUCE_TO", speedKt }; }
export function maintainSpeed(speedKt) { return { type: SPEED, mode: "MAINTAIN", speedKt }; }
export function resumeNormalSpeed() { return { type: SPEED, mode: "RESUME_NORMAL" }; }
export function holdAtFix({ fixId, altitudeFt, expectApproachId }) { return { type: HOLD, fixId, altitudeFt, expectApproachId }; }
export function flyHeading(headingDeg) { return { type: VECTOR_HEADING, headingDeg }; }
export function directToFix(fixId) { return { type: DIRECT_FIX, fixId }; }
export function clearedApproach({ approachId, runwayId, approachName }) { return { type: CLEARED_APPROACH, approachId, runwayId, approachName }; }
export function clearedToLand(runwayId) { return { type: CLEARED_TO_LAND, runwayId }; }
export function goAround({ headingDeg, altitudeFt }) { return { type: GO_AROUND, headingDeg, altitudeFt }; }
export function contactFrequency({ facilityName, frequency }) { return { type: CONTACT_FREQUENCY, facilityName, frequency }; }
