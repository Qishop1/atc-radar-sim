import MissionStatusPanel from "./MissionStatusPanel.jsx";
import ObjectivePanel from "./ObjectivePanel.jsx";
import RadioLog from "./RadioLog.jsx";
import CommandPanel from "./CommandPanel.jsx";
import ControlConsole from "./ControlConsole.jsx";
import RadarScope from "./RadarScope.jsx";
import RunwayControls from "./RunwayControls.jsx";
import SequenceStrip from "./SequenceStrip.jsx";
import SelectedAircraftPanel from "./SelectedAircraftPanel.jsx";
import StartScreen from "./StartScreen.jsx";

export default function AppShell(props) {
  const {
    RJCC_RUNWAY_NAMES,
    RUNWAYS,
    SCENARIOS,
    activeButton,
    activeCorridors,
    activeRunway,
    aircraft,
    alternateHandoffLabel,
    alternateHandoffRadiusNm,
    altitude,
    altitudeOnly,
    approachRunwayChoice,
    arrCount,
    arrivalStripRows,
    assignRoute,
    backToMainMenu,
    buttonStyle,
    catText,
    cautionDetails,
    unrestrictedClimbDep,
    svgRef,
    scenarioId,
    resumeSid,
    debugSpawn,
    clamp,
    cautionIds,
    clearILS,
    clearVisual,
    closedRunways,
    commandDelayEnabled,
    commandDelaySec,
    conflictDetails,
    conflictIds,
    conflictPairs,
    contactText,
    dangerButtonStyle,
    delayPenalty,
    deleteSelected,
    depCount,
    depRunway,
    directToWaypoint,
    directToWaypointForRunway,
    displayedRunwaySets,
    divertAll,
    divertRequired,
    divertSelected,
    emergencyCount,
    env,
    fmt3,
    fmtFL,
    followSelected,
    formatEta,
    formatJstTime,
    formatSignedClock,
    fuelOutAircraft,
    gameMode,
    getAircraftMissionArea,
    goAround,
    handleRadarClick,
    handleRadarMouseDown,
    handleRadarMouseLeave,
    handleRadarMouseMove,
    handleRadarWheel,
    handoffACC,
    handoffCount,
    heading,
    holdAtFix,
    inputStyle,
    issueCommand,
    landedCount,
    lang,
    log,
    lowFuelCount,
    militaryBingoFuelMinutes,
    missedCount,
    missionAirspaceViolations,
    missionPenalty,
    modeText,
    mouseVectorMode,
    moveInSequence,
    onOff,
    openArrRunways,
    openDepRunways,
    parallelApproach,
    pendingCommands,
    preferredArrivalRunwayFor,
    qnh,
    radarDisplayTargets,
    radarSweepAgeSec,
    radarView,
    radioCollapsed,
    reset,
    resetSequenceAuto,
    rjcjHelipadPoint,
    rjcjPriorityNotice,
    running,
    runwayChangeCandidate,
    runwayDisplaySet,
    runwayHeadwind,
    runwayLabelForRole,
    runwayNoticeAccent,
    runwayNoticeBody,
    runwayNoticeTitle,
    runwayNoticeVisible,
    runwayOccupied,
    runwayPairName,
    runwayRoleOf,
    runways,
    scenarioComplete,
    scenarioEnded,
    scenarioEventsDone,
    scenarioFailed,
    scenarioLocked,
    scenarioObjective,
    score,
    seat,
    seatForAircraft,
    selectAircraft,
    selected,
    selectedBR,
    selectedGeo,
    selectedId,
    selectedPanel,
    selectedVnavAlt,
    selectedVnavStatus,
    setAltitude,
    setApproachRunwayChoice,
    setCommandDelayEnabled,
    setCommandDelaySec,
    setFollowSelected,
    setHeading,
    setLang,
    setMouseVectorMode,
    setParallelApproach,
    setQnh,
    setRadioCollapsed,
    setRunning,
    setRunwayEndPlan,
    setRunwayRole,
    setSeat,
    setSpeed,
    setSystemCollapsed,
    setTimeScale,
    setVectorPreview,
    showAirportIls,
    simSeconds,
    smallText,
    snowRemovalNotice,
    spawnMil,
    spawnNow,
    speed,
    speedOnly,
    startMode,
    startScreen,
    stopRadarPan,
    systemCollapsed,
    tick,
    timeScale,
    towerAuto,
    towerClearLand,
    towerGoAround,
    towerLineUpWait,
    towerQueue,
    towerTakeoffClear,
    tr,
    transitionOps,
    vectorPreview,
    viewBox,
    viewCenter,
    viewSize,
    vnavStatus,
    vnavText,
    wakeCategory,
    wakeShort,
    weatherOn,
    windObj,
    zoom
  } = props;
  if (startScreen) {
    return (
      <StartScreen
        scenarios={SCENARIOS}
        lang={lang}
        tr={tr}
        buttonStyle={buttonStyle}
        onToggleLang={() => setLang((v) => v === "en" ? "zh" : "en")}
        onStartMode={startMode}
      />
    );
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#020617", color: "#e5e7eb", padding: 10, boxSizing: "border-box", position: "relative" }}>
      {scenarioEnded ? <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(2, 6, 23, 0.80)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
        <div style={{ border: `3px solid ${scenarioComplete ? "#22c55e" : "#ef4444"}`, background: "rgba(2, 6, 23, 0.97)", borderRadius: 28, padding: "34px 42px", minWidth: 560, maxWidth: 780, textAlign: "center", boxShadow: `0 0 55px ${scenarioComplete ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.32)"}` }}>
          <div style={{ fontSize: 48, fontWeight: 950, letterSpacing: 2, color: scenarioComplete ? "#22c55e" : "#ef4444", marginBottom: 12 }}>{scenarioComplete ? (lang === "zh" ? "任务完成" : "MISSION COMPLETE") : (lang === "zh" ? "任务失败" : "MISSION FAILED")}</div>
          <div style={{ fontFamily: "monospace", color: "#cbd5e1", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
            TIME {Math.floor(tick / 120)} / {Math.floor((scenarioObjective?.duration || 0) / 120)} min<br />
            LAND {landedCount}/{scenarioObjective?.landed ?? "-"} | ACC {handoffCount}/{scenarioObjective?.handoff ?? "-"}<br />
            CONFLICT {conflictPairs.length}/{scenarioObjective?.maxConflict ?? "-"} | MISSED {missedCount}/{scenarioObjective?.maxMissed ?? "-"}<br />
            {conflictDetails.length ? conflictDetails.map((p) => p.kind === "WAKE" ? `WAKE ${p.lead}>${p.trail} RWY ${p.runway} ${p.spacingNm.toFixed(1)}/${p.requiredNm.toFixed(1)}NM` : `RADAR ${p.a}/${p.b} ${p.lateralNm.toFixed(1)}NM ${Math.round(p.verticalFt)}FT`).join(" | ") : ""}<br />
            {scenarioFailed && fuelOutAircraft ? (lang === "zh" ? `失败原因：${fuelOutAircraft.id} 燃油耗尽。` : `Failure reason: ${fuelOutAircraft.id} fuel exhausted.`) : ""}<br />
            {scenarioFailed && conflictPairs.length > (scenarioObjective?.maxConflict ?? 99) ? (lang === "zh" ? "失败原因：管制冲突。" : "Failure reason: separation conflict.") : ""}<br />
            {scenarioFailed && missedCount > (scenarioObjective?.maxMissed ?? 99) ? (lang === "zh" ? "失败原因：复飞次数超限。" : "Failure reason: missed approach limit exceeded.") : ""}<br />
            {scenarioFailed && tick > (scenarioObjective?.duration || 0) + 240 ? (lang === "zh" ? "失败原因：超过任务时间。" : "Failure reason: mission time exceeded.") : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button style={{ ...buttonStyle, background: "#1d4ed8", fontSize: 16, padding: "13px 18px" }} onClick={reset}>{lang === "zh" ? "重试本关" : "Retry Scenario"}</button>
            <button style={{ ...buttonStyle, background: "#111827", fontSize: 16, padding: "13px 18px" }} onClick={backToMainMenu}>{lang === "zh" ? "返回主界面" : "Main Menu"}</button>
          </div>
        </div>
      </div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr 360px", gap: 10, width: "100%", height: "100%", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "calc(100vh - 20px)", overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 16, padding: 10, flex: "0 0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={{ ...buttonStyle, background: running ? "#7f1d1d" : "#1d4ed8", padding: "9px 10px" }} disabled={scenarioEnded} onClick={() => setRunning((v) => !v)}>{running ? tr("pause") : tr("run")}</button>
              <button style={{ ...buttonStyle, padding: "9px 10px" }} onClick={backToMainMenu}>{lang === "zh" ? "返回主界面" : "Main Menu"}</button>
            </div>
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>JST {formatJstTime(simSeconds)} | {running ? (lang === "zh" ? "运行中" : "RUNNING") : (lang === "zh" ? "暂停" : "PAUSED")}</div>
            {gameMode === "DEBUG" ? <div style={{ marginTop: 8, border: "1px solid #7c2d12", background: "#120a04", borderRadius: 10, padding: 7 }}>
              <div style={{ fontSize: 11, color: "#fed7aa", fontFamily: "monospace", marginBottom: 6 }}>{lang === "zh" ? "开发调试生成入口" : "DEVELOPER DEBUG SPAWN"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("ARR")}>ARR</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("DEP")}>DEP</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL")}>MIL</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "F-15J")}>F-15J</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "U-125A")}>U-125A</button>
                <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11 }} onClick={() => debugSpawn("MIL", "UH-60J")}>UH-60J</button>
              </div>
            </div> : null}
          </div>

          <SequenceStrip
            lang={lang}
            simSeconds={simSeconds}
            buttonStyle={buttonStyle}
            smallText={smallText}
            arrivalStripRows={arrivalStripRows}
            formatJstTime={formatJstTime}
            formatSignedClock={formatSignedClock}
            formatEta={formatEta}
            fmtFL={fmtFL}
            wakeCategory={wakeCategory}
            wakeShort={wakeShort}
            onResetAuto={resetSequenceAuto}
            onMove={moveInSequence}
          />

          <RadioLog
            title={tr("radioLog")}
            buttonStyle={buttonStyle}
            collapsed={radioCollapsed}
            lang={lang}
            log={log}
            onToggle={() => setRadioCollapsed((v) => !v)}
          />

          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 10, flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{tr("systemAutomation")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setLang((v) => v === "en" ? "zh" : "en")}>{tr("langButton")}</button>
                <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setSystemCollapsed((v) => !v)}>{systemCollapsed ? (lang === "zh" ? "展开" : "Show") : (lang === "zh" ? "收起" : "Hide")}</button>
              </div>
            </div>
            {!systemCollapsed ? <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginTop: 8 }}>
                <button style={{ ...buttonStyle, padding: "7px 8px" }} onClick={reset}>{tr("reset")}</button>
              </div>
              <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, marginTop: 8, color: "#bfdbfe", fontSize: 12, lineHeight: 1.38 }}>
                {tr("wind")}: {fmt3(windObj.dir)}/{windObj.speed} | {tr("headwind")}: {env.headwind.toFixed(1)} kt | {tr("tailwind")}: {env.tailwind.toFixed(1)} kt<br />
                ARR {activeRunway} / DEP {depRunway} | WX {weatherOn ? "ON" : "OFF"}<br />{lang === "zh" ? "指令延迟" : "CMD DELAY"} {commandDelayEnabled ? `${commandDelaySec}s` : (lang === "zh" ? "关" : "OFF")} | {lang === "zh" ? "待执行" : "PENDING"} {pendingCommands.length}
              </div>
              <label style={{ display: "block", fontSize: 12, marginTop: 8 }}>{tr("qnh")}<input value={qnh} onChange={(e) => setQnh(e.target.value)} style={inputStyle} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <button style={commandDelayEnabled ? activeButton : buttonStyle} onClick={() => setCommandDelayEnabled((v) => !v)}>{lang === "zh" ? "指令延迟" : "CMD DELAY"} {commandDelayEnabled ? (lang === "zh" ? "开" : "ON") : (lang === "zh" ? "关" : "OFF")}</button>
                <label style={{ fontSize: 12 }}>{lang === "zh" ? "延迟秒数" : "Delay sec"}<input value={commandDelaySec} onChange={(e) => setCommandDelaySec(clamp(Number(e.target.value) || 0, 0, 20))} style={inputStyle} /></label>
              </div>
              {pendingCommands.length ? <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#fbbf24", lineHeight: 1.35 }}>{pendingCommands.slice(-4).map((c) => `${c.targetId} ${c.label} T-${Math.max(0, ((c.dueTick - tick) / 2)).toFixed(1)}s`).join(" | ")}</div> : null}
            </> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "calc(100vh - 20px)", overflow: "hidden" }}>
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 800, fontFamily: "monospace" }}>{tr("radar")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "34px 56px 34px", gap: 4, alignItems: "center" }}>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.max(1, v / 2))}>-</button>
                <div style={{ border: "1px solid #374151", background: "#030712", borderRadius: 10, padding: "8px 0", textAlign: "center", fontFamily: "monospace", fontWeight: 900 }}>{timeScale}x</div>
                <button style={{ ...buttonStyle, padding: "8px 0" }} onClick={() => setTimeScale((v) => Math.min(8, v * 2))}>+</button>
              </div>
            </div>
            <RadarScope
              svgRef={svgRef}
              viewBox={viewBox}
              viewCenter={viewCenter}
              viewSize={viewSize}
              zoom={zoom}
              seat={seat}
              activeRunway={activeRunway}
              windObj={windObj}
              qnh={qnh}
              radarSweepAgeSec={radarSweepAgeSec}
              snowRemovalNotice={snowRemovalNotice}
              rjcjPriorityNotice={rjcjPriorityNotice}
              fmt3={fmt3}
              fmtFL={fmtFL}
              weatherOn={weatherOn}
              env={env}
              runwayDisplaySet={runwayDisplaySet}
              runwayLabelForRole={runwayLabelForRole}
              showAirportIls={showAirportIls}
              rjcjHelipadPoint={rjcjHelipadPoint}
              aircraft={aircraft}
              alternateHandoffRadiusNm={alternateHandoffRadiusNm}
              alternateHandoffLabel={alternateHandoffLabel}
              activeCorridors={activeCorridors}
              scenarioId={scenarioId}
              scenarioEventsDone={scenarioEventsDone}
              lang={lang}
              directToWaypoint={directToWaypoint}
              directToWaypointForRunway={directToWaypointForRunway}
              mouseVectorMode={mouseVectorMode}
              vectorPreview={vectorPreview}
              selected={selected}
              radarDisplayTargets={radarDisplayTargets}
              selectedId={selectedId}
              conflictIds={conflictIds}
              cautionIds={cautionIds}
              selectAircraft={selectAircraft}
              vnavStatus={vnavStatus}
              modeText={modeText}
              radarView={radarView}
              handleRadarClick={handleRadarClick}
              handleRadarMouseDown={handleRadarMouseDown}
              handleRadarMouseMove={handleRadarMouseMove}
              handleRadarMouseLeave={handleRadarMouseLeave}
              stopRadarPan={stopRadarPan}
              handleRadarWheel={handleRadarWheel}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "calc(100vh - 20px)", overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
          <ControlConsole
            title={tr("controlConsole")}
            seat={seat}
            lang={lang}
            activeButton={activeButton}
            buttonStyle={buttonStyle}
            selectedId={selectedId}
            aircraft={aircraft}
            inputStyle={inputStyle}
            modeText={modeText}
            onSeatChange={setSeat}
            onSelectAircraft={selectAircraft}
            selectedPanel={<SelectedAircraftPanel
              selected={selected}
              selectedBR={selectedBR}
              selectedGeo={selectedGeo}
              selectedVnavStatus={selectedVnavStatus}
              selectedVnavAlt={selectedVnavAlt}
              env={env}
              activeRunway={activeRunway}
              tr={tr}
              lang={lang}
              fmt3={fmt3}
              fmtFL={fmtFL}
              catText={catText}
              seatForAircraft={seatForAircraft}
              militaryBingoFuelMinutes={militaryBingoFuelMinutes}
              vnavText={vnavText}
              modeText={modeText}
              contactText={contactText}
            />}
          >
            {seat !== "RJCJ" ? <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                <label style={{ fontSize: 12 }}>{tr("targetHdg")}<input value={heading} onChange={(e) => setHeading(e.target.value)} style={inputStyle} /></label>
                <label style={{ fontSize: 12 }}>{tr("targetAlt")}<input value={altitude} onChange={(e) => setAltitude(e.target.value)} style={inputStyle} /></label>
                <label style={{ fontSize: 12 }}>{tr("targetSpd")}<input value={speed} onChange={(e) => setSpeed(e.target.value)} style={inputStyle} /></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                <button style={buttonStyle} onClick={issueCommand}>{tr("vector")}</button>
                <button style={buttonStyle} onClick={() => { setMouseVectorMode((v) => !v); setVectorPreview(null); }}>{mouseVectorMode ? tr("mouseArmed") : tr("mouseVector")}</button>
                <button style={buttonStyle} onClick={altitudeOnly}>ALT</button>
                <button style={buttonStyle} onClick={speedOnly}>SPD</button>
                {!scenarioLocked ? <button style={dangerButtonStyle} onClick={deleteSelected}>{tr("remove")}</button> : null}
              </div>
            </> : <div style={{ border: "1px solid #334155", background: "#020617", borderRadius: 12, padding: 10, marginTop: 10, ...smallText }}>
              {lang === "zh" ? "RJCJ 任务状态为只读。本席位仅作为协调信息板，不提供战术引导、高度、速度、返场、备降、删除或生成军机等控制功能。" : "RJCJ MISSION STATUS is read-only. This seat is a coordination display only; no tactical vector, altitude, speed, recovery, diversion, deletion, or spawn controls are available here."}
            </div>}
            <CommandPanel>
              {seat === "APP" ? <>
                <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, marginBottom: 10 }}>
                  <div style={{ ...smallText, marginBottom: 6 }}>{lang === "zh" ? "进场目标跑道" : "Approach runway target"}: {approachRunwayChoice === "AUTO" ? `${lang === "zh" ? "自动" : "AUTO"} → ${preferredArrivalRunwayFor(selected)}` : approachRunwayChoice}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                    <button style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11, background: approachRunwayChoice === "AUTO" ? "#1d4ed8" : "#111827" }} onClick={() => setApproachRunwayChoice("AUTO")}>AUTO</button>
                    {RJCC_RUNWAY_NAMES.map((rw) => <button key={`app-rwy-${rw}`} disabled={!openArrRunways.includes(rw)} style={{ ...buttonStyle, padding: "6px 4px", fontSize: 11, background: approachRunwayChoice === rw ? "#14532d" : "#111827", opacity: openArrRunways.includes(rw) ? 1 : 0.38 }} onClick={() => setApproachRunwayChoice(rw)}>{rw}</button>)}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 0 }}>
                  <button style={buttonStyle} onClick={assignRoute}>{tr("starVnav")}</button>
                  <button style={buttonStyle} onClick={holdAtFix}>{tr("hold")}</button>
                  <button style={buttonStyle} onClick={clearILS}>{lang === "zh" ? "ILS 自动" : "ILS AUTO"}</button>
                  <button style={buttonStyle} onClick={() => clearVisual("DOWNWIND")}>{tr("visualApp")}</button>
                  <button style={buttonStyle} onClick={goAround}>{tr("missedApp")}</button>
                  <button style={buttonStyle} onClick={() => divertSelected("RJCH")}>{tr("toRjch")}</button>
                  <button style={buttonStyle} onClick={() => divertSelected("RJSM")}>{tr("toRjsm")}</button>
                  <button style={dangerButtonStyle} onClick={divertAll}>{tr("divertAll")}</button>
                </div>
              </> : seat === "TWR" ? <>
                <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 12, padding: 8, ...smallText }}>
                  {tr("categoryArr")} {activeRunway} {runwayOccupied(aircraft, activeRunway) ? "OCC" : "CLR"} / {tr("categoryDep")} {depRunway} {runwayOccupied(aircraft, depRunway) ? "OCC" : "CLR"}<br />
                  {tr("arrInTwr")}: {towerQueue(aircraft, env).arrivals.length} | {tr("depQueue")}: {towerQueue(aircraft, env).departures.length}<br />
                  {tr("selected")}: {selected.towerControlled ? (lang === "zh" ? "塔台" : "TWR") : selected.towerPending ? tr("twrPending") : tr("notTwr")} | {tr("landClearanceShort")} {selected.landingClearance ? tr("yes") : tr("no")} | {tr("tkof")} {selected.takeoffClearance ? tr("yes") : tr("no")} | {tr("contact")} {contactText(selected.contact || "APP/DEP")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                  {selected.category === "ARR" ? <>
                    <button style={buttonStyle} onClick={() => clearVisual("DOWNWIND")}>{tr("visualPattern")}</button>
                    <button style={buttonStyle} onClick={towerClearLand}>{tr("clearLand")}</button>
                    <button style={buttonStyle} onClick={towerGoAround}>{tr("goAround")}</button>
                  </> : null}
                  {selected.category === "DEP" ? <>
                    <button style={buttonStyle} onClick={towerLineUpWait}>{tr("lineUp")}</button>
                    <button style={buttonStyle} onClick={towerTakeoffClear}>{tr("clearTkof")}</button>
                  </> : null}
                  {selected.category !== "ARR" && selected.category !== "DEP" ? <div style={{ gridColumn: "1 / -1", ...smallText }}>{lang === "zh" ? "该目标没有塔台可用指令。" : "No tower command available for this target."}</div> : null}
                </div>
              </> : seat === "DEP" ? <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? <div style={{ gridColumn: "1 / -1", border: "1px solid #7c2d12", background: "#120a04", color: "#fed7aa", borderRadius: 10, padding: 8, ...smallText }}>
                    {lang === "zh" ? "该离场仍在地面或塔台阶段。请在 TWR 执行 Line Up / Clear TKOF，离地并建立离场雷达识别后再交给 DEP。" : "This departure is still in local-control phase. Use TWR for Line Up / Clear TKOF; DEP takes over after airborne radar contact."}
                  </div> : null}
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={resumeSid}
                  >{tr("resumeSid")}</button>
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={unrestrictedClimbDep}
                  >{tr("unrestAlt")}</button>
                  <button
                    disabled={selected.category === "DEP" && seatForAircraft(selected) !== "DEP"}
                    style={{ ...buttonStyle, opacity: selected.category === "DEP" && seatForAircraft(selected) !== "DEP" ? 0.42 : 1 }}
                    onClick={handoffACC}
                  >{tr("toAcc")}</button>
                </div>
              </> : <>
                <div style={{ border: "1px solid #334155", background: "#020617", borderRadius: 14, padding: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#f59e0b", marginBottom: 6 }}>
                    {lang === "zh" ? "RJCJ 任务状态 / 仅协调信息" : "RJCJ MISSION STATUS / COORDINATION ONLY"}
                  </div>
                  <div style={{ ...smallText, marginBottom: 10 }}>
                    {lang === "zh" ? "只读信息板。RJCJ 军机为自主战术流量；RJCC 只负责让民航避开活跃移动走廊和任务管制空域。" : "Read-only board. RJCJ military traffic is autonomous; RJCC only protects civil traffic from active moving corridors and mission control areas."}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.9fr 0.8fr 0.9fr 0.9fr", gap: 4, fontFamily: "monospace", fontSize: 11, color: "#94a3b8", borderBottom: "1px solid #1f2937", paddingBottom: 5, marginBottom: 5 }}>
                    <b>{lang === "zh" ? "编号 / 机型" : "ID / TYPE"}</b>
                    <b>{lang === "zh" ? "模式" : "MODE"}</b>
                    <b>{lang === "zh" ? "燃油" : "FUEL"}</b>
                    <b>{lang === "zh" ? "任务区" : "AREA"}</b>
                    <b>{lang === "zh" ? "空域" : "AIRSPACE"}</b>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto" }}>
                    {aircraft.filter((a) => a.category === "MIL" && !a.handedOff && !a.landed).length ? aircraft.filter((a) => a.category === "MIL" && !a.handedOff && !a.landed).map((a) => {
                      const area = getAircraftMissionArea(a);
                      const corridor = activeCorridors.find((c) => c.aircraftId === a.id);
                      const bingo = Math.round(a.bingoFuelMinutes ?? militaryBingoFuelMinutes(a, env));
                      const fuel = Math.round(a.fuelMinutes ?? 0);
                      const fuelColor = fuel <= bingo ? "#ef4444" : fuel <= bingo + 8 ? "#f59e0b" : "#cbd5e1";
                      let airspace = lang === "zh" ? "无" : "NONE";
                      if (corridor?.kind === "AREA") airspace = lang === "zh" ? "任务管制区" : "CONTROL AREA";
                      if (corridor?.kind === "MOVING_CORRIDOR") airspace = lang === "zh" ? "移动走廊" : "MOVING CORRIDOR";
                      return <div key={`rjcj-status-${a.id}`} style={{ display: "grid", gridTemplateColumns: "1.05fr 0.9fr 0.8fr 0.9fr 0.9fr", gap: 4, alignItems: "center", border: `1px solid ${a.id === selectedId ? "#f6e94d" : "#1f2937"}`, background: a.id === selectedId ? "rgba(250,204,21,0.08)" : "#030712", borderRadius: 10, padding: 6, fontFamily: "monospace", fontSize: 11, cursor: "pointer" }} onClick={() => selectAircraft(a.id)}>
                        <div style={{ color: "#60a5fa", fontWeight: 900 }}>{a.id}<br /><span style={{ color: "#94a3b8", fontWeight: 600 }}>{a.type}</span></div>
                        <div style={{ color: a.mode === "RJCJ_RTB" ? "#f59e0b" : "#cbd5e1" }}>{a.mode}{a.rtbReason ? <><br /><span style={{ color: "#f59e0b" }}>{a.rtbReason}</span></> : null}</div>
                        <div style={{ color: fuelColor }}>{lang === "zh" ? "油量" : "FUEL"} {fuel}<br />BINGO {bingo}</div>
                        <div style={{ color: area?.dynamic ? "#f59e0b" : "#93c5fd" }}>{area?.id || "-"}<br />{area?.label || "-"}</div>
                        <div style={{ color: corridor ? "#f59e0b" : "#64748b" }}>{airspace}<br />{corridor?.kind === "MOVING_CORRIDOR" ? `${corridor.widthNm.toFixed(1)}NM` : corridor?.kind === "AREA" ? `${corridor.controlRadiusNm.toFixed(1)}NM` : "--"}</div>
                      </div>;
                    }) : <div style={{ border: "1px solid #1f2937", background: "#030712", borderRadius: 10, padding: 10, ...smallText }}>{lang === "zh" ? "当前没有活跃 RJCJ 军机流量。" : "No active RJCJ military traffic."}</div>}
                  </div>
                </div>
              </>}
            </CommandPanel>
          </ControlConsole>

          <RunwayControls
            lang={lang}
            buttonStyle={buttonStyle}
            smallText={smallText}
            openArrRunways={openArrRunways}
            openDepRunways={openDepRunways}
            closedRunways={closedRunways}
            runwayNames={RJCC_RUNWAY_NAMES}
            activeRunway={activeRunway}
            windObj={windObj}
            runways={RUNWAYS}
            parallelApproach={parallelApproach}
            runwayPairName={runwayPairName}
            runwayRoleOf={runwayRoleOf}
            runwayLabelForRole={runwayLabelForRole}
            runwayHeadwind={runwayHeadwind}
            onToggleParallel={() => setParallelApproach((v) => !v)}
            onSetRunwayRole={setRunwayRole}
            onSetRunwayEndPlan={setRunwayEndPlan}
          />
          {runwayNoticeVisible ? <div style={{ border: `2px solid ${runwayNoticeAccent}`, background: "rgba(2, 6, 23, 0.92)", borderRadius: 18, padding: "14px 16px", boxShadow: `0 0 22px ${runwayChangeCandidate.pair ? "rgba(245,158,11,0.28)" : "rgba(56,189,248,0.22)"}`, fontFamily: "monospace" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: runwayChangeCandidate.pair ? "#fbbf24" : "#7dd3fc", lineHeight: 1.2, marginBottom: 8 }}>{runwayNoticeTitle}</div>
            <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45 }}>{runwayNoticeBody}</div>
          </div> : null}
          <ObjectivePanel
            gameMode={gameMode}
            scenarioObjective={scenarioObjective}
            scenarioFailed={scenarioFailed}
            scenarioComplete={scenarioComplete}
            lang={lang}
            smallText={smallText}
            rjcjPriorityNotice={rjcjPriorityNotice}
            scenarioEventsDone={scenarioEventsDone}
            landedCount={landedCount}
            handoffCount={handoffCount}
            conflictPairs={conflictPairs}
            missedCount={missedCount}
            tick={tick}
            conflictDetails={conflictDetails}
            cautionDetails={cautionDetails}
          />
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{tr("weatherStatus")}</div>
            <div style={{ ...smallText }}>{tr("wxRadar")}: {onOff(weatherOn)}<br />{tr("wind")}: {fmt3(windObj.dir)}/{windObj.speed}<br />{tr("weatherForecast")}: {fmt3(windObj.nextDir ?? windObj.dir)}/{windObj.nextSpeed ?? windObj.speed} {lang === "zh" ? `${windObj.changeIn ?? 0}${tr("inSeconds")}` : `${tr("inSeconds")} ${windObj.changeIn ?? 0}s`}<br />{tr("headwind")}: {env.headwind.toFixed(1)} kt<br />{tr("tailwind")}: {env.tailwind.toFixed(1)} kt<br />{tr("divertState")}: {divertRequired(windObj) ? tr("required") : tr("normal")}<br />{tr("runwayModeNotice")}</div>
          </div>
          <MissionStatusPanel
            tr={tr}
            lang={lang}
            smallText={smallText}
            score={score}
            delayPenalty={delayPenalty}
            missionPenalty={missionPenalty}
            landedCount={landedCount}
            handoffCount={handoffCount}
            conflictPairs={conflictPairs}
            cautionDetails={cautionDetails}
            conflictDetails={conflictDetails}
            missionAirspaceViolations={missionAirspaceViolations}
            missedCount={missedCount}
            emergencyCount={emergencyCount}
            lowFuelCount={lowFuelCount}
            activeRunway={activeRunway}
            aircraft={aircraft}
            activeCorridors={activeCorridors}
            arrCount={arrCount}
            depCount={depCount}
          />
          <div style={{ border: "1px solid #1f2937", background: "#0f172a", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{tr("airports")}</div>
            <div style={{ ...smallText }}>RJCC: {tr("mainCivilField")}, {tr("rwy")} {activeRunway}<br />RJCJ: {tr("jasdfBase")}, 18/36 recovery area<br />RJCH: {tr("hakodateAlt")}, {tr("activeRunwayLabel")} {env.airports.RJCH.name}<br />RJSM: {tr("misawaAlt")}, {tr("activeRunwayLabel")} {env.airports.RJSM.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
