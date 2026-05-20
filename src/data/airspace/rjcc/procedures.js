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

export const departures = [
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
        segments: [
          {
            id: "main",
            legs: [
              {
                type: "HEADING_TO_FIX",
                headingDeg: 182,
                fixId: "CHE",
                altitude: { atOrAboveFt: 500 },
                notes: "DER to CHE; preview approximates heading leg as endpoint CHE because DER coordinates are not represented.",
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
];

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
