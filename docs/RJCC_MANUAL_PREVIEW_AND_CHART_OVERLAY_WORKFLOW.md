# RJCC Manual Preview & Chart Overlay Workflow

本文档记录 RJCC JAIP 原型中“手工描线航路 + 航图叠加”的标准工作流。

核心原则：

- `manual-previews/` 只保存手工描线航路，用于 `#/rjcc-jaip` 显示程序路线。
- `chart-overlays/` 只保存航图 PNG 的叠加姿态，用于 `#/rjcc-jaip` 显示类似 Navigraph 的半透明航图。
- `public/charts/rjcc/` 保存原始航图 PNG。
- 手工描线和航图叠加全部是 display-only，不是权威导航数据，不参与 legacy gameplay，不参与 aircraft guidance。
- 飞机未来不能沿手描 SVG 巡线飞；真正飞行逻辑应由 procedure legs / FMS-like lateral guidance 实现。

---

## 1. 文件与命名规范

### 1.1 Procedure ID

每条手工航路必须使用唯一 `procedureId`。

规则：

```txt
PROCEDURE_NAME[_RUNWAY][_TRANSITION]
```

示例：

```txt
KURIS_SEVEN_RWY19
KURIS_SEVEN_RWY01
CHITOSE_FOUR_RWY01
CHITOSE_FOUR_RWY19
YOSAN_ONE_RWY19_TOBBY_TRANSITION
REZOT_TWO_RWY01_TEKKO_TRANSITION
```

`procedureId` 必须满足：

```txt
^[A-Z0-9_]+$
```

禁止使用：

```txt
KURIS7
kurisSeven
Chitose Four
KURIS-SEVEN-RWY19
```

### 1.2 Chart ID

`chartId` 表示一张航图本身。同一张航图可以被多个 procedure variant 共用。

示例：

```txt
KURIS_SEVEN
CHITOSE_FOUR
YOSAN_ONE
REZOT_TWO
```

例如：

```txt
KURIS_SEVEN_RWY19  → chartId: KURIS_SEVEN
KURIS_SEVEN_RWY01  → chartId: KURIS_SEVEN

CHITOSE_FOUR_RWY01 → chartId: CHITOSE_FOUR
CHITOSE_FOUR_RWY19 → chartId: CHITOSE_FOUR
```

### 1.3 文件名规范

手工航路文件：

```txt
PROCEDURE_ID.js
```

航图叠加文件：

```txt
CHART_ID.chartOverlay.js
```

航图 PNG：

```txt
CHART_ID.png
```

示例：

```txt
manual-previews/KURIS_SEVEN_RWY19.js
manual-previews/KURIS_SEVEN_RWY01.js
chart-overlays/KURIS_SEVEN.chartOverlay.js
public/charts/rjcc/KURIS_SEVEN.png
```

---

## 2. 目录结构

标准目录如下：

```txt
src/data/airspace/rjcc/
  manualProcedurePreviews.js
  chartOverlays.js

  manual-previews/
    index.js
    KURIS_SEVEN_RWY19.js
    KURIS_SEVEN_RWY01.js
    CHITOSE_FOUR_RWY01.js
    CHITOSE_FOUR_RWY19.js

  chart-overlays/
    index.js
    KURIS_SEVEN.chartOverlay.js
    CHITOSE_FOUR.chartOverlay.js

public/charts/rjcc/
  KURIS_SEVEN.png
  CHITOSE_FOUR.png
```

兼容入口：

```js
// src/data/airspace/rjcc/manualProcedurePreviews.js
export { manualProcedurePreviews } from "./manual-previews/index.js";
```

```js
// src/data/airspace/rjcc/chartOverlays.js
export { chartOverlays } from "./chart-overlays/index.js";
```

---

## 3. Trace Editor 制作流程

打开：

```txt
#/rjcc-trace-editor
```

### 3.1 输入或选择 Procedure ID

在程序设置区域输入或选择：

```txt
KURIS_SEVEN_RWY19
```

如果支持自动解析，点击：

```txt
自动解析
```

系统应自动推导：

```txt
chartId: KURIS_SEVEN
chartFilename: KURIS_SEVEN.png
traceType: APPROX_TURN
anchorFrame: 根据 procedureId / procedure data 推导
```

如果自动解析不准确，可以手动修改。

### 3.2 拖入航图 PNG

把对应 PNG 拖入 trace editor。

例如：

