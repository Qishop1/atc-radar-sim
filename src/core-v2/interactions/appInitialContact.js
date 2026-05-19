import { radarContact } from "../clearance/clearanceFactories.js";
import { buildClearanceMenu } from "../clearance/clearanceComposer.js";
import { APP_INITIAL_CONTACT } from "./interactionTypes.js";

export function buildAppInitialContactInteraction({ aircraft, context } = {}) {
  return {
    type: APP_INITIAL_CONTACT,
    aircraftId: aircraft?.id,
    pilotMessage: `Chitose Approach, ${aircraft?.spokenName || aircraft?.callsign || "aircraft"} on your frequency.`,
    menu: buildClearanceMenu({ aircraft, context }),
    defaultComponents: [radarContact()],
  };
}
