import {
  ALTITUDE,
  CLEARED_APPROACH,
  CLEARED_TO_LAND,
  DIRECT_FIX,
  EXPECT_APPROACH,
  GO_AROUND,
  HOLD,
  SPEED,
  VECTOR_HEADING,
} from "./clearanceTypes.js";

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

export function validateClearanceComponents({ aircraft, components, context } = {}) {
  const warnings = [];
  const errors = [];
  if (!aircraft?.id) warnings.push({ code: "AIRCRAFT_MISSING_ID", message: "Aircraft id is missing." });
  if (!context) warnings.push({ code: "CONTEXT_MISSING", message: "No context supplied for prototype validation." });

  for (const component of components || []) {
    if (!component?.type) {
      errors.push({ code: "COMPONENT_MISSING_TYPE", component });
      continue;
    }
    if (component.type === ALTITUDE && !isNumber(component.altitudeFt)) errors.push({ code: "ALTITUDE_INVALID", component });
    if (component.type === SPEED && component.speedKt != null && !isNumber(component.speedKt)) errors.push({ code: "SPEED_INVALID", component });
    if ((component.type === VECTOR_HEADING || component.type === GO_AROUND) && (!isNumber(component.headingDeg) || component.headingDeg < 0 || component.headingDeg >= 360)) errors.push({ code: "HEADING_INVALID", component });
    if ((component.type === EXPECT_APPROACH || component.type === CLEARED_APPROACH) && !isString(component.approachId)) errors.push({ code: "APPROACH_ID_INVALID", component });
    if ((component.type === EXPECT_APPROACH || component.type === CLEARED_APPROACH || component.type === CLEARED_TO_LAND) && !isString(component.runwayId)) errors.push({ code: "RUNWAY_ID_INVALID", component });
    if ((component.type === HOLD || component.type === DIRECT_FIX) && !isString(component.fixId)) errors.push({ code: "FIX_ID_INVALID", component });
  }

  return { valid: errors.length === 0, warnings, errors };
}
