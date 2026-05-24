import { buildDerivedDepartureProcedures } from "./derivedDepartureProcedures.js";

export const arrivals = [
  {
    id: "PLACEHOLDER_ARRIVAL",
    type: "STAR",
    airportId: "RJCC",
    runwayIds: ["01L"],
    source: "prototype-placeholder",
    segments: [
      {
        id: "main",
        legs: [
          {
            type: "FIX",
            fixId: "NAVER",
            altitude: { atOrAboveFt: 8500 },
            speed: { maxKt: 250 },
            flyOver: false,
          },
        ],
      },
    ],
  },
];

const explicitDepartures = [
  {
    id: "YOSAN_ONE_DEPARTURE",
    name: "YOSAN ONE DEPARTURE",
    type: "SID",
    navSpec: "RNAV1",
    airportId: "RJCC",
    runwayIds: ["19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID-20, effective 7 SEP 2023",
    notes: [
      "DME/DME/IRU or GNSS required.",
      "Radar service required.",
      "RWY19L/19R: climb on HDG 182 at or above 500FT, direct to CC06T, to YASKN, to MISTA, to YOSAN, to TOBBY.",
      "5.0% climb gradient required up to 500FT.",
    ],
    initialClimb: {
      headingDeg: 182,
      atOrAboveFt: 500,
      climbGradientPercentUntilFt: 500,
    },
    segments: [
      {
        id: "main",
        legs: [
          {
            type: "HEADING_TO_FIX",
            headingDeg: 182,
            fixId: "CC06T",
            altitude: { atOrAboveFt: 500 },
            notes: "DER to CC06T; preview approximates heading leg as endpoint CC06T because DER coordinates are not represented.",
          },
          {
            type: "FIX",
            fixId: "YASKN",
          },
          {
            type: "FIX",
            fixId: "MISTA",
          },
          {
            type: "FIX",
            fixId: "YOSAN",
          },
          {
            type: "FIX",
            fixId: "TOBBY",
          },
        ],
      },
    ],
    distanceNotes: [
      { from: "CC06T", to: "YASKN", distanceNm: 10.6, courseDeg: 236.6 },
      { from: "YASKN", to: "MISTA", distanceNm: 11.2, courseDeg: 214.7 },
      { from: "MISTA", to: "YOSAN", distanceNm: 13.8, courseDeg: 148.9 },
      { from: "YOSAN", to: "TOBBY", distanceNm: 20.1, courseDeg: 150.7 },
    ],
    criticalDme: [
      {
        stationId: "MKE",
        notes: "3.0NM to CC06T; 6.0NM to YASKN; 3.0NM to YASKN; 1.0NM to YASKN; YASKN to 3.0NM to YOSAN; 5.0NM to TOBBY; 3.0NM to TOBBY",
      },
      {
        stationId: "ZYT",
        notes: "3.0NM to CC06T; 1.0NM to CC06T; YASKN to 5.0NM to MISTA",
      },
      {
        stationId: "SPE",
        notes: "5.0NM to TOBBY; 3.0NM to TOBBY",
      },
      {
        stationId: "HWE",
        notes: "19.0NM to TOBBY; 17.0NM to TOBBY; 4.0NM to TOBBY; TOBBY",
      },
    ],
  },
  {
    id: "SOSHU_ONE_DEPARTURE",
    name: "SOSHU ONE DEPARTURE",
    type: "SID",
    navSpec: "RNAV1",
    airportId: "RJCC",
    runwayIds: ["01L", "01R", "19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID-12, effective 7 SEP 2023",
    notes: [
      "DME/DME/IRU or GNSS required.",
      "Radar service required.",
      "RWY01L/01R: climb on HDG 002 at or above 500FT, direct to CC01T, to CC02T, to CC03T at or above 3000FT, to CHE.",
      "RWY19R/19L: climb on HDG 182 at or above 500FT, direct to CHE.",
      "5.0% climb gradient required up to 500FT.",
    ],
    initialClimb: [
      {
        runwayIds: ["01L", "01R"],
        headingDeg: 2,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
      {
        runwayIds: ["19L", "19R"],
        headingDeg: 182,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
    ],
    variants: [
      {
        id: "SOSHU_ONE_RWY01",
        name: "SOSHU ONE RWY01",
        runwayIds: ["01L", "01R"],
        startId: "RJCC_RWY01_REPRESENTATIVE",
        startAnchorId: "RJCC_RWY01_REPRESENTATIVE",
        finalId: "CHE",
        routeFixes: ["CC01T", "CC02T", "CC03T", "CHE"],
        initialDisplayClimb: {
          type: "RUNWAY_HEADING_TO_ALTITUDE_GATE",
          gateId: "SOSHU_ONE_RWY01_500FT_GATE",
          role: "runway-heading-gate",
          headingDeg: 2,
          atOrAboveFt: 500,
          displayDistanceNm: 1.2,
          displayOnly: true,
          thenDirectToFixId: "CC01T",
          label: "HDG002 / >=500",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 2,
                fixId: "CC01T",
                altitude: { atOrAboveFt: 500 },
                notes: "Display preview uses a 500FT runway-heading gate before direct CC01T; not aircraft guidance.",
              },
              {
                type: "FIX",
                fixId: "CC02T",
              },
              {
                type: "FIX",
                fixId: "CC03T",
                altitude: { atOrAboveFt: 3000 },
              },
              {
                type: "DIRECT_FIX",
                fixId: "CHE",
              },
            ],
          },
        ],
        distanceNotes: [
          { from: "CC01T", to: "CC02T", distanceNm: 4.7, courseDeg: 92 },
          { from: "CC02T", to: "CC03T", distanceNm: 4.0, courseDeg: 182 },
          { from: "CC03T", to: "CHE", distanceNm: 8.5, courseDeg: 233.1 },
        ],
      },
      {
        id: "SOSHU_ONE_RWY19",
        name: "SOSHU ONE RWY19",
        runwayIds: ["19L", "19R"],
        startId: "RJCC_RWY19_REPRESENTATIVE",
        startAnchorId: "RJCC_RWY19_REPRESENTATIVE",
        finalId: "CHE",
        routeFixes: ["CHE"],
        initialDisplayClimb: {
          type: "RUNWAY_HEADING_TO_ALTITUDE_GATE",
          gateId: "SOSHU_ONE_RWY19_500FT_GATE",
          role: "runway-heading-gate",
          headingDeg: 182,
          atOrAboveFt: 500,
          displayDistanceNm: 1.2,
          displayOnly: true,
          thenDirectToFixId: "CHE",
          label: "HDG182 / >=500",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 182,
                fixId: "CHE",
                altitude: { atOrAboveFt: 500 },
                notes: "Display preview uses a 500FT runway-heading gate before direct CHE; not aircraft guidance.",
              },
            ],
          },
        ],
      },
    ],
    criticalDme: [
      {
        runwayIds: ["01L", "01R"],
        stationId: "CHE",
        notes: "2.0NM FM DER - 2.0NM to CC01T",
      },
    ],
    dmeGap: [
      {
        runwayIds: ["01L", "01R"],
        notes: "DER - 2.0NM FM DER; 3.0NM to CHE - CHE",
      },
      {
        runwayIds: ["19L", "19R"],
        notes: "DER - CHE",
      },
    ],
  },
  {
    id: "REZOT_TWO_DEPARTURE",
    name: "REZOT TWO DEPARTURE",
    type: "SID",
    navSpec: "RNAV1",
    airportId: "RJCC",
    runwayIds: ["01L", "01R", "19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID, effective 7 SEP 2023",
    notes: [
      "DME/DME/IRU or GNSS required.",
      "Radar service required.",
      "RWY01L/01R: climb on HDG 002 at or above 500FT, direct to CC01T, to CC02T, to CC03T at or above 3000FT, to CHE, to REZOT, to TEKKO at or above 11000FT.",
      "RWY19R/19L: climb on HDG 182 at or above 500FT, direct to CC06T, to REZOT, to TEKKO at or above 11000FT.",
      "5.0% climb gradient required up to 500FT.",
    ],
    initialClimb: [
      {
        runwayIds: ["01L", "01R"],
        headingDeg: 2,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
      {
        runwayIds: ["19L", "19R"],
        headingDeg: 182,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
    ],
    variants: [
      {
        id: "REZOT_TWO_RWY01",
        name: "REZOT TWO RWY01",
        runwayIds: ["01L", "01R"],
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 2,
                fixId: "CC01T",
                altitude: { atOrAboveFt: 500 },
                notes: "DER to CC01T; preview approximates heading leg as endpoint CC01T because DER coordinates are not represented.",
              },
              {
                type: "FIX",
                fixId: "CC02T",
              },
              {
                type: "FIX",
                fixId: "CC03T",
                altitude: { atOrAboveFt: 3000 },
              },
              {
                type: "DIRECT_FIX",
                fixId: "CHE",
              },
              {
                type: "FIX",
                fixId: "REZOT",
              },
              {
                type: "FIX",
                fixId: "TEKKO",
                altitude: { atOrAboveFt: 11000 },
              },
            ],
          },
        ],
        distanceNotes: [
          { from: "CC01T", to: "CC02T", distanceNm: 4.7, courseDeg: 92 },
          { from: "CC02T", to: "CC03T", distanceNm: 4.0, courseDeg: 182 },
          { from: "CC03T", to: "CHE", distanceNm: 8.5, courseDeg: 233.1 },
          { from: "CHE", to: "REZOT", distanceNm: 20.0, courseDeg: 256 },
          { from: "REZOT", to: "TEKKO", distanceNm: 9.5, courseDeg: 256 },
        ],
      },
      {
        id: "REZOT_TWO_RWY19",
        name: "REZOT TWO RWY19",
        runwayIds: ["19L", "19R"],
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 182,
                fixId: "CC06T",
                altitude: { atOrAboveFt: 500 },
                notes: "DER to CC06T; preview approximates heading leg as endpoint CC06T because DER coordinates are not represented.",
              },
              {
                type: "FIX",
                fixId: "REZOT",
              },
              {
                type: "FIX",
                fixId: "TEKKO",
                altitude: { atOrAboveFt: 11000 },
              },
            ],
          },
        ],
        distanceNotes: [
          { from: "CC06T", to: "REZOT", distanceNm: 20.1, courseDeg: 269 },
          { from: "REZOT", to: "TEKKO", distanceNm: 9.5, courseDeg: 256 },
        ],
      },
    ],
    criticalDme: [
      {
        runwayIds: ["01L", "01R"],
        stationId: "CHE",
        notes: "2.0NM FM DER - 2.0NM to CC01T",
      },
      {
        runwayIds: ["01L", "01R"],
        stationId: "MKE",
        notes: "CHE - 18.0NM to REZOT",
      },
      {
        runwayIds: ["01L", "01R"],
        stationId: "ZYT",
        notes: "CHE - 18.0NM to REZOT",
      },
      {
        runwayIds: ["19L", "19R"],
        stationId: "MKE",
        notes: "3.0NM to CC06T - 16.0NM to REZOT; 7.0NM to REZOT - REZOT",
      },
      {
        runwayIds: ["19L", "19R"],
        stationId: "ZYT",
        notes: "3.0NM to CC06T - 1.0NM to CC06T; 7.0NM to REZOT - REZOT",
      },
    ],
    dmeGap: [
      {
        runwayIds: ["01L", "01R"],
        notes: "DER - 2.0NM FM DER; 3.0NM to CHE - CHE",
      },
      {
        runwayIds: ["19L", "19R"],
        notes: "DER - 3.0NM to CC06T",
      },
    ],
  },
    {
    id: "DALBI_ONE_DEPARTURE",
    name: "DALBI ONE DEPARTURE",
    type: "SID",
    navSpec: "RNAV1",
    airportId: "RJCC",
    runwayIds: ["01L", "01R", "19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID, chart-derived display seed",
    notes: [
      "DME/DME/IRU or GNSS required.",
      "Radar service required.",
      "Display-layer route seed for RJCC Procedure Atlas.",
      "RWY01L/01R: direct to CC01T, to CC02T, to CC03T, to KUGIE, to POWAN, to ZALAR, to DALBI.",
      "RWY19L/19R: direct to NEJIE, to POWAN, to ZALAR, to DALBI.",
      "This entry is display/atlas data only; not aircraft guidance.",
    ],
    initialClimb: [
      {
        runwayIds: ["01L", "01R"],
        headingDeg: 2,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
      {
        runwayIds: ["19L", "19R"],
        headingDeg: 182,
        atOrAboveFt: 500,
        climbGradientPercentUntilFt: 500,
      },
    ],
    variants: [
      {
        id: "DALBI_ONE_RWY01",
        name: "DALBI ONE RWY01",
        runwayIds: ["01L", "01R"],
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 2,
                fixId: "CC01T",
                altitude: { atOrAboveFt: 500 },
                notes: "DER to CC01T; display preview approximates heading leg as endpoint CC01T.",
              },
              { type: "FIX", fixId: "CC02T" },
              {
                type: "FIX",
                fixId: "CC03T",
                altitude: { atOrAboveFt: 3000 },
              },
              { type: "FIX", fixId: "KUGIE" },
              { type: "FIX", fixId: "POWAN" },
              { type: "FIX", fixId: "ZALAR" },
              { type: "FIX", fixId: "DALBI" },
            ],
          },
        ],
      },
      {
        id: "DALBI_ONE_RWY19",
        name: "DALBI ONE RWY19",
        runwayIds: ["19L", "19R"],
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 182,
                fixId: "NEJIE",
                altitude: { atOrAboveFt: 500 },
                notes: "DER to NEJIE; display preview approximates heading leg as endpoint NEJIE.",
              },
              { type: "FIX", fixId: "POWAN" },
              { type: "FIX", fixId: "ZALAR" },
              { type: "FIX", fixId: "DALBI" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "CHITOSE_FOUR_DEPARTURE",
    name: "CHITOSE FOUR DEPARTURE",
    type: "SID",
    navSpec: "CONVENTIONAL",
    airportId: "RJCC",
    runwayIds: ["01L", "01R", "19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID-1, effective 7 SEP 2023",
    notes: [
      "RWY01L/01R: climb RWY HDG until 1NM FM RWY end / CHE 6.3 DME, turn right, direct to CHE VOR/DME within CHE 10DME (5NM FM RWY end).",
      "Cross 4DME prior to CHE VOR/DME (MKE R330) at or above 3000FT.",
      "RWY19R/19L: climb direct to CHE VOR/DME.",
      "Curved turn preview is display-only and approximate.",
    ],
    variants: [
      {
        id: "CHITOSE_FOUR_RWY01",
        name: "CHITOSE FOUR RWY01",
        runwayIds: ["01L", "01R"],
        previewGeometry: {
          type: "APPROX_RIGHT_TURN_TO_FIX",
          fromRunwayEnds: ["19R", "19L"],
          initialTrack: "RUNWAY_HEADING",
          initialHeadingDeg: 352.62,
          initialStraightNm: 1.0,
          turnRadiusNm: 2.4,
          maxTurnDeg: 210,
          sampleCount: 24,
          turnDirection: "RIGHT",
          toFixId: "CHE",
          altitudeGate: {
            id: "CHITOSE_FOUR_D4_CHE_GATE",
            stationId: "CHE",
            distanceNm: 4.0,
            atOrAboveFt: 3000,
            label: "D4 CHE 3000",
            notes: "Altitude constraint gate: cross D4 CHE at or above 3000FT; MKE R330 reference is metadata only.",
          },
          turnLimit: {
            stationId: "CHE",
            distanceNm: 10.0,
            distanceFromRunwayEndNm: 5.0,
          },
          approximate: true,
          notes: "Display-only approximation of RWY01 DER climb, right turn, then direct CHE. Not authoritative procedure geometry.",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "RUNWAY_HEADING",
                runwayHeading: true,
                until: {
                  distanceFromRunwayEndNm: 1.0,
                  dme: {
                    stationId: "CHE",
                    distanceNm: 6.3,
                  },
                },
                notes: "Climb runway heading until 1NM from runway end / CHE 6.3 DME.",
              },
              {
                type: "TURN_DIRECT_FIX",
                turnDirection: "RIGHT",
                fixId: "CHE",
                within: {
                  dme: {
                    stationId: "CHE",
                    distanceNm: 10.0,
                  },
                  distanceFromRunwayEndNm: 5.0,
                },
                notes: "Turn right direct CHE within CHE 10DME / 5NM from runway end.",
              },
              {
                type: "RADIAL_DME_CONSTRAINT",
                stationId: "CHE",
                distanceNmPriorToStation: 4.0,
                crossAtOrAboveFt: 3000,
                referenceRadial: {
                  stationId: "MKE",
                  radialDeg: 330,
                },
                notes: "Cross 4DME prior to CHE VOR/DME (MKE R330) at or above 3000FT. Metadata only.",
              },
              {
                type: "DIRECT_FIX",
                fixId: "CHE",
              },
            ],
          },
        ],
      },
      {
        id: "CHITOSE_FOUR_RWY19",
        name: "CHITOSE FOUR RWY19",
        runwayIds: ["19L", "19R"],
        previewGeometry: {
          type: "APPROX_DIRECT_TO_FIX",
          fromRunwayEnds: ["01L", "01R"],
          initialHeadingDeg: 172.62,
          toFixId: "CHE",
          approximate: true,
          notes: "Display-only approximate direct-to-CHE preview.",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 182,
                fixId: "CHE",
                notes: "Climb direct to CHE VOR/DME.",
              },
            ],
          },
        ],
      },
    ],
    radialDmeMetadata: [
      {
        id: "CHITOSE_FOUR_CHE_D6_3",
        stationId: "CHE",
        distanceNm: 6.3,
        notes: "1NM from RWY end / CHE 6.3 DME; RWY01L/01R",
      },
      {
        id: "CHITOSE_FOUR_CHE_D10",
        stationId: "CHE",
        distanceNm: 10.0,
        notes: "Turn/direct CHE within CHE 10DME / 5NM from RWY end; RWY01L/01R",
      },
      {
        id: "CHITOSE_FOUR_CHE_D4_PRIOR",
        stationId: "CHE",
        distanceNmPriorToStation: 4.0,
        referenceRadial: {
          stationId: "MKE",
          radialDeg: 330,
        },
        altitude: {
          atOrAboveFt: 3000,
        },
        notes: "Cross 4DME prior to CHE (MKE R330) at or above 3000FT; metadata only",
      },
    ],
  },
  {
    id: "KURIS_SEVEN_DEPARTURE",
    name: "KURIS SEVEN DEPARTURE",
    type: "SID",
    navSpec: "CONVENTIONAL",
    airportId: "RJCC",
    runwayIds: ["01L", "01R", "19L", "19R"],
    source: "AIP Japan RJCC AD2.24-SID, effective 7 SEP 2023",
    notes: [
      "RWY01L/01R: climb segment exists on chart but full text is not currently available in source extract.",
      "RWY19R/19L: climb RWY HDG until 1.8NM FM RWY end / CHE 2.0DME, turn left within 6NM, via CHE R011 to KURIS.",
      "RWY19 preview uses display-only approximate left teardrop geometry.",
      "CHE R011 and DME constraints are preserved as metadata only.",
    ],
    variants: [
      {
        id: "KURIS_SEVEN_RWY01",
        name: "KURIS SEVEN RWY01",
        runwayIds: ["01L", "01R"],
        previewGeometry: {
          type: "APPROX_TURN_TO_RADIAL",
          fromRunwayEnds: ["19R", "19L"],
          initialTrack: "RUNWAY_HEADING",
          initialHeadingDeg: 352.62,
          turnDirection: "RIGHT",
          turnStart: {
            distanceFromRunwayEndNm: 1.0,
          },
          turnLimit: {
            withinNm: 4.0,
          },
          interceptDistanceNm: 6.2,
          interceptRadial: {
            stationId: "CHE",
            radialDeg: 11,
          },
          toFixId: "KURIS",
          approximate: true,
          notes: "Approximate KURIS SEVEN RWY01 join to CHE R011 about 1NM after runway departure end; not authoritative.",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "RUNWAY_HEADING",
                runwayHeading: true,
                until: {
                  distanceFromRunwayEndNm: 1.0,
                },
                notes: "Display-only approximation: after leaving RWY01, continue about 1NM beyond the departure end before joining CHE R011.",
              },
              {
                type: "TURN_TO_RADIAL",
                stationId: "CHE",
                radialDeg: 11,
                fixId: "KURIS",
                notes: "Approximate turn/intercept to CHE R011.",
              },
              {
                type: "RADIAL_TO_FIX",
                stationId: "CHE",
                radialDeg: 11,
                fixId: "KURIS",
                notes: "Via CHE R011 to KURIS.",
              },
              {
                type: "FIX",
                fixId: "KURIS",
              },
            ],
          },
        ],
      },
      {
        id: "KURIS_SEVEN_RWY19",
        name: "KURIS SEVEN RWY19",
        runwayIds: ["19L", "19R"],
        previewGeometry: {
          type: "APPROX_LEFT_TEARDROP_TO_RADIAL",
          fromRunwayEnds: ["19L", "19R"],
          initialTrack: "RUNWAY_HEADING",
          initialHeadingDeg: 172.62,
          turnDirection: "LEFT",
          turnStart: {
            distanceFromRunwayEndNm: 1.8,
            dme: {
              stationId: "CHE",
              distanceNm: 2.0,
            },
          },
          turnLimit: {
            withinNm: 6.0,
          },
          interceptDistanceNm: 8.5,
          interceptRadial: {
            stationId: "CHE",
            radialDeg: 11,
          },
          toFixId: "KURIS",
          approximate: true,
          notes: "Approximate KURIS SEVEN left teardrop turn to CHE R011; not authoritative.",
        },
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "RUNWAY_HEADING",
                runwayHeading: true,
                until: {
                  distanceFromRunwayEndNm: 1.8,
                  dme: {
                    stationId: "CHE",
                    distanceNm: 2.0,
                  },
                },
                notes: "Climb runway heading until 1.8NM from runway end / CHE 2.0 DME.",
              },
              {
                type: "LEFT_TURN_TO_RADIAL",
                stationId: "CHE",
                radialDeg: 11,
                withinNm: 6.0,
                notes: "Turn left within 6NM to intercept CHE R011.",
              },
              {
                type: "RADIAL_TO_FIX",
                stationId: "CHE",
                radialDeg: 11,
                fixId: "KURIS",
                notes: "Via CHE R011 to KURIS.",
              },
              {
                type: "FIX",
                fixId: "KURIS",
              },
            ],
          },
        ],
        radialDmeMetadata: [
          {
            id: "KURIS_SEVEN_CHE_D2",
            stationId: "CHE",
            distanceNm: 2.0,
            notes: "Turn start reference: CHE 2.0 DME / 1.8NM from runway end.",
          },
          {
            id: "KURIS_SEVEN_TURN_WITHIN_6NM",
            stationId: "CHE",
            distanceNm: 6.0,
            notes: "Left turn within 6NM.",
          },
          {
            id: "KURIS_SEVEN_CHE_R011",
            stationId: "CHE",
            radialDeg: 11,
            notes: "Outbound radial to KURIS.",
          },
        ],
      },
    ],
  },
];

