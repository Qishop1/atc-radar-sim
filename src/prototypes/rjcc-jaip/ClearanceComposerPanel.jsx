import { useMemo, useState } from "react";
import { createSampleAircraft } from "../../core-v2/aircraft/aircraftState.js";
import {
  ALTITUDE,
  CONTINUE_APPROACH,
  DIRECT_FIX,
  EXPECT_APPROACH,
  GO_AROUND,
  HOLD,
  RADAR_CONTACT,
  SPEED,
  VECTOR_HEADING,
} from "../../core-v2/clearance/clearanceTypes.js";
import {
  climbAndMaintain,
  continueApproach,
  crossFixAt,
  crossFixAtOrAbove,
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
} from "../../core-v2/clearance/clearanceFactories.js";
import { formatClearancePhraseology } from "../../core-v2/clearance/phraseology.js";
import { validateClearanceComponents } from "../../core-v2/clearance/clearanceValidation.js";
import { sampleApproaches } from "../../core-v2/clearance/sampleClearanceProfiles.js";
import { buildAppInitialContactInteraction } from "../../core-v2/interactions/appInitialContact.js";

const panelStyle = {
  position: "absolute",
  right: 14,
  top: 14,
  zIndex: 15,
  width: "min(850px, calc(100vw - 28px))",
  color: "#9ed7df",
  fontFamily: "monospace",
  userSelect: "none",
};

const dialogStyle = {
  minHeight: 132,
  maxHeight: "58vh",
  overflow: "auto",
  padding: 10,
  background: "rgba(3,18,22,.64)",
  border: "1px solid rgba(126,198,207,.38)",
  borderRadius: 4,
  boxShadow: "0 18px 46px rgba(0,0,0,.30)",
  backdropFilter: "blur(2px)",
  animation: "clearancePanelIn 180ms ease-out",
  transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
};

const rowStyle = {
  padding: "5px 7px",
  border: "1px solid rgba(126,198,207,.18)",
  background: "rgba(5,24,29,.42)",
  fontSize: 11,
  lineHeight: 1.35,
  cursor: "pointer",
  transition: "background 130ms ease, color 130ms ease, border-color 130ms ease, transform 130ms ease",
};

function replacementTypesFor(component) {
  if (component.type === RADAR_CONTACT) return [RADAR_CONTACT];
  if (component.type === EXPECT_APPROACH) return [EXPECT_APPROACH];
  if (component.type === ALTITUDE) return [ALTITUDE];
  if (component.type === SPEED) return [SPEED];
  if ([CONTINUE_APPROACH, HOLD, GO_AROUND].includes(component.type)) return [CONTINUE_APPROACH, HOLD, GO_AROUND];
  if ([VECTOR_HEADING, DIRECT_FIX].includes(component.type)) return [VECTOR_HEADING, DIRECT_FIX];
  return [component.type];
}

function replaceComponents(current, incoming) {
  return incoming.reduce((next, component) => {
    if (component.type === RADAR_CONTACT && next.some((item) => item.type === RADAR_CONTACT)) return next;
    const replaceTypes = replacementTypesFor(component);
    return [...next.filter((item) => !replaceTypes.includes(item.type)), component];
  }, current);
}

function componentSummary(component) {
  if (component.type === RADAR_CONTACT) return "Radar contact";
  if (component.type === EXPECT_APPROACH) return `Expect ${component.approachName || component.approachId}`;
  if (component.type === ALTITUDE) return `${component.mode}: ${component.altitudeFt}${component.fixId ? ` ${component.fixId}` : ""}`;
  if (component.type === SPEED) return component.speedKt ? `${component.mode}: ${component.speedKt}` : component.mode;
  if (component.type === HOLD) return `Hold ${component.fixId} ${component.altitudeFt || ""}`.trim();
  if (component.type === CONTINUE_APPROACH) return "Continue approach";
  if (component.type === VECTOR_HEADING) return `Heading ${String(component.headingDeg).padStart(3, "0")}`;
  if (component.type === DIRECT_FIX) return `Direct ${component.fixId}`;
  return component.type;
}

function phraseFor(aircraft, components) {
  return formatClearancePhraseology({ callsign: aircraft.callsign, components });
}

function createSuggestedReplies(aircraft) {
  return [
    {
      id: "initial-expect-ils-y",
      label: phraseFor(aircraft, [radarContact(), expectApproach({ approachId: "ILS_Y_RWY_01L", runwayId: "01L", approachName: "ILS Y Runway 01L" })]),
      components: [radarContact(), expectApproach({ approachId: "ILS_Y_RWY_01L", runwayId: "01L", approachName: "ILS Y Runway 01L" })],
    },
    {
      id: "initial-continue",
      label: phraseFor(aircraft, [radarContact(), continueApproach()]),
      components: [radarContact(), continueApproach()],
    },
    {
      id: "initial-hold-obgos",
      label: phraseFor(aircraft, [radarContact(), holdAtFix({ fixId: "OBGOS", altitudeFt: 8500, expectApproachId: "ILS_Z_RWY_01L" }), expectApproach({ approachId: "ILS_Z_RWY_01L", runwayId: "01L", approachName: "ILS Z Runway 01L" })]),
      components: [radarContact(), holdAtFix({ fixId: "OBGOS", altitudeFt: 8500, expectApproachId: "ILS_Z_RWY_01L" }), expectApproach({ approachId: "ILS_Z_RWY_01L", runwayId: "01L", approachName: "ILS Z Runway 01L" })],
    },
    {
      id: "initial-descend-speed",
      label: phraseFor(aircraft, [radarContact(), descendAndMaintain(6500), reduceSpeedTo(180)]),
      components: [radarContact(), descendAndMaintain(6500), reduceSpeedTo(180)],
    },
  ];
}

