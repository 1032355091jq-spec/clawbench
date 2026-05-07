# ClawBench 内置完整交互终端设计

## 背景

ClawBench 当前已经具备移动端优先的文件浏览、AI 聊天、Git 历史、端口转发、计划任务和 RAG 历史记忆能力。新增终端功能的目标，是让用户可以在浏览器或 Android App/WebView 中直接操作项目环境，完成构建、测试、Git 操作、启动本地服务等任务。

本设计将终端定位为完整交互式 Web Terminal，而不是简单的命令运行器。它需要支持真实 shell 交互能力，包括 `vim` / `nano`、`top` / `htop`、方向键、`Ctrl+C`、`Tab` 补全、窗口 resize、长时间运行命令，以及页面刷新或手机切后台后的短时间恢复。

## 目标

- 在 ClawBench 底部 Dock 中新增 Terminal 入口。
- 使用底部抽屉承载终端 UI，保持与 Chat、Files、History、Port Forward 一致的移动端交互模型。
- 后端通过 PTY 启动真实 shell，前端通过 xterm.js 渲染终端。
- 使用 WebSocket 做双向输入输出和 resize 同步。
- 支持浏览器和 Android App/WebView。
- 支持移动端虚拟快捷键、组合键和 Termius 风格手势。
- 支持可配置快捷指令。
- 不持久化终端命令历史或完整输出日志。

## 非目标

- 第一版不实现多终端标签。
- 第一版不保存命令历史。
- 第一版不保存完整终端输出日志。
- 第一版快捷指令不支持变量替换或参数输入。
- 第一版不提供强沙箱；shell 启动后用户可以自行 `cd` 到其他目录。
- 第一版不实现 AI 辅助命令解释或错误诊断。

## 产品形态

终端入口位于底部 Dock，与现有抽屉入口并列。点击 Terminal 图标后打开 `TerminalPanel`，该面板基于现有 `BottomSheet` 体系实现，并参与 `App.vue` 的抽屉互斥逻辑。

终端抽屉关闭时，只隐藏 UI，不关闭后端 shell。用户再次打开终端时，会重新连接同一个后端 PTY 会话。用户可以通过终端抽屉中的控制按钮主动关闭终端进程。

终端会话采用当前项目单一会话模式。切换项目时，旧项目终端自动关闭，避免用户在新项目上下文里误操作旧项目 shell。

## 启动目录规则

终端启动目录由当前上下文决定：

1. 如果当前打开了文件，使用该文件所在目录作为 shell 初始工作目录。
2. 如果没有打开文件，使用当前项目目录作为 shell 初始工作目录。
3. shell 内部 `cd` 不做限制。

已有终端会话存在时，不因为用户切换文件而自动重启。如果用户打开终端时发现当前文件目录与已有终端启动目录不同，前端显示轻量提示：

- 继续使用当前终端。
- 关闭当前终端并在当前文件目录新建终端。

这样可以避免误杀正在运行的命令，同时保留按当前文件上下文启动终端的便利性。

## 会话生命周期

后端为当前项目维护一个 `TerminalSession`。该 session 包含：

- PTY 进程。
- 启动 cwd。
- WebSocket 客户端集合。
- 最近输出 ring buffer。
- 最后连接时间。
- idle timeout timer。
- 当前终端尺寸。

浏览器刷新、网络断开、手机切后台或关闭终端抽屉时，PTY 不立即关闭。最后一个 WebSocket 连接断开后，后端启动 idle timer。超时仍无人连接时关闭 PTY。

默认 idle timeout 为 `10m`，并通过配置项覆盖。

用户点击“关闭终端进程”时，后端立即关闭 PTY，不等待 idle timeout。

## 输出缓冲

后端只在内存中保留最近 2000 行终端输出，作为重连 replay buffer。服务端重启、终端进程退出或会话超时关闭后，缓冲丢失。

设计原则：

- 不写入 SQLite。
- 不写入日志文件。
- 不保存命令历史。
- 不保存完整终端输出。

PTY 输出仍按字节流实时转发给前端；ring buffer 按行裁剪。新 WebSocket 客户端连接后，后端先发送 replay，再进入实时 output 模式。

## 后端架构

采用：

```text
Go PTY + WebSocket + xterm.js
```

推荐后端依赖：

```text
github.com/creack/pty
github.com/gorilla/websocket
```

建议新增模块：

