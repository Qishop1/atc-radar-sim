# RJCC ATC Simulator — 长期架构与工作指导 v4.0

版本 4.0 的目标不是推翻 v3.7，而是把已经落地的 package 边界、Canvas 地图渲染方向、Procedure Authoring Tool 现实状态，以及接下来 P0 前必须做的事情整理成一份可执行指导。

核心判断：

- RJCC 仍然是主线，先把 RJCC 做深，不急着扩张。
- Sector 已经从“ACA 视图”升级为平台里的可加载 ATC 管制单元 / 场景包。
- `rjcc_aca` 只是 RJCC Sector 的 boundary asset，不是 Sector 本身。
- Procedure Authoring Tool 当前只产出 display layer / manual trace 数据，不产出飞机可飞的 legs。
- 近期新增的 package 结构是 wrapper foundation，不是完整迁移完成。
- 当前最重要的工作是保护已经跑通的 KURIS 7 / CHITOSE 4 工作流，并把它固化成 P0 批量录入模板。

## 一、v4.0 相对 v3.7 的最近改动总结

### 1. `src/data` 四层 package 边界已经开始落地

当前项目已经出现 v3.7 规划中的四层数据目录：

- `src/data/global`
- `src/data/regions`
- `src/data/sectors`
- `src/data/airports`

这代表项目已经从“RJCC 单点原型数据”进入“可扩展数据包结构”的第一阶段。

但这一步仍然是包装层，不是彻底迁移：

- 旧数据仍主要保留在 `src/data/airspace/rjcc`
- JAIP 底图数据仍在 `src/data/jaip/rjcc`
- 新 package 多数通过 wrapper / re-export 聚合旧数据
- 新代码可以逐步改用 package entry point
- 旧工具链不能因为目录变化而中断

这符合 v3.7 的执行原则：先加 wrapper，后迁移 import，再移动文件。

### 2. RJCC Airport Package 已经存在

新增入口：

```txt
src/data/airports/rjcc/rjccAirportPackage.js
```

它聚合了：

- airport
- runways
- localizers
- procedures
- chart overlays
- manual previews
- procedure authoring metadata
- regional airport markers

当前它的语义是：

```js
rjccAirportPackage = {
  id: "rjcc",
  icao: "RJCC",
  type: "airport",
  status: "active",
  ...
}
```

这完成了 P-1 的核心方向：RJCC airport 作为一个独立 airport package 被声明出来。

注意：它现在仍然大量引用 `src/data/airspace/rjcc` 的旧数据，所以不能理解成“机场资料已经完全搬迁完成”。

### 3. RJCC Sector Package 已经存在

新增入口：

```txt
src/data/sectors/rjcc/sectorPackage.js
```

它定义了 RJCC Sector 的平台级组合关系：

- region: `hokkaido`
- associated airports: `RJCC`, `RJCJ`
- airport packages: RJCC + RJCJ
- boundaries: ACA + ACC partial placeholder
- controller roles
- frequencies
- runway configs
- traffic flows
- handoff rules
- traffic status

这完成了 v3.7 里最关键的概念纠偏：

```txt
RJCC Sector != RJCC Airport
RJCC Sector != RJCC ACA
RJCC ACA = RJCC Sector 引用的一个 boundary asset
```

当前 `controllerRoles` 已经预留：

- ACC: future
- APP: primary / enabled
- DEP: planned
- TWR: planned
- GND: future
- DEL: future

这只是 metadata，不代表 ACC / TWR / GND / DEL 工作流已经实现。

### 4. Boundary asset 路径已经固定

当前已经存在：

```txt
src/data/sectors/rjcc/boundaries/rjcc_aca.json
src/data/sectors/rjcc/boundaries/rjcc_acc_partial.json
```

`rjcc_aca.json` 现在是 polyline control geometry。它保留了边界资产路径，但当前视觉显示仍然通过旧的 ACA point/path helper 保持显示一致性。

`rjcc_acc_partial.json` 只是未来占位，不代表 ACC partial 已经实现。

v4.0 的规则：

- boundary asset 可以存在多个
- boundary 不等于 sector
- ACA 不等于 APP
- ACC partial 未经数据验证前不能虚构
- 当前继续保持 polyline，不回到 arc segment 主数据结构

