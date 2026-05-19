
// src/data/airspace/rjcc/runways.js
// Initial RJCC-area real-coordinate runway data seed.
// Coordinates are threshold coordinates from user-provided JAIP AD 2.12 extracts.

export const runways = [
  {
    airportId: "RJCC",
    id: "01L/19R",
    lengthM: 3000,
    widthM: 60,
    surface: "Asphalt Concrete",
    trueBearingDeg: 352.62,
    reciprocalTrueBearingDeg: 172.62,
    strength: "PCR 1157/F/C/X/T",
    slopePercent: 0.2,
    grooved: true,
    source: "JAIP RJCC AD 2.12",
    ends: [
      {
        id: "01L",
        lat: 42.7616388889, // 424541.90N
        lon: 141.692825, // 1414134.17E
        thresholdElevationFt: 62,
        tdzElevationFt: 66,
        geoidUndulationFt: 97.7,
        trueBearingDeg: 352.62,
      },
      {
        id: "19R",
        lat: 42.7884333333, // 424718.36N
        lon: 141.6881055556, // 1414117.18E
        thresholdElevationFt: 82,
        tdzElevationFt: 65,
        geoidUndulationFt: 98.2,
        trueBearingDeg: 172.62,
      },
    ],
  },
  {
    airportId: "RJCC",
    id: "01R/19L",
    lengthM: 3000,
    widthM: 60,
    surface: "Asphalt Concrete",
    trueBearingDeg: 352.62,
    reciprocalTrueBearingDeg: 172.62,
    strength: "PCR 1150/F/C/X/T",
    slopePercent: 0.2,
    grooved: true,
    source: "JAIP RJCC AD 2.12",
    ends: [
      {
        id: "01R",
        lat: 42.7619861111, // 424543.15N
        lon: 141.6964583333, // 1414147.25E
        thresholdElevationFt: 57.4,
        tdzElevationFt: 66,
        geoidUndulationFt: 97.7,
        trueBearingDeg: 352.62,
      },
      {
        id: "19L",
        lat: 42.7887666667, // 424719.56N
        lon: 141.6917444444, // 1414130.28E
        thresholdElevationFt: 77.1,
        tdzElevationFt: 74,
        geoidUndulationFt: 98.1,
        trueBearingDeg: 172.62,
      },
    ],
  },
  {
    airportId: "RJCJ",
    id: "18L/36R",
    lengthM: 3000,
    widthM: 60,
    surface: "Concrete",
    trueBearingDeg: 172.60,
    reciprocalTrueBearingDeg: 352.60,
    strength: "PCR 975/R/B/W/T; SW61000kg; DW87000kg; DTW202000kg",
    source: "JAIP RJCJ AD 2.12",
    stripDimensionsM: "3600x300",
    ends: [
      {
        id: "18L",
        lat: 42.8020333333, // 424807.32N
        lon: 141.6672111111, // 1414001.96E
        thresholdElevationFt: 70.0,
        tdzElevationFt: null,
        geoidUndulationFt: null,
        trueBearingDeg: 172.60,
      },
      {
        id: "36R",
        lat: 42.7752194444, // 424630.79N
        lon: 141.6719361111, // 1414018.97E
        thresholdElevationFt: 84.6,
        tdzElevationFt: null,
        geoidUndulationFt: null,
        trueBearingDeg: 352.60,
      },
    ],
  },
  {
    airportId: "RJCJ",
    id: "18R/36L",
    lengthM: 2700,
    widthM: 45,
    surface: "Asphalt Concrete",
    trueBearingDeg: 172.60,
    reciprocalTrueBearingDeg: 352.60,
    strength: "PCR 1038/F/B/X/T; SW20000kg; DW25000kg",
    source: "JAIP RJCJ AD 2.12",
    stripDimensionsM: "3300x450",
    ends: [
      {
        id: "18R",
        lat: 42.8105833333, // 424838.10N
        lon: 141.6620055556, // 1413943.22E
        thresholdElevationFt: 65.2,
        tdzElevationFt: null,
        geoidUndulationFt: null,
        trueBearingDeg: 172.60,
      },
      {
        id: "36L",
        lat: 42.7864777778, // 424711.32N
        lon: 141.6662555556, // 1413958.52E
        thresholdElevationFt: 86.7,
        tdzElevationFt: null,
        geoidUndulationFt: null,
        trueBearingDeg: 352.60,
      },
    ],
  },
  {
    airportId: "RJCH",
    id: "12/30",
    lengthM: 3000,
    widthM: 45,
    surface: "Asphalt Concrete",
    trueBearingDeg: 107.98,
    reciprocalTrueBearingDeg: 287.98,
    strength: "PCR 1088/F/D/X/T",
    grooved: true,
    source: "JAIP RJCH AD 2.12",
    ends: [
      {
        id: "12",
        lat: 41.7743388889, // 414627.62N
        lon: 140.8048916667, // 1404817.61E
        thresholdElevationFt: 92.2,
        tdzElevationFt: 103,
        geoidUndulationFt: 112.6,
        trueBearingDeg: 107.98,
      },
      {
        id: "30",
        lat: 41.766, // 414557.54N
        lon: 140.8391666667, // 1405021.00E
        thresholdElevationFt: 151,
        tdzElevationFt: null,
        geoidUndulationFt: 112.5,
        trueBearingDeg: 287.98,
      },
    ],
  },
  {
    airportId: "RJSM",
    id: "10/28",
    lengthM: 3047,
    widthM: 45,
    surface: "Asphalt Concrete",
    trueBearingDeg: null,
    reciprocalTrueBearingDeg: null,
    strength: "PCN 46/R/B/W/T",
    grooved: true,
    groovedDimensionsM: "3047x42",
    source: "JAIP RJSM AD 2.12",
    stripDimensionsM: "3650x600",
    slopeRemarks: "RWY 10: from crown of RWY -0.26; RWY 28: from crown of RWY -0.148",
    ends: [
      {
        id: "10",
        lat: 40.7044419444, // 404215.991N
        lon: 141.3503780556, // 1412101.361E
        thresholdElevationFt: 114,
        tdzElevationFt: 116,
        geoidUndulationFt: null,
        trueBearingDeg: null,
      },
      {
        id: "28",
        lat: 40.7019983333, // 404207.194N
        lon: 141.3863472222, // 1412310.850E
        thresholdElevationFt: 94,
        tdzElevationFt: 109,
        geoidUndulationFt: null,
        trueBearingDeg: null,
      },
    ],
  },
  {
    airportId: "RJCO",
    id: "14/32",
    lengthM: 1500,
    widthM: 45,
    surface: "Asphalt",
    trueBearingDeg: 134.85,
    reciprocalTrueBearingDeg: 314.85,
    strength: "PCR 286/F/D/X/T; SW20000kg; DW25000kg",
    grooved: true,
    groovedDimensionsM: "1500x45",
    source: "JAIP RJCO AD 2.12",
    stripDimensionsM: "1620x300",
    ends: [
      {
        id: "14",
        lat: 43.1221861111, // 430719.87N
        lon: 141.3747527778, // 1412229.11E
        thresholdElevationFt: 20,
        tdzElevationFt: null,
        geoidUndulationFt: 104.1,
        trueBearingDeg: 134.85,
      },
      {
        id: "32",
        lat: 43.1126611111, // 430645.58N
        lon: 141.3878222222, // 1412316.16E
        thresholdElevationFt: 27,
        tdzElevationFt: null,
        geoidUndulationFt: 104.0,
        trueBearingDeg: 314.85,
      },
    ],
  },
  {
    airportId: "RJEC",
    id: "16/34",
    lengthM: 2500,
    widthM: 60,
    surface: "Asphalt Concrete",
    trueBearingDeg: 154.17,
    reciprocalTrueBearingDeg: 334.17,
    strength: "PCR 1170/F/C/X/T",
    source: "JAIP RJEC AD 2.12",
    stripDimensionsM: "2620x300",
    ends: [
      {
        id: "16",
        lat: 43.6808444444, // 434051.04N
        lon: 142.4408222222, // 1422626.96E
        thresholdElevationFt: 660,
        tdzElevationFt: null,
        geoidUndulationFt: 105.2,
        trueBearingDeg: 154.17,
      },
      {
        id: "34",
        lat: 43.6605888889, // 433938.12N
        lon: 142.4543305556, // 1422715.59E
        thresholdElevationFt: 721,
        tdzElevationFt: 717.7,
        geoidUndulationFt: 105.3,
        trueBearingDeg: 334.17,
      },
    ],
  },
  {
    airportId: "RJCB",
    id: "17/35",
    lengthM: 2500,
    widthM: 45,
    surface: "Asphalt-Concrete",
    trueBearingDeg: 159.30,
    reciprocalTrueBearingDeg: 339.30,
    strength: "RWY 17 PCR 1229/F/D/X/T; RWY 35 PCR 1490/F/D/X/T",
    grooved: true,
    groovedDimensionsM: "2500x45",
    source: "JAIP RJCB AD 2.12",
    stripDimensionsM: "2620x300",
    ends: [
      {
        id: "17",
        lat: 42.7441277778, // 424438.86N
        lon: 143.2120305556, // 1431243.31E
        thresholdElevationFt: 470,
        tdzElevationFt: null,
        geoidUndulationFt: 92,
        trueBearingDeg: 159.30,
      },
      {
        id: "35",
        lat: 42.723075, // 424323.07N
        lon: 143.2228222222, // 1431322.16E
        thresholdElevationFt: 505,
        tdzElevationFt: null,
        geoidUndulationFt: 91,
        trueBearingDeg: 339.30,
      },
    ],
  },
];