```txt
KURIS_SEVEN.png
```

### 3.3 对齐航图

进入：

```txt
调整航图 / OVERLAY
```

调整：

```txt
x / y / scale / rotationDeg / opacity
```

原则：

- 航图 PNG 不是严格 georeferenced map。
- 不要试图让 CHE、KURIS、跑道、海岸线全部完全对齐。
- 航图只作为形状底稿。
- 真实几何以 FIX / NAVAID / RWY anchor / DME / radial construction 为准。

KURIS 7 的经验：

```txt
CHE R011 是 magnetic radial。
VAR 9W → magnetic 011 roughly equals true 002。
真实 CHE R011 MAG / true 002 应穿过真实 KURIS。
```

### 3.4 添加辅助线

按需要添加：

```txt
径向线
DME圆
DME弧
辅助线
标记点
```

例如 KURIS 7 RWY19：

```txt
台站: CHE
径向: 011
MAG
VAR: -9
添加径向线

DME: 2
添加DME圆

DME: 6
添加DME圆
```

### 3.5 描线

进入：

```txt
描线 / TRACE
```

常用 traceType：

```txt
APPROX_TURN   conventional SID / teardrop / turn procedure
SOLID_ROUTE   RNAV fix-to-fix route
CONNECTOR     short direct connector
RADIAL        radial segment
```

描线原则：

- 起点接近 runway departure anchor。
- 中间照航图形状描。
- 关键截获点吸附到真实 radial / DME / FIX。
- 终点吸附到真实 final fix / navaid。

### 3.6 吸附关键点

常用吸附：

```txt
首点吸附到起点
末点吸附到终点
选中点到径向线
选中点到DME圆
选中点到航点
```

注意：如果当前版本的吸附使用表单参数，吸附前必须确认当前表单中的台站、径向、MAG/TRUE、VAR、DME 是正确的。

例如要吸附到 KURIS 7 的 R011：

```txt
台站: CHE
径向: 011
MAG
VAR: -9
```

---

## 4. 导出文件

### 4.1 下载航路 JS

点击：

```txt
下载航路JS
```

得到：

```txt
PROCEDURE_ID.js
```

示例：

```txt
KURIS_SEVEN_RWY19.js
```

该文件放入：

```txt
src/data/airspace/rjcc/manual-previews/
```

文件内容格式：

```js
export const KURIS_SEVEN_RWY19 = {
  id: "KURIS_SEVEN_RWY19",
  type: "MANUAL_TRACE",
  traceType: "APPROX_TURN",
  approximate: true,
  source: "manual chart trace",
  coordinateSpace: "anchor-normalized",
  chartId: "KURIS_SEVEN",
  anchorFrame: {
    originId: "CHE",
    axisToId: "KURIS",
    startId: "RJCC_RWY19_REPRESENTATIVE",
    finalId: "KURIS",
  },
  points: [
    // { u, v }
  ],
  construction: {
    stationId: "CHE",
    radialDeg: 11,
    bearingType: "MAGNETIC",
    magneticVariationDeg: -9,
  },
  notes:
    "Display-only traced preview; not authoritative navigation geometry.",
};
```

### 4.2 下载航图叠加 JS

点击：

```txt
下载航图叠加JS
```

得到：

```txt
CHART_ID.chartOverlay.js
```

示例：

```txt
KURIS_SEVEN.chartOverlay.js
```

该文件放入：

```txt
src/data/airspace/rjcc/chart-overlays/
```

文件内容格式：

```js
export const KURIS_SEVEN_CHART_OVERLAY = {
  id: "KURIS_SEVEN_CHART_OVERLAY",
  chartId: "KURIS_SEVEN",
  title: "KURIS SEVEN DEPARTURE",
  imageUrl: "/charts/rjcc/KURIS_SEVEN.png",
  approximate: true,
  source: "manual chart overlay transform",
  transform: {
    x: 0,
    y: 0,
    scale: 1,
    rotationDeg: -4,
    width: 0,
    height: 0,
    opacity: 0.45,
  },
  notes:
    "Chart overlay is a visual reference only. AIP SID sketch is not georeferenced.",
};
```

---

## 5. 放置 PNG

航图 PNG 放入：

```txt
public/charts/rjcc/
```

例如：

```txt
public/charts/rjcc/KURIS_SEVEN.png
public/charts/rjcc/CHITOSE_FOUR.png
```

代码中的 `imageUrl` 必须写：