```text
internal/terminal/
  manager.go
  session.go
  buffer.go
  shell.go
  protocol.go

internal/handler/
  terminal.go
```

### TerminalManager

`TerminalManager` 负责管理当前终端运行态：

- 创建或复用当前项目终端会话。
- 关闭当前终端会话。
- 项目切换时关闭旧终端。
- 维护 idle timeout。
- 处理并发连接。

### TerminalSession

`TerminalSession` 负责单个 PTY 会话：

- 启动 shell。
- 读取 PTY 输出。
- 写入 PTY 输入。
- 处理 resize。
- 广播输出到所有 WebSocket 客户端。
- 写入 ring buffer。
- 会话退出时通知客户端。

### Shell 选择

Linux/macOS：

- 优先使用 `$SHELL`。
- 为空时回退 `/bin/sh`。

Windows：

- 优先 `pwsh`。
- 再尝试 `powershell`。
- 最后回退 `cmd.exe`。

需要注意：`github.com/creack/pty` 对 Windows 的完整交互终端支持需要验证。如果不满足需求，Windows 后续可能需要单独接入 ConPTY。第一版应保证 Windows 构建不被破坏，即使运行能力标记为实验支持。

## HTTP 与 WebSocket 接口

建议新增接口：

```text
GET  /api/terminal/ws?cwd=<relative-dir>
GET  /api/terminal/status
POST /api/terminal/close
GET  /api/terminal/config
```

也可以将 config 并入现有 `/api/watch-dir` 返回值，减少一次请求。

所有需要用户操作的接口复用现有 `middleware.Auth`。WebSocket handler 在升级前完成鉴权和项目解析。

`cwd` 参数必须是项目内相对路径。后端创建 PTY 前使用现有路径校验逻辑解析到绝对路径，确保初始 cwd 不越过当前项目边界。shell 启动后用户自行 `cd` 不做限制。

## WebSocket 协议

第一版统一使用 JSON 消息，便于调试。

客户端到服务端：

```json
{"type":"input","data":"ls -la\r"}
```

```json
{"type":"resize","cols":120,"rows":32}
```

```json
{"type":"close"}
```

服务端到客户端：

```json
{"type":"output","data":"..."}
```

```json
{"type":"replay","lines":["..."]}
```

```json
{"type":"status","running":true,"cwd":"internal/handler"}
```

```json
{"type":"exit","code":0}
```

```json
{"type":"error","message":"shell 启动失败"}
```

连接流程：

1. 前端打开 TerminalPanel。
2. 前端根据当前文件计算目标 cwd。
3. WebSocket 连接 `/api/terminal/ws?cwd=<relative-dir>`。
4. 后端校验 cwd 是否在项目内。
5. 如果没有会话，新建 PTY。
6. 如果已有会话，复用。
7. 后端先发送 `replay`。
8. 后端发送当前 `status`。
9. 后续实时发送 `output`。
10. 前端输入通过 `input` 发送给后端。
11. 前端 resize 通过 `resize` 发送给后端。

## 配置

新增 `terminal` 配置段：

```yaml
terminal:
  enabled: true
  idle_timeout: "10m"
  buffer_lines: 2000
  quick_commands:
    - label: "Git Status"
      command: "git status"
    - label: "Run Tests"
      command: "go test ./..."
    - label: "Build"
      command: "npm run build"
```

默认值：

```text
enabled: true
idle_timeout: 10m
buffer_lines: 2000
quick_commands: []
```

`enabled` 使用与 `proxy.enabled`、`ssh.enabled` 类似的 presence map 处理方式：配置缺省时默认为 true，只有用户显式写 `terminal.enabled: false` 时关闭。

快捷指令规则：

- 不支持变量替换。
- 不支持参数弹窗。
- 点击后直接向当前 shell 发送 `command + "\r"`。
- 不通过独立命令执行 API。
- 未配置时隐藏入口或显示空状态。

## 前端架构

推荐新增：

```text
web/src/components/terminal/
  TerminalPanel.vue
  TerminalToolbar.vue
  TerminalQuickCommands.vue
  TerminalReopenPrompt.vue

web/src/composables/
  useTerminalSession.ts
  useTerminalViewport.ts
  useTerminalKeys.ts
  useTerminalGestures.ts
```

推荐前端依赖：

```text
@xterm/xterm
@xterm/addon-fit
```

如项目兼容性需要，也可以使用旧包名：

