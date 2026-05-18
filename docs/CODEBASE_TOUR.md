# 代码库导览 / Codebase Tour

本文面向新加入项目的开发者，介绍 ATC Radar Simulator 的整体结构、关键模块、核心运行流程、易回归区域，以及建议的学习路线。

## 1. 项目概览

ATC Radar Simulator 是一个基于 Vite + React + Electron 的空管雷达模拟器。它既可以在开发阶段作为 Web 应用运行，也可以通过 Electron Builder 打包成 Windows 桌面应用。

整体启动链路可以简化理解为：

```text
index.html
  -> src/main.tsx
    -> src/App.jsx
      -> src/simulator/*
```

当前代码库的核心特点是：主应用逻辑集中在 `src/App.jsx`，领域数据和可复用计算逻辑拆分在 `src/simulator/` 下。

## 2. 顶层目录结构

| 路径 | 作用 |
| --- | --- |
| `src/` | React 前端和仿真编排逻辑。 |
| `src/App.jsx` | 主应用组件，包含 UI 状态、仿真循环、管制指令、计分、雷达 / 塔台 / 3D 渲染等核心逻辑。 |
| `src/main.tsx` | 浏览器端 React 入口。 |
| `src/simulator/` | 可复用的仿真基础模块，包括几何、跑道、天气、机型性能、场景和状态机。 |
| `electron/` | Electron 主进程入口。 |
| `public/` | 图标、favicon 等静态资源。 |
| `README.md` | 用户和开发者常用的运行、构建、发布说明。 |
| `CODEX_NOTES.md` | 维护注意事项，包含保持小 diff、避免改变玩法等约束。 |
| `REGRESSION_RISKS.md` | 曾经频繁变化或容易改坏的高风险区域。 |
| `package.json` | npm 脚本、依赖和 Electron Builder 配置。 |

## 3. 运行和构建命令

常用 npm 脚本包括：

- `npm run dev`：启动 Vite 开发服务器。
- `npm run build`：执行 TypeScript 构建检查并生成生产版 Web 构建。
- `npm run electron:dev`：先构建 Vite 应用，再用 Electron 启动桌面端。
- `npm run dist:win`：构建 Windows 安装包。
- `npm run lint`：运行 ESLint。
- `npm run preview`：预览生产版 Vite 构建。

生产 Web 构建产物位于 `dist/`。Windows 本地发布产物位于 `release/`。

## 4. 应用入口

### 4.1 浏览器入口：`src/main.tsx`

`src/main.tsx` 是很薄的一层启动代码。它引入全局样式，导入 `App`，并用 React 的 `createRoot` 把应用挂载到页面上。

新人阅读时可以把它当作“React 启动器”，真正的业务和仿真逻辑在 `src/App.jsx`。

### 4.2 Electron 入口：`electron/main.cjs`

`electron/main.cjs` 负责创建桌面窗口。开发环境下，如果存在 `VITE_DEV_SERVER_URL`，它会加载开发服务器地址；否则加载构建后的 `dist/index.html`。

Electron 窗口启用了 `contextIsolation: true`，并关闭了 `nodeIntegration`。因此渲染进程代码不应假设可以直接使用 Node.js API。

## 5. 主应用：`src/App.jsx`

`src/App.jsx` 是当前项目最核心、也最需要谨慎修改的文件。它承担了多类职责：

- React UI 状态管理。
- 雷达、塔台和 3D 视图渲染。
- 飞机生成、删除和选中逻辑。
- 飞机运动推进和状态变化。
- 管制指令处理。
- 跑道计划和跑道切换。
- 风和天气集成。
- 剧本事件和关卡目标。
- 冲突 / 间隔检测。
- 计分。
- 塔台自动化。
- RJCJ 军机、任务走廊和特殊事件逻辑。

因为职责集中，修改 `App.jsx` 时应优先采用小步、局部、可验证的改动。除非任务明确要求，不建议一次性大规模重构。

### 5.1 国际化文案

UI 文案集中在 `src/App.jsx` 内的 `I18N` 对象中。英文文案位于 `en`，中文文案位于 `zh`。

如果只是修改按钮、标签、面板标题或状态提示，通常优先查找 `I18N`，避免误改仿真逻辑。

### 5.2 React 状态

主组件使用大量 `useState` 保存模拟器状态，包括：

- 开始界面、游戏模式和场景 ID。
- 当前席位和塔台机场。
- 跑道模式、进场跑道、离场跑道、关闭跑道。
- 风、天气开关、天气种子和天气时间。
- 飞机列表、雷达目标列表和当前选中飞机。
- 管制指令输入框和待执行指令。
- 进场 / 离场 / 军机 / 塔台自动化开关。
- 时间倍率、缩放、雷达平移、3D 视角、语言和无线电日志。

项目当前没有单独使用 Redux、Zustand 或 XState。多数编排逻辑直接发生在主组件中。

### 5.3 `env` 环境对象

`App.jsx` 会用 `useMemo` 生成 `env` 对象。可以把它理解为“当前世界状态”。它通常包含：