const {
  procedures: derivedDepartureProcedures,
  diagnostics: derivedDepartureDiagnostics,
} = buildDerivedDepartureProcedures(explicitDepartures);

if (derivedDepartureDiagnostics.duplicateDerivedIds.length) {
  console.warn("[RJCC procedures] Duplicate derived procedure IDs skipped:", derivedDepartureDiagnostics.duplicateDerivedIds);
}

export const departures = [
  ...explicitDepartures,
  ...derivedDepartureProcedures,
];

export { derivedDepartureProcedures, derivedDepartureDiagnostics };

export const approaches = [
  {
    id: "ILS_Y_RWY_01L",
    type: "APPROACH",
    airportId: "RJCC",
    runwayId: "01L",
    approachType: "ILS",
    name: "ILS Y Runway 01L",
    source: "prototype-placeholder",
    legs: [],
  },
  {
    id: "ILS_Z_RWY_01L",
    type: "APPROACH",
    airportId: "RJCC",
    runwayId: "01L",
    approachType: "ILS",
    name: "ILS Z Runway 01L",
    source: "prototype-placeholder",
    legs: [],
  },
  {
    id: "ILS_RWY_19R",
    type: "APPROACH",
    airportId: "RJCC",
    runwayId: "19R",
    approachType: "ILS",
    name: "ILS Runway 19R",
    source: "prototype-placeholder",
    legs: [],
  },
  {
    id: "ILS_RWY_19L",
    type: "APPROACH",
    airportId: "RJCC",
    runwayId: "19L",
    approachType: "ILS",
    name: "ILS Runway 19L",
    source: "prototype-placeholder",
    legs: [],
  },
  {
    id: "VISUAL_RWY_01L",
    type: "APPROACH",
    airportId: "RJCC",
    runwayId: "01L",
    approachType: "VISUAL",
    name: "Visual Runway 01L",
    source: "prototype-placeholder",
    legs: [],
  },
];

export const holdings = [
  {
    id: "HOLD_NAVER",
    fixId: "NAVER",
    inboundCourseDeg: null,
    turnDirection: "RIGHT",
    legTimeMin: 1,
    altitudeFt: 8500,
    source: "prototype-placeholder",
  },
];
