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

function headingText(value) {
  return String(Math.round(value)).padStart(3, "0");
}

function componentPhrase(component) {
  if (!component) return null;
  switch (component.type) {
    case RADAR_CONTACT:
      return "radar contact";
    case EXPECT_APPROACH:
      return `expect ${component.approachName || component.approachId}`;
    case CONTINUE_APPROACH:
      return "continue approach";
    case ALTITUDE:
      if (component.mode === "DESCEND_AND_MAINTAIN") return `descend and maintain ${component.altitudeFt}`;
      if (component.mode === "CLIMB_AND_MAINTAIN") return `climb and maintain ${component.altitudeFt}`;
      if (component.mode === "MAINTAIN") return `maintain ${component.altitudeFt}`;
      if (component.mode === "CROSS_FIX_AT_OR_ABOVE") return `cross ${component.fixId} at or above ${component.altitudeFt}`;
      if (component.mode === "CROSS_FIX_AT") return `cross ${component.fixId} at ${component.altitudeFt}`;
      return null;
    case SPEED:
      if (component.mode === "REDUCE_TO") return `reduce speed to ${component.speedKt}`;
      if (component.mode === "MAINTAIN") return `maintain speed ${component.speedKt}`;
      if (component.mode === "RESUME_NORMAL") return "resume normal speed";
      return null;
    case HOLD:
      return `hold at ${component.fixId}${component.altitudeFt ? `, maintain ${component.altitudeFt}` : ""}`;
    case VECTOR_HEADING:
      return `fly heading ${headingText(component.headingDeg)}`;
    case DIRECT_FIX:
      return `direct ${component.fixId}`;
    case CLEARED_APPROACH:
      return `cleared ${component.approachName || component.approachId}`;
    case CLEARED_TO_LAND:
      return `runway ${component.runwayId}, cleared to land`;
    case GO_AROUND:
      return `go around, fly heading ${headingText(component.headingDeg)}, maintain ${component.altitudeFt}`;
    case CONTACT_FREQUENCY:
      return `contact ${component.facilityName} ${component.frequency}`;
    default:
      return null;
  }
}

export function formatClearancePhraseology({ callsign, components }) {
  const phrases = (components || []).map(componentPhrase).filter(Boolean);
  if (!phrases.length) return `${callsign}.`;
  return `${callsign}, ${phrases.join(", ")}.`;
}