function leaf(id, label, components) {
  return { id, label, components };
}

function branch(id, label, children) {
  return { id, label, children };
}

function createCascadeTree(aircraft, suggestedReplies) {
  const altitude = Math.round(aircraft.altitudeFt);
  const speed = Math.round(aircraft.groundSpeedKt);
  return [
    branch("replies", "Replies", [
      branch("replies-initial-contact", "Initial Contact", suggestedReplies.map((reply) => leaf(reply.id, reply.label, reply.components))),
    ]),
    branch("radar", "Radar Contact", [leaf("radar-contact", "Radar contact", [radarContact()])]),
    branch("expect", "Expect Approach", sampleApproaches.map((approach) => leaf(`expect-${approach.id}`, approach.name, [expectApproach({ approachId: approach.id, runwayId: approach.runwayId, approachName: approach.name })]))),
    branch("altitude", "Altitude", [
      branch("descend", "Descend and maintain", [11000, 8500, 6500, 4000].map((value) => leaf(`descend-${value}`, `${value}`, [descendAndMaintain(value)]))),
      branch("climb", "Climb and maintain", [4000, 6500, 8500, 11000].map((value) => leaf(`climb-${value}`, `${value}`, [climbAndMaintain(value)]))),
      branch("maintain-alt", "Maintain", [leaf("maintain-present-alt", `Present altitude ${altitude}`, [maintainAltitude(altitude)])]),
      branch("cross-fix", "Cross fix", [
        branch("cross-obgos", "OBGOS", [
          leaf("cross-obgos-at-or-above-8500", "At or above 8500", [crossFixAtOrAbove({ fixId: "OBGOS", altitudeFt: 8500 })]),
          leaf("cross-obgos-at-6500", "At 6500", [crossFixAt({ fixId: "OBGOS", altitudeFt: 6500 })]),
        ]),
        branch("cross-naver", "NAVER", [
          leaf("cross-naver-at-or-above-8500", "At or above 8500", [crossFixAtOrAbove({ fixId: "NAVER", altitudeFt: 8500 })]),
          leaf("cross-naver-at-6500", "At 6500", [crossFixAt({ fixId: "NAVER", altitudeFt: 6500 })]),
        ]),
      ]),
    ]),
    branch("speed", "Speed", [
      branch("reduce-speed", "Reduce speed to", [250, 220, 200, 180, 160].map((value) => leaf(`reduce-${value}`, `${value}`, [reduceSpeedTo(value)]))),
      branch("maintain-speed", "Maintain speed", [leaf("maintain-present-speed", `Present speed ${speed}`, [maintainSpeed(speed)]), ...[250, 220, 200, 180, 160].map((value) => leaf(`maintain-speed-${value}`, `${value}`, [maintainSpeed(value)]))]),
      branch("speed-managed", "Managed", [leaf("resume-normal-speed", "Resume normal speed", [resumeNormalSpeed()])]),
    ]),
    branch("flow", "Flow", [
      leaf("continue-approach", "Continue approach", [continueApproach()]),
      branch("hold", "Hold", [
        branch("hold-obgos", "OBGOS", [
          leaf("hold-obgos-8500", "Maintain 8500", [holdAtFix({ fixId: "OBGOS", altitudeFt: 8500 })]),
          leaf("hold-obgos-6500", "Maintain 6500", [holdAtFix({ fixId: "OBGOS", altitudeFt: 6500 })]),
        ]),
        branch("hold-naver", "NAVER", [leaf("hold-naver-8500", "Maintain 8500", [holdAtFix({ fixId: "NAVER", altitudeFt: 8500 })])]),
      ]),
    ]),
    branch("lateral", "Vector / Direct", [
      branch("heading", "Fly heading", [270, 290, 310, 350, 10].map((value) => leaf(`heading-${value}`, String(value).padStart(3, "0"), [flyHeading(value)]))),
      branch("direct", "Direct", ["OBGOS", "CHE", "MKE", "HWE", "SPE", "NAVER"].map((id) => leaf(`direct-${id}`, id, [directToFix(id)]))),
    ]),
  ];
}

