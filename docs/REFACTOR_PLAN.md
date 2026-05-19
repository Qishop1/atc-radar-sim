# App.jsx Refactor Plan

This document tracks the current App.jsx disassembly status for the ATC Radar Simulator.

The refactor goal is structural only: preserve gameplay behavior, keep aircraft mode strings stable, and keep radar extrapolation display-only.

## Extracted So Far

- Constants, geometry, navigation, aircraft performance, weather, scenarios, formatting, separation, sequencing, and state-machine helpers live under `src/simulator/`.
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
- Radar overlay JSX is split into `src/components/RadarOverlays.jsx`.
- Low/medium-risk panels and controls are split into `src/components/`.

## What Remains In App.jsx

`App.jsx` is now closer to an orchestration layer, but it still owns:

- Top-level React state, refs, memoized derived state, and effects.
- Layout composition and wiring of high-level UI components.
- Runway plan state setters and runway plan command handlers.
- Selected-aircraft command handlers, including APP/TWR/DEP button behavior and delayed-command dispatch entry points.
- Start/reset/debug spawn orchestration.
- Arrival sequence UI ordering handlers.
- Remaining radar SVG JSX composition.
- Remaining 3D/TWR JSX rendering and its event handlers.
- Some display translation glue that depends on current language and `tr`.

## Why Some Code Remains

- Command handlers still touch many React setters and selected-aircraft inputs. They can be moved with a command-handler factory, but that is a high-risk dependency-injection pass and needs focused manual UI testing.
- Start/reset orchestration owns many state resets at once. It should move only after a reset/start context object is introduced and verified against Free Play and every scenario.
- 3D/TWR JSX remains large but is UI-sensitive. It should be extracted as components in a dedicated UI pass, preserving all props and event handlers.
- Radar SVG composition still wires many overlays, event handlers, and selected target state. It should stay until `RadarScope` can be extracted without changing pan/zoom/select behavior.

## High-Risk Areas Requiring Manual Review

- Scenario 05 F-15J / MiG-31 intercept, merge, escort, RJCJ recovery, fuel-out failure, and duplicate spawn prevention.
- ILS capture, `UNSTABLE_ILS`, final, missed approach, and rollout transition boundaries.
- APP/TWR/DEP command visibility and automatic tower handoff behavior.
- Departure aircraft remaining under TWR while on ground.
- Weather cells staying driven by `weatherTick`, not render ticks.
- Radar sweep and extrapolation remaining display-layer behavior only.
- RJCJ mission corridors and mission areas avoiding false civil separation conflicts for paired intercept aircraft.

## Manual Smoke Tests Required

- Start menu opens.
- Free Play starts.
- Scenario 01 starts.
- Scenario 04 starts and weather displays.
- Scenario 05 starts without white screen or immediate failure.
- Aircraft selection works.
- Selected aircraft panel works.
- APP/TWR/DEP controls still work.
- Arrival sequence still displays.
- Runway planner still works.
- Radar pan/zoom/select still works.
- Weather overlays still display.
- Runway/ILS overlays still display.
- Mission corridor/ADIZ overlays still display.
- No startup `ReferenceError` or `TypeError` appears in the browser console.

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
