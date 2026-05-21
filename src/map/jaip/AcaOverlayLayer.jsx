import { averagePoint, offsetFromCenter } from "./pathHelpers.js";

export function AcaBoundaryRadarLayer({ paths }) {
  const common = { vectorEffect: "non-scaling-stroke" };
  return (
    <g id="aca-boundary-layer" fill="none" stroke="#2c6f7a" strokeWidth="0.65" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
      <path {...common} d={paths.linePath([19, 18, 21, 20, 7, 1, 5])} />
      <path {...common} d={paths.arcByThreePoints(5, 4, 12, 1)} />
      <path {...common} d={paths.linePath([12, 11])} />
      <path {...common} d={paths.circleArcPath(11, 10, 6, 1)} />
      <path {...common} d={paths.linePath([10, 15, 14, 19])} />
      <path {...common} d={paths.linePath([14, 13])} />
      <path {...common} d={paths.rjcoArc(2, 9, 1)} />
      <path {...common} d={paths.linePath([9, 10])} />
      <path {...common} d={paths.linePath([3, 4])} />
      <path {...common} d={paths.linePath([7, 8])} />
      <path {...common} d={paths.linePath([1, 8, 2])} />
      <path {...common} d={paths.linePath([13, 17])} />
      <path {...common} d={paths.hwe45Arc(15, 16, 1)} />
      <path {...common} d={paths.linePath([16, 17])} />
    </g>
  );
}

