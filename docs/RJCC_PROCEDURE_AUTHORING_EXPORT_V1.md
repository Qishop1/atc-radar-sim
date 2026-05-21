# RJCC Procedure Authoring Export V1

This document freezes the current `#/rjcc-trace-editor` export format as Procedure Authoring Export V1. It describes the existing display-only pipeline; it does not introduce a new schema.

Verified examples only:

- KURIS 7
- CHITOSE 4

RNAV SID, STAR, approach, procedure-leg execution, and aircraft guidance workflows are not verified in V1.

## Current File Chain

Procedure selector and base procedure records:

- `src/data/airspace/rjcc/procedures.js`
- `src/core-v2/procedures/procedureLookup.js`

Manual display previews:

- `src/data/airspace/rjcc/manualProcedurePreviews.js`
- `src/data/airspace/rjcc/manual-previews/index.js`
- `src/data/airspace/rjcc/manual-previews/KURIS_SEVEN_RWY19.js`
- `src/data/airspace/rjcc/manual-previews/KURIS_SEVEN_RWY01.js`
- `src/data/airspace/rjcc/manual-previews/CHITOSE_FOUR_RWY19.js`
- `src/data/airspace/rjcc/manual-previews/CHITOSE_FOUR_RWY01.js`

Chart overlay placement:

- `src/data/airspace/rjcc/chartOverlays.js`
- `src/data/airspace/rjcc/chart-overlays/index.js`
- `src/data/airspace/rjcc/chart-overlays/KURIS_SEVEN.chartOverlay.js`
- `src/data/airspace/rjcc/chart-overlays/CHITOSE_FOUR.chartOverlay.js`

Runtime display composition:

- `src/core-v2/procedures/procedureRouteBuilder.js`
- `src/core-v2/procedures/chartOverlayLookup.js`
- `src/map/jaip/ProcedureRouteLayer.jsx`
- `src/map/jaip/ChartOverlayLayer.jsx`
- `src/prototypes/rjcc-trace-editor/RjccProcedureTraceEditor.jsx`

## How Entries Connect

1. A procedure or runway variant exists in `procedures.js`.
2. `expandProcedureRouteEntries()` turns parent procedures with `variants` into selector entries.
3. `buildProcedureDisplayOptions()` exposes selector rows by `id`, `label`, `type`, `airportId`, and runway IDs.
4. If `manualProcedurePreviews[procedure.id]` exists, `buildProcedureRoutePreview()` uses that manual trace before approximate procedure metadata.
5. The manual preview provides `points`, `coordinateSpace`, optional `anchorFrame`, optional `rawProjectedPoints`, construction helper metadata, and chart overlay hints.
6. `chartOverlayLookup.js` finds a chart overlay by exact procedure id, `procedureIds`, or derived chart id.
7. `ProcedureRouteLayer.jsx` draws the preview path and labels. It is a display preview only.
8. `ChartOverlayLayer.jsx` draws the chart image placement. It is a visual reference only.

## Manual Preview V1 Fields

Required for a P0 display procedure:

- `id`: must exactly match the expanded selector procedure id, for example `KURIS_SEVEN_RWY19`.
- `type`: currently `MANUAL_TRACE`.
- `traceType`: display style, such as `APPROX_TURN`, `SOLID_ROUTE`, `RADIAL`, or `CONNECTOR`.
- `approximate`: should be `true`.
- `source`: usually `manual chart trace`.
- `coordinateSpace`: `anchor-normalized` or `rjcc-projected`.
- `points`: display path points.
- `notes`: should state that the trace is display-only and not authoritative.

Required when `coordinateSpace` is `anchor-normalized`:

- `anchorFrame.originId`
- `anchorFrame.axisToId`
- `anchorFrame.startId`
- `anchorFrame.finalId`

Useful but not authoritative:

- `rawProjectedPoints`
- `constructionItems`
- `construction`
- `overlay`
- labels stored in construction helper items

`legs` may remain `null`, empty, or metadata-only before the future P2 leg authoring pipeline. V1 does not require leg semantics.

## Chart Overlay V1 Fields

Required for chart display:

- `id`
- `chartId`
- `title`
- `imageUrl`
- `source`
- `transform.x`
- `transform.y`
- `transform.scale`
- `transform.rotationDeg`
- `transform.opacity`

Optional/current convenience fields:

- `procedureIds`
- `width`
- `height`
- `approximate`
- `notes`

Chart overlays are visual placement data. They are not georeferenced navigation data and are not used by gameplay.

## Template Procedures

Use KURIS 7 and CHITOSE 4 as future V1 templates:

- KURIS 7 demonstrates `anchor-normalized` display traces with a fix final anchor.
- CHITOSE 4 demonstrates `rjcc-projected` display traces and conventional turn helper geometry.
- Both use chart overlays and construction helper records as authoring aids.
- Both remain display-only.

Do not use placeholder or unverified records as production templates.

## Export Compatibility Rules

The Procedure Authoring Tool JS export currently emits a named constant with the traced preview object. JSON export emits the same payload as JSON. This task freezes that behavior for V1; future changes must be additive and backward compatible.

Do not change:

- manual preview object shape
- chart overlay object shape
- JS export behavior
- JSON export behavior
- chart placement tool data
- selector ids for KURIS 7 or CHITOSE 4

## Safety Rule

`display_path`, manual preview points, chart overlays, and construction helper geometry are display-layer data only.

Aircraft must never follow `display_path`, manual preview points, chart overlay geometry, or construction helper geometry. Aircraft guidance belongs to the future P2 procedure-leg pipeline, not V1 authoring export data.

