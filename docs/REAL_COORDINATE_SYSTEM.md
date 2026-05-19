# Real Coordinate System

This project now has shared infrastructure for real-world RJCC radar coordinates, but the simulator has not migrated to it yet.

## Current Authority

Legacy local `x/y` coordinates remain authoritative for gameplay. Aircraft motion, `aircraftStep.js`, runway geometry, weather, scoring, commands, state transitions, tower automation, and scenarios must continue to use the legacy coordinate system until a dedicated migration task changes them.

The new RJCC radar projection is the future canonical display/world coordinate system. It exists so map data, fixes, navaids, airports, runways, and later aircraft state can move toward one shared real-world reference without per-layer projection drift.

## Entry Point For Lat/Lon

Latitude/longitude data must enter the simulator through `createRjccRadarProjection(...)` from `src/geo/rjccRadarProjection.js`.

Do not hand-roll one-off lat/lon transforms in map layers, scenario logic, or UI components. If a layer needs screen coordinates, create or receive a projection object and convert through that object.

## Bounds And Frames

JAIP chart replica bounds and radar display bounds are different concepts.

- JAIP/chart bounds describe the source document or replica viewport.
- Radar display bounds describe a radar frame, center, range, scale, and optional rotation.

Do not build gameplay projection bounds from coastline, chart art, or decorative map extents. Coastline and chart layers are visual references only; they are not a gameplay coordinate authority.

## No Mixed Projections

Do not mix per-layer projections. A radar view should use one projection object for every real-world layer in that view. Mixing separate ad hoc projections for coastlines, fixes, airports, weather, or aircraft will create alignment errors that are hard to diagnose.

## Compatibility Bridge

`src/geo/legacyCoordinateBridge.js` exists only for compatibility. It can translate between legacy local `x/y`, bearing/range, lat/lon, and radar-frame `x/y`, but it must not be used to silently replace legacy gameplay functions yet.

## Airspace Seed Debug Checks

RJCC-area airport and runway real-coordinate seed data lives in:

- `src/data/airspace/rjcc/airports.js`
- `src/data/airspace/rjcc/runways.js`

These files are source data. Do not re-derive airport ARP coordinates from runway thresholds. Airport ARP latitude/longitude must come from `airports.js`; runway threshold latitude/longitude must come from `runways.js`.

`src/geo/rjccAirspaceDebugChecks.js` provides read-only debug helpers around that source data:

- `validateRjccAirspaceSeeds(...)`
- `createRjccAirspaceDebugProjection(...)`
- `debugRjccAirspaceCoordinates(...)`

These helpers return structured objects for validation, projection round trips, runway threshold distance checks, and optional legacy-coordinate bridge round trips. They do not mutate simulator state, do not replace legacy `x/y`, and are not part of gameplay authority.

## Future Migration Order

1. Coordinate system.
2. Map layers.
3. Navaids/fixes.
4. Airports/runways.
5. Weather.
6. Aircraft state last.

Aircraft state is intentionally last because it is the most behavior-sensitive part of the simulator.
