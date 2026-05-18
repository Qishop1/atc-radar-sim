export default function SelectedAircraftPanel({
  selected,
  selectedBR,
  selectedGeo,
  selectedVnavStatus,
  selectedVnavAlt,
  env,
  activeRunway,
  tr,
  lang,
  fmt3,
  fmtFL,
  catText,
  seatForAircraft,
  militaryBingoFuelMinutes,
  vnavText,
  modeText,
  contactText,
}) {
  return (
    <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 14, padding: 10, color: selected.category === "DEP" ? "#c084fc" : selected.category === "MIL" ? "#60a5fa" : "#32ff4d", fontFamily: "monospace", lineHeight: 1.45, fontSize: 12 }}>
      {selected.id} | {selected.type} | {catText(selected.category)} | {lang === "zh" ? "席位" : "SEAT"} {seatForAircraft(selected)}<br />
      {tr("targetBrg")} {fmt3(selectedBR.bearing)} / {selectedBR.rangeNm.toFixed(1)} NM<br />
      {tr("targetAlt")} {fmtFL(selected.altitude)} | {tr("targetSpd")} {Math.round(selected.speed)} | {tr("targetHdg")} {fmt3(selected.heading)}<br />
      {tr("fuel")} {Math.round(selected.fuelMinutes ?? 0)} min{selected.category === "MIL" ? ` | BINGO ${Math.round(selected.bingoFuelMinutes ?? militaryBingoFuelMinutes(selected, env))}` : ""} | {tr("burn")} {(selected.burnRate ?? 1).toFixed(1)}x<br />
      {selected.category === "DEP" ? `${tr("dest")} ${selected.destination} | ${tr("sid")} ${selected.sid || "-"}`
        : selected.category === "MIL" ? `${tr("dest")} ${selected.destination} | RJCJ ${tr("rwy")} ${env.airports.RJCJ.name}`
          : `${tr("rwy")} ${activeRunway} ${tr("dme")} ${selectedGeo.alongNm.toFixed(1)} | ${tr("loc")} ${Math.round(selectedGeo.crossPx)} | ${tr("vnav")} ${vnavText(selectedVnavStatus)} ${Math.round(selected.altitude - selectedVnavAlt)}`}<br />
      {tr("status")} {modeText(selected)}{selected.contact ? ` | ${tr("contact")} ${contactText(selected.contact)}` : ""}{selected.speedRestriction ? ` | ${tr("spdLim")} ${Math.round(selected.speedRestriction)}` : ""}
    </div>
  );
}
