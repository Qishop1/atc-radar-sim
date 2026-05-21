import { fixes as rjccFixes } from "../airspace/rjcc/fixes.js";
import { fixRecord } from "./recordAdapters.js";

export const fixes = rjccFixes.map(fixRecord);
export const fixById = Object.fromEntries(fixes.map((fix) => [fix.id, fix]));
