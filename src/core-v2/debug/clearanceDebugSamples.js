import { createSampleAircraft } from "../aircraft/aircraftState.js";
import { expectApproach, radarContact, reduceSpeedTo, descendAndMaintain } from "../clearance/clearanceFactories.js";
import { formatClearancePhraseology } from "../clearance/phraseology.js";
import { validateClearanceComponents } from "../clearance/clearanceValidation.js";

export function buildClearanceDebugSamples() {
  const aircraft = createSampleAircraft();
  const components = [
    radarContact(),
    expectApproach({ approachId: "ILS_Y_RWY_01L", runwayId: "01L", approachName: "ILS Y Runway 01L" }),
    descendAndMaintain(6500),
    reduceSpeedTo(180),
  ];
  return {
    aircraft,
    examples: [
      {
        id: "initial-ils-y-01l",
        components,
        phraseology: formatClearancePhraseology({ callsign: aircraft.callsign, components }),
        validation: validateClearanceComponents({ aircraft, components, context: {} }),
      },
    ],
  };
}
