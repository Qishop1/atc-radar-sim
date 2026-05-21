import { airports as rjccAirports } from "../airspace/rjcc/airports.js";
import { airportRecord } from "./recordAdapters.js";

export const airports = rjccAirports.map(airportRecord);
export const airportById = Object.fromEntries(airports.map((airport) => [airport.id, airport]));