- 当前活动跑道。
- 导航点、进场路线和 SID。
- 当前风、顶风、顺风。
- RJCJ / RJCH / RJSM 等机场的活动跑道。
- 天气开关和天气单体。
- 关闭跑道列表。

大量仿真函数都依赖 `env`，排查问题时应先确认当前 `env` 是否符合预期。

### 5.4 主仿真循环

当模拟器运行时，主组件会启动定时器推进仿真。每个周期大致会：

1. 推进仿真 tick。
2. 按天气节奏更新 `weatherTick`。
3. 推进真实时间 tick。
4. 对每架飞机执行运动和状态推进。
5. 归一化飞机状态。
6. 统计 touchdown。
7. 应用塔台自动化。
8. 移除已落地、已移交或离开模拟范围的飞机。

这是理解 gameplay 行为的核心流程。任何影响飞机运动、状态、塔台或移交的改动，都应该围绕这个循环进行验证。

### 5.5 雷达显示目标

雷达显示使用扫描后的目标快照，并根据扫描年龄做显示外推。外推位置只用于显示，不能反向影响飞机真实物理状态。

开发时请严格区分：

- `aircraft`：真实仿真状态。
- `radarTargets` / display targets：雷达显示层状态。

如果把显示外推结果写回真实飞机状态，就会改变仿真物理，是高风险错误。

### 5.6 管制指令系统

管制指令可以立即执行，也可以延迟执行。延迟指令会进入 pending command 列表，记录目标飞机、patch、创建 tick 和到期 tick。到期后再应用到飞机对象，并重新归一化状态。

因此，如果用户点击指令后飞机没有立刻变化，不一定是 bug。需要先检查：

- 是否启用了指令延迟。
- 指令是否还在 pending 列表中。
- 到期后 patch 是否被应用。
- `normalizeAircraftState` 是否改变或清理了相关字段。

### 5.7 塔台自动化

塔台自动化负责自动移交塔台、落地许可，以及部分无许可低高度进近导致的复飞逻辑。它与以下因素强耦合：

- 飞机类别和模式。
- 进近状态和高度。
- 跑道占用。
- 是否紧急状态。
- 是否已塔台控制。
- 是否已有落地许可。

这部分是高风险区域。修改时要重点测试正常进近、无许可进近、复飞、Mayday / Pan-Pan、落地滑跑和跑道释放。

### 5.8 计分和冲突

`App.jsx` 会根据当前飞机、任务状态和进场排序派生冲突、警戒、任务空域违规、延误惩罚和最终分数。

关卡目标主要定义在 `src/simulator/scenarios.js`，实时计分和 UI 展示主要在 `src/App.jsx`。

## 6. 仿真模块

### 6.1 `src/simulator/constants.js`

该文件定义基础常量和机场跑道数据，包括：

- 雷达中心点。
- 像素和海里的换算比例。
- 仿真步长。
- 雷达扫描周期。
- 最大目标数。
- ILS 和跑道显示参数。
- 塔台显示范围和比例。
- RJCC 的 `01L`、`01R`、`19L`、`19R` 跑道。
- RJCJ、RJCH、RJSM 的跑道数据。

如果要改坐标比例、跑道定义或全局仿真常量，先读这个文件。

### 6.2 `src/simulator/geometry.js`

该文件提供几何和航空坐标工具，包括：

- 种子随机数。
- 数值限制、航向归一化、航向格式化和飞行高度层格式化。
- 航向向量和最短转弯角计算。
- 方位 / 距离与 XY 坐标互转。
- 跑道点、五边几何和 final approach 几何。
- 机场点位。
- 点到线段距离。

新人要理解“雷达坐标如何对应航空方位和距离”，应优先读这个文件。

### 6.3 `src/simulator/navigation.js`

该文件负责跑道和跑道组相关 helper：

- 判断跑道属于 `01` 还是 `19` 方向。
- 计算跑道原点。
- 选择默认进场 / 离场跑道。
- 判断两个跑道是否同向。
- 归一化跑道列表。
- 生成当前 / 待切换跑道显示集合。

涉及跑道选择、跑道切换和进离场跑道配置时，优先查这里。

### 6.4 `src/simulator/aircraftPerf.js`

该文件定义：

- 民航呼号。
- 军机呼号。
- 民航机型和军机机型。
- 离场飞行计划。
- 每种机型的性能参数。

性能参数包括最小速度、进近速度、光洁速度、最大速度、加减速、爬升率、下降率、转弯率、燃油消耗、是否旋翼机和尾流类别。

速度限制、成本指数速度、进近速度、尾流间隔等 helper 也在这里。

### 6.5 `src/simulator/weather.js`

该文件负责风和天气：

- 解析风向风速文本。
- 计算跑道顶风分量。
- 生成自动风。
- 计算风向量。
- 判断是否需要备降。
- 判断飞机高度是否位于天气单体高度层内。
- 判断点或航段是否穿越天气。
- 查找前方最近红色天气。
- 生成程序化天气单体。
- 生成天气 tile 用于显示。
- 根据风选择其他机场活动跑道。

天气单体应由天气时间状态驱动，不应在每次 React render 时重新随机生成。

