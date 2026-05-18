export const CENTER = 360;
export const PX_PER_NM = 5.0;
export const SIM_STEP_SECONDS = 0.5;
export const RADAR_SWEEP_SECONDS = 4;
export const RADAR_SWEEP_TICKS = Math.max(1, Math.round(RADAR_SWEEP_SECONDS / SIM_STEP_SECONDS));
export const MAX_TARGETS = 18;
export const ILS_NEAR_PX = 10;
export const ILS_FAR_PX = 34;
export const RJCC_RUNWAY_VISUAL_NM = 2.9;
export const OTHER_RUNWAY_VISUAL_NM = 2.0;
export const TWR_RADIUS_NM = 13;
export const PATTERN_ALT = 1500;
export const TWR_NM_PX = 42;
export const TWR_SCALE = TWR_NM_PX / PX_PER_NM;

export const RUNWAYS = {
  "01L": { name: "01L", course: 10, side: "L", pair: "01", offsetPx: -10 },
  "01R": { name: "01R", course: 10, side: "R", pair: "01", offsetPx: 10 },
  "19L": { name: "19L", course: 190, side: "L", pair: "19", offsetPx: 10 },
  "19R": { name: "19R", course: 190, side: "R", pair: "19", offsetPx: -10 },
  "01": { name: "01L", course: 10, side: "L", pair: "01", offsetPx: -10 },
  "19": { name: "19R", course: 190, side: "R", pair: "19", offsetPx: -10 },
};

export const RJCC_RUNWAY_NAMES = ["01L", "01R", "19L", "19R"];

export const AIRPORT_RUNWAYS = {
  RJCJ: [{ name: "18", course: 180 }, { name: "36", course: 360 }],
  RJCH: [{ name: "12", course: 120 }, { name: "30", course: 300 }],
  RJSM: [{ name: "10", course: 100 }, { name: "28", course: 280 }],
};
