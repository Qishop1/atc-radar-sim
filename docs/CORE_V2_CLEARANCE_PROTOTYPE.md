# Core-V2 Clearance Prototype

`src/core-v2` is a non-gameplay prototype for future ATC interaction design.

It is not connected to the legacy simulator. It does not send clearances to aircraft, mutate simulator state, replace legacy command handling, or alter the legacy state machine.

## What It Does

- Builds structured clearance component objects.
- Generates phraseology from those components.
- Performs lightweight validation for altitude, speed, heading, runway, approach, and fix fields.
- Provides a generic cascade menu model for prototype UI.
- Shows an isolated clearance composer panel in `#/rjcc-jaip`.

## Components

Prototype menu components currently include:

- Radar contact
- Expected approach
- Altitude assignments
- Speed assignments
- Flow instructions
- Vector headings
- Direct-to-fix instructions

FIX data is intentionally minimal. `NAVER` and `CHE` are available from the seed files; `OBGOS` may remain a placeholder string until real fix/AIRAC data is added.

## Boundaries

This prototype does not implement procedure loading, SID/STAR/IAC logic, aircraft guidance, aircraft motion, fuel integration, or any gameplay effect.
