# RJCC Manual Preview And Chart Overlay Workflow

Manual previews and chart overlays are display-only assets for the isolated RJCC JAIP tools. They are not authoritative navigation data and are not used by legacy gameplay, aircraft guidance, command handling, scenarios, weather, scoring, or runway geometry.

## File Locations

- Manual route previews: `src/data/airspace/rjcc/manual-previews/`
- Chart overlay transforms: `src/data/airspace/rjcc/chart-overlays/`
- Chart images: `public/charts/rjcc/`

The procedure variant id is the key that ties everything together:

- manual preview `id`
- chart overlay `procedureId`
- JAIP procedure selector id

These must match exactly, for example `KURIS_SEVEN_RWY19`.

## Workflow

1. Put the chart PNG in `public/charts/rjcc/`.
2. Open `#/rjcc-trace-editor`.
3. Select the procedure preset.
4. Drop the chart PNG into the editor.
5. Align the chart overlay.
6. Add construction aids such as radial lines, DME circles, arcs, anchors, and auxiliary lines.
7. Trace the route.
8. Snap critical points to real anchors or construction aids.
9. Click `下载航路JS`.
10. Click `下载航图叠加JS`.
11. Move the downloaded procedure JS file into `src/data/airspace/rjcc/manual-previews/`.
12. Move the downloaded chart overlay JS file into `src/data/airspace/rjcc/chart-overlays/`.
13. Add the manual preview import and object entry to `src/data/airspace/rjcc/manual-previews/index.js`.
14. Add the chart overlay import and object entry to `src/data/airspace/rjcc/chart-overlays/index.js`.
15. Move or copy the PNG into `public/charts/rjcc/`.
16. Open `#/rjcc-jaip`.
17. Select the procedure.
18. Turn `CHART AUTO` on.

## Index Snippets

The trace editor provides copyable import and object-entry snippets for both index files. The intended pattern is:

```js
import { KURIS_SEVEN_RWY19 } from "./KURIS_SEVEN_RWY19.js";

export const manualProcedurePreviews = {
  [KURIS_SEVEN_RWY19.id]: KURIS_SEVEN_RWY19,
};
```

```js
import { KURIS_SEVEN_CHART_OVERLAY } from "./KURIS_SEVEN.chartOverlay.js";

export const chartOverlaysByChartId = {
  [KURIS_SEVEN_CHART_OVERLAY.chartId]: KURIS_SEVEN_CHART_OVERLAY,
};
```

## Procedure / Transition Naming

The manual preview id must exactly match the JAIP procedure selector variant id. Chart overlays should normally be shared by `chartId`, so variants using the same PNG call the same `x/y/scale/rotation/width/height` transform.

Use these file names:

- `PROCEDURE_ID.js`
- `CHART_ID.chartOverlay.js`

For transition-specific work, prefer:

- `PROCEDURE_RUNWAY_TRANSITION`
- Example: `YOSAN_ONE_RWY19_TOBBY_TRANSITION`

Do not use informal ids such as `KURIS7` or `CHITOSE1`.

## Waypoint Snapping

The trace editor can snap trace points to known FIX, NAVAID, AIRPORT, and RJCC runway departure anchor targets.

Use the `航点吸附` panel:

1. Search by target id or type, such as `KURIS`, `CHE`, `TOBBY`, `CC06T`, or `RJCC_RWY19_REPRESENTATIVE`.
2. Select the matching target.
3. Snap the selected trace point, first trace point, or last trace point.

This is useful for RNAV SID endpoints, transition fixes, VOR/DME anchors, and runway departure anchors. Snapping only moves trace-editor display points; it does not write coordinates into seed data and does not affect gameplay.

## Notes

AIP SID sketches are not georeferenced. Do not expect CHE, KURIS, runways, and coastline to all align with one image transform. The chart overlay is a visual reference only; the route preview should be tied to real anchors, construction aids, and explicit display-only trace points.
