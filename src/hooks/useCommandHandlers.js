export function useCommandHandlers(ctx) {
  const {
    MAX_TARGETS,
    PATTERN_ALT,
    PX_PER_NM,
    RUNWAYS,
    activeRunway,
    aircraft,
    altitude,
    alternateHandoffRadiusNm,
    approachRunwayChangeRequiresMissed,
    approachSpeedFor,
    buildAppReacquirePatch,
    canClearVisual,
    clamp,
    commandDelayEnabled,
    commandDelaySec,
    companyCostIndexSpeed,
    depExitReady,
    depRunway,
    departureRunwayEntry,
    env,
    fmt3,
    heading,
    headingToPoint,
    holdAltitude,
    holdFix,
    ilsGateState,
    isApproachMode,
    isGroundTraffic,
    landingClearancePatch,
    lastDepTick,
    makeDeparture,
    makeMilitary,
    makeNavCached,
    makeRandomArrival,
    makeRoutes,
    makeSids,
    missedApproachPatch,
    normHeading,
    normalizeAircraftState,
    openArrRunways,
    openDepRunways,
    preferredArrivalRunwayFor,
    runwayOccupied,
    scenarioEnded,
    seat,
    selected,
    selectedBR,
    selectedId,
    selectAircraft,
    seq,
    setAircraft,
    setAltitude,
    setHandoffCount,
    setHeading,
    setLastDepTick,
    setLog,
    setPendingCommands,
    setSeq,
    setSpeed,
    speed,
    speedLimitForAircraft,
    suggestHoldForBearing,
    suggestRouteForBearing,
    tick,
    visualDownwindEntry,
    vnavTargetAltitude,
    wp,
    xyToBearingRange,
  } = ctx;

  function pushRadio(cmd, rb) { setLog((p) => [cmd, rb, ...p].slice(0, 14)); }
  function rejectGroundApproachCommand(ac = selected, label = "approach command") {
    const ground = isGroundTraffic(ac) || ac.altitude < 500 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(ac.mode);
    if (!ground) return false;
    setLog((p) => [`${ac.id}: ${label} rejected — aircraft is on ground. Use TWR/DEP controls first.`, ...p].slice(0, 14));
    return true;
  }
  function assignedHoldAltitude(fixId) {
    const typed = Number(holdAltitude);
    if (Number.isFinite(typed) && typed >= 3000) return clamp(typed, 3000, 14000);
    const sameFix = aircraft.filter((a) => a.id !== selected.id && a.mode === "HOLD" && a.hold?.fixId === fixId && !a.handedOff && !a.landed);
    const used = new Set(sameFix.map((a) => Math.round((a.hold?.altitude || a.assignedAltitude || 6000) / 1000) * 1000));
    for (const alt of [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000]) {
      if (!used.has(alt)) return alt;
    }
    return 14000;
  }
  function setSelectedPatch(patch, opts = {}) {
    if (scenarioEnded) return;
    const targetId = opts.targetId || selectedId;
    const target = aircraft.find((a) => a.id === targetId) || selected;
    const delayed = commandDelayEnabled && !opts.immediate && target && !["FUEL_EXHAUSTED", "DEADSTICK"].includes(target.mode);
    if (delayed) {
      const delayTicks = Math.max(1, Math.round((Number(commandDelaySec) || 0) * 2));
      const cmd = { id: `${targetId}-${Date.now()}-${Math.random().toString(36).slice(2)}`, targetId, patch, dueTick: tick + delayTicks, createdTick: tick, label: opts.label || "COMMAND" };
      setPendingCommands((p) => [...p, cmd].slice(-20));
      setLog((p) => [`${targetId}: ${cmd.label} acknowledged, execution in ${Number(commandDelaySec) || 0}s.`, ...p].slice(0, 14));
      return;
    }
    setAircraft((prev) => prev.map((a) => a.id === targetId ? normalizeAircraftState({ ...a, ...patch, color: (patch.category ?? a.category) === "DEP" ? "#c084fc" : patch.category === "MIL" || a.category === "MIL" ? "#60a5fa" : "#f6e94d" }) : a));
  }
  function appReacquirePatch(extra = {}) { return buildAppReacquirePatch(selected, extra); }
  function applyVectorHeading(h) {
    if (selected.category === "MIL") {
      setLog((p) => [`RJCC ${seat}: no authority to vector ${selected.id}. RJCJ tactical traffic is protected by mission corridor only.`, ...p].slice(0, 14));
      return;
    }
    const alt = clamp(Number(altitude) || selected.assignedAltitude, 0, 45000), spd = clamp(Number(speed) || selected.assignedSpeed, 90, speedLimitForAircraft(selected, alt)), reacquire = selected.depState === "MISSED_APP" || selected.mode === "MISSED_APP" || selected.mode === "MISSED_TRANSFER_APP";
    const vectorMode = reacquire ? "VECTOR" : selected.category === "DEP" ? "DEP_VECTOR" : "VECTOR";
    setSelectedPatch(appReacquirePatch({ assignedHeading: h, assignedAltitude: alt, assignedSpeed: spd, speedRestriction: null, clearedILS: false, mode: vectorMode, route: [], hold: null }), { label: `HDG ${fmt3(h)} ALT ${Math.round(alt)} SPD ${Math.round(spd)}` });
    setHeading(fmt3(h)); setSpeed(String(Math.round(spd)));
    pushRadio(`${selected.id}, turn heading ${fmt3(h)}, maintain ${Math.round(alt)}, speed ${Math.round(spd)}.`, `${selected.id}: heading ${fmt3(h)}, maintain ${Math.round(alt)}, speed ${Math.round(spd)}.`);
  }
  function issueCommand() { applyVectorHeading(Number.isFinite(Number(heading)) ? normHeading(Number(heading)) : selected.assignedHeading); }
  function altitudeOnly() {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no altitude authority for ${selected.id}.`, ...p].slice(0, 14)); return; }
    const alt = clamp(Number(altitude) || selected.assignedAltitude, 0, 45000);
    const patch = selected.category === "DEP"
      ? { assignedAltitude: alt, requestedAltitude: alt, depState: selected.depState === "PENDING_TWR" ? selected.depState : "RELEASED" }
      : { assignedAltitude: alt };
    setSelectedPatch(patch, { label: `ALT ${Math.round(alt)}` });
    pushRadio(`${selected.id}, maintain ${Math.round(alt)}.`, `${selected.id}: maintain ${Math.round(alt)}.`);
  }

  function spawnNow() { if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`Sector saturated: maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14)); if (seat === "DEP" && tick - lastDepTick < 75) return setLog((p) => [`Tower: runway departure spacing not available yet.`, ...p].slice(0, 14)); const depChoice = openDepRunways[seq % openDepRunways.length] || depRunway; const next = seat === "DEP" ? makeDeparture(seq + 50, env, depChoice) : makeRandomArrival(seq); setSeq((s) => s + 1); if (seat === "DEP") setLastDepTick(tick); setAircraft((p) => [...p, normalizeAircraftState(next)]); selectAircraft(next.id); setLog((p) => [seat === "DEP" ? `Tower: ${next.id} ready for departure RWY ${next.depRunway}. Filed ${next.sid} to ${next.destination}.` : `${next.id}: new inbound target, radar contact.`, ...p].slice(0, 14)); }

  function spawnMil() {
    if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`Sector saturated: maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14));
    const next = makeMilitary(seq + 90, aircraft, null, env);
    setSeq((s) => s + 1);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    selectAircraft(next.id);
    setLog((p) => [`RJCJ: ${next.id} ${next.type} airborne / tactical traffic.`, ...p].slice(0, 14));
  }
  function debugSpawn(kind = "MIL", forcedType = null) {
    if (aircraft.length >= MAX_TARGETS) return setLog((p) => [`DEBUG: sector saturated, maximum ${MAX_TARGETS} active targets.`, ...p].slice(0, 14));
    let next;
    if (kind === "ARR") next = makeRandomArrival(seq + 700);
    else if (kind === "DEP") next = makeDeparture(seq + 750, env, openDepRunways[seq % openDepRunways.length] || depRunway);
    else next = makeMilitary(seq + 790, aircraft, forcedType, env);
    setSeq((s) => s + 1);
    setAircraft((p) => [...p, normalizeAircraftState(next)]);
    selectAircraft(next.id);
    setLog((p) => [`DEBUG SPAWN: ${next.id} ${next.type} ${next.category} ${next.mode}.`, ...p].slice(0, 14));
  }
  function divertSelected(alternate = "AUTO") {
    if (selected.category !== "ARR") {
      setLog((p) => [`${selected.id}: divert rejected — only civil arrivals can be sent to RJCH/RJSM with this command.`, ...p].slice(0, 14));
      return;
    }
    const dest = alternate === "AUTO" ? (selectedBR.bearing > 180 ? "RJCH" : "RJSM") : alternate;
    const fix = wp(env.nav, dest);
    if (!fix) return;
    const h = headingToPoint(selected.x, selected.y, fix);
    setSelectedPatch({ destination: dest, alternate: dest, alternateRunway: null, alternateCourse: null, mode: "DIVERT", route: [], hold: null, clearedILS: false, landingClearance: false, towerControlled: false, contact: "APP", assignedHeading: h, assignedAltitude: 9000, assignedSpeed: 230 });
    pushRadio(`${selected.id}, divert to ${dest}, fly heading ${fmt3(h)}, maintain 9000. Contact ${dest} Approach within ${alternateHandoffRadiusNm(dest)} miles.`, `${selected.id}: diverting ${dest}, heading ${fmt3(h)}, maintain 9000.`);
  }
  function divertAll() {
    setAircraft((prev) => prev.map((a) => {
      if (a.category === "DEP" || a.category === "MIL" || a.handedOff) return a;
      const br = xyToBearingRange(a.x, a.y);
      const dest = br.bearing > 180 ? "RJCH" : "RJSM";
      const fix = wp(env.nav, dest);
      return { ...a, destination: dest, alternate: dest, alternateRunway: null, alternateCourse: null, mode: "DIVERT", route: [], hold: null, clearedILS: false, landingClearance: false, towerControlled: false, contact: "APP", assignedHeading: headingToPoint(a.x, a.y, fix), assignedAltitude: 9000, assignedSpeed: 230, color: "#f59e0b" };
    }));
    setLog((p) => [`CHITOSE APP: field condition unsafe, all civil arrivals divert RJCH/RJSM. RJCJ SAR/CAP traffic remains with RJCJ control.`, ...p].slice(0, 14));
  }

  function assignRoute() {
    if (rejectGroundApproachCommand(selected, "STAR/VNAV")) return;
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: runway change rejected — already committed to runway ${selected.approachRunway || selected.routeRunway}. Issue missed approach first.`, ...p].slice(0, 14));
      return;
    }
    const nav = makeNavCached(targetRunway);
    const routes = makeRoutes(targetRunway);
    const picked = suggestRouteForBearing(selectedBR.bearing);
    const route = routes[picked] || routes.SOUTH;
    const routeEnv = { ...env, runway: RUNWAYS[targetRunway], nav, routes, sids: makeSids(targetRunway) };
    const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", routeRunway: targetRunway, approachRunway: targetRunway }, routeEnv, 0);
    setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, routeRunway: targetRunway, approachRunway: targetRunway, clearedILS: false, hold: null, speedRestriction: null, assignedSpeed: 200, assignedAltitude: vnavAlt }));
    pushRadio(`${selected.id}, proceed via ${picked}, descend via profile, expect ILS runway ${targetRunway}.`, `${selected.id}: via ${picked}, descend via profile, expect ILS ${targetRunway}.`);
  }
  function vectorToIF01() {
    if (rejectGroundApproachCommand(selected, "direct IF01")) return;
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: direct IF01 runway ${targetRunway} rejected — approach locked to runway ${selected.approachRunway || selected.routeRunway}. Go around before reassigning runway.`, ...p].slice(0, 14));
      return;
    }
    const route = makeRoutes(targetRunway).VECTORS_IF01;
    const routeEnv = { ...env, runway: RUNWAYS[targetRunway], nav: makeNavCached(targetRunway), routes: makeRoutes(targetRunway), sids: makeSids(targetRunway) };
    const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", routeRunway: targetRunway, approachRunway: targetRunway }, routeEnv, 0);
    setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, routeRunway: targetRunway, approachRunway: targetRunway, clearedILS: false, hold: null, speedRestriction: null, assignedSpeed: 190, assignedAltitude: vnavAlt }));
    pushRadio(`${selected.id}, direct IF01 runway ${targetRunway}, descend via profile, expect intercept runway heading ${fmt3(RUNWAYS[targetRunway].course)}.`, `${selected.id}: direct IF01 runway ${targetRunway}, descend via profile.`);
  }
  function holdAtFix() { if (rejectGroundApproachCommand(selected, "hold/fix")) return; const fix = holdFix !== "AUTO" ? holdFix : suggestHoldForBearing(selectedBR.bearing), alt = assignedHoldAltitude(fix); setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: fix, altitude: alt }, route: [], clearedILS: false, speedRestriction: null, assignedSpeed: 190, assignedAltitude: alt })); pushRadio(`${selected.id}, hold at ${fix}, maintain ${alt}, speed 190.`, `${selected.id}: hold at ${fix}, maintain ${alt}, speed 190.`); }
  function clearILS() { if (rejectGroundApproachCommand(selected, "ILS/approach")) return; const gate = ilsGateState(selected, env); setLog((p) => [`${selected.id}: ILS is automatic. Capture ${gate.capture ? "available" : "not available"}; fly the published route or vector into the intercept cone.`, ...p].slice(0, 14)); }
  function clearVisual(requested = "DOWNWIND") {
    if (rejectGroundApproachCommand(selected, "visual approach")) return;
    if (!canClearVisual(selected, env)) return setLog((p) => [`${selected.id}, unable visual approach. Aircraft must be ARR, below FL060, speed controlled, and field/weather acceptable.`, ...p].slice(0, 14));
    const targetRunway = preferredArrivalRunwayFor(selected);
    if (approachRunwayChangeRequiresMissed(selected, targetRunway)) {
      setLog((p) => [`${selected.id}: visual runway ${targetRunway} rejected — approach locked to runway ${selected.approachRunway || selected.routeRunway}. Use go-around first.`, ...p].slice(0, 14));
      return;
    }
    const visualEnv = { ...env, runway: RUNWAYS[targetRunway], nav: makeNavCached(targetRunway), routes: makeRoutes(targetRunway), sids: makeSids(targetRunway) };
    const entry = visualDownwindEntry(visualEnv);
    setSelectedPatch({ towerControlled: false, contact: "APP", landingClearance: false, clearedILS: false, mode: "VISUAL_APP", routeRunway: targetRunway, approachRunway: targetRunway, patternLeg: 0, patternReport: null, route: [], hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, entry), assignedAltitude: Math.max(PATTERN_ALT, Math.min(4500, selected.altitude)), assignedSpeed: Math.max(approachSpeedFor(selected) + 45, 170) });
    pushRadio(`${selected.id}, cleared visual approach runway ${targetRunway}, cross overhead at ${PATTERN_ALT}, continue upwind, left crosswind, report downwind, then contact Tower.`, `${selected.id}: visual approach runway ${targetRunway}, overhead, upwind, left pattern.`);
  }
  function handoffTower() {
    setLog((p) => [`${selected.id}: tower handoff is automatic inside TWR airspace below handoff altitude.`, ...p].slice(0, 14));
  }
  function towerAccept() {
    setLog((p) => [`${selected.id}: APP/TWR acceptance is automatic; no manual accept required.`, ...p].slice(0, 14));
  }
  function towerLineUpWait() { if (selected.category !== "DEP") return; const rw = selected.depRunway || depRunway; const depCourse = RUNWAYS[rw]?.course || env.runway.course; const entry = departureRunwayEntry(rw); const occ = runwayOccupied(aircraft, rw); if (occ) return setLog((p) => [`TWR: runway ${rw} occupied, ${selected.id} hold short.`, ...p].slice(0, 14)); setSelectedPatch({ x: entry.x, y: entry.y, heading: depCourse, towerControlled: true, runwayOccupancy: true, occupancyRunway: rw, mode: "LINEUP_WAIT", assignedHeading: depCourse, assignedAltitude: 0, assignedSpeed: 0, depRunway: rw }); pushRadio(`${selected.id}, line up and wait runway ${rw}.`, `${selected.id}: line up and wait ${rw}.`); }
  function towerGoAround() { setSelectedPatch(missedApproachPatch(env, selected.approachRunway || selected.routeRunway || activeRunway)); pushRadio(`${selected.id}, go around, fly runway heading, climb 3000, contact Departure.`, `${selected.id}: going around, Departure.`); }
  function towerExitRunway() {
    setLog((p) => [`TWR: manual runway release removed. Runway occupancy now clears automatically during rollout/vacating.`, ...p].slice(0, 14));
  }
  function towerClearLand() {
    if (selected.category !== "ARR" || !selected.towerControlled || selected.contact !== "TWR") return setLog((p) => [`TWR: ${selected.id} is not under Tower control. Handoff is automatic inside TWR airspace below handoff altitude.`, ...p].slice(0, 14));
    if (!isApproachMode(selected.mode)) return setLog((p) => [`TWR: ${selected.id} is not an arrival on approach.`, ...p].slice(0, 14));
    const rw = selected.approachRunway || selected.routeRunway || activeRunway;
    const occ = runwayOccupied(aircraft.filter((a) => a.id !== selectedId), rw);
    if (occ) return setLog((p) => [`TWR: unable landing clearance, runway ${rw} occupied.`, ...p].slice(0, 14));
    if (!openArrRunways.includes(rw) && !openDepRunways.includes(rw)) return setLog((p) => [`TWR: unable landing clearance, runway ${rw} is not open.`, ...p].slice(0, 14));
    setSelectedPatch(landingClearancePatch({ ...selected, approachRunway: rw, routeRunway: rw }));
    pushRadio(`${selected.id}, runway ${rw}, cleared to land.`, `${selected.id}: cleared to land ${rw}.`);
  }
  function towerTakeoffClear() { if (selected.category !== "DEP") return; const rw = selected.depRunway || depRunway; const depCourse = RUNWAYS[rw]?.course || env.runway.course; const entry = departureRunwayEntry(rw); const occ = runwayOccupied(aircraft.filter((a) => a.id !== selectedId), rw); if (occ && selected.mode !== "LINEUP_WAIT") return setLog((p) => [`TWR: unable takeoff clearance, runway ${rw} occupied.`, ...p].slice(0, 14)); const sid = env.sids[selected.sid] || env.sids.NORTH; const initialAlt = Math.max(4000, sid.initialAlt || 5000); setSelectedPatch({ x: selected.mode === "LINEUP_WAIT" ? selected.x : entry.x, y: selected.mode === "LINEUP_WAIT" ? selected.y : entry.y, heading: depCourse, speed: Math.min(selected.speed || 0, 5), altitude: 0, towerControlled: true, takeoffClearance: true, runwayOccupancy: true, occupancyRunway: rw, mode: "TAKEOFF_ROLL", assignedHeading: depCourse, assignedAltitude: initialAlt, assignedSpeed: 135, depRunway: rw }); pushRadio(`${selected.id}, runway ${rw}, cleared for takeoff, initial climb ${initialAlt}.`, `${selected.id}: cleared for takeoff ${rw}, initial climb ${initialAlt}.`); }
  function speedOnly() { if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no speed authority for ${selected.id}.`, ...p].slice(0, 14)); return; } const spd = clamp(Number(speed) || selected.assignedSpeed, 90, speedLimitForAircraft(selected, selected.altitude)); setSelectedPatch({ assignedSpeed: spd, speedRestriction: spd }, { label: `SPD ${Math.round(spd)}` }); setSpeed(String(Math.round(spd))); pushRadio(`${selected.id}, reduce speed ${Math.round(spd)}, continue present route.`, `${selected.id}: speed ${Math.round(spd)}, continuing route.`); }
  function goAround() { if (rejectGroundApproachCommand(selected, "missed approach")) return; setSelectedPatch(missedApproachPatch(env, selected.approachRunway || selected.routeRunway || activeRunway)); pushRadio(`${selected.id}, go around, fly missed approach, climb 3000, contact Departure.`, `${selected.id}: going around, Departure.`); }
  function resumeSid() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH; const spd = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ mode: "SID", depState: "SID_CLIMB", route: sid.route, routeIndex: 0, assignedHeading: sid.heading, assignedAltitude: sid.initialAlt, assignedSpeed: spd, speedRestriction: null }); pushRadio(`${selected.id}, resume filed ${selected.sid}, climb and maintain ${sid.initialAlt}.`, `${selected.id}: resume ${selected.sid}, climb ${sid.initialAlt}.`); }
  function climbDep() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH, requestedAlt = Number.isFinite(Number(altitude)) ? clamp(Number(altitude), sid.initialAlt, 24000) : sid.initialAlt, depSpeed = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ depState: "RELEASED", mode: "SID", assignedAltitude: requestedAlt, requestedAltitude: requestedAlt, assignedSpeed: depSpeed, speedRestriction: null }); setAltitude(String(Math.round(requestedAlt))); setSpeed(String(Math.round(depSpeed))); pushRadio(`${selected.id}, climb and maintain ${Math.round(requestedAlt)}, speed ${Math.round(depSpeed)}.`, `${selected.id}: climb ${Math.round(requestedAlt)}, speed ${Math.round(depSpeed)}.`); }
  function unrestrictedClimbDep() { if (selected.category !== "DEP") return; const sid = env.sids[selected.sid] || env.sids.NORTH; const requestedAlt = sid.topAlt; const nextFix = selected.route?.length && selected.routeIndex < selected.route.length ? wp(env.nav, selected.route[selected.routeIndex]) : null; const sidHeading = nextFix ? headingToPoint(selected.x, selected.y, nextFix) : sid.exitBearing; const ciSpeed = selected.altitude < 10000 ? Math.min(250, companyCostIndexSpeed(selected)) : companyCostIndexSpeed(selected); setSelectedPatch({ depState: "UNRESTRICTED", mode: "SID", route: selected.route?.length ? selected.route : sid.route, routeIndex: selected.routeIndex || 0, assignedHeading: sidHeading, assignedAltitude: requestedAlt, requestedAltitude: requestedAlt, assignedSpeed: ciSpeed, speedRestriction: null }); setAltitude(String(Math.round(requestedAlt))); setSpeed(String(Math.round(ciSpeed))); setHeading(fmt3(sidHeading)); pushRadio(`${selected.id}, altitude restriction cancelled, climb via ${selected.sid} to ${Math.round(requestedAlt)}. Max 250 below FL100, then company cost-index speed.`, `${selected.id}: unrestricted climb via ${selected.sid} to ${Math.round(requestedAlt)}, company speed when able.`); }
  function handoffACC() { if (selected.category !== "DEP") return; const br = xyToBearingRange(selected.x, selected.y); if (!depExitReady(selected, env)) return setLog((p) => [`${selected.id}: not ready for ACC handoff. Need SID exit direction and 38+ NM; now ${br.rangeNm.toFixed(1)} NM / BRG ${fmt3(br.bearing)}.`, ...p].slice(0, 14)); setAircraft((prev) => prev.map((a) => a.id === selectedId ? { ...a, handedOff: true } : a)); setHandoffCount((c) => c + 1); setLog((p) => [`DEP: ${selected.id}, contact Sapporo Control.`, `${selected.id}: Sapporo Control, good day.`, ...p].slice(0, 14)); const next = aircraft.find((a) => a.id !== selectedId && !a.handedOff); if (next) selectAircraft(next.id); }
  function deleteSelected() { setAircraft((prev) => prev.filter((a) => a.id !== selectedId)); const next = aircraft.find((a) => a.id !== selectedId); if (next) selectAircraft(next.id); setLog((p) => [`${selected.id}: removed from sector.`, ...p].slice(0, 14)); }
  function directToWaypointForRunway(id, runwayName) {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no approach clearance authority for ${selected.id}.`, ...p].slice(0, 14)); return; }
    if (rejectGroundApproachCommand(selected, `direct ${id} runway ${runwayName}`)) return;
    if (approachRunwayChangeRequiresMissed(selected, runwayName)) {
      setLog((p) => [`${selected.id}: direct ${id}_${runwayName} rejected — already committed to runway ${selected.approachRunway || selected.routeRunway}. Go around before runway reassignment.`, ...p].slice(0, 14));
      return;
    }
    const nav = makeNavCached(runwayName);
    const routes = makeRoutes(runwayName);
    const fix = wp(nav, id);
    if (!fix) return;
    const h = headingToPoint(selected.x, selected.y, fix);
    if (id.startsWith("HOLD")) {
      const alt = assignedHoldAltitude(id);
      setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: id, altitude: alt, navRunway: runwayName }, route: [], clearedILS: false, speedRestriction: null, assignedHeading: h, assignedSpeed: 190, assignedAltitude: alt }));
      pushRadio(`${selected.id}, hold at ${id} for runway ${runwayName}, maintain ${alt}.`, `${selected.id}: hold ${id}, runway ${runwayName}.`);
      return;
    }
    if (selected.category === "ARR") {
      const containingRoute = Object.values(routes).find((r) => r.includes(id) && r.indexOf(id) < r.length - 1);
      let route = id === "IF01" ? routes.VECTORS_IF01 : containingRoute ? containingRoute.slice(containingRoute.indexOf(id)) : [];
      let routeIndex = 0;
      if (route.length && id.startsWith("BASE_")) {
        const selectedFix = wp(nav, id);
        const nextFix = route[1] ? wp(nav, route[1]) : null;
        const distSelected = selectedFix ? Math.hypot(selected.x - selectedFix.x, selected.y - selectedFix.y) / PX_PER_NM : 99;
        const distNext = nextFix ? Math.hypot(selected.x - nextFix.x, selected.y - nextFix.y) / PX_PER_NM : 99;
        const alreadyPastBase = distSelected < 2.8 || distNext < distSelected;
        if (alreadyPastBase && route.length > 1) routeIndex = 1;
      }
      const nextId = route[routeIndex] || id;
      const nextAlt = nextId === "FAF" ? 2200 : nextId === "IF01" ? 3000 : nextId.startsWith("BASE_") ? 5000 : nextId.startsWith("DW_") ? 6000 : selected.assignedAltitude;
      const nextFix = wp(nav, nextId) || fix;
      setSelectedPatch(appReacquirePatch({ mode: route.length ? "ROUTE" : "DIRECT_FIX", route, routeIndex, routeRunway: runwayName, approachRunway: runwayName, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, nextFix), assignedSpeed: nextId === "FAF" ? 170 : 190, assignedAltitude: nextAlt }));
      pushRadio(`${selected.id}, proceed ${id} for runway ${runwayName}, expect ILS ${runwayName}.`, `${selected.id}: ${id} runway ${runwayName}.`);
      return;
    }
    setSelectedPatch(appReacquirePatch({ mode: "DIRECT_FIX", route: [], routeRunway: runwayName, approachRunway: runwayName, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: h, assignedAltitude: selected.assignedAltitude, assignedSpeed: selected.assignedSpeed }));
    pushRadio(`${selected.id}, proceed direct ${id} for runway ${runwayName}.`, `${selected.id}: direct ${id} runway ${runwayName}.`);
  }
  function directToWaypoint(id) {
    if (selected.category === "MIL") { setLog((p) => [`RJCC ${seat}: no direct clearance authority for ${selected.id}. Military traffic follows RJCJ mission corridor / BINGO RTB logic.`, ...p].slice(0, 14)); return; }
    const isGround = isGroundTraffic(selected) || selected.altitude < 500 || ["DEP_READY", "LINEUP_WAIT", "TAKEOFF_ROLL", "ROLLOUT", "VACATED"].includes(selected.mode);
    const groundAllowed = (selected.category === "MIL" && id === "RJCJ") || id === selected.destination;
    if (isGround && !groundAllowed) {
      setLog((p) => [`${selected.id}: direct ${id} rejected — aircraft is on ground. Use TWR/DEP controls first.`, ...p].slice(0, 14));
      return;
    }
    const fix = wp(env.nav, id);
    if (!fix) return;
    if (id.startsWith("HOLD")) {
      const alt = assignedHoldAltitude(id);
      setSelectedPatch(appReacquirePatch({ mode: "HOLD", hold: { fixId: id, altitude: alt }, route: [], clearedILS: false, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: 190, assignedAltitude: alt }));
      pushRadio(`${selected.id}, hold at ${id}, maintain ${alt}, speed 190.`, `${selected.id}: hold at ${id}, maintain ${alt}.`);
      return;
    }
    if (id === "RJCH" || id === "RJSM") return divertSelected(id);
    if (id === "RJCJ" && selected.category === "MIL") {
      setSelectedPatch({ mode: "RJCJ_RECOVERY", destination: "RJCJ", assignedAltitude: 3500, assignedSpeed: selected.type === "F-15J" || selected.type === "F-2A" ? 240 : 165 });
      pushRadio(`${selected.id}, proceed recovery RJCJ.`, `${selected.id}: recovery RJCJ.`);
      return;
    }
    if (selected.category !== "MIL" && id === "IF01") {
      vectorToIF01();
      return;
    }
    if (selected.category === "ARR") {
      const containingRoute = Object.values(env.routes).find((r) => r.includes(id) && r.indexOf(id) < r.length - 1);
      if (containingRoute && (id.startsWith("IAF") || id.startsWith("DW_") || id.startsWith("BASE_") || id === "FAF")) {
        const idx = containingRoute.indexOf(id);
        const route = containingRoute.slice(idx);
        const vnavAlt = vnavTargetAltitude({ ...selected, route, routeIndex: 0, category: "ARR", mode: "ROUTE" }, env, 0);
        setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route, routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: id === "FAF" ? 170 : 200, assignedAltitude: vnavAlt }));
        pushRadio(`${selected.id}, direct ${id}, continue published segment, descend via profile.`, `${selected.id}: direct ${id}, descend via profile.`);
        return;
      }
    }
    const matchingRoute = selected.category !== "MIL" ? Object.values(env.routes).find((r) => r[0] === id) : null;
    if (matchingRoute) {
      const vnavAlt = selected.category === "DEP" ? selected.assignedAltitude : vnavTargetAltitude({ ...selected, route: matchingRoute, routeIndex: 0, category: "ARR", mode: "ROUTE" }, env, 0);
      setSelectedPatch(appReacquirePatch({ mode: "ROUTE", route: matchingRoute, routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedSpeed: selected.category === "DEP" ? selected.assignedSpeed : 200, assignedAltitude: vnavAlt }));
      pushRadio(`${selected.id}, direct ${id}, then continue published route.`, `${selected.id}: direct ${id}.`);
      return;
    }
    setSelectedPatch(appReacquirePatch({ mode: "DIRECT_FIX", route: [id], routeIndex: 0, clearedILS: false, hold: null, speedRestriction: null, assignedHeading: headingToPoint(selected.x, selected.y, fix), assignedAltitude: selected.assignedAltitude, assignedSpeed: selected.assignedSpeed }));
    pushRadio(`${selected.id}, proceed direct ${id}.`, `${selected.id}: direct ${id}.`);
  }


  return {
    applyVectorHeading,
    issueCommand,
    altitudeOnly,
    spawnNow,
    spawnMil,
    debugSpawn,
    divertSelected,
    divertAll,
    assignRoute,
    vectorToIF01,
    holdAtFix,
    clearILS,
    clearVisual,
    handoffTower,
    towerAccept,
    towerLineUpWait,
    towerGoAround,
    towerExitRunway,
    towerClearLand,
    towerTakeoffClear,
    speedOnly,
    goAround,
    resumeSid,
    climbDep,
    unrestrictedClimbDep,
    handoffACC,
    deleteSelected,
    directToWaypointForRunway,
    directToWaypoint,
  };
}
