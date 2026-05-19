# App.jsx Refactor Plan

This document tracks the current App.jsx disassembly status for the ATC Radar Simulator.

The refactor goal is structural only: preserve gameplay behavior, keep aircraft mode strings stable, and keep radar extrapolation display-only.

## Extracted So Far

- Second-pass line count: `src/App.jsx` went from 1700 lines to 1138 lines. The 600-line target was not reached safely in this pass.
- Constants, geometry, navigation, aircraft performance, weather, scenarios, formatting, separation, sequencing, and state-machine helpers live under `src/simulator/`.
- Language/display glue now lives in `src/simulator/displayText.js`.
- Arrival sequence strip derivation and manual-order helpers now live in `src/simulator/arrivalSequenceState.js`.
- Scenario completion/failure notices and RJCJ priority notices now live in `src/simulator/scenarioStatus.js`.
- Start/reset/back-to-menu orchestration now lives in `src/hooks/useSessionController.js`.
- APP/TWR/DEP command handlers and debug/manual spawn commands now live in `src/hooks/useCommandHandlers.js`.
- Runway, airport, ILS, and visual runway geometry helpers live in `src/simulator/runwayGeometry.js`.
- Aircraft factory helpers live in `src/simulator/aircraftFactory.js`.
- Airspace route, SID, hold, and waypoint helpers live in `src/simulator/airspaceRoutes.js`.
- Arrival boundary helpers live in `src/simulator/arrivalApproach.js`.
- Military area/corridor helpers live in `src/simulator/military.js` and `src/simulator/militaryBoundary.js`.
- Scenario 05 pure ADIZ/intercept helpers live in `src/simulator/interceptScenario.js`.
- Scenario 05 orchestration now lives in `src/simulator/scenario05.js`.
- Aircraft step, aircraft motion, ILS core, VNAV helpers, missed approach helpers, rollout/fuel-out motion, military target-state resolution, and Scenario 05 aircraft factory helpers now live in `src/simulator/aircraftStep.js`.
- Delayed command execution, automatic traffic spawning, and scenario traffic/weather/snow timeline events now live in `src/simulator/simulationLoop.js`.
- Radar target display extrapolation and runway display derived state now live in `src/simulator/radarState.js`.
- Radar mouse/3D ground interaction helpers now live in `src/simulator/radarInteractions.js`.
- 3D projection/path helper calculations now live in `src/simulator/radar3D.js`.
- Tower automation lives in `src/simulator/towerAutomation.js`.
- Small command patch helpers live in `src/simulator/commands.js`.
- Radar overlay JSX is split into `src/components/RadarOverlays.jsx`, and the main radar SVG composition now lives in `src/components/RadarScope.jsx`.
- Low/medium-risk panels and controls are split into `src/components/`.
- Obsolete 3D View, TWR View, and the top radar/3D/tower tabs were removed. The simulator now keeps the radar view as the primary interface.

## What Remains In App.jsx

`App.jsx` is now closer to an orchestration layer, but it still owns:

- Top-level React state, refs, memoized derived state, and effects.
- Layout composition and wiring of high-level UI components.
- Runway plan state setters and runway plan command handlers.
- Radar pan/zoom/mouse-vector handlers that directly touch the SVG ref and current view box.
- Debug/selection/layout glue around the already-extracted command/session hooks.
- Score, count, and small left/right panel wiring values.
- A large amount of high-level JSX composition for the side panels and command panel.

## Why Some Code Remains

- The remaining runway planner handlers still combine runway-state mutation, radio/log updates, and runway candidate logic. They should move in a focused runway-command pass.
- Radar pan/zoom/select handlers still depend on `svgRef`, current `viewBox`, selected aircraft, and immediate React setters. They can move to a small hook, but require careful browser testing of drag, wheel zoom, and mouse vector assignment.
- The side-panel JSX is still large. It can be moved into a layout component, but this pass stopped short because command visibility and APP/TWR/DEP button wiring are behavior-sensitive.
- `aircraftStep`, aircraft motion, Scenario 05 orchestration, and main simulation loop are already outside App; no further high-risk core movement was attempted after build/lint/browser checks passed.

## High-Risk Areas Requiring Manual Review

- Scenario 05 F-15J / MiG-31 intercept, merge, escort, RJCJ recovery, fuel-out failure, and duplicate spawn prevention.
- ILS capture, `UNSTABLE_ILS`, final, missed approach, and rollout transition boundaries.
- APP/TWR/DEP command visibility and automatic tower handoff behavior.
- Departure aircraft remaining under TWR while on ground.
- Weather cells staying driven by `weatherTick`, not render ticks.
- Radar sweep and extrapolation remaining display-layer behavior only.
- RJCJ mission corridors and mission areas avoiding false civil separation conflicts for paired intercept aircraft.

## Manual Smoke Tests Required

- Start menu opens. Verified.
- Free Play starts. Verified.
- Scenario 01 starts. Verified.
- Scenario 04 starts and weather displays. Verified at startup level.
- Scenario 05 starts without white screen or immediate failure. Verified.
- Aircraft selection works.
- Selected aircraft panel works.
- APP/TWR/DEP controls still render. Verified; command behavior still needs manual click-through.
- Arrival sequence still displays. Verified.
- Runway planner still displays. Verified.
- Radar pan/zoom/select still works. Still requires manual interaction testing.
- Weather overlays still display. Verified at Scenario 04 startup level.
- Runway/ILS overlays still display. Verified at startup level.
- Mission corridor/ADIZ overlays still display. Verified by Scenario 05 startup text and single radar SVG; visual corridor review still recommended.
- No startup `ReferenceError` or `TypeError` appears in the browser console. Verified.

## Build And Lint

- `npm run lint`: passed.
- `npm run build`: passed.

## Post-Refactor Roadmap

### P0

- Radio Log reduction and separate critical alert display.
- Right-click aircraft command menu.
- Selected Aircraft Inspector showing state / owner / clearance / next action / risk.
- Corrected landing geometry with threshold / aim point / touchdown zone / long landing / go-around.
- Crosswind / tailwind / speed / capture-distance based stable approach model.

### P1

- RJCC seasonal weather generation instead of random 360-degree wind.
- METAR / TAF / ATIS / operational weather summary.

### P2

- Intercept / escort relative-position logic redesign.
- More scenarios, art, audio, radio voice, polish.
