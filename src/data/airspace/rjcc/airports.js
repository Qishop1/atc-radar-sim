// src/data/airspace/rjcc/airports.js
// Initial RJCC-area real-coordinate airport data seed.
// Source: user-provided JAIP AD 2 extracts.

export const airports = [
  {
    id: "RJCC",
    icao: "RJCC",
    name: "New Chitose Airport",
    lat: 42.7752777778, // 424631N
    lon: 141.6925, // 1414133E
    elevationFt: 69.8,
    magneticVariationDeg: -10,
    magneticVariationYear: 2024,
    source: "JAIP RJCC AD 2",
  },
  {
    id: "RJCJ",
    icao: "RJCJ",
    name: "Chitose Air Base",
    lat: 42.7944444444, // 424740N
    lon: 141.6663888889, // 1413959E
    elevationFt: 89,
    magneticVariationDeg: -9,
    magneticVariationYear: 2006,
    operator: "JSDF-A",
    trafficPermitted: "IFR/VFR",
    source: "JAIP RJCJ AD 2",
  },
  {
    id: "RJCH",
    icao: "RJCH",
    name: "Hakodate Airport",
    lat: 41.77, // 414612N
    lon: 140.8219444444, // 1404919E
    elevationFt: 111.9,
    magneticVariationDeg: -9,
    magneticVariationYear: 2009,
    source: "JAIP RJCH AD 2",
  },
  {
    id: "RJSM",
    icao: "RJSM",
    name: "Misawa Air Base / Misawa Airport",
    lat: 40.7030555556, // 404211N
    lon: 141.3683333333, // 1412206E
    elevationFt: 119,
    magneticVariationDeg: -9,
    magneticVariationYear: 2021,
    magneticVariationAnnualChange: "6'W",
    operator: "USAF",
    trafficPermitted: "IFR/VFR",
    source: "JAIP RJSM AD 2",
  },
  {
    id: "RJCO",
    icao: "RJCO",
    name: "Sapporo Okadama Airport",
    lat: 43.1175, // 430703N
    lon: 141.3813888889, // 1412253E
    elevationFt: 26,
    magneticVariationDeg: -9,
    magneticVariationYear: 2006,
    operator: "JSDF-G / Public AD",
    trafficPermitted: "IFR/VFR",
    source: "JAIP RJCO AD 2",
  },
  {
    id: "RJEC",
    icao: "RJEC",
    name: "Asahikawa Airport",
    lat: 43.6708333333, // 434015N
    lon: 142.4475, // 1422651E
    elevationFt: 690,
    geoidUndulationFt: 105,
    magneticVariationDeg: -10,
    magneticVariationYear: 2023,
    magneticVariationAnnualChange: "2.4'W",
    trafficPermitted: "IFR/VFR",
    source: "JAIP RJEC AD 2",
  },
  {
    id: "RJCB",
    icao: "RJCB",
    name: "Obihiro Airport",
    lat: 42.7333333333, // 424400N
    lon: 143.2172222222, // 1431302E
    elevationFt: 490,
    geoidUndulationFt: 92,
    magneticVariationDeg: -10,
    magneticVariationYear: 2024,
    magneticVariationAnnualChange: "3'W",
    trafficPermitted: "IFR/VFR",
    source: "JAIP RJCB AD 2",
  },
];

