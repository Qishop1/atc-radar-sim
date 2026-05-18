These are not necessarily current bugs; they are areas that previously changed often or are easy to break during refactors.

- Scenario 05 F-15J / MiG-31 intercept, merge, escort, RJCJ recovery, fuel-out failure, and duplicate spawn prevention.
- ILS capture, UNSTABLE_ILS, FINAL, missed approach, and rollout transition boundaries.
- TWR automatic handoff, landing clearance, Mayday/Pan-Pan tower handling, and command visibility by aircraft phase.
- DEP aircraft should remain under TWR while on ground; DEP/ACC logic begins after airborne/radar-contact phase.
- Weather cells should be driven by weatherTick and not recomputed every render tick.
- Radar sweep and extrapolation are display-layer behavior only.
- RJCJ military mission corridors and mission areas should not trigger civil separation conflicts between paired intercept aircraft.
