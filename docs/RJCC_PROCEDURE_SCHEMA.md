# RJCC Procedure Schema

The RJCC procedure schema is future-facing data infrastructure for SID, STAR, IAC/approach, holding, and route procedure work.

It is not connected to aircraft motion yet. It does not change legacy `x/y` gameplay, command handling, scenarios, runway geometry, aircraft guidance, weather, scoring, or tower automation.

## Data

Procedure placeholders live in:

- `src/data/airspace/rjcc/procedures.js`

The schema currently supports:

- `arrivals`
- `departures`
- `approaches`
- `holdings`

The data is intentionally minimal and marked `prototype-placeholder`. It is not real AIRAC coverage and should not be treated as operational procedure data.

`YOSAN_ONE_DEPARTURE` is the first real RNAV SID seed. It represents YOSAN ONE DEPARTURE from AIP Japan RJCC AD2.24-SID-20, effective 7 SEP 2023, for RJCC RWY19L/19R.

## Lookups And Validation

Core-v2 procedure utilities live in:

- `src/core-v2/procedures/procedureTypes.js`
- `src/core-v2/procedures/procedureLookup.js`
- `src/core-v2/procedures/procedureRouteBuilder.js`
- `src/core-v2/procedures/procedureValidation.js`

Lookup helpers can find procedures, approaches for a runway, holds by fix, and a combined waypoint lookup from existing airport, runway-end, fix, and navaid seed data.

Validation checks structural references only:

- procedure ids
- airport ids
- runway ids
- fix/navaid ids
- altitude constraints
- speed constraints

## Route Preview

The JAIP prototype includes a procedure route visualizer for display/debug use only. It is not connected to aircraft guidance, route execution, the legacy state machine, command handling, or aircraft motion.

YOSAN ONE DEPARTURE previews through:

- `CC06T`
- `YASKN`
- `MISTA`
- `YOSAN`
- `TOBBY`

`HEADING_TO_FIX` is previewed using the endpoint fix only until true heading-leg geometry is implemented. For YOSAN ONE DEPARTURE, the initial heading leg is shown from `CC06T`; DER coordinates are not represented and are not inferred from runway geometry.

Radial/DME references are metadata only. They are not used to derive route coordinates yet.

## Coordinate Authority

FIX and NAVAID coordinates are authoritative where present in their seed files.

`NAVER` includes radial/DME metadata (`R201/D35.0 CHE`), but that metadata is not used to derive coordinates yet. Do not derive NAVER from CHE until a dedicated validation/migration task explicitly asks for it.

Legacy `x/y` gameplay remains unchanged and authoritative for the current simulator.
