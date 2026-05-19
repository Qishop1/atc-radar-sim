export function translate(I18N, lang, key) {
  return I18N[lang]?.[key] || I18N.en[key] || key;
}

export function onOffText(value, tr) {
  return value ? tr("on") : tr("off");
}

export function categoryText(cat, lang, tr) {
  return lang === "zh" ? (cat === "ARR" ? tr("categoryArr") : cat === "DEP" ? tr("categoryDep") : cat === "MIL" ? tr("categoryMil") : cat) : cat;
}

export function vnavDisplayText(status, lang) {
  return lang === "zh" ? (status === "HIGH" ? "偏高" : status === "LOW" ? "偏低" : status === "PATH" ? "在剖面" : status) : status;
}

export function contactDisplayText(contact, lang) {
  return lang === "zh" ? (contact === "TWR" ? "塔台" : contact === "APP" ? "进近" : contact === "DEP" ? "离场" : contact === "ACC" ? "区域" : contact) : contact;
}

export function modeDisplayText(aircraft, { lang, tr, displayMode }) {
  const raw = displayMode(aircraft);
  if (lang !== "zh") return raw;
  return raw
    .replaceAll("TWR PENDING", tr("twrPending"))
    .replaceAll("LAND CLR", tr("landClr"))
    .replaceAll("TKOF CLR", tr("tkofClr"))
    .replaceAll("NO CLR", tr("noClr"))
    .replaceAll("ROLLOUT", tr("rollout"))
    .replaceAll("VACATED", tr("vacated"))
    .replaceAll("VISUAL", tr("visual"))
    .replaceAll("TWR PATTERN", `塔台${tr("pattern")}`)
    .replaceAll("PATTERN", tr("pattern"))
    .replaceAll("FINAL", "五边")
    .replaceAll("ILS", "ILS")
    .replaceAll("MISSED_APP", "复飞程序")
    .replaceAll("MISSED", "复飞")
    .replaceAll("DEP_READY", "离场待命")
    .replaceAll("LINEUP_WAIT", "跑道等待")
    .replaceAll("TAKEOFF_ROLL", "起飞滑跑")
    .replaceAll("DEP_RADAR_CONTACT", "离场雷达识别")
    .replaceAll("SID", "SID")
    .replaceAll("ROUTE", "航路")
    .replaceAll("VECTOR", "雷达引导")
    .replaceAll("HOLD", "等待")
    .replaceAll("DIRECT_FIX", "直飞点")
    .replaceAll("RADAR_CONTACT", "雷达识别");
}
