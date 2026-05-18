# Codebase Tour

This tour is a practical map of the ATC Radar Simulator codebase for maintainers who need to understand where features live before making a small, behavior-preserving change.

## Application shape

ATC Radar Simulator is a Vite React application packaged for desktop with Electron. The React app owns the simulator UI, the simulation loop, traffic state, controller commands, scenario handling, and radar/tower rendering. The Electron shell only opens a browser window, loads the Vite dev server when available, and otherwise loads the built `dist/index.html` file.

Key entry points:

- `src/main.tsx` mounts the React app into the page.
- `src/App.jsx` is the main simulator module. It contains UI text, helper functions, aircraft factories, command handlers, the simulation tick, and the rendered radar/tower interface.
- `electron/main.cjs` is the desktop wrapper for development and packaged builds.
- `package.json` defines the Vite, TypeScript, Electron, and release scripts.

## Simulator modules

The simulator-specific modules live under `src/simulator/` and are intentionally small compared with `src/App.jsx`:

- `constants.js` defines radar scale, timing constants, runway geometry, tower scale, and airport runway lists.
- `geometry.js` provides heading, bearing/range, runway-point, seeded-random, formatting, and distance helpers. It also declares the airport reference points used by the display and alternate-airport logic.
- `navigation.js` maps runway ends to runway pairs, computes runway origins, chooses default arrival/departure runway splits, normalizes runway lists, and prepares pending runway-transition sets.
- `aircraftPerf.js` defines civil and military aircraft types, callsign pools, performance envelopes, wake categories, speed limits, departure plans, and helpers such as approach/clean/target speeds.
- `weather.js` parses and generates wind, computes headwind/tailwind effects, models weather-cell geometry, detects red-weather intersections, generates weather tiles for rendering, and chooses active runways at non-RJCC airports.
- `scenarios.js` contains the scenario catalog, deterministic scenario traffic plans, objectives, and weighted spawn routes.
- `stateMachine.js` centralizes allowed mode transitions and aliases used to keep aircraft mode strings stable.

## Main React simulator flow

`src/App.jsx` can be read in several broad bands:

1. Imports and bilingual UI labels.
2. Safety, sequencing, airport, runway, mission, and scoring helpers.
3. Aircraft factories for initial traffic, arrivals, departures, military flights, and scenario-specific intruders/interceptors.
4. Guidance and state-resolution helpers for ILS, VNAV, visual patterns, missed approaches, alternates, tower flow, RJCJ recovery, departures, and military missions.
5. Motion/physics stepping for each aircraft category and mode.
6. The `App` component, which owns React state, derived environment objects, timers, command handlers, radar target extrapolation, scoring, and JSX rendering.

When investigating behavior, start with the command handler or button label in the JSX, then follow it to the helper that changes an aircraft mode. For movement bugs, follow the aircraft category into the corresponding step function and then into the mode-specific resolver.

## Runtime state and environment

The `App` component stores most live simulator data in React state: selected aircraft, aircraft list, scenario progress, runway configuration, wind/weather settings, automation toggles, radar/tower view state, pending delayed commands, score counters, language, and log messages.

A derived `env` object bundles frequently used runtime context such as active runway, departure runway, runway lists, wind, weather cells, navigation fixes, routes, SIDs, and scenario settings. Many helpers accept `env` to avoid threading individual state fields through every call.

The simulator advances in fixed `SIM_STEP_SECONDS` increments. The visible radar picture is intentionally sampled into radar targets at sweep intervals, so extrapolated display positions do not feed back into aircraft physics.

## Aircraft lifecycle

Aircraft are plain objects with position, heading, speed, altitude, target values, category, mode, clearance flags, route state, fuel, wake category, and optional scenario/mission metadata.

Typical flows:

- Arrivals spawn on a route or final, receive STAR/VNAV, hold, ILS, visual, tower, landing, missed-approach, or alternate-diversion modes.
- Departures start in ground/queue states, line up, take off, resume SID, climb, and hand off to ACC.
- Military traffic can depart from or recover to RJCJ, fly training/SAR/intercept missions, return to base on bingo fuel, or participate in special scenario logic.
- Tower automation can issue local clearances when enabled, but manual controls can also command line-up, takeoff, landing clearance, go-around, and runway release.

Mode changes should be checked against `stateMachine.js`. Keep existing mode strings stable unless a task explicitly asks for a state-machine refactor.

## Navigation, runways, and airport geometry

RJCC runway geometry starts from the `RUNWAYS` constants, with runway origins adjusted for parallel-runway offsets. Navigation helpers derive runway pairs, default runway splits, and pending runway-transition sets. `App.jsx` builds runway-specific fixes, holds, arrival routes, and SIDs, then caches navigation data per runway.

Alternate airports use their own runway lists and wind-derived active-runway selection. The app includes localizer-style guidance and rollout handling for alternate diverts, separate from the primary RJCC final and tower flow.

## Weather and operational constraints

Weather and wind affect both display and operations:

- Wind can be manual or generated, and runway auto mode reacts to wind shifts.
- Headwind/tailwind calculations influence runway suitability and tailwind go-arounds.
- Weather cells are generated deterministically from seeds and scenario identifiers.
- Red weather intersections can trigger route or diversion concerns.
- Severe wind can require broad diversion handling.

Because weather is tied to scenarios, runway selection, and aircraft safety checks, verify changes across both sandbox and scenario modes.

## Scenarios and scripted traffic

`scenarios.js` defines named scenarios with titles, difficulty, runway/wind/weather defaults, automation defaults, optional special flags, traffic schedules, and objective targets. Scenario setup in `App.jsx` applies those defaults, seeds deterministic traffic, marks scripted events as done, and evaluates progress against objectives.

Scenario 05 adds special Foxhound ADIZ logic in `App.jsx`: it creates an intruder/interceptor pair, tracks the ADIZ rectangle, computes intercept/escort guidance, and scores completion separately from normal civil flow.

## Rendering and user interaction

The UI is rendered directly from `App.jsx` with SVG-heavy radar and tower views plus side-console controls. Styling is split between inline styles in JSX and shared styles in `src/App.css` / `src/index.css`.

Important UI areas include:

- Start/scenario selection.
- System automation and runway/wind/weather controls.
- Radar scope with range rings, fixes, routes, weather, mission corridors, runway geometry, and target tracks.
- Tower/local view for runway occupancy, finals, patterns, and departure queues.
- Controller command console for APP, DEP, RJCJ, and TWR seats.
- Radio log, status panels, scoreboard, airport summaries, and scenario objectives.

## Build and quality gates

Common checks:

```bash
npm run build
```

The build runs TypeScript project references and then Vite production bundling. For source changes, also consider `npm run lint` when relevant.

## Change guidance

- Keep diffs small and localized.
- Do not rewrite the simulator architecture for routine fixes.
- Preserve gameplay behavior unless the task asks for behavior changes.
- Treat radar extrapolation as display-only; do not use extrapolated positions as physics inputs.
- Keep aircraft mode strings and state-machine transitions stable.
- Prefer updating the focused simulator module when logic already lives there; otherwise, add narrowly scoped helpers near the existing related code in `App.jsx`.
