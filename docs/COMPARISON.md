[中文](COMPARISON.md) | [English](COMPARISON.en.md)

# 竞品对比

移动端 AI 编程工具全景对比，涵盖开源与闭源产品。

## 竞品概览

| 产品 | 类型 | 定位 | 开源 | Stars |
|------|------|------|------|-------|
| **ClawBench** | 自部署 Web 工作台 | 移动端 AI 工作台（文件+代码+AI+Git+调度） | ✅ MIT | — |
| **Happy** | 远程遥控器 | 手机远程操控电脑上运行的 Claude Code/Codex 会话 | ✅ MIT | 19.9k |
| **Claude Dispatch** | 官方远程控制 | Anthropic 官方手机遥控 Claude Code（Cowork 家族） | ❌ 闭源 | — |
| **Claude Remote** | 远程遥控器 | 非官方 Claude Code 远程控制，支持 API 用户 | ✅ | 30 |
| **Cursor Background Agent** | 云端异步 Agent | 网页/手机提交任务，云端异步执行，查看结果/创建 PR | ❌ 闭源 | — |
| **GitHub Copilot** | 官方集成 | GitHub 移动端 + 网页端 AI 编程助手 | ❌ 闭源 | — |

## 功能矩阵

| 功能 | ClawBench | Happy | Claude Dispatch | Claude Remote | Cursor Agent | GitHub Copilot |
|------|-----------|-------|-----------------|---------------|--------------|----------------|
| **AI 后端数量** | 5 | 2 | 1 | 1 | 内置 | 内置 |
| **文件浏览/编辑** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **代码预览/语法高亮** | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Git 集成** | ✅（分支图/Diff/历史） | ❌ | ❌ | ❌ | ✅（PR 创建/Diff） | ✅（PR Review） |
| **Markdown 渲染** | ✅（KaTeX/Mermaid） | ❌ | ❌ | ✅ | ❌ | ❌ |
| **定时任务（Cron）** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **TTS 语音合成** | ✅（5 种引擎） | ❌ | ❌ | ❌ | ❌ | ❌ |
| **媒体预览** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SSH 隧道端口转发** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **端到端加密** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **实时语音** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **推送通知** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **多客户端同步** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **权限审批** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **PWA 安装** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **自部署** | ✅ | ✅（可选） | ❌ | ✅ | ❌ | ❌ |
| **离线/局域网** | ✅ | ✅（局域网） | ❌ | ✅ | ❌ | ❌ |

## 架构差异

| 维度 | ClawBench | Happy | Claude Dispatch | Claude Remote | Cursor Agent |
|------|-----------|-------|-----------------|---------------|--------------|
| **架构** | C/S（Go Web + SSE） | P2P + 中继（E2E 加密同步） | 中心化（Anthropic 服务器中转） | WebSocket 桥接（node-pty） | 云端异步 Agent |
| **AI 在哪运行** | 服务器本地 CLI | 电脑本地 CLI | 电脑本地 CLI | 电脑本地 CLI | Cursor 云端 |
| **手机角色** | 完整工作台 | 遥控器 | 遥控器 | 遥控器 | 任务提交器 |
| **需电脑在线** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **后端语言** | Go | TypeScript | — | JavaScript | — |
| **移动端** | 浏览器 + Android WebView | Expo（React Native）原生 | 原生 App | Tauri 2.0（Android） | PWA |
| **数据存储** | SQLite 本地持久化 | 无持久化（加密同步） | 云端 | 无 | 云端 |
| **部署方式** | 单二进制解压即用 | npm install + App 配对 | App 登录即用 | npm install + 连接 | 浏览器登录 |

## 各竞品详析

### Happy（GitHub: slopus/happy，19.9k Stars）

开源最热门的移动端 AI 编程遥控器。

- ✅ 端到端加密，隐私安全
- ✅ 实时语音、设备即时切换
- ✅ 免费开源，可自建服务器
- ✅ 支持 Claude Code + Codex
- ❌ 只能遥控，无文件浏览/编辑/Git
- ❌ 仅 2 种 AI 后端
- ❌ 电脑必须在线

### Claude Dispatch（Anthropic 官方）

Claude Cowork 家族成员，手机远程控制 Claude Code。

- ✅ 开箱即用，界面精美
- ✅ 与 Claude 生态深度集成
- ❌ 仅限 Pro/Max 订阅用户
- ❌ 只支持 Claude，必须联网
- ❌ 数据经 Anthropic 服务器中转
- ❌ 电脑必须唤醒

### Claude Remote（GitHub: RioArisk/claudecode_api_RemoteControl）

非官方 Claude Code 远程控制方案，支持 API 用户。

- ✅ 支持 API 用户（Dispatch 不支持）
- ✅ 权限审批、模型切换
- ✅ 局域网/Tailscale/Cloudflare 多种连接方式
- ❌ 仅支持 Claude Code
- ❌ 功能简单，无文件/Git/定时任务
- ❌ 仅 Android

### Cursor Background Agent（闭源商业）

Cursor 的云端异步 Agent，通过浏览器/手机提交任务。

- ✅ 无需本地电脑在线，云端执行
- ✅ 自动创建 PR，多模型对比
- ✅ PWA 支持，任何浏览器可用
- ❌ 闭源，依赖 Cursor 云端
- ❌ 异步模式——无法实时观看执行过程
- ❌ 需 GitHub 仓库，不支持本地项目
- ❌ 需 Cursor 付费订阅

### GitHub Copilot（闭源商业）

GitHub 官方 AI 编程助手，支持移动端。

- ✅ GitHub 生态深度集成
- ✅ 移动端 PR Review
- ❌ 无完整开发环境
- ❌ 闭源，依赖 GitHub
- ❌ 需付费订阅

## ClawBench 核心优势

1. **唯一的全功能移动端工作台**：其他产品全是"遥控器"——远程操控电脑上的会话。ClawBench 本身就是完整开发环境：文件、代码、Git、AI、定时任务、TTS、媒体预览，手机上直接干活。

2. **5 种 AI 后端**：Happy 只有 2 种，Claude Dispatch/Remote 只有 1 种。ClawBench 支持 CodeBuddy、Claude Code、OpenCode、Gemini CLI、Codex，覆盖最广。

3. **不依赖电脑在线**：Happy/Dispatch/Remote 都需要电脑在线运行 CLI。ClawBench 部署在服务器上，手机随时连上就用，服务器挂机即可。

4. **定时任务调度**：所有竞品都没有。AI 提案 → 确认 → Cron 自动执行，适合自动化运维、每日 review 等场景。

5. **数据完整持久化**：Happy/Remote 不存数据，Dispatch 存云端。ClawBench 用 SQLite 本地持久化所有会话、历史、任务，断连不丢，数据主权在用户手中。

6. **绿色单文件部署**：一个二进制 + 静态资源，零依赖。Happy 需要 Node.js + npm + App 配对，Claude Remote 需要 Node.js + Tailscale，Dispatch 需要订阅。

7. **SSH 隧道端口转发**：内嵌 SSH 服务器，Android App 可直接访问服务器上任意端口。其他产品均无此能力。

8. **TTS 语音合成**：5 种引擎 + 8 种总结后端，AI 回复自动朗读。竞品均无。

## ClawBench 相对劣势

1. **无端到端加密**：Happy 的核心卖点，对隐私极度敏感的用户有吸引力
2. **无实时语音**：Happy 支持
3. **无多客户端同步**：同一会话不能多设备同时操控
4. **无权限审批机制**：AI 工具调用没有人工审批流程（Happy/Dispatch/Remote 都有）
5. **iOS 无原生 App**：Happy 有 iOS 原生 App