```text
xterm
@xterm/addon-fit
```

### TerminalPanel

`TerminalPanel` 负责：

- 初始化 xterm。
- 连接 WebSocket。
- 处理 `output` / `replay` / `status` / `error` / `exit`。
- 将用户输入发送到 WebSocket。
- 监听终端 resize 并发送 `cols` / `rows`。
- 抽屉打开时 focus terminal。
- 抽屉尺寸变化时调用 `FitAddon.fit()`。
- 软键盘弹出或收起时重新计算高度并 fit。

### useTerminalSession

负责：

- WebSocket 建立与关闭。
- 自动重连。
- 消息解析。
- 发送 input / resize / close。
- 暴露连接状态。

### useTerminalViewport

负责：

- 监听 `ResizeObserver`。
- 监听 `window.visualViewport.resize`。
- 监听 `window.visualViewport.scroll`。
- 计算移动端软键盘占用高度。
- 更新终端容器高度。
- 触发 xterm fit。

### useTerminalKeys

负责：

- 虚拟按键。
- `Ctrl` / `Alt` / `Shift` 修饰键状态机。
- 组合键转换。
- 一次性修饰键清除。
- 长按锁定与取消锁定。
- 快捷键栏和手机软键盘输入统一处理。

### useTerminalGestures

负责：

- 左右滑动映射方向键。
- 上下滑动映射方向键。
- 双击映射 Tab。
- 触摸阈值控制。
- 与 BottomSheet 手势隔离。

## 移动端软键盘避让

这是终端移动端体验的核心约束。

终端抽屉不能简单依赖 `100vh`。移动端应结合：

- `100dvh`
- `window.visualViewport.height`
- `visualViewport.resize`
- `visualViewport.scroll`
- `env(safe-area-inset-bottom)`

布局结构：

```text
TerminalPanel
  header/status
  xterm viewport
  virtual key toolbar
```

软键盘收起时：

- xterm 占据剩余空间。
- 快捷键栏贴近抽屉底部安全区。

软键盘弹出时：

- 终端可视区域高度变小。
- 快捷键栏贴在软键盘上方。
- xterm 执行 `fit()`，避免最后一行被键盘遮住。

虚拟按键按钮必须避免抢焦点：

- 使用 `pointerdown.preventDefault()`。
- 点击后主动 `terminal.focus()`。
- 避免按钮导致 xterm 隐藏 textarea 失焦。
- 粘贴、复制、快捷指令执行后也恢复 focus。

## 虚拟按键与组合键

快捷键栏至少包含：

```text
Esc
Tab
Ctrl
Alt
Shift
Ctrl+C
↑
↓
←
→
Commands
Close
Copy
```

修饰键规则：

- `Ctrl` / `Alt` / `Shift` 单击：一次性激活。
- 长按：锁定激活。
- 再次点击锁定态修饰键：取消锁定。
- 一次性修饰键作用于下一个输入后自动清除。
- 锁定修饰键持续生效。
- 修饰键可以叠加。

示例转换：

```text
Ctrl + c      -> \x03
Ctrl + d      -> \x04
Ctrl + l      -> \x0c
Alt + x       -> \x1bx
Shift + Tab   -> \x1b[Z
方向键         -> ANSI escape sequence
```

所有输入都必须统一经过 `useTerminalKeys`：

- 快捷栏按钮。
- 手机软键盘字母。
- 桌面物理键盘。
- 手势方向键。

这样才能保证用户点击虚拟 `Ctrl` 后，再用手机软键盘输入 `c` 时，前端向 PTY 发送 `Ctrl+C`，而不是普通字符 `c`。

## Termius 风格手势

终端区域内支持：

- 左滑：左方向键。
- 右滑：右方向键。
- 上滑：上方向键。
- 下滑：下方向键。
- 双击：Tab。

实现注意：

- 手势只绑定 xterm 区域。
- 不绑定整个 BottomSheet。
- 避免和抽屉关闭手势冲突。
- 避免和浏览器默认滚动冲突。
- 设置滑动阈值，避免轻微误触。
- 双击 Tab 与文本选择存在取舍，移动端优先终端效率。

## 会话控制

第一版终端抽屉提供两个明确控制操作：

- 关闭终端进程。
- 复制输出。

关闭终端进程：

- 立即关闭当前 PTY。
- 清理当前会话状态。
- 清理 replay buffer。
- 下次打开终端时重新创建会话。

