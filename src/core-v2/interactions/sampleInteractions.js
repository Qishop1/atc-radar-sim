import { createSampleAircraft } from "../aircraft/aircraftState.js";
import { buildAppInitialContactInteraction } from "./appInitialContact.js";

export const sampleInitialContact = buildAppInitialContactInteraction({ aircraft: createSampleAircraft(), context: {} });
