# RJCC Airspace Seed Data

The RJCC-area real-coordinate seed files are display and future-migration source data only. Legacy `x/y` gameplay remains unchanged.

## Files

- `src/data/airspace/rjcc/airports.js` contains airport ARP source data.
- `src/data/airspace/rjcc/runways.js` contains runway threshold endpoint source data.
- `src/data/airspace/rjcc/navaids.js` contains navaid source data.
- `src/data/airspace/rjcc/fixes.js` contains fix/waypoint source data.

Airport ARP latitude/longitude must come only from `airports.js`. Do not infer airport ARP coordinates from runway thresholds.

Runway endpoint latitude/longitude must come only from `runways.js`. Do not compute runway display geometry from airport center points.

## NAVER / CHE

`NAVER` currently has authoritative latitude/longitude in `fixes.js` and reference metadata:

- `R201/D35.0 CHE`

That radial/DME reference is metadata only for now. Do not derive NAVER from CHE until a dedicated validation/migration task asks for it.

## Current Non-Goals

This seed data does not implement SID, STAR, IAC, or AIRAC procedure logic.

Navaids and fixes are not connected to aircraft guidance, aircraft motion, command handling, scoring, scenarios, weather, tower automation, or the legacy state machine.
