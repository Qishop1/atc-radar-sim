# RJCC Airspace Seed Data

The RJCC-area real-coordinate seed files are display and future-migration source data only. Legacy `x/y` gameplay remains unchanged.

## Files

- `src/data/airspace/rjcc/airports.js` contains airport ARP source data.
- `src/data/airspace/rjcc/runways.js` contains runway threshold endpoint source data.
- `src/data/airspace/rjcc/navaids.js` contains VOR/DME and TACAN source data.
- `src/data/airspace/rjcc/fixes.js` contains RNAV waypoint, approach fix, FAF/IAF/IF, MAPt, and holding-fix source data with authoritative printed coordinates where available.
- `src/data/airspace/rjcc/localizers.js` contains ILS/LOC facility seed data.
- `src/data/airspace/rjcc/radialDmeReferences.js` contains radial/DME-only references and named points that do not yet have authoritative printed coordinates.

Airport ARP latitude/longitude must come only from `airports.js`. Do not infer airport ARP coordinates from runway thresholds.

Runway endpoint latitude/longitude must come only from `runways.js`. Do not compute runway display geometry from airport center points.

## NAVER / CHE

`NAVER` currently has authoritative latitude/longitude in `fixes.js` and reference metadata:

- `R201/D35.0 CHE`

That radial/DME reference is metadata only for now. Do not derive NAVER from CHE until a dedicated validation/migration task asks for it.

## Expanded Navaids, Fixes, And Facilities

The navaid seed now includes CHE, HWE, MKE, SPE, and ZYT. VOR/DME and TACAN records are display/lookup source data only.

The fix seed now includes a broader RJCC-area RNAV and approach-fix dataset. Points with printed latitude/longitude are treated as coordinate-authoritative. Approximate reverse-calculated points are explicitly marked with `approximate: true`.

ILS/LOC facility data is stored separately from coordinate fixes. Localizer records currently hold identifiers, runway association text, frequencies, DME channels, and final course metadata only.

`radialDmeReferences.js` is not coordinate-authoritative. BOKSO, RAKNO, NAPRO, and other DME/radial-only references are not plotted by the FIX layer unless a future task adds authoritative coordinates.

## Procedure Seeds

`YOSAN_ONE_DEPARTURE` uses coordinate-bearing fixes from `fixes.js`:

- `CC06T`
- `YASKN`
- `MISTA`
- `YOSAN`
- `TOBBY`

Critical DME information for MKE, ZYT, SPE, and HWE is preserved as metadata in `procedures.js`. It is not used to derive coordinates or drive gameplay.

`SOSHU_ONE_DEPARTURE` uses:

- RWY01: `CC01T`, `CC02T`, `CC03T`, `CHE`
- RWY19: `CHE`

`REZOT_TWO_DEPARTURE` uses:

- RWY01: `CC01T`, `CC02T`, `CC03T`, `CHE`, `REZOT`, `TEKKO`
- RWY19: `CC06T`, `REZOT`, `TEKKO`

Critical DME and DME GAP information for these SIDs is preserved as metadata only.

## Current Non-Goals

This seed data does not implement SID, STAR, IAC, or AIRAC procedure logic.

Navaids and fixes are not connected to aircraft guidance, aircraft motion, command handling, scoring, scenarios, weather, tower automation, or the legacy state machine.

Legacy `x/y` gameplay remains the authoritative runtime model until a future migration task explicitly changes that.
