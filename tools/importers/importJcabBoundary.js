#!/usr/bin/env node
/* global process */
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseJcabLatitude, parseJcabLongitude } from "../../src/data/importers/coordinateParsers.js";

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    sector_id: "rjcc",
    boundary_id: "rjcc_aca",
    type: "ACA",
    source: null,
    airac_cycle: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--out") args.out = argv[++i];
    else if (value === "--sector-id") args.sector_id = argv[++i];
    else if (value === "--boundary-id") args.boundary_id = argv[++i];
    else if (value === "--type") args.type = argv[++i];
    else if (value === "--source") args.source = argv[++i];
    else if (value === "--airac" || value === "--airac-cycle") args.airac_cycle = argv[++i];
    else if (!args.input) args.input = value;
  }
  return args;
}

function compactTokens(line) {
  return line.match(/\d+(?:\.\d+)?[NSEW]/gi) || [];
}

export function parseJcabBoundaryText(text, options = {}) {
  const points = [];
  const warnings = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const tokens = compactTokens(line);
    if (!tokens.length) continue;

    const latToken = tokens.find((token) => /[NS]$/i.test(token));
    const lonToken = tokens.find((token) => /[EW]$/i.test(token));
    if (!latToken || !lonToken) {
      warnings.push(`Skipped line without lat/lon pair: ${line}`);
      continue;
    }

    try {
      points.push({
        lat: Number(parseJcabLatitude(latToken).toFixed(8)),
        lon: Number(parseJcabLongitude(lonToken).toFixed(8)),
      });
    } catch (error) {
      warnings.push(`Skipped line: ${error.message}`);
    }
  }

  return {
    sector_id: options.sector_id || "rjcc",
    boundary_id: options.boundary_id || "rjcc_aca",
    type: options.type || "ACA",
    source: options.source || null,
    airac_cycle: options.airac_cycle || null,
    status: "draft",
    writes_runtime_data: false,
    boundary: {
      polylines: points.length ? [points] : [],
    },
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Usage: node tools/importers/importJcabBoundary.js <vertices.txt> [--out draft.json] [--sector-id rjcc] [--boundary-id rjcc_aca] [--type ACA] [--source name] [--airac cycle]");
    process.exitCode = 1;
    return;
  }

  const text = await readFile(args.input, "utf8");
  const draft = parseJcabBoundaryText(text, {
    ...args,
    source: args.source || `jcab_enr:${basename(args.input)}`,
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

