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