### 5. Hokkaido Region Package 已经存在

新增入口：

```txt
src/data/regions/hokkaido/regionPackage.js
```

当前它聚合：

- coastline
- contours
- terrain: null
- airport markers

但它仍然复用旧 JAIP 数据：

```txt
src/data/jaip/rjcc/rjcc_coastline_hires.json
src/data/jaip/rjcc/hokkaido_contours.json
```

语义上，这是正确方向：

```txt
Region = 底图
Region != Procedure
Region != Sector gameplay
```

### 6. Global wrappers 已经存在，但还不是正式全球数据库

当前有：

```txt
src/data/global/airports.js
src/data/global/fixes.js
src/data/global/navaids.js
src/data/global/resolveFix.js
src/data/global/index.js
```

但现在 `airports / fixes / navaids` 仍然只是从 `src/data/airspace/rjcc` re-export。

`resolveFix(ref)` 已经可以按 id 解析：

- fix
- navaid
- airport

这是 P-1.5 Global Database 的开始，不是完成。

下一步需要补的是：

- FIR 字段
- source
- airac_cycle
- 多源合并标注
- VATSIM `.sct` import
- JCAB compact DMS parser

### 7. RJCJ 已经从 RJCC airport 概念中拆出

当前存在：

```txt
src/data/airports/rjcj/rjcjAirportPackage.js
```

它还是 placeholder，但方向正确：

- RJCJ 是独立 airport package
- RJCJ 可以是 RJCC Sector 的 associated airport
- RJCJ 不应该继续挂在 RJCC airport package 下面
- JASDF / scramble / recovery / military traffic 后续属于 RJCJ 或 Sector gameplay，不继续散落在旧 RJCC airport 语义中

### 8. ZYTX / ZYTL / Liaoning 已有扩展占位

当前存在：

```txt
src/data/regions/liaoning
src/data/airports/zytx
src/data/airports/zytl
src/data/sectors/zytx
```

这些只是 placeholder。

v4.0 明确：

- 不要把它们当作 P0 主线
- 不要现在录入中国 eAIP
- 不要为了占位牺牲 RJCC 进度
- 这些目录存在的意义是验证 package 边界可以跨 region 扩展

### 9. JAIP 地图开始使用 Canvas-first 静态几何渲染

近期另一个重要变化是地图渲染层：

```txt
src/map/canvas/CanvasMapLayer.jsx
src/map/canvas/canvasMapDrawers.js
```

`RjccJaipMapLayer.jsx` 现在默认使用 Canvas 渲染重型静态几何：

- coastline
- contours
- ACA boundary stroke

SVG / React 继续负责：

- chart overlay
- airports
- runways
- fixes
- navaids
- localizers
- procedure display routes
- procedure labels
- ACA DME references
- altitude blocks
- navaid symbols
- trace editor construction / dragging / labels / export UI

这不是换技术栈。项目仍然是 React/Web 2D radar-first，不引入 Unity / Three.js / Babylon / WebGL 3D。

重要原则：

- 大型底图几何不要继续变成大量 React element
- 可交互对象继续留在 SVG / React
- Canvas helper 要保持独立，以后可以 worker 化
- Procedure Authoring Tool 的导出格式不能被 Canvas 迁移破坏

## 二、当前文件结构

下面是 v4.0 视角下的当前核心结构。没有列出每个 UI / simulator 文件，只列和长期架构直接相关的部分。

