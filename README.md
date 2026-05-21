# ATC Radar Simulator / 空管雷达模拟器

Version / 版本: v0.5.1

ATC Radar Simulator is a Vite React + Electron air traffic control radar simulator.

ATC Radar Simulator 是一个基于 Vite React + Electron 的空管雷达模拟器。

v0.5.1 is a pre-release/testing build.

v0.5.1 是预发布/测试版本。

## What this is / 项目定位

A personal-scale ATC radar simulator, RJCC (New Chitose) first, then expanding to Hokkaido and beyond. Built around an offline procedure authoring workflow (chart placement, manual trace, JAIP overlay) rather than real-time navdata pipelines.

一个个人尺度的空管雷达模拟器，以 RJCC（新千岁）为优先目标，后续扩展北海道及更多区域。围绕离线 procedure 制作工作流构建（chart 对齐、人工 trace、JAIP 叠图），不依赖实时 navdata pipeline。

**Not** a real navigation system. **Not** for operational use. **Not** an AIRAC auto-sync platform.

**不是**真实导航系统。**不**用于实际运行。**不是** AIRAC 自动同步平台。

## Companion tools / 配套工具

- [airport-weather-profiler](https://github.com/Qishop1/airport-weather-profiler) — Offline tool that generates the `weather_profile.json` files consumed by this simulator. Designed to run separately from sim runtime; the sim only imports the generated JSON.

  离线工具，生成本模拟器消费的 `weather_profile.json`。设计上与 sim runtime 分离；sim 只导入生成的 JSON。

## Download / 下载

Windows builds are published on GitHub Releases:

Windows 版本已发布在 GitHub Releases：

[Download the latest release / 下载最新版本](https://github.com/Qishop1/atc-radar-sim/releases/latest)

The release provides a `.zip` archive containing the Windows installer `.exe`.

Release 中提供了包含 Windows 安装程序 `.exe` 的 `.zip` 压缩包。

Typical release asset:

常见发布文件：

```text
ATC-Radar-Simulator-Setup-0.5.1.zip
```

Extract the `.zip`, then run the installer `.exe`.

解压 `.zip` 后，运行其中的 `.exe` 安装程序。

## Windows Security Notice / Windows 安全提示

The Windows executable is unsigned. Microsoft SmartScreen may show a warning when opening the installer or app.

Windows 可执行文件未进行代码签名。打开安装包或应用时，Microsoft SmartScreen 可能会显示警告。

## Developer documentation / 开发者文档

For developer onboarding and architecture notes, see/如需查看开发者入门说明和架构笔记，请参阅 [docs/CODEBASE_TOUR.md](docs/CODEBASE_TOUR.md).


## Web Development / Web 开发运行

Start the Vite development server:

启动 Vite 开发服务器：

```powershell
npm.cmd run dev
```

## Electron Development / Electron 开发运行

Build the Vite app and launch it in Electron:

构建 Vite 应用并用 Electron 启动：

```powershell
npm.cmd run electron:dev
```

## Web Build / Web 构建

Build the production web app:

构建生产版 Web 应用：

```powershell
npm.cmd run build
```

The web build is generated in:

Web 构建产物生成在：

```text
dist/
```

## Windows Installer Build / Windows 安装包构建

Build the Windows installer:

构建 Windows 安装包：

```powershell
npm.cmd run dist:win
```

Local release artifacts are generated in:

本地发布产物生成在：

```text
release/
```

Typical local outputs include:

常见本地输出包括：

```text
release/ATC Radar Simulator Setup 0.5.1.exe
release/ATC Radar Simulator Setup 0.5.1.exe.zip
release/win-unpacked/ATC Radar Simulator.exe
```
