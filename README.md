# ATC Radar Simulator / 空管雷达模拟器

Version / 版本: **v0.5.1**

ATC Radar Simulator is a Vite + React + Electron based ATC radar simulation project focused on **RJCC (New Chitose)** as the primary data and workflow baseline.

ATC Radar Simulator 是一个基于 Vite + React + Electron 的空管雷达模拟项目，当前以 **RJCC（新千岁）** 作为主数据与流程基线。

> ⚠️ This is a simulation/prototyping project for learning and tooling, **not** an operational navigation system.
>
> ⚠️ 本项目用于模拟与工具化开发，**不**是实际运行导航系统。

---

## Project Positioning / 项目定位

This project is built around an **offline procedure authoring workflow** rather than real-time AIRAC auto-sync:

- chart alignment / chart overlay（航图叠加）
- manual route tracing（人工航迹描绘）
- JAIP map layer composition（JAIP 底图组合）
- display-first procedure preview（以显示验证优先）

Not goals (current stage):

- Not an FMS-grade route execution engine
- Not a real-time navdata ingestion platform
- Not a production ATC decision support tool

当前阶段非目标：

- 不是 FMS 级可飞行航线执行引擎
- 不是实时航行情报自动接入平台
- 不是生产级管制决策支持系统

---

## Current Architecture Snapshot (v0.5.1) / 当前架构快照

Recent updates establish a **4-layer data package foundation**:

- `src/data/global`
- `src/data/regions`
- `src/data/sectors`
- `src/data/airports`

RJCC is now organized as:

- **Region package**: Hokkaido basemap aggregation
- **Sector package**: RJCC sector-level composition (roles, boundaries, flows, frequencies, runway configs)
- **Airport package**: RJCC airport-level composition (runways, localizers, procedures, chart overlays, manual previews)

Important boundary clarifications:

- `RJCC Sector != RJCC Airport`
- `RJCC Sector != RJCC ACA`
- `rjcc_aca` is a boundary asset referenced by RJCC Sector, not the sector root itself

---

## Rendering Strategy / 渲染策略

The map stack is now **Canvas-first for heavy static geometry** while preserving SVG/React overlays for interaction.

Canvas static layer currently covers:

- coastline
- contours
- ACA boundary stroke

SVG/React remains for:

- chart overlays
- airports/runways/fixes/navaids/localizers
- procedure display routes/labels
- trace-editor interactive controls

This hybrid strategy keeps authoring interactivity while reducing React/SVG pressure on large static geometry.

---

## Procedure Authoring Status / Procedure 制作状态

Current tooling output is **display-layer data** (manual trace / preview), not fully flyable guidance legs.

Verified display seeds:

- **KURIS 7**
- **CHITOSE 4**

Not yet completed at guidance-engine level:

- full RNAV SID pipeline
- STAR/APP structured validation pipeline
- speed/altitude constraint execution model

---

## Data Scope Notes / 数据范围说明

- RJCC is the mainline focus.
- RJCJ is maintained as an independent airport package placeholder and associated with RJCC sector.
- ZYTX, ZYTL, and Liaoning currently exist as expansion placeholders only.

---

## Companion Tool / 配套工具

- [airport-weather-profiler](https://github.com/Qishop1/airport-weather-profiler)
  - Generates offline `weather_profile.json` consumed by this simulator.
  - 与模拟器运行时解耦，sim 仅加载生成结果。

---

## Install & Run / 安装与运行

### 1) Development (Web)

```bash
npm run dev
```

### 2) Development (Electron)

```bash
npm run electron:dev
```

### 3) Production Web Build

```bash
npm run build
```

Output:

```text
dist/
```

### 4) Windows Installer Build

```bash
npm run dist:win
```

Output:

```text
release/
```

---

## Download / 下载

Latest Windows release:

- https://github.com/Qishop1/atc-radar-sim/releases/latest

Typical artifacts:

- `ATC Radar Simulator Setup 0.5.1.exe`
- `ATC Radar Simulator Setup 0.5.1.exe.zip`

---

## Windows Security Notice / Windows 安全提示

Windows binaries are currently unsigned. SmartScreen warnings may appear during install/first launch.

Windows 可执行文件当前未签名，安装或首次启动时可能触发 SmartScreen 警告。

---

## Documentation Index / 文档索引

Core docs:

- `docs/CODEBASE_TOUR.md` — project structure onboarding
- `docs/RJCC_DATA_PACK.md` — RJCC package boundaries and placeholder policy
- `docs/CANVAS_RENDERER_PLAN.md` — Canvas/SVG hybrid renderer plan
- `docs/ARCHITECTURE_ROADMAP_V4.md` — long-term roadmap and execution priorities
- `docs/RJCC_MANUAL_PREVIEW_AND_CHART_OVERLAY_WORKFLOW.md` — chart/trace workflow
- `docs/RJCC_PROCEDURE_SCHEMA.md` — procedure data schema guidance

---

## Disclaimer / 免责声明

This repository is for simulation, visualization, and engineering exploration. Do not use it for real-world ATC operations, flight planning, or safety-critical navigation decisions.

本仓库用于模拟、可视化与工程探索，请勿用于实际空管运行、真实飞行计划或任何安全关键导航决策。