```txt
src/
  data/
    global/
      airports.js
      fixes.js
      navaids.js
      resolveFix.js
      index.js

    regions/
      hokkaido/
        airportMarkers.js
        regionPackage.js
        index.js
      liaoning/
        regionPackage.js
        index.js

    sectors/
      rjcc/
        sectorPackage.js
        controllerRoles.js
        frequencies.js
        runwayConfigs.js
        trafficFlows.js
        handoffRules.js
        trafficStatus.js
        index.js
        boundaries/
          rjcc_aca.json
          rjcc_acc_partial.json
      zytx/
        sectorPackage.js
        controllerRoles.js
        index.js

    airports/
      rjcc/
        rjccAirportPackage.js
        airport.js
        runways.js
        localizers.js
        procedures.js
        charts.js
        manualPreviews.js
        procedureAuthoring.js
        index.js
      rjcj/
        rjcjAirportPackage.js
        airport.js
        runways.js
        procedures.js
        recoveryProcedures.js
        militaryTraffic.js
        index.js
      zytx/
        zytxAirportPackage.js
        airport.js
        runways.js
        procedures.js
        index.js
      zytl/
        zytlAirportPackage.js
        airport.js
        runways.js
        procedures.js
        index.js

    airspace/
      rjcc/
        airports.js
        runways.js
        localizers.js
        fixes.js
        navaids.js
        procedures.js
        radialDmeReferences.js
        manualProcedurePreviews.js
        chartOverlays.js
        manual-previews/
          KURIS_SEVEN_RWY01.js
          KURIS_SEVEN_RWY19.js
          CHITOSE_FOUR_RWY01.js
          CHITOSE_FOUR_RWY19.js
          index.js
        chart-overlays/
          KURIS_SEVEN.chartOverlay.js
          CHITOSE_FOUR.chartOverlay.js
          index.js

    jaip/
      rjcc/
        acaPoints.js
        navaids.js
        rjcc_coastline_hires.json
        hokkaido_contours.json

  map/
    jaip/
      RjccJaipMapLayer.jsx
      AcaOverlayLayer.jsx
      CoastlineLayer.jsx
      ContourLayer.jsx
      ProcedureRouteLayer.jsx
      ChartOverlayLayer.jsx
      AirportLayer.jsx
      RunwayLayer.jsx
      FixLayer.jsx
      NavaidLayer.jsx
      LocalizerLayer.jsx
      semanticFilters.js
      pathHelpers.js
    canvas/
      CanvasMapLayer.jsx
      canvasMapDrawers.js

  prototypes/
    rjcc-jaip/
      ChitoseApproachControlAreaReplica.jsx
      ClearanceComposerPanel.jsx
    rjcc-trace-editor/
      RjccProcedureTraceEditor.jsx
      TraceEditorLayer.jsx
      ChartOverlayLayer.jsx
      ConstructionOverlayLayer.jsx
      deriveProcedureTraceSetup.js
      manualPreviewPresets.js
      waypointSnapTargets.js
      runwayAnchors.js
      constructionGeometry.js
      anchorTraceTransform.js

public/
  charts/
    rjcc/
      KURIS_SEVEN.png
      CHITOSE_FOUR.png

docs/
  ARCHITECTURE_ROADMAP_V4.md
  CANVAS_RENDERER_PLAN.md
  RJCC_DATA_PACK.md
  RJCC_PROCEDURE_SCHEMA.md
  RJCC_MANUAL_PREVIEW_AND_CHART_OVERLAY_WORKFLOW.md
  RJCC_JAIP_MAP_LAYER.md
  RJCC_AIRSPACE_SEED_DATA.md
```

## 三、当前真实状态判断

### 已经完成或基本成立

- RJCC JAIP prototype 已存在
- RJCC TRACON / ACA 单 sector 视图已存在
- KURIS 7 / CHITOSE 4 已经作为 conventional SID display seeds
- procedure selector / labels / preview / chart overlay 链路已成立
- `#/rjcc-trace-editor` 已经是 Procedure Authoring Tool prototype
- chart 手工对齐、JAIP overlay、辅助线、trace preview、JS / JSON export 工作流已经成立
- RJCC airport package wrapper 已存在
- RJCC sector package wrapper 已存在
- Hokkaido region package wrapper 已存在
- Global resolve wrapper 已存在
- RJCJ airport package placeholder 已存在
- ZYTX / ZYTL / Liaoning placeholders 已存在
- Canvas-first 静态底图渲染路径已出现

### 还没有完成

- RNAV SID workflow 未验证
- STAR workflow 未验证
- approach workflow 未验证
- Global fix / navaid database 还没有正式独立数据源
- VATSIM `.sct` importer 未实现
- JCAB AIP ENR importer 未实现
- RJCC ACA boundary 还未从正式 ENR import 流程生成
- aircraft guidance 仍不能接 procedure display path
- procedure legs 仍可为 `null`
- Leg Authoring Tool 未实现
- ACC / GND / DEL gameplay 未实现
- RJCJ 军航玩法仍是 future placeholder
- ZYTX / ZYTL 只是边界验证占位