```txt
/charts/rjcc/KURIS_SEVEN.png
```

不要写：

```txt
public/charts/rjcc/KURIS_SEVEN.png
```

也不要写本地绝对路径。

---

## 6. 注册 manual preview

打开：

```txt
src/data/airspace/rjcc/manual-previews/index.js
```

添加 import：

```js
import { KURIS_SEVEN_RWY19 } from "./KURIS_SEVEN_RWY19.js";
```

添加对象条目：

```js
[KURIS_SEVEN_RWY19.id]: KURIS_SEVEN_RWY19,
```

完整示例：

```js
import { KURIS_SEVEN_RWY19 } from "./KURIS_SEVEN_RWY19.js";
import { KURIS_SEVEN_RWY01 } from "./KURIS_SEVEN_RWY01.js";
import { CHITOSE_FOUR_RWY01 } from "./CHITOSE_FOUR_RWY01.js";
import { CHITOSE_FOUR_RWY19 } from "./CHITOSE_FOUR_RWY19.js";

export const manualProcedurePreviews = {
  [KURIS_SEVEN_RWY19.id]: KURIS_SEVEN_RWY19,
  [KURIS_SEVEN_RWY01.id]: KURIS_SEVEN_RWY01,
  [CHITOSE_FOUR_RWY01.id]: CHITOSE_FOUR_RWY01,
  [CHITOSE_FOUR_RWY19.id]: CHITOSE_FOUR_RWY19,
};
```

manual preview 按 `procedureId` 注册。

---

## 7. 注册 chart overlay

打开：

```txt
src/data/airspace/rjcc/chart-overlays/index.js
```

添加 import：

```js
import { KURIS_SEVEN_CHART_OVERLAY } from "./KURIS_SEVEN.chartOverlay.js";
```

添加对象条目：

```js
[KURIS_SEVEN_CHART_OVERLAY.chartId]: KURIS_SEVEN_CHART_OVERLAY,
```

完整示例：

```js
import { KURIS_SEVEN_CHART_OVERLAY } from "./KURIS_SEVEN.chartOverlay.js";
import { CHITOSE_FOUR_CHART_OVERLAY } from "./CHITOSE_FOUR.chartOverlay.js";

export const chartOverlays = {
  [KURIS_SEVEN_CHART_OVERLAY.chartId]: KURIS_SEVEN_CHART_OVERLAY,
  [CHITOSE_FOUR_CHART_OVERLAY.chartId]: CHITOSE_FOUR_CHART_OVERLAY,
};
```

chart overlay 按 `chartId` 注册。

同一张图的多个 procedure variant 共用一个 chart overlay。

示例：

```txt
CHITOSE_FOUR_RWY01 → chartId: CHITOSE_FOUR
CHITOSE_FOUR_RWY19 → chartId: CHITOSE_FOUR
```

这两个都会调用：

```txt
CHITOSE_FOUR.chartOverlay.js
```

---

## 8. JAIP 中查看

打开：

```txt
#/rjcc-jaip
```

选择 procedure：

```txt
KURIS SEVEN RWY19
CHITOSE FOUR RWY01
```

检查：

```txt
1. 手绘 procedure route 出现
2. 旧自动错误路线没有覆盖手绘线
3. CHART AUTO 开启后显示对应航图 PNG
4. 航图在路线下方
5. 关闭 CHART 后航图消失
```

如果航图不显示，检查：

```txt
1. PNG 是否在 public/charts/rjcc/
2. imageUrl 是否是 /charts/rjcc/xxx.png
3. chart-overlays/index.js 是否注册了 chartId
4. manual preview 文件中是否有正确 chartId
```

如果航路不显示，检查：

```txt
1. manual-previews/index.js 是否注册了 procedureId
2. manual preview 的 id 是否和 selector id 完全一致
3. coordinateSpace / anchorFrame 是否有效
4. 是否存在 NaN / 0-length anchor frame
```

---

## 9. anchorFrame 选择规则

### 9.1 以 FIX 为终点的程序

例如 KURIS 7：

```txt
start: RJCC_RWY19_REPRESENTATIVE
final: KURIS
reference radial: CHE → KURIS
```

可使用：

```js
anchorFrame: {
  originId: "CHE",
  axisToId: "KURIS",
  startId: "RJCC_RWY19_REPRESENTATIVE",
  finalId: "KURIS",
}
```

### 9.2 以 VOR/DME 为终点的程序

