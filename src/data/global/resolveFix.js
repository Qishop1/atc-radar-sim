import { airports } from "./airports.js";
import { fixes } from "./fixes.js";
import { navaids } from "./navaids.js";

function normalizeReference(ref) {
  if (typeof ref === "string") return ref;
  return ref?.id || ref?.fixId || ref?.navaidId || ref?.airportId || "";
}

const waypointEntries = [
  ...fixes.map((item) => [item.id, { id: item.id, kind: "fix", item }]),
  ...navaids.map((item) => [item.id, { id: item.id, kind: "navaid", item }]),
  ...airports.map((item) => [item.id, { id: item.id, kind: "airport", item }]),
];

export const waypointById = Object.fromEntries(
  waypointEntries
    .filter(([id]) => id)
    .map(([id, value]) => [String(id).toUpperCase(), value])
);

export function resolveFix(ref) {
  const id = normalizeReference(ref).toUpperCase();
  return waypointById[id] || null;
}

