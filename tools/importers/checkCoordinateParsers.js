#!/usr/bin/env node
/* global process */
import {
  parseJcabLatitude,
  parseJcabLongitude,
  parseVatsimLatitude,
  parseVatsimLongitude,
} from "../../src/data/importers/coordinateParsers.js";
import { parseDMS } from "../../src/geo/dms.js";

const checks = [
  ["VATSIM latitude", parseVatsimLatitude("N043.14.03.000"), 43.2341666667],
  ["VATSIM longitude", parseVatsimLongitude("E141.43.27.000"), 141.7241666667],
  ["JCAB latitude", parseJcabLatitude("424656.25N"), 42.7822916667],
  ["JCAB longitude", parseJcabLongitude("1414051.29E"), 141.6809138889],
  ["compat parseDMS VATSIM", parseDMS("N043.14.03.000"), 43.2341666667],
  ["compat parseDMS JCAB", parseDMS("424656.25N"), 42.7822916667],
];

const failures = checks.filter(([, actual, expected]) => Math.abs(actual - expected) > 0.0000002);

if (failures.length) {
  for (const [name, actual, expected] of failures) {
    console.error(`${name}: expected ${expected}, got ${actual}`);
  }
  process.exitCode = 1;
} else {
  console.log("coordinate parser checks passed");
}

