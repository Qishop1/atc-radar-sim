# RJCC JAIP Map Layer

The RJCC JAIP prototype is now split into reusable display-only map layers:

- `CoastlineLayer.jsx` renders `rjcc_coastline_hires.json`.
- `ContourLayer.jsx` renders `hokkaido_contours.json`.
- `AcaOverlayLayer.jsx` renders the Chitose Approach Control Area, DME references, altitude blocks, and navaid symbols.
- `RjccJaipMapLayer.jsx` composes the three layers behind the prototype.

These layers are display-only. They are not gameplay geometry, they do not drive aircraft motion, and they do not affect command handling, weather, scoring, tower automation, scenarios, or the state machine.

## Data Sources

COAST uses the preprocessed RJCC coastline JSON:

- `src/data/jaip/rjcc/rjcc_coastline_hires.json`

CONTOUR uses QGIS DEM-derived contour-line JSON:

- `src/data/jaip/rjcc/hokkaido_contours.json`

The older mesh or polygon terrain source, `hokkaido_terrain.json`, is intentionally not used. The JAIP map layer renders contour lines, not terrain polygons.

## Coordinate Boundary

Legacy simulator `x/y` remains authoritative for gameplay. The RJCC JAIP map projection is a display/world coordinate layer for chart rendering and future migration work only.

Latitude/longitude chart data should enter through a shared projection object that exposes `projectLatLon(lat, lon)`. The current isolated prototype keeps its existing fixed-bounds chart projection to preserve visual behavior and full-view aspect handling, while reusable map layers are written against the shared projection interface.

JAIP chart replica bounds and radar display bounds are different concepts. Do not build gameplay projection bounds from coastline data. Do not mix per-layer projections: COAST, CONTOUR, and ACA must share the same projection for a given render.

## Current Integration

The main simulator at `/` still uses legacy `x/y` coordinates and should look unchanged by default.

The isolated prototype at `#/rjcc-jaip` uses the reusable JAIP map layers and keeps:

- COAST / CONTOUR / ACA toggles
- wheel zoom
- left-drag pan
- dynamic NM scale bar
- full-view aspect-ratio handling
- contour LOD and wheel-zoom-only temporary degradation
- non-scaling strokes
- ACA boundary, DME, altitude, and navaid rendering