### 现在最容易犯的错

- 把 `display_path` 当作飞机导航轨迹使用
- 在 P0 前强行补不完整 `legs`
- 把 `rjcc_aca` 当成 Sector
- 把 RJCJ 继续塞回 RJCC airport package
- 把 Hokkaido region 变成 procedure / gameplay 容器
- 因为已有 ZYTX 目录就提前展开中国区域
- 重构 trace editor 时顺手改 procedure schema
- Canvas 化时破坏 SVG 交互层
- 一次 PR 同时做目录迁移、渲染迁移、procedure 数据调整和 gameplay 接入

## 四、v4.0 核心架构规则

### 1. 数据层职责

```txt
Global = 跨 region 共享索引
Region = 地理底图
Sector = 可加载 ATC 管制单元 / 场景包
Boundary = Sector 引用的真实空域边界资产
Airport = 单机场资产包
Procedure = 程序资料
Procedure Authoring Data = 给人看的 chart / preview / trace 数据
Gameplay = 模拟玩法
```

任何新文件进入前先问：它属于哪一层？

如果答案不清楚，先不要放进 `src/data/airspace/rjcc` 继续堆。

### 2. 新代码优先引用 package entry point

以后新增代码应优先引用：

```js
import { rjccSectorPackage } from "../data/sectors/rjcc/index.js";
import { rjccAirportPackage } from "../data/airports/rjcc/index.js";
import { hokkaidoRegionPackage } from "../data/regions/hokkaido/index.js";
import { resolveFix } from "../data/global/index.js";
```

旧代码可以暂时继续引用：

```txt
src/data/airspace/rjcc
src/data/jaip/rjcc
```

但新增功能不应扩大旧路径的职责。

### 3. Package data 尽量保持 JSON-compatible

Package 对象应该尽量避免：

- React component
- JSX
- DOM reference
- Canvas context
- rendering callback
- class instance
- 需要执行才能理解数据结构的函数

允许存在 wrapper 文件，但真正的 package 数据应尽量是普通对象、数组、字符串、数字、布尔值和 `null`。

### 4. Procedure Authoring Tool 和 Leg Authoring Tool 分开

当前：

```txt
Procedure Authoring Tool = #/rjcc-trace-editor
```

它负责：

- chart 加载
- chart 手工对齐
- JAIP 底图叠加
- radial / DME / 辅助线
- procedure display preview trace
- waypoint / navaid 辅助标注
- JS / JSON export

它不负责：

- aircraft guidance
- ARINC-like path terminator
- altitude / speed constraint validation
- leg simulator
- FMS-like execution

未来 P2：

```txt
Leg Authoring Tool = 给飞机读的 navigation semantics 工具
```

Leg Authoring Tool 可以复用地图、chart placement、trace editor 的 UI 能力，但产物必须不同。

### 5. display layer 永远不能驱动飞机

下面这些都是给人看的：

- chart overlay
- manual preview
- display_path
- SVG route preview
- trace editor export preview

下面这些未来才可以给飞机读：

- legs
- constraints
- path terminators
- leg simulator output

在 P2 完成前，任何飞机行为都不能读取 `display_path` 当导航路径。

## 五、v4.0 推荐工作顺序

### Step 1：冻结并验证当前 package foundation

目标：确保新 wrapper 没有破坏现有 RJCC 原型。

需要做：

1. 确认 `#/rjcc-jaip` 正常打开。
2. 确认 `#/rjcc-trace-editor` 正常打开。
3. 确认 KURIS 7 图层显示不变。
4. 确认 CHITOSE 4 图层显示不变。
5. 确认 procedure selector / labels / chart overlay / manual preview 都能工作。
6. 运行 lint。
7. 运行 build。

完成标准：

```txt
npm.cmd run lint
npm.cmd run build
```

都通过。

不要在这一步新增 procedure。

### Step 2：整理 v4 文档与 package 使用规则

目标：让之后每个改动都有清楚边界。

