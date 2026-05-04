[中文](COMPARISON.md) | [English](COMPARISON.en.md)

# Competitive Comparison

A comprehensive comparison of mobile AI programming tools, covering both open-source and closed-source products.

## Product Overview

| Product | Type | Positioning | Open Source | Stars |
|---------|------|-------------|-------------|-------|
| **ClawBench** | Self-hosted Web workstation | Mobile AI workstation (files + code + AI + Git + scheduling) | ✅ MIT | — |
| **Happy** | Remote controller | Remotely control Claude Code/Codex sessions running on your PC from your phone | ✅ MIT | 19.9k |
| **Claude Dispatch** | Official remote control | Anthropic's official mobile remote control for Claude Code (Cowork family) | ❌ Closed source | — |
| **Claude Remote** | Remote controller | Unofficial Claude Code remote control, supports API users | ✅ | 30 |
| **Cursor Background Agent** | Cloud async Agent | Submit tasks via web/mobile, async execution in the cloud, view results / create PRs | ❌ Closed source | — |
| **GitHub Copilot** | Official integration | GitHub mobile + web AI programming assistant | ❌ Closed source | — |

## Feature Matrix

| Feature | ClawBench | Happy | Claude Dispatch | Claude Remote | Cursor Agent | GitHub Copilot |
|---------|-----------|-------|-----------------|---------------|--------------|----------------|
| **AI backend count** | 5 | 2 | 1 | 1 | Built-in | Built-in |
| **File browsing/editing** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Code preview/syntax highlighting** | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Git integration** | ✅ (branch graph/Diff/history) | ❌ | ❌ | ❌ | ✅ (PR creation/Diff) | ✅ (PR Review) |
| **Markdown rendering** | ✅ (KaTeX/Mermaid) | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Scheduled tasks (Cron)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **TTS speech synthesis** | ✅ (5 engines) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Media preview** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SSH tunnel port forwarding** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **End-to-end encryption** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Real-time voice** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Push notifications** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Multi-client sync** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Permission approval** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **PWA install** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Self-hosted** | ✅ | ✅ (optional) | ❌ | ✅ | ❌ | ❌ |
| **Offline/LAN** | ✅ | ✅ (LAN) | ❌ | ✅ | ❌ | ❌ |

## Architecture Differences

| Dimension | ClawBench | Happy | Claude Dispatch | Claude Remote | Cursor Agent |
|-----------|-----------|-------|-----------------|---------------|--------------|
| **Architecture** | C/S (Go Web + SSE) | P2P + relay (E2E encrypted sync) | Centralized (Anthropic server relay) | WebSocket bridge (node-pty) | Cloud async Agent |
| **Where AI runs** | Server-local CLI | PC-local CLI | PC-local CLI | PC-local CLI | Cursor cloud |
| **Phone's role** | Full workstation | Remote controller | Remote controller | Remote controller | Task submitter |
| **PC must be online** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Backend language** | Go | TypeScript | — | JavaScript | — |
| **Mobile client** | Browser + Android WebView | Expo (React Native) native | Native App | Tauri 2.0 (Android) | PWA |
| **Data storage** | SQLite local persistence | No persistence (encrypted sync) | Cloud | None | Cloud |
| **Deployment** | Single binary, extract and run | npm install + App pairing | App login and go | npm install + connect | Browser login |

## Detailed Analysis of Each Competitor

### Happy (GitHub: slopus/happy, 19.9k Stars)

The most popular open-source mobile AI programming remote controller.

- ✅ End-to-end encryption, privacy security
- ✅ Real-time voice, instant device switching
- ✅ Free and open source, self-hosted server option
- ✅ Supports Claude Code + Codex
- ❌ Remote control only, no file browsing/editing/Git
- ❌ Only 2 AI backends
- ❌ PC must be online

### Claude Dispatch (Anthropic Official)

A Claude Cowork family member for mobile remote control of Claude Code.

- ✅ Out-of-the-box, beautiful interface
- ✅ Deep integration with the Claude ecosystem
- ❌ Pro/Max subscription only
- ❌ Only supports Claude, must be online
- ❌ Data relayed through Anthropic servers
- ❌ PC must be awake

### Claude Remote (GitHub: RioArisk/claudecode_api_RemoteControl)

An unofficial Claude Code remote control solution that supports API users.

- ✅ Supports API users (Dispatch does not)
- ✅ Permission approval, model switching
- ✅ LAN/Tailscale/Cloudflare multiple connection options
- ❌ Only supports Claude Code
- ❌ Simple features, no files/Git/scheduled tasks
- ❌ Android only

### Cursor Background Agent (Closed-source Commercial)

Cursor's cloud async Agent, submit tasks via browser/mobile.

- ✅ No local PC required, cloud execution
- ✅ Auto-create PRs, multi-model comparison
- ✅ PWA support, works in any browser
- ❌ Closed source, depends on Cursor cloud
- ❌ Async mode — cannot watch execution in real time
- ❌ Requires GitHub repo, no local project support
- ❌ Requires Cursor paid subscription

### GitHub Copilot (Closed-source Commercial)

GitHub's official AI programming assistant, with mobile support.

- ✅ Deep GitHub ecosystem integration
- ✅ Mobile PR Review
- ❌ No complete development environment
- ❌ Closed source, depends on GitHub
- ❌ Requires paid subscription

## ClawBench Core Advantages

1. **The only full-featured mobile workstation**: All other products are "remote controllers" — they remotely control sessions on a PC. ClawBench itself is a complete development environment: files, code, Git, AI, scheduled tasks, TTS, media preview — get work done directly on your phone.

2. **5 AI backends**: Happy has only 2, Claude Dispatch/Remote has only 1. ClawBench supports CodeBuddy, Claude Code, OpenCode, Gemini CLI, and Codex — the broadest coverage.

3. **No dependency on PC being online**: Happy/Dispatch/Remote all require a PC online running the CLI. ClawBench is deployed on a server — connect from your phone anytime; just leave the server running.

4. **Scheduled task dispatch**: No competitor has this. AI proposes → confirm → Cron auto-executes. Ideal for automated ops, daily reviews, and similar scenarios.

5. **Complete data persistence**: Happy/Remote don't store data, Dispatch stores in the cloud. ClawBench uses SQLite for local persistence of all sessions, history, and tasks — no data loss on disconnect, data sovereignty stays with the user.

6. **Green single-file deployment**: One binary + static assets, zero dependencies. Happy needs Node.js + npm + App pairing, Claude Remote needs Node.js + Tailscale, Dispatch requires a subscription.

7. **SSH tunnel port forwarding**: Built-in SSH server; the Android App can directly access any port on the server. No other product offers this capability.

8. **TTS speech synthesis**: 5 engines + 8 summarization backends, automatic reading of AI responses. No competitor has this.

## ClawBench Relative Disadvantages

1. **No end-to-end encryption**: Happy's core selling point, attractive to users extremely sensitive about privacy
2. **No real-time voice**: Happy supports this
3. **No multi-client sync**: The same session cannot be controlled simultaneously from multiple devices
4. **No permission approval mechanism**: No human approval flow for AI tool calls (Happy/Dispatch/Remote all have this)
5. **No native iOS App**: Happy has a native iOS App
