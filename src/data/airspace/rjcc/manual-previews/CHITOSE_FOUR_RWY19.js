// src/data/airspace/rjcc/manual-previews/CHITOSE_FOUR_RWY19.js
// Display-only manual procedure preview geometry.
// Not authoritative navigation data. Not used by gameplay.

export const CHITOSE_FOUR_RWY19 = {
  "id": "CHITOSE_FOUR_RWY19",
  "type": "MANUAL_TRACE",
  "traceType": "APPROX_TURN",
  "approximate": true,
  "source": "manual chart trace",
  "coordinateSpace": "anchor-normalized",
  "points": [
    {
      "u": -0.000263,
      "v": -0.00038
    },
    {
      "u": 0.999677,
      "v": -0.000344
    }
  ],
  "anchorFrame": {
    "originId": "RJCC_RWY19_REPRESENTATIVE",
    "axisToId": "CHE",
    "startId": "RJCC_RWY19_REPRESENTATIVE",
    "finalId": "CHE"
  },
  "rawProjectedPoints": [
    {
      "x": 373,
      "y": 599.43,
      "lat": 42.761813,
      "lon": 141.694642
    },
    {
      "x": 371.77,
      "y": 611.7,
      "lat": 42.7,
      "lon": 141.686111
    }
  ],
  "constructionItems": [
    {
      "id": "c-1779269849963-e8y3j",
      "kind": "DME_CIRCLE",
      "label": "D6.3 CHE",
      "visible": true,
      "locked": false,
      "createdBy": "user",
      "approximate": true,
      "data": {
        "stationId": "CHE",
        "radiusNm": 6.3
      }
    },
    {
      "id": "c-1779269855296-0i18h",
      "kind": "RADIAL",
      "label": "MKE R330 MAG / true 321°",
      "visible": true,
      "locked": false,
      "createdBy": "user",
      "approximate": true,
      "data": {
        "stationId": "MKE",
        "radialDeg": 330,
        "bearingType": "MAGNETIC",
        "magneticVariationDeg": -9,
        "trueBearingDeg": 321,
        "lengthNm": 35
      }
    }
  ],
  "overlay": {
    "chartId": "CHITOSE_FOUR",
    "filename": "CHITOSE_FOUR.png",
    "imageUrl": "/charts/rjcc/CHITOSE_FOUR.png",
    "width": 1240,
    "height": 1755,
    "x": 367.97,
    "y": 578.62,
    "scale": 0.0765,
    "rotationDeg": 1.1,
    "opacity": 0.42
  },
  "notes": "Display-only traced preview; not authoritative navigation geometry.",
  "construction": {
    "constructionItems": [
      {
        "id": "c-1779269849963-e8y3j",
        "kind": "DME_CIRCLE",
        "label": "D6.3 CHE",
        "visible": true,
        "locked": false,
        "createdBy": "user",
        "approximate": true,
        "data": {
          "stationId": "CHE",
          "radiusNm": 6.3
        }
      },
      {
        "id": "c-1779269855296-0i18h",
        "kind": "RADIAL",
        "label": "MKE R330 MAG / true 321°",
        "visible": true,
        "locked": false,
        "createdBy": "user",
        "approximate": true,
        "data": {
          "stationId": "MKE",
          "radialDeg": 330,
          "bearingType": "MAGNETIC",
          "magneticVariationDeg": -9,
          "trueBearingDeg": 321,
          "lengthNm": 35
        }
      }
    ]
  }
};
