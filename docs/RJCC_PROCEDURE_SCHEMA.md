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

`SOSHU_ONE_DEPARTURE` and `REZOT_TWO_DEPARTURE` are also present as real RNAV SID seeds. They use runway-dependent `variants` so the route visualizer can show each branch independently:

- `SOSHU_ONE_RWY01`
- `SOSHU_ONE_RWY19`
- `REZOT_TWO_RWY01`
- `REZOT_TWO_RWY19`

`CHITOSE_FOUR_DEPARTURE` is present as a conventional SID seed. It also uses runway-dependent variants:

- `CHITOSE_FOUR_RWY01`
- `CHITOSE_FOUR_RWY19`

`KURIS_SEVEN_DEPARTURE` is present as a conventional SID seed with two display-only preview variants:

- `KURIS_SEVEN_RWY01`
- `KURIS_SEVEN_RWY19`

The RWY01 branch is approximate because the current source extract does not include the full RWY01 chart text. Its preview shows a short runway-heading segment after the RWY01 departure end before joining CHE R011 toward `KURIS`.

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

SOSHU ONE RWY01 previews through `CC01T`, `CC02T`, `CC03T`, and `CHE`.

SOSHU ONE RWY19 has only `CHE` as a coordinate endpoint because DER is not represented.

REZOT TWO RWY01 previews through `CC01T`, `CC02T`, `CC03T`, `CHE`, `REZOT`, and `TEKKO`.

REZOT TWO RWY19 previews through `CC06T`, `REZOT`, and `TEKKO`.

CHITOSE FOUR RWY01 includes an approximate right-turn preview from the RJCC RWY01 ends back to `CHE`. This curved turn geometry is purely visual, display-only, and not authoritative procedure geometry.

CHITOSE FOUR RWY19 can show an approximate dashed direct-to-`CHE` preview. That connector is also display-only.

KURIS SEVEN RWY01 uses a display-only approximate join to CHE R011 about 1 NM after the RWY01 departure end, then continues toward `KURIS`.

KURIS SEVEN RWY19 uses a display-only approximate left teardrop preview. The preview shows runway-heading departure, a bounded left turn toward the CHE R011 outbound course, and continuation toward `KURIS`. Its R011 capture is intentionally smoothed for display readability. It is not authoritative procedure geometry and is not used for validation, aircraft guidance, route execution, or gameplay.

Manual procedure previews can override automatic display geometry when a trace exists under `src/data/airspace/rjcc/manual-previews/`. The compatibility module `src/data/airspace/rjcc/manualProcedurePreviews.js` re-exports the split registry for older imports. `KURIS_SEVEN_RWY19` currently uses a manual chart trace normalized to the `CHE` to `KURIS` anchor frame, so the JAIP visualizer draws the hand-traced display shape instead of the automatic KURIS geometry.

Chart overlay transforms live under `src/data/airspace/rjcc/chart-overlays/`, with `src/data/airspace/rjcc/chartOverlays.js` as the compatibility re-export. Chart overlays may be shared by `chartId` so runway variants using the same chart reuse one `x/y/scale/rotation/width/height` transform. Procedure ids may still map to the shared object through `procedureIds`.

Manual previews are display-only. They are not authoritative navigation geometry, are not used by validation as source coordinates, and are not connected to aircraft guidance, route execution, command handling, or legacy gameplay.

Chart overlays are also display-only. They reference public chart images such as `/charts/rjcc/KURIS_SEVEN.png`, are not georeferenced, and are not used by gameplay or aircraft guidance.

`HEADING_TO_FIX` is previewed using the endpoint fix only until true heading-leg geometry is implemented. DER coordinates are not represented and are not inferred from runway geometry.

Radial/DME references, including CHE R011 and DME references used by KURIS SEVEN, are metadata only. They are not used to derive authoritative route coordinates.

Approximate curved turn geometry is not used by validation, aircraft guidance, command handling, route execution, or legacy gameplay.

## Coordinate Authority

FIX and NAVAID coordinates are authoritative where present in their seed files.

`NAVER` includes radial/DME metadata (`R201/D35.0 CHE`), but that metadata is not used to derive coordinates yet. Do not derive NAVER from CHE until a dedicated validation/migration task explicitly asks for it.

Legacy `x/y` gameplay remains unchanged and authoritative for the current simulator.
