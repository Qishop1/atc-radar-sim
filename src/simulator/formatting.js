export function wakeShort(wtc) { return wtc === "SUPER" ? "S" : wtc === "HEAVY" ? "H" : wtc === "LIGHT" ? "L" : "M"; }

export function formatEta(sec) {
  if (!Number.isFinite(sec)) return "--:--";
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatJstTime(sec) {
  if (!Number.isFinite(sec)) return "--:--:--";
  const s = Math.max(0, Math.round(sec));
  const daySec = (9 * 3600 + s) % 86400;
  const h = Math.floor(daySec / 3600);
  const m = Math.floor((daySec % 3600) / 60);
  const ss = daySec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function formatSignedClock(sec) {
  if (!Number.isFinite(sec)) return "+--:--";
  const sign = sec >= 0 ? "+" : "-";
  return `${sign}${formatEta(Math.abs(sec))}`;
}
