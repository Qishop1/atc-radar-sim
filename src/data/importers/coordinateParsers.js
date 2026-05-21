function assertCoordinateRange(value, hemisphere, raw) {
  const limit = hemisphere === "N" || hemisphere === "S" ? 90 : 180;
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new Error(`Invalid coordinate range for ${raw}`);
  }
  return value;
}

function decimalDegrees({ degrees, minutes, seconds, hemisphere, raw }) {
  if (![degrees, minutes, seconds].every(Number.isFinite)) {
    throw new Error(`Invalid DMS coordinate ${raw}`);
  }
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    throw new Error(`Invalid DMS minutes/seconds for ${raw}`);
  }
  const sign = hemisphere === "S" || hemisphere === "W" ? -1 : 1;
  return assertCoordinateRange(sign * (degrees + minutes / 60 + seconds / 3600), hemisphere, raw);
}

export function parseVatsimDms(value) {
  if (typeof value !== "string") throw new Error(`Expected VATSIM DMS string, got ${typeof value}`);
  const raw = value.trim().toUpperCase();
  const match = /^([NSEW])(\d{2,3})\.(\d{2})\.(\d{2})(?:\.(\d{1,3}))?$/.exec(raw);
  if (!match) throw new Error(`Invalid VATSIM DMS coordinate ${value}`);

  const [, hemisphere, degreeText, minuteText, secondText, fractionalSecondText = ""] = match;
  const seconds = Number(`${secondText}${fractionalSecondText ? `.${fractionalSecondText}` : ""}`);
  return decimalDegrees({
    degrees: Number(degreeText),
    minutes: Number(minuteText),
    seconds,
    hemisphere,
    raw: value,
  });
}

export function parseVatsimLatitude(value) {
  const result = parseVatsimDms(value);
  const hemisphere = value.trim().toUpperCase()[0];
  if (hemisphere !== "N" && hemisphere !== "S") throw new Error(`Expected VATSIM latitude, got ${value}`);
  return result;
}

export function parseVatsimLongitude(value) {
  const result = parseVatsimDms(value);
  const hemisphere = value.trim().toUpperCase()[0];
  if (hemisphere !== "E" && hemisphere !== "W") throw new Error(`Expected VATSIM longitude, got ${value}`);
  return result;
}

export function parseJcabCompactDms(value) {
  if (typeof value !== "string") throw new Error(`Expected JCAB compact DMS string, got ${typeof value}`);
  const raw = value.trim().toUpperCase();
  const match = /^(\d+(?:\.\d+)?)([NSEW])$/.exec(raw);
  if (!match) throw new Error(`Invalid JCAB compact DMS coordinate ${value}`);

  const [, coordinateText, hemisphere] = match;
  const degreeLength = hemisphere === "N" || hemisphere === "S" ? 2 : 3;
  const [wholeText, fractionalText = ""] = coordinateText.split(".");
  const expectedMinimumLength = degreeLength + 4;
  if (wholeText.length < expectedMinimumLength) {
    throw new Error(`Invalid JCAB compact DMS length for ${value}`);
  }

  const degrees = Number(wholeText.slice(0, degreeLength));
  const minutes = Number(wholeText.slice(degreeLength, degreeLength + 2));
  const secondsText = `${wholeText.slice(degreeLength + 2)}${fractionalText ? `.${fractionalText}` : ""}`;

  return decimalDegrees({
    degrees,
    minutes,
    seconds: Number(secondsText),
    hemisphere,
    raw: value,
  });
}

export function parseJcabLatitude(value) {
  const hemisphere = String(value).trim().toUpperCase().at(-1);
  if (hemisphere !== "N" && hemisphere !== "S") throw new Error(`Expected JCAB latitude, got ${value}`);
  return parseJcabCompactDms(value);
}

export function parseJcabLongitude(value) {
  const hemisphere = String(value).trim().toUpperCase().at(-1);
  if (hemisphere !== "E" && hemisphere !== "W") throw new Error(`Expected JCAB longitude, got ${value}`);
  return parseJcabCompactDms(value);
}

export function parseKnownDms(value) {
  const text = String(value || "").trim().toUpperCase();
  if (/^[NSEW]\d{2,3}\.\d{2}\.\d{2}(?:\.\d{1,3})?$/.test(text)) return parseVatsimDms(text);
  if (/^\d+(?:\.\d+)?[NSEW]$/.test(text)) return parseJcabCompactDms(text);
  throw new Error(`Unsupported DMS coordinate ${value}`);
}

