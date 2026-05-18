import { isFoxhound } from "./interceptScenario.js";

export function runwayRoleColor(role) {
  return role === "CURRENT" ? "#22c55e"
    : role === "BOTH" ? "#84cc16"
      : role === "DEP" ? "#a855f7"
        : role === "PENDING" ? "#f59e0b"
          : role === "CLOSED" ? "#ef4444"
            : "#38bdf8";
}

export function radarRunwayOpacity(role) {
  return role === "CURRENT" ? "0.30"
    : role === "BOTH" ? "0.25"
      : role === "DEP" ? "0.20"
        : role === "PENDING" ? "0.18"
          : role === "CLOSED" ? "0.08"
            : "0.10";
}

export function radarRunwayStrokeWidth(role) {
  return role === "CURRENT" ? "1.45" : "1.05";
}

export function priorityNoticeColor(level) {
  return level === "FAIL" ? "#ef4444"
    : level === "DANGER" ? "#f97316"
      : level === "WARN" ? "#facc15"
        : level === "DONE" ? "#22c55e"
          : "#38bdf8";
}

export function missionAreaColor(area) {
  return area.dynamic ? "#f59e0b" : "#60a5fa";
}

export function weatherCellColor(level) {
  return level === "RED" ? "#ef4444" : "#facc15";
}

export function weatherCellLabelColor(level) {
  return level === "RED" ? "#fecaca" : "#fef3c7";
}

export function radarTargetColor(a, { conflictIds, cautionIds, selectedId }) {
  const lowFuel = (a.fuelMinutes ?? 60) < 15;
  return conflictIds.has(a.id) ? "#ff1f1f"
    : cautionIds.has(a.id) ? "#f59e0b"
      : a.emergency ? "#ff4d4d"
        : lowFuel ? "#ff4d4d"
          : a.id === selectedId ? "#f6e94d"
            : isFoxhound(a) ? "#ef4444"
              : a.category === "MIL" ? "#60a5fa"
                : a.category === "DEP" ? "#c084fc"
                  : a.clearedILS ? "#4de1ff"
                    : a.mode === "HOLD" ? "#f59e0b"
                      : "#32ff4d";
}
