import { fixes } from "../../data/airspace/rjcc/fixes.js";
import { navaids } from "../../data/airspace/rjcc/navaids.js";
import {
  continueApproach,
  descendAndMaintain,
  directToFix,
  expectApproach,
  flyHeading,
  holdAtFix,
  maintainAltitude,
  maintainSpeed,
  radarContact,
  reduceSpeedTo,
  resumeNormalSpeed,
} from "./clearanceFactories.js";
import { sampleApproaches } from "./sampleClearanceProfiles.js";
import { getApproachesForRunway } from "../procedures/procedureLookup.js";

function menuItem(id, label, component) {
  return { id, label, component };
}

export function buildClearanceMenu({ aircraft, context } = {}) {
  const availableFixIds = new Set((context?.fixes || fixes).map((fix) => fix.id));
  const availableNavaidIds = new Set((context?.navaids || navaids).map((navaid) => navaid.id));
  const airportId = aircraft?.destination || "RJCC";
  const procedureApproaches = context?.approaches || getApproachesForRunway({ airportId, runwayId: aircraft?.assignedRunwayId || undefined });
  const approachChoices = procedureApproaches.length ? procedureApproaches : sampleApproaches;
  const altitude = Math.round(aircraft?.altitudeFt ?? 0);
  const speed = Math.round(aircraft?.groundSpeedKt ?? 0);
  const directItems = [menuItem("direct-obgos", "Direct OBGOS", directToFix("OBGOS"))];
  for (const navaidId of ["CHE", "MKE", "HWE", "SPE"]) {
    if (availableNavaidIds.has(navaidId)) directItems.push(menuItem(`direct-${navaidId.toLowerCase()}`, `Direct ${navaidId}`, directToFix(navaidId)));
  }
  if (availableFixIds.has("NAVER")) directItems.push(menuItem("direct-naver", "Direct NAVER", directToFix("NAVER")));

  const flowItems = [
    menuItem("continue-approach", "Continue approach", continueApproach()),
    menuItem("hold-obgos-8500", "Hold at OBGOS maintain 8500", holdAtFix({ fixId: "OBGOS", altitudeFt: 8500 })),
    menuItem("hold-obgos-6500", "Hold at OBGOS maintain 6500", holdAtFix({ fixId: "OBGOS", altitudeFt: 6500 })),
  ];
  if (availableFixIds.has("NAVER")) flowItems.push(menuItem("hold-naver-8500", "Hold at NAVER maintain 8500", holdAtFix({ fixId: "NAVER", altitudeFt: 8500 })));

  return [
    { id: "radar-contact", label: "Radar Contact", items: [menuItem("radar-contact", "Radar contact", radarContact())] },
    { id: "expect-approach", label: "Expect Approach", items: approachChoices.map((approach) => menuItem(`expect-${approach.id}`, approach.name, expectApproach({ approachId: approach.id, runwayId: approach.runwayId, approachName: approach.name }))) },
    { id: "altitude", label: "Altitude", items: [menuItem("maintain-present-altitude", `Maintain present altitude (${altitude})`, maintainAltitude(altitude)), ...[11000, 8500, 6500, 4000].map((value) => menuItem(`descend-${value}`, `Descend and maintain ${value}`, descendAndMaintain(value)))] },
    { id: "speed", label: "Speed", items: [menuItem("maintain-present-speed", `Maintain present speed (${speed})`, maintainSpeed(speed)), ...[250, 220, 200, 180, 160].map((value) => menuItem(`speed-${value}`, `Reduce speed to ${value}`, reduceSpeedTo(value))), menuItem("resume-normal-speed", "Resume normal speed", resumeNormalSpeed())] },
    { id: "flow", label: "Flow", items: flowItems },
    { id: "vector", label: "Vector", items: [270, 290, 310, 350, 10].map((heading) => menuItem(`heading-${heading}`, `Fly heading ${String(heading).padStart(3, "0")}`, flyHeading(heading))) },
    { id: "direct", label: "Direct", items: directItems },
  ];
}