复制输出：

- 优先复制当前选中内容。
- 如果没有选区，可复制当前屏幕或最近缓冲内容。
- 复制后恢复 terminal focus。

第一版不做单独“重启终端”和“清屏”按钮。需要重启时，用户可以先关闭终端进程，再重新打开。

## 快捷指令

快捷指令从后端配置读取。前端在工具栏中提供 `Commands` 入口。

交互建议：

- 点击 `Commands` 打开紧凑列表。
- 列表展示 `label`。
- 点击某项后向当前终端发送 `command + "\r"`。
- 发送后关闭列表并恢复 terminal focus。
- 未配置快捷指令时隐藏入口或显示空状态。

快捷指令不支持变量替换。后续如有需要，可以扩展 `${file}`、`${dir}`、`${project}` 等模板变量，但不纳入第一版。

## 错误状态

前端应区分以下状态：

```text
terminal_disabled
websocket_failed
cwd_invalid
shell_start_failed
pty_exited
session_closed
reconnecting
idle_timeout_closed
```

用户可见文案应具备可操作性，例如：

- 终端功能已关闭。
- 当前目录不可用，将使用项目目录启动。
- 终端进程已退出。
- 连接断开，正在重连。
- 会话已因空闲超时关闭。
- 无法启动系统 shell。

WebSocket 内部错误使用 `error` 消息发送，正常退出使用 `exit` 消息发送，状态变化使用 `status` 消息发送。

## 安全边界

安全模型是个人工作站式终端：

- 接口必须经过现有登录鉴权。
- 初始 cwd 必须由后端校验，不能通过 URL 参数越过项目边界。
- shell 启动后用户自行 `cd` 不做限制。
- 不持久化命令历史或完整输出日志。
- 不将终端输出写入 AI 会话历史。
- 不将终端输出纳入 RAG 索引。

终端本质上等同于把登录用户的 shell 暴露到 Web UI，后续如支持公网访问，应继续强化 HTTPS、访问控制和风险提示。

## 跨平台策略

Linux/macOS 是第一优先级，使用 `$SHELL` + PTY 路径。

Windows 需要单独验证：

- `creack/pty` 是否满足完整交互需求。
- Windows cross-compile 是否受到影响。
- 是否需要后续接入 ConPTY。

第一版可以将 Windows 运行时体验标记为实验支持，但不应破坏现有 Windows 构建流程。

## 测试策略

后端测试：

- shell 选择逻辑。
- cwd 校验。
- ring buffer 最近 2000 行裁剪。
- WebSocket 连接。
- 输入输出回环。
- resize 消息处理。
- 断线后 idle timeout。
- 主动 close session。
- PTY 进程退出后状态通知。

前端测试：

- `TerminalPanel` 渲染。
- WebSocket 消息处理。
- 修饰键状态机。
- `Ctrl+C` / `Alt+x` / `Shift+Tab` 转换。
- 一次性修饰键自动清除。
- 长按锁定与取消锁定。
- 快捷指令发送。
- 文件目录变化时提示重开。
- 终端关闭后重新打开。

移动端手测：

- 软键盘弹出不遮挡终端最后一行。
- 快捷键栏贴在键盘上方。
- 点击虚拟按键不收起键盘。
- 虚拟 `Ctrl` 能与手机软键盘字母组合触发。
- 滑动方向键不误关抽屉。
- 双击发送 Tab。
- Android App/WebView 和普通浏览器都可用。

## 推荐实施顺序

1. 增加配置模型：`terminal.enabled`、`terminal.idle_timeout`、`terminal.buffer_lines`、`terminal.quick_commands`。
2. 增加后端 terminal manager、PTY session、ring buffer。
3. 增加 WebSocket handler 和 close/status/config 接口。
4. 增加最小前端 `TerminalPanel`，先保证桌面浏览器可输入输出。
5. 接入 xterm FitAddon 和 resize 消息。
6. 接入底部 Dock 与抽屉互斥。
7. 接入 replay buffer。
8. 增加主动关闭终端进程。
9. 增加快捷指令。
10. 增加移动端软键盘避让。
11. 增加虚拟快捷键栏。
12. 增加 `Ctrl` / `Alt` / `Shift` 状态机。
13. 增加 Termius 风格手势。
14. 补充后端和前端测试。
15. 验证 Linux/macOS 行为和 Windows 构建。

## 后续可选增强

