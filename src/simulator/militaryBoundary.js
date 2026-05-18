import { PX_PER_NM } from "./constants.js";
import { isRotor } from "./aircraftPerf.js";
import { bearingToXY, clamp, headingToPoint } from "./geometry.js";

export function militaryBingoFuelMinutes(ac, env) {
  const base = isRotor(ac) ? 10 : ac.type === "F-15J" ? 8 : 11;
  const rjcj = env.nav.find((w) => w.id === "RJCJ") || bearingToXY(285, 4.5);
  const distNm = Math.hypot(ac.x - rjcj.x, ac.y - rjcj.y) / PX_PER_NM;
  const cruiseKts = Math.max(90, Math.min(ac.type === "F-15J" ? 360 : isRotor(ac) ? 95 : 240, ac.assignedSpeed || ac.speed || 160));
  const timeHome = (distNm / cruiseKts) * 60;
  const recoveryReserve = isRotor(ac) ? 6 : 7;
  return clamp(Math.ceil(timeHome + recoveryReserve + base), 8, 28);
}

export function shouldMilitaryRTB(ac, env) {
  if (ac.category !== "MIL") return false;
  if (["RJCJ_RTB", "RJCJ_RECOVERY", "RJCJ_FINAL", "RJCJ_HELO_RECOVERY"].includes(ac.mode)) return false;
  const bingo = ac.bingoFuelMinutes ?? militaryBingoFuelMinutes(ac, env);
  return (ac.fuelMinutes ?? 60) <= bingo;
}

export function militaryRtbPatch(ac, env) {
  const rjcj = env.nav.find((w) => w.id === "RJCJ") || bearingToXY(285, 4.5);
  const h = headingToPoint(ac.x, ac.y, rjcj);
  return {
    mode: "RJCJ_RTB",
    assignedHeading: h,
    assignedAltitude: isRotor(ac) ? 1500 : 5000,
    assignedSpeed: isRotor(ac) ? 90 : Math.min(260, Math.max(180, ac.speed || 180)),
    destination: "RJCJ",
    missionComplete: false,
    rtbReason: "BINGO FUEL",
    color: "#fbbf24",
  };
}