function RadiusLine({ x1, y1, x2, y2, both = false, stroke = "#5fa8b3" }) {
  return <path d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`} stroke={stroke} strokeWidth="0.7" vectorEffect="non-scaling-stroke" fill="none" markerEnd="url(#smallArrow)" markerStart={both ? "url(#smallArrowStart)" : undefined} />;
}

function DmeReferenceLayer({ pointById, paths, uiScale }) {
  const c6 = pointById[6];
  const rjcoCenter = pointById["RJCO ARP"];
  const hweCenter = pointById.HWE;
  const stroke = "#5fa8b3";
  const textStyle = { fill: stroke, fontSize: 10 * uiScale, fontFamily: "monospace", fontWeight: 600 };
  const rjco8Mark = rjcoCenter ? paths.radiusPointOnArc(rjcoCenter, 2, 9, 0.62, 1) : null;
  const rjco8Start = rjcoCenter && rjco8Mark ? offsetFromCenter(rjcoCenter, rjco8Mark, 13 * uiScale) : null;
  const center52Mark = paths.radiusPointOnArc(c6, 5, 12, 0.55, 1);
  const center45Mark = paths.radiusPointOnArc(c6, 11, 10, 0.48, 1);
  const hwe45Mark = hweCenter ? paths.radiusPointOnArc(hweCenter, 15, 16, 0.22, 1) : null;
  const hwe45Start = hweCenter && hwe45Mark ? offsetFromCenter(hweCenter, hwe45Mark, 12 * uiScale) : null;
  return (
    <g id="dme-radius-reference-layer" opacity="0.82">
      {rjco8Mark && rjco8Start && <><RadiusLine x1={rjco8Start.x} y1={rjco8Start.y} x2={rjco8Mark.x} y2={rjco8Mark.y} both /><text x={(rjco8Start.x + rjco8Mark.x) / 2} y={(rjco8Start.y + rjco8Mark.y) / 2 - 8 * uiScale} style={textStyle}>8NM</text></>}
      <circle cx={c6.x} cy={c6.y} r={1.1 * uiScale} fill={stroke} />
      <text x={c6.x - 18 * uiScale} y={c6.y + 14 * uiScale} style={textStyle}>CTS</text>
      <RadiusLine x1={c6.x} y1={c6.y} x2={center52Mark.x} y2={center52Mark.y} />
      <text x={(c6.x + center52Mark.x) / 2 + 10 * uiScale} y={(c6.y + center52Mark.y) / 2} style={textStyle}>52NM</text>
      <RadiusLine x1={c6.x} y1={c6.y} x2={center45Mark.x} y2={center45Mark.y} />
      <text x={(c6.x + center45Mark.x) / 2 - 18 * uiScale} y={(c6.y + center45Mark.y) / 2} style={textStyle}>45NM</text>
      {hwe45Mark && hwe45Start && <><RadiusLine x1={hwe45Start.x} y1={hwe45Start.y} x2={hwe45Mark.x} y2={hwe45Mark.y} /><text x={(hwe45Start.x + hwe45Mark.x) / 2 - 20 * uiScale} y={(hwe45Start.y + hwe45Mark.y) / 2 - 8 * uiScale} style={textStyle}>45NM</text></>}
    </g>
  );
}

function RadarAltitudeBlock({ x, y, top, bottom, exc, uiScale, width = 34 }) {
  const stroke = "#5fa8b3";
  const w = width * uiScale;
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.86">
      <line x1={-w / 2} x2={w / 2} y1={-12 * uiScale} y2={-12 * uiScale} stroke={stroke} strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
      <text x="0" y="0" textAnchor="middle" fill={stroke} fontSize={11 * uiScale} fontFamily="monospace" fontWeight="700">{top}</text>
      <text x="0" y={13 * uiScale} textAnchor="middle" fill={stroke} fontSize={11 * uiScale} fontFamily="monospace" fontWeight="700">{bottom}</text>
      <line x1={-w / 2} x2={w / 2} y1={18 * uiScale} y2={18 * uiScale} stroke={stroke} strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
      {exc && <text x="0" y={29 * uiScale} textAnchor="middle" fill={stroke} fontSize={8 * uiScale} fontFamily="monospace" fontWeight="600">{exc}</text>}
    </g>
  );
}

function RadarUpperLimit({ x, y, text = "FL200", uiScale, width = 30 }) {
  const stroke = "#5fa8b3";
  const w = width * uiScale;
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.86">
      <line x1={-w / 2} x2={w / 2} y1={-12 * uiScale} y2={-12 * uiScale} stroke={stroke} strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
      <text x="0" y="0" textAnchor="middle" fill={stroke} fontSize={11 * uiScale} fontFamily="monospace" fontWeight="700">{text}</text>
    </g>
  );
}

function AltitudeLayer({ pointById, uiScale }) {
  const altTri178Target = averagePoint(pointById, [1, 7, 8]);
  const altTri178 = averagePoint(pointById, [1, 7, 8], 92, -62);
  const altSector234578 = averagePoint(pointById, [2, 3, 4, 5, 7, 8], 0, 8);
  const altSector151610 = averagePoint(pointById, [15, 16, 10], 0, -28);
  const stroke = "#5fa8b3";
  return (
    <g id="altitude-block-layer">
      <RadarAltitudeBlock x={averagePoint(pointById, [18, 19, 20, 21], -6, 22).x} y={averagePoint(pointById, [18, 19, 20, 21], -6, 22).y} top="FL200" bottom="11000" exc="EXC 11000" uiScale={uiScale} />
      <path d={`M ${(altTri178.x - 28).toFixed(1)} ${(altTri178.y + 12).toFixed(1)} L ${altTri178Target.x.toFixed(1)} ${altTri178Target.y.toFixed(1)}`} stroke={stroke} strokeWidth="0.55" vectorEffect="non-scaling-stroke" fill="none" opacity="0.72" />
      <RadarAltitudeBlock x={altTri178.x} y={altTri178.y} top="FL160" bottom="8000" exc="EXC 8000" uiScale={uiScale} />
      <text x={altSector234578.x} y={altSector234578.y} textAnchor="middle" fill={stroke} fontSize={11 * uiScale} fontFamily="monospace" fontWeight="700" opacity="0.86">FL160</text>
      <RadarAltitudeBlock x={altSector151610.x} y={altSector151610.y} top="FL200" bottom="13000" exc="EXC 13000" uiScale={uiScale} />
      <RadarUpperLimit x={averagePoint(pointById, [4, 5, 10, 11, 12], 16, -46).x} y={averagePoint(pointById, [4, 5, 10, 11, 12], 16, -46).y} text="FL200" uiScale={uiScale} />
      <RadarUpperLimit x={averagePoint(pointById, [13, 14, 15, 16, 17], -2, -6).x} y={averagePoint(pointById, [13, 14, 15, 16, 17], -2, -6).y} text="FL200" uiScale={uiScale} />
    </g>
  );
}

function RadarNavaidSymbolLayer({ pointById, uiScale }) {
  const hwe = pointById.HWE;
  const rjco = pointById["RJCO ARP"];
  const stroke = "#5fa8b3";
  const s = uiScale;
  const hweHex = hwe ? Array.from({ length: 6 }, (_, i) => {
    const a = (-180 + i * 60) * Math.PI / 180;
    return `${(hwe.x + Math.cos(a) * 4.4 * s).toFixed(1)},${(hwe.y + Math.sin(a) * 4.4 * s).toFixed(1)}`;
  }).join(" ") : "";
  return (
    <g id="navaid-symbol-layer" opacity="0.9" fill="none" stroke={stroke} strokeWidth="0.65" vectorEffect="non-scaling-stroke">
      {hwe && <g><rect x={hwe.x - 5 * s} y={hwe.y - 5 * s} width={10 * s} height={10 * s} vectorEffect="non-scaling-stroke" /><polygon points={hweHex} vectorEffect="non-scaling-stroke" /><circle cx={hwe.x} cy={hwe.y} r={0.9 * s} fill={stroke} stroke="none" /></g>}
      {rjco && <g><circle cx={rjco.x} cy={rjco.y} r={5.5 * s} vectorEffect="non-scaling-stroke" /><circle cx={rjco.x} cy={rjco.y} r={3 * s} vectorEffect="non-scaling-stroke" /><circle cx={rjco.x} cy={rjco.y - 5.5 * s} r={1 * s} fill={stroke} stroke="none" /><circle cx={rjco.x + 5.5 * s} cy={rjco.y} r={1 * s} fill={stroke} stroke="none" /><circle cx={rjco.x} cy={rjco.y + 5.5 * s} r={1 * s} fill={stroke} stroke="none" /><circle cx={rjco.x - 5.5 * s} cy={rjco.y} r={1 * s} fill={stroke} stroke="none" /></g>}
    </g>
  );
}

export function AcaOverlayLayer({ pointById, paths, uiScale, showBoundary = true }) {
  return (
    <>
      {showBoundary && <AcaBoundaryRadarLayer paths={paths} />}
      <DmeReferenceLayer pointById={pointById} paths={paths} uiScale={uiScale} />
      <AltitudeLayer pointById={pointById} uiScale={uiScale} />
      <RadarNavaidSymbolLayer pointById={pointById} uiScale={uiScale} />
    </>
  );
}