- 多终端标签。
- 快捷指令变量替换。
- 当前文件相关命令模板。
- 终端命令收藏。
- AI 解释命令或诊断错误。
- 终端输出选择后发送给 Chat。
- WebSocket 二进制优化。
- Windows ConPTY 完整支持。

---

## 实施记录（2026-05-07）

### 设计完善（15 个缺口 + 3 个架构关切）

基于对代码库的深入探索，在原设计基础上识别并解决了以下问题：

| 缺口 | 问题 | 解决方案 |
|------|------|----------|
| GAP-1 | Vite dev proxy 无 WS 支持 | 添加 `/api/terminal/ws` 代理 + `ws: true` |
| GAP-2 | WebSocket 库选择 | `github.com/coder/websocket`（非 gorilla，已归档） |
| GAP-3 | 项目切换生命周期 | TerminalSession 存 projectPath，新 WS 连接时检测不匹配 |
| GAP-4 | 缺少 TerminalConfig | 添加结构体 + QuickCommand + ApplyDefaults + presence map |
| GAP-5 | WS 路由与 middleware | coder/websocket 兼容标准 middleware 链，无需特殊处理 |
| GAP-6 | Ring buffer 设计 | 原始字节存储、行分割、64KB 行限制、4MB 总限制、单字符串 replay |
| GAP-7 | 配置传递 | 构造器注入（非全局变量），跟随 NewProxyRegistry 模式 |
| GAP-8 | Manager 生命周期 | main.go 中初始化 + defer Close()，跟随 ProxyService 模式 |
| GAP-9 | i18n | 24 个终端相关键（en.ts + zh.ts） |
| GAP-10 | 主题集成 | Catppuccin Mocha/Latte xterm 主题 + data-theme MutationObserver |
| GAP-11 | xterm 版本 | @xterm/xterm v5+（非 xterm v4）+ @xterm/addon-web-links |
| GAP-12 | SSH 隧道兼容 | 验证项——WS over TCP 透明工作 |
| GAP-13 | 选择和复制 | selectionStyle: 'line' + 复制输出按钮 + navigator.clipboard |
| GAP-14 | 优雅关闭 | SIGTERM 进程组 → 3s 等待 → SIGKILL + 关闭 PTY + WS |
| GAP-15 | 信号转发 | Setpgid: true + 进程组 kill；Ctrl+C 走 PTY \x03 |

架构关切：
- CONCERN-1: TerminalManager 完全独立于 session_runtime.go
- CONCERN-2: 项目切换时接受 window.location.reload() 行为
- CONCERN-3: 第一版拒绝第二个 WS 连接（发送 session_in_use 错误）

### 已实现文件清单

**后端（Go）：**
- `internal/terminal/buffer.go` — RingBuffer（159 行）
- `internal/terminal/session.go` — TerminalSession（310 行）
- `internal/terminal/manager.go` — TerminalManager（220 行）
- `internal/terminal/shell.go` — Shell 选择 + PTY 启动（58 行）
- `internal/terminal/shell_posix.go` — POSIX 进程组（33 行）
- `internal/terminal/shell_windows.go` — Windows 回退（23 行）
- `internal/terminal/protocol.go` — JSON WebSocket 消息类型（28 行）
- `internal/handler/terminal.go` — WebSocket handler + REST 端点（104 行）
- 修改：`config.go`, `defaults.go`, `handler.go`, `main.go`, `config.example.yaml`

**前端（Vue 3 + TypeScript）：**
- `web/src/components/terminal/TerminalPanel.vue` — 主终端 UI（577 行）
- `web/src/composables/useTerminalSession.ts` — WebSocket 生命周期（181 行）
- `web/src/composables/useTerminalViewport.ts` — 视口 + 键盘避让（72 行）
- `web/src/composables/useTerminalKeys.ts` — 修饰键状态机（138 行）
- `web/src/composables/useTerminalGestures.ts` — Termius 手势（112 行）
- 修改：`App.vue`, `vite.config.ts`, `en.ts`, `zh.ts`, `package.json`

**测试：**
- `internal/terminal/buffer_test.go` — 11 个 RingBuffer 测试
- `internal/terminal/terminal_test.go` — 5 个 Session/Manager 测试

**验证：**
- Go 全量测试通过（11 个包）
- 前端生产构建通过
- Windows 交叉编译通过（amd64）
- PTY 测试在沙箱环境中正确 skip
