// src/data/airspace/rjcc/manual-previews/KURIS_SEVEN_RWY19.js
// Display-only manual procedure preview geometry.
// Not authoritative navigation data. Not used by gameplay.

export const KURIS_SEVEN_RWY19 = {
  "id": "KURIS_SEVEN_RWY19",
  "type": "MANUAL_TRACE",
  "traceType": "APPROX_TURN",
  "approximate": true,
  "source": "manual chart trace",
  "coordinateSpace": "anchor-normalized",
  "points": [
    {
      "u": 0.136112,
      "v": 0.009344
    },
    {
      "u": 0.241426,
      "v": -0.012588
    },
    {
      "u": 0.26541,
      "v": -0.017
    },
    {
      "u": 0.300965,
      "v": -0.008943
    },
    {
      "u": 0.342692,
      "v": 0.001794
    },
    {
      "u": 0.378266,
      "v": 0.000002
    },
    {
      "u": 1.00005,
      "v": -0.000026
    }
  ],
  "anchorFrame": {
    "originId": "CHE",
    "axisToId": "KURIS",
    "startId": "RJCC_RWY19_REPRESENTATIVE",
    "finalId": "KURIS"
  },
  "rawProjectedPoints": [
    {
      "x": 373,
      "y": 599.43,
      "lat": 42.761813,
      "lon": 141.694642
    },
    {
      "x": 371.32,
      "y": 589.85,
      "lat": 42.810083,
      "lon": 141.68304
    },
    {
      "x": 370.99,
      "y": 587.67,
      "lat": 42.821066,
      "lon": 141.6807
    },
    {
      "x": 371.82,
      "y": 584.48,
      "lat": 42.837148,
      "lon": 141.686462
    },
    {
      "x": 372.91,
      "y": 580.74,
      "lat": 42.855976,
      "lon": 141.694025
    },
    {
      "x": 372.85,
      "y": 577.52,
      "lat": 42.872192,
      "lon": 141.693634
    },
    {
      "x": 374.63,
      "y": 521.33,
      "lat": 43.155222,
      "lon": 141.706
    }
  ],
  "constructionItems": [
    {
      "id": "c-1779270486061-sgx4i",
      "kind": "RADIAL",
      "label": "CHE R011 MAG / true 002°",
      "visible": true,
      "locked": false,
      "createdBy": "user",
      "approximate": true,
      "data": {
        "stationId": "CHE",
        "radialDeg": 11,
        "bearingType": "MAGNETIC",
        "magneticVariationDeg": -9,
        "trueBearingDeg": 2,
        "lengthNm": 35
      }
    },
    {
      "id": "c-1779270589643-hd4lb",
      "kind": "DME_CIRCLE",
      "label": "D27.4 CHE",
      "visible": true,
      "locked": false,
      "createdBy": "user",
      "approximate": true,
      "data": {
        "stationId": "CHE",
        "radiusNm": 27.4
      }
    },
    {
      "id": "c-1779270619308-qsenx",
      "kind": "DME_CIRCLE",
      "label": "D2 CHE",
      "visible": true,
      "locked": false,
      "createdBy": "user",
      "approximate": true,
      "data": {
        "stationId": "CHE",
        "radiusNm": 2
      }
    }
  ],
  "overlay": {
    "chartId": "KURIS_SEVEN",
    "filename": "KURIS_SEVEN.png",
    "imageUrl": "/charts/rjcc/KURIS_SEVEN.png",
    "width": 1240,
    "height": 1755,
    "x": 373.88,
    "y": 533.67,
    "scale": 0.1436,
    "rotationDeg": -4,
    "opacity": 0.34
  },
  "notes": "Display-only traced preview; not authoritative navigation geometry.",
  "construction": {
    "constructionItems": [
      {
        "id": "c-1779270486061-sgx4i",
        "kind": "RADIAL",
        "label": "CHE R011 MAG / true 002°",
        "visible": true,
        "locked": false,
        "createdBy": "user",
        "approximate": true,
        "data": {
          "stationId": "CHE",
          "radialDeg": 11,
          "bearingType": "MAGNETIC",
          "magneticVariationDeg": -9,
          "trueBearingDeg": 2,
          "lengthNm": 35
        }
      },
      {
        "id": "c-1779270589643-hd4lb",
        "kind": "DME_CIRCLE",
        "label": "D27.4 CHE",
        "visible": true,
        "locked": false,
        "createdBy": "user",
        "approximate": true,
        "data": {
          "stationId": "CHE",
          "radiusNm": 27.4
        }
      },
      {
        "id": "c-1779270619308-qsenx",
        "kind": "DME_CIRCLE",
        "label": "D2 CHE",
        "visible": true,
        "locked": false,
        "createdBy": "user",
        "approximate": true,
        "data": {
          "stationId": "CHE",
          "radiusNm": 2
        }
      }
    ]
  }
};
