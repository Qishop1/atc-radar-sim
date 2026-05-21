import { navaids as rjccNavaids } from "../airspace/rjcc/navaids.js";
import { navaidRecord } from "./recordAdapters.js";

export const navaids = rjccNavaids.map(navaidRecord);
export const navaidById = Object.fromEntries(navaids.map((navaid) => [navaid.id, navaid]));
