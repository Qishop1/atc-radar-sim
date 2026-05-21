# RJCC Data Pack

RJCC is the first complete loadable sector/data pack foundation for the simulator. The package layout is intentionally additive: legacy RJCC data remains in `src/data/airspace/rjcc` and `src/data/jaip/rjcc`, while new package entry points give future code stable boundaries.

## Package Boundaries

- Region: `src/data/regions/hokkaido/regionPackage.js`
- Sector: `src/data/sectors/rjcc/sectorPackage.js`
- Boundary asset: `src/data/sectors/rjcc/boundaries/rjcc_aca.json`
- RJCC airport package: `src/data/airports/rjcc/rjccAirportPackage.js`
- RJCJ airport package placeholder: `src/data/airports/rjcj/rjcjAirportPackage.js`
- Global compatibility wrappers: `src/data/global`

A Sector is the platform-level ATC unit or scenario package. `sectors/rjcc` is the RJCC Sector. `rjcc_aca` is only a boundary asset used by that Sector; it is not the Sector root.

## RJCC Airport Package

`airports/rjcc` represents the civil RJCC airport package. It aggregates existing airport, runway, localizer, procedure, chart overlay, manual preview, and procedure-authoring metadata without converting schemas.

Current procedure seed status:

- Verified display seeds: KURIS 7, CHITOSE 4
- Not verified: RNAV SID workflow, STAR workflow, approach workflow
- Existing prototype records remain untouched for compatibility

The Procedure Authoring Tool output is display-layer data only. Manual previews and chart overlays do not provide aircraft guidance, ARINC-like legs, speed/altitude validation, or FMS-style route execution.

## RJCJ Relationship

RJCJ is not part of the RJCC airport package. It has its own placeholder airport package at `airports/rjcj`, and the RJCC Sector associates both airports:

```js
associatedAirports: ["RJCC", "RJCJ"]
```

RJCJ military traffic, recovery procedures, scramble/intercept logic, and related gameplay remain future placeholders. Existing gameplay modules are not moved or expanded by this data pack foundation.

## Controller Roles

RJCC Sector role metadata includes all planned role names:

- ACC: future/inactive
- APP: primary/enabled
- DEP: planned/inactive
- TWR: planned/inactive
- GND: future/inactive
- DEL: future/inactive

This is metadata only. It does not implement ACC, DEP, TWR, GND, DEL, handoff behavior, or gameplay changes.

## Boundary Assets

`rjcc_aca.json` is a portable boundary asset using polyline control geometry. The current visual ACA rendering still uses the legacy verified ACA point/path helper data to preserve exact display behavior. `rjcc_acc_partial.json` is an empty future placeholder only; no ACC boundary has been invented.

## Future Placeholders

The following placeholders exist so expansion work has package boundaries before real data arrives:

- Region: `regions/liaoning`
- Airport packages: `airports/zytx`, `airports/zytl`
- Sector package: `sectors/zytx`

They contain minimal metadata, empty arrays, and disabled controller roles. They do not include Chinese eAIP data, procedures, runways, gameplay, or map rendering.

