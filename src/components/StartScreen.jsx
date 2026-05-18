import ScenarioCard from "./ScenarioCard.jsx";

export default function StartScreen({ scenarios, lang, tr, buttonStyle, onToggleLang, onStartMode }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 10%, #0f172a 0%, #020617 54%, #000 100%)", color: "#e5e7eb", padding: 34, boxSizing: "border-box", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 0.5 }}>ATC Radar Simulator</div>
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 15 }}>{lang === "zh" ? "选择运行模式。自由模式用于测试系统，关卡模式用于按剧本处理流量、天气与突发事件。" : "Select an operating mode. Free Play is for system testing; Scenario Mode uses scripted traffic, weather and events."}</div>
          </div>
          <button style={{ ...buttonStyle, padding: "9px 14px" }} onClick={onToggleLang}>{tr("langButton")}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))", gap: 16 }}>
          {scenarios.filter((sc) => sc.kind !== "DEBUG").map((sc) => <ScenarioCard key={sc.id} scenario={sc} lang={lang} buttonStyle={buttonStyle} onStart={onStartMode} />)}
        </div>

        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          {scenarios.filter((sc) => sc.kind === "DEBUG").map((sc) => <button key={sc.id} title={lang === "zh" ? sc.subtitleZh : sc.subtitle} style={{ border: "1px solid #64748b", background: "rgba(15,23,42,0.34)", color: "#64748b", borderRadius: 8, padding: "3px 7px", fontSize: 10, fontFamily: "monospace", cursor: "pointer", opacity: 0.62 }} onClick={() => onStartMode(sc)}>DEV</button>)}
        </div>

        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ border: "1px solid #334155", background: "rgba(15, 23, 42, 0.82)", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{lang === "zh" ? "简易教程" : "Quick Tutorial"}</div>
            <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 }}>
              {lang === "zh" ? <>
                <b>1. 运行：</b>进入关卡后点“运行”。关卡模式下流量、风向、跑道由剧本控制，不能手动生成或换跑道。<br />
                <b>2. 选择飞机：</b>点击雷达目标，或在右侧下拉列表选择目标；右侧面板显示高度、速度、航向、燃油和状态。<br />
                <b>3. 管制：</b>用 HDG / ALT / SPD 后点击“雷达引导”“ALT”“SPD”；也可开启“鼠标引导”后在雷达上点击给航向。<br />
                <b>4. 进场：</b>点击航点可直飞或接入程序；ILS 为自动截获，VAPP 会抑制 ILS 门控。进塔台空域后交给 TWR，再给落地许可。<br />
                <b>5. 离场：</b>TWR 先 Line Up，再 Clear TKOF；DEP 席位可恢复 SID、取消高度限制，满足出口条件后 To ACC。<br />
                <b>6. 视图：</b>2D 左键拖动、滚轮缩放；3D 左键平移、中键旋转、滚轮缩放。
              </> : <>
                <b>1. Run:</b> enter a scenario and press Run. In Scenario Mode, traffic, wind and runway selection are controlled by the script.<br />
                <b>2. Select:</b> click a radar target or use the right-side selector. The panel shows altitude, speed, heading, fuel and state.<br />
                <b>3. Control:</b> set HDG / ALT / SPD, then use Vector, ALT or SPD. Mouse Vector lets you click the radar to assign heading.<br />
                <b>4. Arrival:</b> click fixes to join routes. ILS capture is automatic; VAPP suppresses ILS gate capture. Handoff to TWR before landing clearance.<br />
                <b>5. Departure:</b> TWR uses Line Up then Clear TKOF. DEP resumes SID, cancels altitude restrictions, then hands off to ACC when exit-ready.<br />
                <b>6. View:</b> 2D left-drag pans, wheel zooms. 3D left-drag pans, middle-drag rotates, wheel zooms.
              </>}
            </div>
          </div>
          <div style={{ border: "1px solid #334155", background: "rgba(15, 23, 42, 0.82)", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{lang === "zh" ? "关卡判定" : "Scenario Rules"}</div>
            <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 }}>
              {lang === "zh" ? <>
                成功通常需要在时间内完成指定落地数与 ACC 移交数。<br />
                冲突目标会先标红，持续一小段时间后才判定失败。<br />
                复飞次数、冲突、超时会导致任务失败。<br />
                天气关需要绕开红色天气核心；穿越红区可能触发紧急状态。
              </> : <>
                Success usually requires enough landings and ACC handoffs within the time limit.<br />
                Conflict targets turn red first; failure triggers only if the conflict persists briefly.<br />
                Excess missed approaches, conflicts, or time-over cause mission failure.<br />
                Weather scenarios require avoiding red cells; crossing them may trigger emergencies.
              </>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22, border: "1px solid #1f2937", background: "rgba(2, 6, 23, 0.72)", borderRadius: 18, padding: 16, color: "#9ca3af", fontSize: 13, lineHeight: 1.6 }}>
          {lang === "zh"
            ? "当前版本的关卡模式先提供启动界面、固定初始条件与基础事件：换向关会在运行后触发风向转变，天气关会触发雪阵提示。后续可以继续加胜负条件、剧情事件、低油量、跑道关闭、军机任务冲突等。"
            : "This first Scenario Mode build provides the start menu, fixed initial conditions, and basic scripted events: the runway-transition scenario triggers a wind shift after start, and the snow scenario triggers a weather event. Later builds can add win/loss conditions, emergency events, low fuel, runway closures and military-task conflicts."}
        </div>
      </div>
    </div>
  );
}