例如 CHITOSE FOUR 到 CHE：

不要使用：

```js
originId: "CHE",
axisToId: "CHE",
```

这会产生 0 长度轴线。

应使用：

```js
anchorFrame: {
  originId: "RJCC_RWY01_REPRESENTATIVE",
  axisToId: "CHE",
  startId: "RJCC_RWY01_REPRESENTATIVE",
  finalId: "CHE",
}
```

或：

```js
anchorFrame: {
  originId: "RJCC_RWY19_REPRESENTATIVE",
  axisToId: "CHE",
  startId: "RJCC_RWY19_REPRESENTATIVE",
  finalId: "CHE",
}
```

### 9.3 RNAV fix-to-fix 程序

RNAV SID / STAR 通常使用：

```js
anchorFrame: {
  originId: "FIRST_FIX_OR_RUNWAY_ANCHOR",
  axisToId: "FINAL_FIX",
  startId: "FIRST_FIX_OR_RUNWAY_ANCHOR",
  finalId: "FINAL_FIX",
}
```

如果路线很长、形状复杂，必要时可以仍然使用 raw projected，但默认优先 anchor-normalized。

---

## 10. Transition 命名规则

Transition 必须进入 `procedureId`。

规则：

```txt
PROCEDURE_RUNWAY_TRANSITION
```

示例：

```txt
YOSAN_ONE_RWY19_TOBBY_TRANSITION
REZOT_TWO_RWY01_TEKKO_TRANSITION
SAVIT_ARRIVAL_DALBI_TRANSITION
```

不要把多个 transition 都塞进一个：

```txt
YOSAN_ONE_DEPARTURE
```

否则 JAIP 不知道应该显示哪条手绘线、哪张图、哪个 overlay。

---

## 11. 数据层分工

```txt
fixes.js / navaids.js / runways.js / airports.js
  真实基础数据

procedures.js
  程序语义 / procedure leg / selector 数据

manual-previews/*.js
  手工描线显示，不是导航数据

chart-overlays/*.js
  航图 PNG 叠加姿态，不是导航数据

public/charts/rjcc/*.png
  原始航图图片
```

飞机未来导航不应沿 manual preview 的 SVG 线巡线，而应基于 procedure legs 执行：

```txt
RUNWAY_HEADING
TURN_TO_RADIAL
RADIAL_TO_FIX
DIRECT_FIX
HOLD
ILS_INTERCEPT
MISSED_APPROACH
```

manual preview 只用于显示、校验和 briefing。

---

## 12. 验证命令

每次新增文件后运行：

```powershell
cd "C:\Users\59679\Desktop\atc-radar-sim"

npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

打开：

```txt
#/rjcc-jaip
#/rjcc-trace-editor
```

检查：

```txt
SVG 无 NaN / Infinity
console 无 error
/ 主模拟器不受影响
CHART AUTO 正常
manual preview 正常
```

---

## 13. Commit 建议

```powershell
git status

git add public/charts/rjcc
git add src/data/airspace/rjcc/manual-previews
git add src/data/airspace/rjcc/chart-overlays
git add src/data/airspace/rjcc/manualProcedurePreviews.js
git add src/data/airspace/rjcc/chartOverlays.js
git add src/prototypes/rjcc-trace-editor
git add src/map/jaip
git add src/core-v2/procedures
git add docs

git commit -m "Add RJCC manual preview and chart overlay workflow" -m "Document and implement the display-only manual procedure preview and shared chart overlay workflow for RJCC JAIP visualizer without changing legacy gameplay."
```

---

## 14. 当前完成状态示例

已完成样板：

```txt
KURIS SEVEN
CHITOSE FOUR
```

示例文件：

```txt
manual-previews/KURIS_SEVEN_RWY19.js
manual-previews/KURIS_SEVEN_RWY01.js
manual-previews/CHITOSE_FOUR_RWY01.js
manual-previews/CHITOSE_FOUR_RWY19.js

chart-overlays/KURIS_SEVEN.chartOverlay.js
chart-overlays/CHITOSE_FOUR.chartOverlay.js

public/charts/rjcc/KURIS_SEVEN.png
public/charts/rjcc/CHITOSE_FOUR.png
```

下一批建议：

```txt
KURIS_SEVEN_RWY01
TOKACHI
TEKKO
MUKAWA
TOBBY
NAGANUMA
YUFUTSU
SAVIT
RNAV SID
```