### 6.6 `src/simulator/scenarios.js`

该文件定义：

- 随机进场的生成路线池。
- sandbox、debug 和 scripted scenarios。
- 每个场景的默认跑道、风、天气和自动化设置。
- 剧本流量计划。
- 场景目标。

新增关卡、调整关卡节奏或修改通关目标时，主要看这个文件。

### 6.7 `src/simulator/stateMachine.js`

该文件定义飞机 `mode` 的合法转换，以及等价状态别名。

`mode` 字符串是很多逻辑的连接点，影响运动、按钮可见性、显示文字、塔台自动化、复飞和场景事件。除非任务明确要求状态机重构，否则不要随意改名。

如果新增状态，至少需要检查：

- 状态机转换表。
- `normalizeAircraftState`。
- `displayMode`。
- 飞机运动推进逻辑。
- 指令按钮显示条件。
- 场景事件和胜负条件。

## 7. 重要行为流程

### 7.1 进场飞机生命周期

典型进场流程可以理解为：

```text
生成 / 雷达接触
  -> STAR、雷达引导、等待或直飞定位点
  -> ILS 或目视进近
  -> 移交塔台
  -> 落地许可
  -> touchdown
  -> rollout
  -> vacated / removed
```

学习时建议选中一架进场飞机，观察这些字段如何变化：

- `category`
- `mode`
- `route`
- `routeIndex`
- `assignedHeading`
- `assignedAltitude`
- `assignedSpeed`
- `clearedILS`
- `towerControlled`
- `landingClearance`
- `touchdown`

### 7.2 离场飞机生命周期

典型离场流程可以理解为：

```text
DEP_READY
  -> LINEUP_WAIT
  -> TAKEOFF_ROLL
  -> INITIAL_CLIMB
  -> DEP_RADAR_CONTACT / SID / DEP_VECTOR
  -> ACC_READY
  -> handed off
```

注意：地面上的离场飞机应该保持塔台管制。DEP / ACC 相关逻辑应在 airborne 或 radar-contact 阶段之后才开始。

### 7.3 军机和特殊任务流程

军机逻辑包含 RJCJ 离场、任务区、任务走廊、回收、直升机、天气避让和 Scenario 05 的 Foxhound / F-15J 特殊事件。

这部分同时涉及：

- 军机性能。
- 任务走廊和任务区。
- 民航间隔例外。
- 天气避让。
- 燃油状态。
- 剧本事件进度。

建议在熟悉普通进场和离场之后再学习这一块。

## 8. 高风险区域

修改行为前请先阅读 `REGRESSION_RISKS.md`。尤其要注意：

- Scenario 05 F-15J / MiG-31 拦截、汇合、护航、RJCJ 回收、燃油耗尽和重复生成防护。
- ILS 捕获、`UNSTABLE_ILS`、`FINAL`、复飞和滑跑状态边界。
- 塔台自动移交、落地许可、Mayday / Pan-Pan、不同飞行阶段的指令可见性。
- DEP 飞机在地面、起飞、雷达接触和 ACC 移交之间的边界。
- 天气单体更新时间。
- 雷达扫描和显示外推。
- RJCJ 军机任务走廊与民航冲突检测例外。

## 9. 推荐学习路线

### 第一步：先跑起来

先确认开发和构建命令可用：

```bash
npm run dev
npm run build
```

如果需要桌面端，再运行：

```bash
npm run electron:dev
```

目标是先熟悉开发服务器、生产构建和桌面端启动方式。

### 第二步：阅读基础数据模块

建议按顺序阅读：

1. `src/simulator/constants.js`
2. `src/simulator/geometry.js`
3. `src/simulator/navigation.js`
4. `src/simulator/aircraftPerf.js`
5. `src/simulator/stateMachine.js`
6. `src/simulator/scenarios.js`

这些文件能帮助你理解 `App.jsx` 里的领域词汇。

### 第三步：跟踪一架进场飞机

从生成到落地完整跟踪一架 ARR 飞机，重点观察 `mode`、路线、指令、高度、速度、塔台状态和落地许可。

### 第四步：跟踪一架离场飞机

从 `DEP_READY` 到起飞、SID、离场移交完整跟踪一架 DEP 飞机，重点理解地面塔台阶段和空中 DEP / ACC 阶段的边界。

### 第五步：学习天气和雷达显示

理解天气单体如何生成、如何影响航路，以及雷达显示如何使用扫描目标和外推。始终牢记显示外推不能影响飞机真实物理。

### 第六步：最后学习场景和军机逻辑

剧本和军机逻辑更复杂、更容易回归。建议在熟悉普通民航流程后再深入。

## 10. 贡献建议

- 优先小步、局部修改。
- 不要从头重写模拟器。
- 除非任务明确要求，否则不要改变 gameplay 行为。
- 除非明确进行状态机重构，否则保持飞机 `mode` 字符串稳定。
- 不要让雷达显示外推影响飞机真实物理。
- 提交前运行 `npm run build`。
- 修改高风险区域前先阅读 `REGRESSION_RISKS.md`。
