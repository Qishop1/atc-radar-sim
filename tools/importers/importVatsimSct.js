#!/usr/bin/env node
/* global process */
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseVatsimLatitude, parseVatsimLongitude } from "../../src/data/importers/coordinateParsers.js";

const SECTION_KIND = {
  AIRPORT: "airport",
  AIRPORTS: "airport",
  FIX: "fix",
  FIXES: "fix",
  NDB: "navaid",
  NDBS: "navaid",
  VOR: "navaid",
  VORS: "navaid",
};

function parseArgs(argv) {
  const args = { input: null, out: null, source: null, airac_cycle: null };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--out") args.out = argv[++i];
    else if (value === "--source") args.source = argv[++i];
    else if (value === "--airac" || value === "--airac-cycle") args.airac_cycle = argv[++i];
    else if (!args.input) args.input = value;
  }
  return args;
}

function cleanToken(token) {
  return token.replace(/^[,;]+|[,;]+$/g, "").trim();
}

function coordinateTokens(tokens) {
  const lat = tokens.find((token) => /^[NS]\d{2,3}\.\d{2}\.\d{2}(?:\.\d{1,3})?$/i.test(token));
  const lon = tokens.find((token) => /^[EW]\d{2,3}\.\d{2}\.\d{2}(?:\.\d{1,3})?$/i.test(token));
  return { lat, lon };
}

function sectionName(line) {
  const match = /^\s*\[([^\]]+)]\s*$/.exec(line);
  return match ? match[1].trim().toUpperCase() : null;
}

function recordFromLine({ line, kind, source, airac_cycle }) {
  const tokens = line.split(/\s+/).map(cleanToken).filter(Boolean);
  const { lat, lon } = coordinateTokens(tokens);
  if (!lat || !lon) return null;

  const id = tokens.find((token) => !/^[NSEW]\d/i.test(token) && !/^\d+(?:\.\d+)?$/.test(token));
  if (!id) return null;

  return {
    id: id.toUpperCase(),
    name: null,
    type: kind === "navaid" ? "NAVAID" : kind.toUpperCase(),
    lat: parseVatsimLatitude(lat),
    lon: parseVatsimLongitude(lon),
    fir: null,
    source,
    airac_cycle,
    status: "draft",
    source_format: "vatsim_sct",
    raw: line,
  };
}

export function parseVatsimSct(text, { source = "vatsim_sct", airac_cycle = null } = {}) {
  const draft = {
    metadata: {
      source,
      airac_cycle,
      status: "draft",
      writes_runtime_data: false,
    },
    airports: [],
    fixes: [],
    navaids: [],
    warnings: [],
  };
  let currentSection = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;

    const nextSection = sectionName(line);
    if (nextSection) {
      currentSection = nextSection;
      continue;
    }

    const kind = SECTION_KIND[currentSection];
    if (!kind) continue;

    try {
      const record = recordFromLine({ line, kind, source, airac_cycle });
      if (!record) {
        if (/[NSEW]\d{2,3}\.\d{2}\.\d{2}/i.test(line)) draft.warnings.push(`Skipped malformed ${currentSection} line: ${line}`);
        continue;
      }
      if (kind === "airport") draft.airports.push(record);
      else if (kind === "fix") draft.fixes.push(record);
      else draft.navaids.push(record);
    } catch (error) {
      draft.warnings.push(`Skipped ${currentSection} line: ${error.message}`);
    }
  }

  return draft;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Usage: node tools/importers/importVatsimSct.js <sector.sct> [--out draft.json] [--source name] [--airac cycle]");
    process.exitCode = 1;
    return;
  }

  const text = await readFile(args.input, "utf8");
  const draft = parseVatsimSct(text, {
    source: args.source || `vatsim_sct:${basename(args.input)}`,
    airac_cycle: args.airac_cycle,
  });
  const output = `${JSON.stringify(draft, null, 2)}\n`;

  if (args.out) await writeFile(args.out, output, "utf8");
  else console.log(output);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