需要做：

1. 保留本文件作为 v4.0 指导。
2. 保留 `docs/RJCC_DATA_PACK.md` 作为 package 边界说明。
3. 保留 `docs/CANVAS_RENDERER_PLAN.md` 作为 Canvas/SVG 分层说明。
4. 更新 README，只放项目定位和不用于真实导航声明。
5. 不在 README 里塞完整 schema，schema 留给 docs。

完成标准：

- README 可以让陌生人理解项目不是真实导航系统。
- docs 可以让之后的自己知道下一步该改哪里。

### Step 3：固化 KURIS 7 / CHITOSE 4 导出格式

目标：在开始 RNAV SID / STAR 前，先把已经验证的 conventional SID 工作流变成模板。

需要做：

1. 对比当前 `manual-previews` 和 `chart-overlays` 的字段。
2. 写一份“当前导出格式说明”，不要重新发明 schema。
3. 标记哪些字段是 Procedure Authoring Tool 必须继续导出的。
4. 标记哪些字段只是当前 UI convenience。
5. 确认 KURIS 7 / CHITOSE 4 的 chart image、placement、manual preview、procedure route 之间的引用关系。

建议输出：

```txt
docs/RJCC_PROCEDURE_AUTHORING_EXPORT_V1.md
```

完成标准：

- 你可以照着这份文档手工录入第三条 procedure。
- 不需要猜 chart id / preview id / runway variant / procedure id 怎么连。

### Step 4：Global Database 从 wrapper 变成真实局部数据库

目标：让 `resolveFix(ref)` 不再只是 RJCC old airspace 的 re-export。

需要做：

1. 给 `navaids.js` 建立明确记录结构。
2. 给 `fixes.js` 建立明确记录结构。
3. 给 `airports.js` 建立明确记录结构。
4. 每条记录加入：

```js
{
  id,
  lat,
  lon,
  fir,
  source,
  airac_cycle
}
```

5. 保留兼容导出，避免一次性打断旧 UI。
6. `resolveFix(ref)` 支持大小写归一。
7. 对重复 id 做冲突标记，不要静默覆盖。

完成标准：

- KURIS 7 / CHITOSE 4 的 refs 可以通过 global resolver 找到。
- 旧 JAIP / procedure display 不坏。

### Step 5：实现两个坐标 parser

目标：为 importer 做最小基础设施。

只需要支持两种：

VATSIM `.sct`：

```txt
N043.14.03.000
E141.43.27.000
```

JCAB AIP compact DMS：

```txt
424656.25N
1414051.29E
```

输出统一十进制度数：

```js
{ lat: 42.7822917, lon: 141.6809139 }
```

建议位置：

```txt
src/geo/dms.js
```

或新增：

```txt
src/data/importers/coordinateParsers.js
```

完成标准：

- 有小样本测试。
- parser 不依赖 React。
- parser 不依赖地图 projection。

### Step 6：做 VATSIM `.sct` importer

目标：快速导入 / cross-check fix 和 navaid。

范围：

- 解析必要 section
- 转换 DMS 点分格式
- 输出 draft fix / navaid records
- 保留 source
- 保留 airac_cycle 或 source_cycle

不做：

- 自动覆盖人工数据
- 复杂冲突自动决策
- 完整 sector file renderer
- gameplay 接入

建议输出位置：

```txt
tools/importers/
```

或：

```txt
scripts/importers/
```

输出可以先是 JSON draft，不必直接写入 runtime data。

完成标准：

- 可以生成 RJCC 周边 fix / navaid 候选列表。
- 可以和当前手工数据对照。

### Step 7：做 JCAB ENR boundary importer

目标：让 `rjcc_aca.json` 未来能从 ENR 顶点表生成或校对。

范围：

- 解析 compact DMS
- 输出 boundary polyline JSON
- 标记 source / airac_cycle
- 不做自动 georeference
- 不做 PDF 全自动提取

完成标准：

```txt
src/data/sectors/rjcc/boundaries/rjcc_aca.json
```

可以被 importer 生成或至少被 importer 校对。

### Step 8：RNAV SID 试点

只有完成 Step 3 后才进入。

