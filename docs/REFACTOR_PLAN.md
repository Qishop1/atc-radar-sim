# Remaining Refactor Plan

This document summarizes the modularization completed so far and the safest next steps for continuing to reduce `src/App.jsx` without changing gameplay behavior.

## Extracted so far

- Core simulator constants, geometry, navigation, aircraft performance, weather, scenarios, state-machine, engine helpers, formatting, separation, and sequencing live under `src/simulator/`.
- Runway / airport / ILS display geometry helpers live in `src/simulator/runwayGeometry.js`.
- Ordinary aircraft factories live in `src/simulator/aircraftFactory.js`.
- Scenario 05 / ADIZ / Foxhound pure helper predicates and planning helpers live in `src/simulator/interceptScenario.js`.
- Airspace nav, route, SID, hold-pattern helpers live in `src/simulator/airspaceRoutes.js`.
- Radar display overlays are split from `App.jsx` into `src/components/RadarOverlays.jsx`.
- Radar display color/label helper utilities live in `src/simulator/radarDisplay.js`.
- Small arrival / approach boundary helpers live in `src/simulator/arrivalApproach.js`.
- Small command patch helpers live in `src/simulator/commands.js`.
- Tower automation orchestration lives in `src/simulator/towerAutomation.js` with explicit dependencies supplied by `App.jsx`.
- Small military boundary helpers live in `src/simulator/militaryBoundary.js`.

## What remains in `App.jsx`

`App.jsx` still owns the highest-coupling orchestration and gameplay-sensitive code:

- React state and UI composition.
- Main simulation `setInterval` loop.
- Aircraft list state, radar target snapshots, radar extrapolation state, and selection state.
- Command event handlers and delayed-command scheduling.
- ILS capture/guidance resolution and arrival target-state resolution.
- Aircraft step dispatch and `aircraftMotionStep`.
- Military target-state resolution and Scenario 05 aircraft factory functions.
- Tower / runway command handlers and debug spawn handlers.
- 3D and TWR SVG rendering.

## Why arrival / ILS remains high risk

Arrival and ILS code is tightly coupled to mode transitions, runway assignment, tower state, missed approach recovery, landing clearance, VNAV target calculations, and rollout. The high-risk boundaries include:

- `ILS`, `UNSTABLE_ILS`, `FINAL`, `FINAL_NO_CLEAR`, `TWR_FINAL`, and `FINAL_LAND` transitions.
- Automatic missed approach due to clearance, tailwind, unstable approach, or runway changes.
- Reacquiring missed approaches back into arrival flow.
- Runway-specific route / approach locks.
- Tower automation using final geometry and landing-clearance state.

Future extraction should move one pure helper group at a time and run Scenario 01 / Free Play approach tests after each change.

## Why military core remains high risk

Military logic combines RJCJ departures, mission areas, moving corridors, weather avoidance, fuel/bingo decisions, Scenario 05 intercept behavior, and recovery. The highest-risk boundaries include:

- Scenario 05 F-15J / MiG-31 spawn, duplicate prevention, intercept, merge, escort, success/failure, and RJCJ recovery.
- RJCJ fixed-wing and helicopter departure/recovery modes.
- Mission corridor conflict exceptions for paired intercept aircraft.
- Fuel-out failure and RTB transitions.

Future extraction should keep Scenario 05 behavior isolated and avoid moving `resolveMilitaryTargetState` until its dependencies are much smaller.

## Why `aircraftMotionStep` and the main loop should remain later

`aircraftMotionStep` is the central physics/status integration point for arrivals, departures, military flights, fuel burn, weather avoidance, radar-visible behavior, landing/rollout, and missed approach transitions. Moving it before arrival, military, and command boundaries are cleaner would make regressions hard to diagnose.

The main simulation loop should remain in `App.jsx` for now because it coordinates React state updates, tick cadence, weather cadence, aircraft normalization, tower automation, target removal, scoring counters, and radar snapshots.

## Recommended next safe steps

1. Extract more small presentational 3D/TWR overlay components, leaving state and event handlers in `App.jsx`.
2. Continue moving pure display helper utilities into `src/simulator/radarDisplay.js` or a future `displayGeometry.js`.
3. Move additional pure command patch builders into `src/simulator/commands.js`, but keep React handlers local.
4. Move small missed-approach patch helpers only after adding focused manual tests for ILS, no-clearance final, and missed approach return.
5. Defer `resolveArrivalTargetState`, `resolveMilitaryTargetState`, `aircraftMotionStep`, and the main loop until dependencies are isolated and each move can be mechanical.