function CascadeColumn({ nodes, activeId, onPick, depth }) {
  const minWidth = depth >= 2 ? 310 : 132;
  return (
    <div className="clearance-cascade-column" style={{ minWidth, display: "grid", alignContent: "start", gap: 4 }}>
      {nodes.map((node) => (
        <div
          key={node.id}
          className="clearance-option-row"
          role="button"
          tabIndex={0}
          onClick={() => onPick(node)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onPick(node); }}
          style={{
            ...rowStyle,
            padding: "4px 6px",
            background: activeId === node.id ? "rgba(13,82,99,.58)" : "rgba(5,24,29,.42)",
            color: activeId === node.id ? "#d8fbff" : "#9ed7df",
          }}
        >
          {node.label}{node.children ? " >" : ""}
        </div>
      ))}
    </div>
  );
}

export default function ClearanceComposerPanel() {
  const aircraft = useMemo(() => createSampleAircraft(), []);
  const context = useMemo(() => ({}), []);
  const interaction = useMemo(() => buildAppInitialContactInteraction({ aircraft, context }), [aircraft, context]);
  const suggestedReplies = useMemo(() => createSuggestedReplies(aircraft), [aircraft]);
  const cascadeTree = useMemo(() => createCascadeTree(aircraft, suggestedReplies), [aircraft, suggestedReplies]);
  const [components, setComponents] = useState(interaction.defaultComponents);
  const [cascadePath, setCascadePath] = useState([]);
  const phraseology = useMemo(() => formatClearancePhraseology({ callsign: aircraft.callsign, components }), [aircraft.callsign, components]);
  const validation = useMemo(() => validateClearanceComponents({ aircraft, components, context }), [aircraft, components, context]);
  const clearanceObject = useMemo(() => ({ aircraftId: aircraft.id, callsign: aircraft.callsign, components }), [aircraft.id, aircraft.callsign, components]);

  const applyComponents = (incoming) => setComponents((current) => replaceComponents(current, incoming));
  const chooseCascadeNode = (node, depth) => {
    const nextPath = [...cascadePath.slice(0, depth), node];
    setCascadePath(nextPath);
    if (node.components) applyComponents(node.components);
  };
  const cascadeColumns = [cascadeTree];
  for (const node of cascadePath) {
    if (node?.children) cascadeColumns.push(node.children);
  }

  return (
    <div style={panelStyle} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <style>
        {`
          @keyframes clearancePanelIn {
            from { opacity: 0; transform: translateY(-6px) scale(.992); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes clearanceColumnIn {
            from { opacity: 0; transform: translateX(8px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .clearance-cascade-column {
            animation: clearanceColumnIn 150ms ease-out;
          }
          .clearance-option-row:hover {
            background: rgba(13,82,99,.50) !important;
            border-color: rgba(126,198,207,.40) !important;
            color: #d8fbff !important;
            transform: translateY(-1px);
          }
          .clearance-option-row:active {
            transform: translateY(0);
          }
        `}
      </style>
      <div style={dialogStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#d8fbff" }}>CTS APP RADIO</div>
          <div style={{ fontSize: 10, color: "#5fa8b3" }}>CORE-V2 DIALOG</div>
        </div>

        <div style={{ minHeight: 44, border: "1px solid rgba(126,198,207,.18)", background: "rgba(0,0,0,.16)", padding: 7, marginBottom: 7 }}>
          <div style={{ color: "#7fc6cf", fontSize: 11, marginBottom: 4 }}>{aircraft.callsign}: {interaction.pilotMessage}</div>
          <div style={{ color: "#d8fbff", fontSize: 11, marginBottom: 4 }}>CTS APP:</div>
          <div style={{ color: "#b8edf2", fontSize: 11, lineHeight: 1.35 }}>{phraseology}</div>
        </div>

        <div style={{ fontSize: 10, color: "#5fa8b3", fontWeight: 900, marginBottom: 4 }}>CTS APP RESPONSE OPTIONS</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 5, marginBottom: 7 }}>
          {cascadeColumns.map((nodes, idx) => (
            <CascadeColumn key={idx} nodes={nodes} activeId={cascadePath[idx]?.id} depth={idx} onPick={(node) => chooseCascadeNode(node, idx)} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.62fr)", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: "#5fa8b3", fontWeight: 900, marginBottom: 4 }}>SELECTED</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {components.map((component) => <div key={`${component.type}-${component.mode || component.fixId || component.approachId || component.speedKt || component.headingDeg || "base"}`} style={{ padding: "3px 6px", border: "1px solid rgba(95,168,179,.18)", background: "rgba(13,82,99,.18)", fontSize: 10 }}>{componentSummary(component)}</div>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#5fa8b3", fontWeight: 900, marginBottom: 4 }}>VALIDATION</div>
            <div style={{ fontSize: 10, color: validation.valid ? "#86efac" : "#fca5a5", marginBottom: 5 }}>{validation.valid ? "valid" : "invalid"} | warnings {validation.warnings.length} | errors {validation.errors.length}</div>
            <pre style={{ margin: 0, padding: 6, maxHeight: 82, overflow: "auto", background: "rgba(2,10,12,.54)", border: "1px solid rgba(95,168,179,.18)", color: "#b8edf2", fontSize: 9, whiteSpace: "pre-wrap" }}>{JSON.stringify(clearanceObject, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
