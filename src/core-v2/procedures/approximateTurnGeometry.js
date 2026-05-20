function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function headingVector(bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length <= 0) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function displayBearing(from, to) {
  return ((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI + 360) % 360;
}

function angleDelta(a, b) {
  return Math.abs((((a - b + 540) % 360) - 180));
}

function signedTurnDelta(fromDeg, toDeg, turnDirection) {
  let delta = ((toDeg - fromDeg + 540) % 360) - 180;
  if (turnDirection === "LEFT" && delta > 0) delta -= 360;
  if (turnDirection === "RIGHT" && delta < 0) delta += 360;
  return delta;
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function sampleHermite(start, end, startTangent, endTangent, sampleCount) {
  const samples = [];
  const count = clamp(Math.round(sampleCount), 8, 28);
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    samples.push({
      x: h00 * start.x + h10 * startTangent.x + h01 * end.x + h11 * endTangent.x,
      y: h00 * start.y + h10 * startTangent.y + h01 * end.y + h11 * endTangent.y,
    });
  }
  return samples.filter(isFinitePoint);
}

function pathLength(points) {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

function bounds(points) {
  return points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minY: Math.min(box.minY, point.y),
    maxY: Math.max(box.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function withinEnvelope(points, startPoint, endPoint, radius) {
  const base = bounds([startPoint, endPoint]);
  const pointBounds = bounds(points);
  const baseWidth = Math.max(1, base.maxX - base.minX);
  const baseHeight = Math.max(1, base.maxY - base.minY);
  const padding = Math.max(radius * 2.2, Math.max(baseWidth, baseHeight) * 0.35);
  return pointBounds.minX >= base.minX - padding
    && pointBounds.maxX <= base.maxX + padding
    && pointBounds.minY >= base.minY - padding
    && pointBounds.maxY <= base.maxY + padding
    && (pointBounds.maxX - pointBounds.minX) <= (baseWidth * 1.8) + (padding * 2)
    && (pointBounds.maxY - pointBounds.minY) <= (baseHeight * 1.8) + (padding * 2);
}

function fallbackPreview({ startPoint, endPoint, initialTrackDeg, turnDirection, straightDistance, radius }) {
  const heading = headingVector(initialTrackDeg);
  const right = { x: -heading.y, y: heading.x };
  const side = turnDirection === "LEFT" ? -1 : 1;
  const p1 = {
    x: startPoint.x + heading.x * straightDistance,
    y: startPoint.y + heading.y * straightDistance,
  };
  const p2 = {
    x: p1.x + right.x * side * radius * 0.8,
    y: p1.y + right.y * side * radius * 0.8,
  };
  return {
    points: [startPoint, p1, p2, endPoint].filter(isFinitePoint),
    warnings: ["Approximate turn preview used compact fallback geometry."],
  };
}

function compactSmoothFallback({ runwayEnd, runwayHeadingDeg, stationPoint, radialDirection, destinationFix, turnDirection, scale, turnStartNm, turnWithinNm }) {
  const heading = headingVector(runwayHeadingDeg);
  const right = { x: -heading.y, y: heading.x };
  const side = turnDirection === "LEFT" ? -1 : 1;
  const straightDistance = clamp(turnStartNm * scale, scale * 0.6, scale * 2.6);
  const interceptDistance = clamp(6 * scale, 4 * scale, Math.min(8 * scale, distance(stationPoint, destinationFix) * 0.55));
  const turnStart = {
    x: runwayEnd.x + heading.x * straightDistance,
    y: runwayEnd.y + heading.y * straightDistance,
  };
  const intercept = {
    x: stationPoint.x + radialDirection.x * interceptDistance,
    y: stationPoint.y + radialDirection.y * interceptDistance,
  };
  const tangentLength = clamp(distance(turnStart, intercept) * 0.55, scale * 2, scale * Math.max(5, turnWithinNm));
  const curve = sampleHermite(
    turnStart,
    intercept,
    {
      x: (heading.x + right.x * side * 0.22) * tangentLength,
      y: (heading.y + right.y * side * 0.22) * tangentLength,
    },
    {
      x: radialDirection.x * tangentLength,
      y: radialDirection.y * tangentLength,
    },
    18
  );
  return {
    points: [runwayEnd, turnStart, ...curve, destinationFix].filter(isFinitePoint),
    warnings: ["Turn-to-radial preview used compact smooth fallback geometry."],
  };
}

export function buildAircraftLikeTurnPreview({
  startPoint,
  endPoint,
  initialTrackDeg,
  turnDirection = "RIGHT",
  nmToDisplayUnits,
  initialStraightNm = 1,
  turnRadiusNm = 2.4,
  maxTurnDeg = 210,
  sampleCount = 24,
} = {}) {
  const warnings = [];
  if (!isFinitePoint(startPoint) || !isFinitePoint(endPoint) || !Number.isFinite(initialTrackDeg)) {
    return { points: [], warnings: ["Approximate turn preview skipped: invalid start, end, or heading."] };
  }

  const directDistance = distance(startPoint, endPoint);
  if (!Number.isFinite(directDistance) || directDistance <= 0) return { points: [], warnings: ["Approximate turn preview skipped: zero distance."] };

  const scale = Number.isFinite(nmToDisplayUnits) && nmToDisplayUnits > 0 ? nmToDisplayUnits : directDistance / 6;
  const straightDistance = clamp(initialStraightNm * scale, scale * 0.25, directDistance * 0.45);
  const radius = clamp(turnRadiusNm * scale, scale * 1.4, Math.max(scale * 3.2, directDistance * 0.46));
  const heading = headingVector(initialTrackDeg);
  const right = { x: -heading.y, y: heading.x };
  const side = turnDirection === "LEFT" ? -1 : 1;

  const turnStart = {
    x: startPoint.x + heading.x * straightDistance,
    y: startPoint.y + heading.y * straightDistance,
  };
  const center = {
    x: turnStart.x + right.x * side * radius,
    y: turnStart.y + right.y * side * radius,
  };
  const startAngle = Math.atan2(turnStart.y - center.y, turnStart.x - center.x);
  const steps = clamp(Math.round(sampleCount), 8, 24);
  const turnLimit = clamp(maxTurnDeg, 45, 240);
  const candidates = [];

  for (let i = 1; i <= steps; i += 1) {
    const turnDeg = (turnLimit * i) / steps;
    const angle = startAngle + side * (turnDeg * Math.PI / 180);
    const point = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    const track = (initialTrackDeg + side * turnDeg + 360) % 360;
    const directTrack = displayBearing(point, endPoint);
    const error = angleDelta(track, directTrack);
    candidates.push({ point, turnDeg, error });
    if (turnDeg >= 35 && error <= 10) break;
  }

  const selected = candidates.reduce((best, candidate) => {
    if (!best) return candidate;
    if (candidate.error < best.error) return candidate;
    return best;
  }, null);
  const arcEndIndex = selected ? candidates.indexOf(selected) : candidates.length - 1;
  const arcPoints = candidates.slice(0, arcEndIndex + 1).map((candidate) => candidate.point);
  const points = [startPoint, turnStart, ...arcPoints, endPoint].filter(isFinitePoint);

  const curveTooLong = pathLength(points) > (directDistance * 4.2) + (scale * 4);
  if (points.length < 2 || curveTooLong || !withinEnvelope(points, startPoint, endPoint, radius)) {
    return fallbackPreview({ startPoint, endPoint, initialTrackDeg, turnDirection, straightDistance, radius });
  }

  return { points, warnings };
}

export function buildTurnToRadialPreview({
  runwayEnd,
  runwayHeadingDeg,
  stationPoint,
  radialDeg,
  destinationFix,
  turnDirection = "LEFT",
  nmToDisplayUnits,
  initialStraightNm,
  interceptDistanceNm,
  turnStartNmFromRunwayEnd = 1.8,
  turnWithinNm = 6,
  sampleCount = 28,
} = {}) {
  const warnings = [];
  if (!isFinitePoint(runwayEnd) || !isFinitePoint(stationPoint) || !isFinitePoint(destinationFix)) {
    return { points: [], warnings: ["KURIS teardrop preview skipped: invalid runway, station, or destination point."] };
  }

  const scale = Number.isFinite(nmToDisplayUnits) && nmToDisplayUnits > 0
    ? nmToDisplayUnits
    : Math.max(1, distance(stationPoint, destinationFix) / 27.4);
  const radialDirection = normalizeVector({
    x: destinationFix.x - stationPoint.x,
    y: destinationFix.y - stationPoint.y,
  });
  if (!radialDirection || !Number.isFinite(runwayHeadingDeg)) {
    return { points: [], warnings: ["KURIS teardrop preview skipped: invalid radial or runway heading."] };
  }

  const radialDistance = distance(stationPoint, destinationFix);
  const straightNm = Number.isFinite(initialStraightNm) ? initialStraightNm : turnStartNmFromRunwayEnd;
  const heading = headingVector(runwayHeadingDeg);
  const radialBearing = displayBearing(stationPoint, destinationFix);
  const turnDelta = signedTurnDelta(runwayHeadingDeg, radialBearing, turnDirection);
  const defaultInterceptNm = Math.abs(turnDelta) > 90 ? 8.5 : 6.2;
  const targetInterceptNm = Number.isFinite(interceptDistanceNm) ? interceptDistanceNm : defaultInterceptNm;
  const interceptDistance = clamp(targetInterceptNm * scale, 4 * scale, Math.min(12 * scale, radialDistance * 0.65));
  const interceptPoint = {
    x: stationPoint.x + radialDirection.x * interceptDistance,
    y: stationPoint.y + radialDirection.y * interceptDistance,
  };
  const turnSteps = clamp(Math.round(sampleCount), 16, 32);
  const straightDistance = clamp(straightNm * scale, scale * 0.6, scale * 2.8);
  const turnRadius = clamp((turnWithinNm || 6) * scale * 0.34, scale * 1.6, scale * 2.8);
  const turnStart = {
    x: runwayEnd.x + heading.x * straightDistance,
    y: runwayEnd.y + heading.y * straightDistance,
  };

  const turnPoints = [];
  const turnArcLength = Math.abs((turnDelta * Math.PI / 180) * turnRadius);
  const stepLength = turnArcLength / turnSteps;
  let current = turnStart;
  for (let i = 1; i <= turnSteps; i += 1) {
    const t = smoothStep(i / turnSteps);
    const track = runwayHeadingDeg + turnDelta * t;
    const vector = headingVector(track);
    current = {
      x: current.x + vector.x * stepLength,
      y: current.y + vector.y * stepLength,
    };
    if (isFinitePoint(current)) turnPoints.push(current);
  }

  const arcEnd = turnPoints[turnPoints.length - 1] || turnStart;
  const finalTurnVector = headingVector(runwayHeadingDeg + turnDelta);
  const tangentLength = clamp(distance(arcEnd, interceptPoint) * 0.72, scale * 2.2, scale * 7.5);
  const captureCurve = sampleHermite(
    arcEnd,
    interceptPoint,
    {
      x: finalTurnVector.x * tangentLength,
      y: finalTurnVector.y * tangentLength,
    },
    {
      x: radialDirection.x * tangentLength,
      y: radialDirection.y * tangentLength,
    },
    16
  );
  const points = [runwayEnd, turnStart, ...turnPoints, ...captureCurve, destinationFix].filter(isFinitePoint);
  const directDistance = distance(runwayEnd, destinationFix);
  const tooLong = pathLength(points) > (directDistance * 4.6) + (scale * 8);
  const localEnvelope = withinEnvelope(points, runwayEnd, destinationFix, turnWithinNm * scale);

  if (points.length < 2 || tooLong || !localEnvelope) {
    return compactSmoothFallback({
      runwayEnd,
      runwayHeadingDeg,
      stationPoint,
      radialDirection,
      destinationFix,
      turnDirection,
      scale,
      turnStartNm: straightNm,
      turnWithinNm: turnWithinNm || 6,
    });
  }

  return {
    points,
    warnings: [
      `Approximate KURIS SEVEN left teardrop to CHE R${String(radialDeg).padStart(3, "0")}; not authoritative.`,
    ],
  };
}

export const buildApproxLeftTeardropToRadialPreview = buildTurnToRadialPreview;
