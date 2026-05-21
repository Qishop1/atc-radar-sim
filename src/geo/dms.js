import { parseJcabCompactDms, parseVatsimDms } from "../data/importers/coordinateParsers.js";

export function parseDMS(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return NaN;

  const text = value.trim().toUpperCase();
  if (!text) return NaN;

  const hemisphereMatch = text.match(/[NSEW]/i);
  const hemisphere = hemisphereMatch?.[0]?.toUpperCase();
  const sign = hemisphere === "S" || hemisphere === "W" || text.startsWith("-") ? -1 : 1;

  try {
    if (/^[NSEW]\d{2,3}\.\d{2}\.\d{2}(?:\.\d{1,3})?$/.test(text)) return parseVatsimDms(text);
    if (/^\d+(?:\.\d+)?[NSEW]$/.test(text)) return parseJcabCompactDms(text);
  } catch {
    return NaN;
  }

  const compact = text.replace(/[NSEW]/gi, "").replace(/[+-]/g, "").trim();
  const compactDigits = compact.replace(/\D/g, "");
  const hasSeparators = /[^0-9.]/.test(compact);

  if (hemisphere && compactDigits === compact && !hasSeparators) {
    const degLen = hemisphere === "N" || hemisphere === "S" ? 2 : 3;
    if (compactDigits.length >= degLen) {
      const deg = Number(compactDigits.slice(0, degLen));
      const min = Number(compactDigits.slice(degLen, degLen + 2) || 0);
      const sec = Number(compactDigits.slice(degLen + 2) || 0);
      if ([deg, min, sec].every(Number.isFinite)) return sign * (deg + min / 60 + sec / 3600);
    }
  }

  const dotParts = text
    .replace(/[NSEW]/gi, "")
    .replace(/[+-]/g, "")
    .trim()
    .split(".");
  if (hemisphere && dotParts.length >= 3 && dotParts.every((part) => /^\d+$/.test(part))) {
    const deg = Number(dotParts[0]);
    const min = Number(dotParts[1] || 0);
    const sec = Number(dotParts[2] || 0);
    if ([deg, min, sec].every(Number.isFinite)) return sign * (deg + min / 60 + sec / 3600);
  }

  const parts = text
    .replace(/[NSEW]/gi, "")
    .replace(/[^\d.+-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);

  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return NaN;

  const absDeg = Math.abs(parts[0]) + ((parts[1] || 0) / 60) + ((parts[2] || 0) / 3600);
  return sign * absDeg;
}
