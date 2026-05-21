# Canvas Renderer Plan

The JAIP/RJCC map now has a Canvas-first static geometry foundation. React remains the UI shell. SVG/React remains available for interaction overlays, labels, selectors, chart overlays, draggable authoring points, and controls.

## Current Split

Canvas-rendered static geometry:

- Coastline
- Contours
- ACA boundary stroke

SVG/React-rendered overlay geometry:

- Chart image overlays
- Airports, runways, fixes, navaids, localizers
- Procedure display routes and labels
- ACA DME references, altitude blocks, and navaid symbols
- Trace editor construction tools, draggable points, labels, hover/click targets, and export UI

The canvas migration is intentionally narrow. It removes the heaviest static map geometry from React/SVG rendering while preserving current visual and interaction behavior.

## Renderer Components

- `src/map/canvas/CanvasMapLayer.jsx`: reusable SVG-embedded canvas layer
- `src/map/canvas/canvasMapDrawers.js`: imperative Canvas 2D drawing helpers
- `src/map/jaip/RjccJaipMapLayer.jsx`: hybrid composer
- `src/map/jaip/AcaOverlayLayer.jsx`: keeps SVG ACA annotations and can hide/show the legacy SVG boundary

`RjccJaipMapLayer` defaults to the canvas static renderer. The old SVG coastline, contour, and ACA boundary paths remain available through the `staticLayerRenderer="svg"` fallback path.

## Performance Rules

- Large geometry arrays should not become thousands of React elements.
- Pan/zoom should trigger explicit canvas redraws, not full React geometry trees.
- Static projected geometry should be memoized before drawing.
- Canvas helpers should stay independent of React so worker offloading remains possible later.
- Procedure authoring export formats must remain display-only and backward compatible.

Future canvas candidates include DME circles, radial helper lines, procedure display paths, static construction geometry, and chart images if the SVG interaction layer remains intact.