目标：验证 RNAV SID 和 KURIS 7 / CHITOSE 4 是否能共用当前 Procedure Authoring Tool workflow。

范围：

- 只选一条 RNAV SID
- 做 chart placement
- 做 display_path
- 做 selector record
- 做 manual preview
- 做 chart overlay
- `legs` 仍然允许 `null`

不做：

- 批量录入所有 SID
- aircraft guidance
- leg semantics
- STAR
- approach

完成标准：

- RNAV SID 可以在 selector 中选择。
- chart overlay 对齐可接受。
- display preview 可见。
- 不影响 KURIS 7 / CHITOSE 4。

### Step 9：开始 P0 批量 SID / STAR Atlas

进入条件：

- KURIS 7 / CHITOSE 4 格式已固化
- RNAV SID 试点通过
- Global resolver 基本可用
- trace editor export 路径稳定

P0 范围：

- conventional SID
- RNAV SID
- conventional STAR
- RNAV STAR

P0 不做：

- approach
- aircraft guidance
- full legs
- gameplay procedure clearance
- ACC / TWR / GND / DEL

完成标准：

- RJCC SID / STAR 可选
- 可显示
- 可校验引用是否存在
- 每条 procedure 至少有 display_path
- `legs` 可以继续是 `null`

## 六、每个阶段的保护清单

任何改动合并前，至少检查：

- `#/rjcc-jaip` 不坏
- `#/rjcc-trace-editor` 不坏
- KURIS 7 不坏
- CHITOSE 4 不坏
- chart overlay 不坏
- manual preview 不坏
- procedure labels 不坏
- Canvas fallback `staticLayerRenderer="svg"` 不坏
- `npm.cmd run lint` 通过
- `npm.cmd run build` 通过

如果某个改动会影响这些基础链路，必须单独做，不要和数据录入混在一起。

## 七、v4.0 禁区

当前不要做：

- AIRAC 自动更新
- 多 AIRAC cycle runtime 切换
- 全球 navdata coverage
- 企业级 ingestion pipeline
- AIXM 全链路
- Navigraph 数据接入
- 日本 SWIM 接入
- 真实导航用途
- aircraft 沿 display_path 飞
- P0 前强行写半成品 legs
- 用 Canvas 取代所有 SVG 交互层
- 把 ZYTX / ZYTL 提前变成主线
- 把 RJCJ 军航玩法继续堆进 RJCC airport
- 一次性移动 `src/data/airspace/rjcc` 全部文件

## 八、v4.0 下一步最短路径

如果只按最高收益排序，接下来应该这样做：

1. 运行 lint / build，确认当前 package + Canvas 变化没有破坏项目。
2. 用当前 v4 文档冻结概念边界。
3. 写 `RJCC_PROCEDURE_AUTHORING_EXPORT_V1.md`，固化 KURIS 7 / CHITOSE 4 的导出格式。
4. 把 `src/data/global` 从 re-export wrapper 升级成真实局部 database。
5. 给 `resolveFix` 加冲突处理和 source / airac awareness。
6. 做 VATSIM `.sct` importer，用来补 fix / navaid 候选。
7. 做 JCAB compact DMS parser 和 ACA boundary 校对输出。
8. 选一条 RNAV SID 做试点。
9. RNAV SID 通过后，进入 P0 SID / STAR 批量 atlas。

一句话版：

```txt
先验证现有 wrapper 和 Canvas 没破坏工具链；
再固化 KURIS 7 / CHITOSE 4 的 procedure authoring export；
然后补 global resolver 和 importer；
最后才开始 RNAV SID 与 SID/STAR 批量录入。
```

## 九、当前项目定位

RJCC ATC Simulator 是一个个人长期项目，目标是做成：

```txt
RJCC / 北海道优先的 procedure + radar simulation 平台
```

它的方向类似：

```txt
VATSIM Radar Client + EuroScope + 简化 EuroControl NM 工作站
```

但它不是：

```txt
真实导航系统
production aviation system
商业 navdata 产品
AIRAC 自动同步平台
```

v4.0 的工作重点不是扩张，而是让当前已经跑通的 RJCC procedure display / authoring workflow 变得稳定、可复用、可批量生产。
