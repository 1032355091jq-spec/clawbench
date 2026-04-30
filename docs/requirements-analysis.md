# ClawBench 需求梳理报告

> 基于原始需求文档 `docs/requirements.md` 的全面梳理，包含功能需求分析、问题分类、实现状态审计。

---

## 一、总览

原始需求共 **20 条**，经分析后分类如下：

| 类别 | 数量 | 条目 |
|------|------|------|
| 新功能需求 | 15 | #2, #3, #4, #5, #7, #8, #9, #10, #11, #12, #13, #14, #18, #19, #20 |
| Bug/问题修复 | 5 | #1, #6, #15, #16, #17 |
| UX/设计改进 | 6 | #1, #3, #6, #14, #17, #18 |

> 注：部分条目同时属于多个类别。

### 实现状态统计

| 状态 | 数量 | 条目 |
|------|------|------|
| ✅ 已完成 | 6 | #6, #7, #8, #9, #12, #14 |
| 🔶 部分完成 | 7 | #2, #5, #10, #13, #16, #18, #19 |
| ⬜ 未开始 | 6 | #1, #3, #4, #11, #15, #20 |
| ❓ 无法判断 | 1 | #17 |

---

## 二、功能需求分析（15 条）

### 🔴 高优先级

#### NF-01: AI总结内容存入数据库（原始 #3）

| 项目 | 内容 |
|------|------|
| **描述** | TTS流程中AI生成的总结内容当前以 `.summary.txt` 文件缓存，需求要求持久化到SQLite数据库 |
| **优先级理由** | 文件系统缓存不可靠（清理即丢失），无法跨会话查询/管理，影响数据完整性 |
| **复杂度** | 中等 |
| **实现状态** | ⬜ 未开始 |
| **涉及模块** | `internal/handler/tts.go`、`internal/service/database.go`（新增 summary 表）、`internal/model/`、`useAutoSpeech.ts` |

#### NF-02: 会话数量上限（原始 #4）

| 项目 | 内容 |
|------|------|
| **描述** | 设置会话数量上限，可在 `config.yaml` 配置，默认 10 个，超出需先删除旧会话 |
| **优先级理由** | 资源控制基本能力，防止 SQLite 膨胀，实现简单价值高 |
| **复杂度** | 简单 |
| **实现状态** | ⬜ 未开始 |
| **配置建议** | `session.max_count: 10` |
| **涉及模块** | `internal/model/config.go`、`internal/handler/chat_session.go`、`SessionManager.vue`、`useChatSession.ts` |

#### NF-03: TTS朗读失败提示分离（原始 #2）

| 项目 | 内容 |
|------|------|
| **描述** | 区分"总结失败"和"语音合成失败"两种错误，显示不同提示 |
| **优先级理由** | 影响用户对TTS功能的理解和问题排查 |
| **复杂度** | 简单 |
| **实现状态** | 🔶 部分完成（后端已有 `summarizeFailed` 字段，前端已区分摘要失败，但合成失败仍为通用HTTP 500错误提示） |
| **涉及模块** | `internal/handler/tts.go`、`useAutoSpeech.ts`、`ChatMessageItem.vue` |

#### NF-04: TTS失败后重试跳过总结（原始 #18）

| 项目 | 内容 |
|------|------|
| **描述** | TTS转换失败后缓存总结内容，重试时跳过总结步骤直接重试语音合成 |
| **优先级理由** | 总结是昂贵操作（LLM调用），不应浪费已成功的中间结果 |
| **复杂度** | 中等 |
| **实现状态** | 🔶 部分完成（后端有音频文件缓存机制，但仅"缓存命中跳过"而非"重试跳过"；前端无重试逻辑） |
| **涉及模块** | `internal/handler/tts.go`、`useAutoSpeech.ts` |

---

### 🟡 中优先级

#### NF-05: 总结功能使用自定义AI后端（原始 #5）

| 项目 | 内容 |
|------|------|
| **描述** | 支持使用项目自身配置的AI后端（如 CodeBuddy、Claude）进行总结，而非硬编码 MiniMax |
| **优先级理由** | 增强灵活性和供应商独立性，当前方案工作正常属增强型需求 |
| **复杂度** | 复杂 |
| **实现状态** | 🔶 部分完成（已有 `SummarizeModel` 配置项可选模型，但无 `summarize_backend` 后端选择） |
| **配置建议** | `tts.summarize_backend: "minimax"` / `tts.summarize_backend_name: "assistant"` |
| **涉及模块** | `internal/speech/interface.go`、`internal/ai/interface.go`、`internal/handler/tts.go`、`internal/model/config.go` |

#### NF-06: 二进制文件检测与限制（原始 #13）

| 项目 | 内容 |
|------|------|
| **描述** | 识别二进制文件不预览，对大文件做大小限制避免卡顿 |
| **优先级理由** | 防止意外加载二进制文件导致界面异常，健壮性增强 |
| **复杂度** | 中等 |
| **实现状态** | 🔶 部分完成（已有 `IsSupportedFile()` 扩展名检测和 10MB 大小限制，但无 magic bytes 二进制内容检测） |
| **涉及模块** | `internal/handler/file.go`、`internal/model/file.go`、`FileViewer.vue`、`CodePreview.vue` |

#### NF-07: 文件预览界面支持编辑（原始 #12）

| 项目 | 内容 |
|------|------|
| **描述** | 文件预览界面支持直接编辑并保存 |
| **优先级理由** | 实用功能，但需考虑安全性和权限 |
| **复杂度** | 复杂 |
| **实现状态** | ✅ 已完成（`CodePreview.vue` 有行编辑、插入、删除功能，`useLongPressLineMenu.ts` 完整实现，`/api/file/edit-line` API 可用） |
| **涉及模块** | `CodePreview.vue`、`FileViewer.vue`、`useLongPressLineMenu.ts`、`internal/handler/file_ops.go` |

#### NF-08: AI消息自定义格式展示（原始 #9）

| 项目 | 内容 |
|------|------|
| **描述** | 根据不同消息类型（Edit/Bash/Read/Write/Grep等）使用最适合的展示格式 |
| **优先级理由** | 展示层优化，当前已有基础分类渲染 |
| **复杂度** | 复杂 |
| **实现状态** | ✅ 已完成（`ChatMessageItem.vue` 有完整的 TOOL_DISPLAYS 配置，7 种分类和独立图标/颜色） |
| **涉及模块** | `ChatMessageItem.vue`、`useChatRender.ts`、`useMarkdownRenderer.ts` |

---

### 🟢 低优先级

#### NF-09: 支持端口转发（原始 #7）

| 项目 | 内容 |
|------|------|
| **描述** | 支持通过 SSH 远程端口转发访问服务 |
| **优先级理由** | 运维/部署增强，非核心功能 |
| **复杂度** | 复杂 |
| **实现状态** | ✅ 已完成（后端 `internal/ssh/` + `service/proxy.go`，前端 `ProxyPanel.vue` + `usePortForward.ts`） |

#### NF-10: 移动端支持 iOS（原始 #10）

| 项目 | 内容 |
|------|------|
| **描述** | 优化 iOS 上的使用体验，包括 Safari 兼容性、安全区域适配 |
| **优先级理由** | 项目已 mobile-first，iOS 特有问题需专门处理但用户群决定优先级 |
| **复杂度** | 复杂 |
| **实现状态** | 🔶 部分完成（有 `safe-area-inset` 和 PWA 安装提示，但非全面 iOS 覆盖） |
| **涉及模块** | `App.vue`、`BottomSheet.vue`、`ChatInputBar.vue`、`index.html` |

#### NF-11: 中英双语支持（原始 #11）

| 项目 | 内容 |
|------|------|
| **描述** | 支持中文和英文界面切换 |
| **优先级理由** | 工程量大非核心功能，适合产品稳定后统一实施 |
| **复杂度** | 复杂 |
| **实现状态** | ⬜ 未开始（无 i18n 框架，所有 UI 文本硬编码中文） |
| **配置建议** | `app.language: "zh"` |
| **涉及模块** | 几乎所有 `.vue` 组件（文本抽取）、新增 i18n 框架 |

#### NF-12: Android端文件下载支持（原始 #19）

| 项目 | 内容 |
|------|------|
| **描述** | Android 端支持文件下载功能 |
| **优先级理由** | 移动端体验补全，标准 HTML download 在 WebView 中行为不一致 |
| **复杂度** | 中等 |
| **实现状态** | 🔶 部分完成（有 `<a download>` 下载链接，但无 Android 原生下载管理器集成） |
| **涉及模块** | `FileViewer.vue`、`FileHeader.vue`、`FileManager.vue` |

#### NF-13: 文件管理器长按菜单添加下载选项（原始 #20）

| 项目 | 内容 |
|------|------|
| **描述** | 长按菜单中添加"下载"选项 |
| **优先级理由** | 移动端体验补全，当前菜单无下载项 |
| **复杂度** | 简单 |
| **实现状态** | ⬜ 未开始（`FileManager.vue` 长按菜单仅含复制/剪切/粘贴/新建/重命名/删除） |
| **涉及模块** | `useLongPressLineMenu.ts`、`FileManager.vue` |

---

## 三、Bug/问题分析（8 条）

### 严重程度分类

| 严重程度 | 条目 |
|----------|------|
| 🔴 严重 | #16 会话切换UI残留 |
| 🟡 中等 | #2 TTS提示不分离、#6 工具状态标识误导、#15 Android确认框、#18 TTS重试效率 |
| 🟢 轻微 | #1 删除按钮颜色、#3 浮窗关闭按钮、#17 智能体间距 |

### 详细分析

#### 🔴 #16 会话切换时UI残留

| 项目 | 内容 |
|------|------|
| **问题** | 左右滑动切换会话时，"响应详情"按钮和"x分钟前"等时间元素残留 |
| **影响范围** | 移动端核心聊天功能 |
| **根因推测** | `useSwipeSession.ts` 切换时消息数组更新非原子操作，Vue DOM diff 在快速切换时未正确清理旧 DOM；SSE 连接和消息状态可能存在竞态 |
| **修复方向** | 1) `switchSession` 先清空消息数组再加载；2) `ChatMessageList` 添加 `:key="currentSessionId"` 强制重建 DOM；3) 切换时先取消旧 SSE 连接 |
| **实现状态** | 🔶 部分完成（滑动切换功能已实现，有 `session-switch-indicator`，但残留问题可能仍存在） |

#### 🟡 #2 TTS朗读失败提示分离

| 项目 | 内容 |
|------|------|
| **问题** | 两种失败（总结 vs 合成）共用同一错误提示 |
| **影响范围** | 所有 TTS 用户 |
| **根因** | 前端 `_speak()` catch 块统一使用泛化提示，后端 `tts.go` 已有 `summarizeFailed` 字段但前端未完全区分 |
| **修复方向** | 根据 `data.summarizeFailed` 字段显示不同文案 |
| **实现状态** | 🔶 部分完成 |

#### 🟡 #6 工具执行中状态标识

| 项目 | 内容 |
|------|------|
| **问题** | 工具执行中显示黄色感叹号 ⚠，易被误认为异常 |
| **影响范围** | 所有查看工具调用的用户 |
| **根因** | `ChatMessageItem.vue` 中 `hasToolResult()` 返回 false 时显示 ⚠，但某些工具正常完成也不需要 input，黄色 ⚠ 暗示异常 |
| **修复方向** | 引入三态：正常完成→绿色 ✓、明确中断→黄色 ⚠、正常无结果→灰色 ○ |
| **实现状态** | ✅ 已完成（有 `tool-spinner` 执行中标识和 `done` 状态控制） |

> 注：#6 原始需求已实现（执行中有 spinner），但黄色感叹号的误导问题仍存，属于进一步优化。

#### 🟡 #15 Android确认框样式优化

| 项目 | 内容 |
|------|------|
| **问题** | 确认框背景灰色、按钮文字灰色、不够清晰 |
| **影响范围** | Android WebView/Chrome 用户 |
| **根因** | 使用浏览器原生 `confirm()` 对话框，Android 系统默认样式无法通过 CSS 覆盖 |
| **修复方向** | 替换为自定义 `ModalDialog` 组件 |
| **实现状态** | ⬜ 未开始（`SessionDrawer.vue:151`、`ChatInputBar.vue:236` 等仍使用原生 `confirm()`） |

#### 🟡 #18 TTS失败后重试跳过总结

| 项目 | 内容 |
|------|------|
| **问题** | TTS 失败后每次重试都重新走总结流程，浪费时间 |
| **影响范围** | TTS 重试用户 |
| **根因** | 音频文件未生成时 summary 缓存不命中，前端无重试/缓存机制 |
| **修复方向** | 1) 后端：独立缓存 summary（不依赖音频文件存在）；2) 前端：缓存上次 summary 直接传给后端；3) 或后端增加 `skip_summarize` 参数 |
| **实现状态** | 🔶 部分完成 |

#### 🟢 #1 删除按钮颜色修改

| 项目 | 内容 |
|------|------|
| **问题** | 删除按钮使用红色过于醒目，易让用户误以为是警告 |
| **修复方向** | 默认颜色改为 `--text-secondary`，hover 时变红色 |
| **实现状态** | ⬜ 未开始 |

#### 🟢 #3 会话管理器浮窗关闭按钮

| 项目 | 内容 |
|------|------|
| **问题** | 浮窗缺少显式关闭按钮，用户可能不熟悉下滑关闭手势 |
| **修复方向** | 在 SessionDrawer header 区域添加关闭按钮 |
| **实现状态** | ✅ 已完成（BottomSheet 自带 `@close` 事件） |

#### 🟢 #17 智能体选择窗口间距优化

| 项目 | 内容 |
|------|------|
| **问题** | 元素间距较大，移动端可见选项过少 |
| **修复方向** | `.agent-list` gap 8px→4px，`.agent-option` padding 10px→8px |
| **实现状态** | ❓ 无法判断（需视觉对比确认） |

---

## 四、实现状态完整清单

| # | 需求 | 状态 | 关键依据 |
|---|------|------|----------|
| 1 | 删除按钮颜色修改 | ⬜ 未开始 | `ChatInputBar.vue` 仍用 `chat-action-btn-danger` 红色 |
| 2 | TTS朗读失败提示分离 | 🔶 部分完成 | 后端有 `summarizeFailed` 字段，前端区分了摘要失败但合成失败仍为通用 500 提示 |
| 3 | AI总结内容存入数据库 | ⬜ 未开始 | 仅文件缓存 `.summary.txt`，无 DB 表 |
| 4 | 会话数量上限 | ⬜ 未开始 | 无 `MaxSessions` 或 `max_count` 代码 |
| 5 | 总结功能使用自定义AI后端 | 🔶 部分完成 | 有模型选择 `SummarizeModel`，无后端选择 `summarize_backend` |
| 6 | 会话管理器浮窗关闭按钮 | ✅ 已完成 | BottomSheet `@close` 事件 + `close()` 方法 |
| 7 | 支持端口转发 | ✅ 已完成 | 完整的 SSH 隧道 + 代理服务 + 前端 ProxyPanel |
| 8 | AI消息支持收缩 | ✅ 已完成 | `collapsed` 状态 + 折叠遮罩 + 展开/收起按钮 |
| 9 | AI消息自定义格式展示 | ✅ 已完成 | TOOL_DISPLAYS 7 类分类 + 独立图标/颜色 |
| 10 | 移动端支持 iOS | 🔶 部分完成 | 有 safe-area 适配和 PWA 提示，非全面 iOS 覆盖 |
| 11 | 中英双语支持 | ⬜ 未开始 | 无 i18n 框架，所有文本硬编码中文 |
| 12 | 文件预览界面支持编辑 | ✅ 已完成 | 行编辑/插入/删除 + `/api/file/edit-line` |
| 13 | 二进制文件检测与限制 | 🔶 部分完成 | 有扩展名检测 + 10MB 限制，无 magic bytes 检测 |
| 14 | 工具执行中状态标识 | ✅ 已完成 | `tool-spinner` + `done` 状态控制 |
| 15 | Android确认框样式优化 | ⬜ 未开始 | 多处仍用原生 `confirm()` |
| 16 | 会话切换时UI残留 | 🔶 部分完成 | 滑动切换已实现，残留问题可能仍存 |
| 17 | 智能体选择窗口间距优化 | ❓ 无法判断 | 需视觉确认 |
| 18 | TTS失败后重试跳过总结 | 🔶 部分完成 | 有缓存命中机制，但非"重试跳过"逻辑 |
| 19 | Android端文件下载支持 | 🔶 部分完成 | 有 `<a download>` 但无 Android 原生下载管理器集成 |
| 20 | 长按菜单添加下载选项 | ⬜ 未开始 | 长按菜单无下载项 |

---

## 五、建议实施路线图

### 第一批：快速交付（1-2 天）

| 需求 | 复杂度 | 说明 |
|------|--------|------|
| #4 会话数量上限 | 简单 | 配置项 + handler 校验 + 前端提示 |
| #1 删除按钮颜色 | 简单 | CSS 改色，hover 变红 |
| #2 TTS提示分离补全 | 简单 | 前端增加合成失败区分 |
| #20 长按菜单下载 | 简单 | 菜单项 + 调用已有下载逻辑 |

### 第二批：核心增强（3-5 天）

| 需求 | 复杂度 | 说明 |
|------|--------|------|
| #3 AI总结存数据库 | 中等 | 新增 DB 表 + 迁移 + handler 改造 |
| #18 TTS重试跳过总结 | 中等 | 独立缓存 summary + 重试逻辑 |
| #15 Android确认框替换 | 中等 | `confirm()` → 自定义 ModalDialog |
| #13 二进制检测增强 | 中等 | magic bytes 检测 + 文件大小 UI 提示 |

### 第三批：深度功能（1-2 周）

| 需求 | 复杂度 | 说明 |
|------|--------|------|
| #5 总结自定义AI后端 | 复杂 | 复用 AIBackend 接口做非流式总结 |
| #19 Android下载增强 | 中等 | 原生下载管理器集成 |
| #16 会话切换残留修复 | 中等 | DOM key + SSE 竞态处理 |

### 第四批：长期规划（专项）

| 需求 | 复杂度 | 说明 |
|------|--------|------|
| #10 iOS移动端适配 | 复杂 | Safari 兼容性 + 安全区域全面覆盖 |
| #11 中英双语 | 复杂 | 引入 i18n 框架 + 全量文本抽取 |

---

## 六、未完成需求深度分析

### A. 未开始需求（6 条）

---

#### #1 删除按钮颜色修改

**现状代码位置：**
- 模板：`ChatInputBar.vue:18` — `<button class="chat-action-btn chat-action-btn-danger" ...>`
- 样式：`ChatInputBar.vue:407-409` — 默认红色 `color: var(--danger-color, #dc3545)`
- hover：`ChatInputBar.vue:411-415` — 白字红底
- disabled：`ChatInputBar.vue:418-421` — opacity 0.4

**改动方案：**

| 位置 | 当前 | 改为 |
|------|------|------|
| L18 | `chat-action-btn-danger` | `chat-action-btn-delete` |
| L407-409 | `color: var(--danger-color)` | `color: var(--text-muted, #999)` |
| L411-415 | hover 白字红底 | hover 时才变红：`color: var(--danger-color); background: color-mix(in srgb, var(--danger-color) 10%, transparent)` |

**风险评估：** 低。`chat-action-btn-danger` 仅被删除按钮使用（grep 确认无复用），触屏 `@media (hover: hover)` 已正确处理。

**预估改动：** ~8 行

---

#### #3 AI总结内容存入数据库

**现状代码位置：**
- 缓存 key 生成：`tts.go:82` — SHA256 hash
- 文件缓存读取：`tts.go:93-106` — `os.ReadFile(summaryPath)`
- 文件缓存写入：`tts.go:132-140` — `os.WriteFile(summaryPath, []byte(summary), 0644)`
- 现有 DB 表：`database.go:50-121` — 5 张表（chat_history, chat_sessions, recent_projects, scheduled_tasks, ai_raw_responses）

**改动方案：**

1. **新增 summary 表**（`database.go:121` 后）：
```sql
CREATE TABLE IF NOT EXISTS tts_summaries (
    cache_key TEXT PRIMARY KEY,
    original_text_hash TEXT NOT NULL,
    summary TEXT NOT NULL,
    summarize_failed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

2. **替换文件缓存**（`tts.go`）：
   - L93-106 读文件 → `SELECT summary, summarize_failed FROM tts_summaries WHERE cache_key = ?`
   - L132-140 写文件 → `INSERT OR REPLACE INTO tts_summaries (...) VALUES (...)`

3. **新增数据库访问函数**（`chat.go` 或新建 `tts_cache.go`）：
   - `GetTTSSummary(cacheKey string) (summary string, failed bool, found bool)`
   - `SaveTTSSummary(cacheKey, originalHash, summary string, failed bool) error`

**风险评估：** 中。需注意 hash 碰撞（cacheKey 为前 16 hex），建议保留 `original_text_hash` 全量 hash 校验。SQLite WAL 模式 + 单连接保证并发安全。

**预估改动：** ~45-60 行

---

#### #4 会话数量上限

**现状代码位置：**
- 配置结构：`config.go:25-29` — Chat 子结构体有 InitialMessages/PageSize/CollapsedHeight，**无** MaxSessions
- 创建会话：`chat_session.go:30-74` — POST 分支直接调用 `service.CreateSession()` 无数量检查
- Service 层：`chat.go:252-265` — `CreateSession()` 直接 INSERT
- 自动创建：`chat.go:98`、`chat_history.go:36` — 首次访问无会话时自动创建
- 前端：`useChatSession.ts:255-284` — 直接 POST 无校验

**改动方案：**

| 文件 | 行号 | 改动 |
|------|------|------|
| `config.go` | 25-29 | Chat 子结构体新增 `MaxSessions int` yaml:"max_sessions" |
| `config.go` | 56-59 | 全局变量 `ChatMaxSessions`，默认 0（不限制） |
| `chat_session.go` | 30-74 | POST 前检查 `len(service.GetSessions()) >= model.ChatMaxSessions` |
| `chat.go` | 98, 166 | 自动创建不受限（否则用户无法进入聊天） |
| `useChatSession.ts` | 255-284 | 创建前可选前端预检查 |

**风险评估：** 中。关键注意点：**自动创建路径不应被限制阻止**，否则用户无法正常进入聊天。手动创建受限，自动创建不受限。

**预估改动：** ~25-35 行

---

#### #11 中英双语支持

**现状代码位置：**
- 含硬编码中文的文件：**54 个**（占前端文件 70%）
- 中文字符实例总数：约 **3141 个**
- 中文行数最多的文件：`useMarkdownRenderer.ts`(43行)、`FileManager.vue`(32行)、`useDoubleClickCopy.ts`(29行)
- Go 后端：71 行中文硬编码
- i18n 依赖：**无**（package.json 中无 vue-i18n）

**改动方案：**

1. **基础设施**（一次性 ~100 行）：
   - `npm install vue-i18n`
   - 新建 `web/src/i18n/`：`index.ts` + `locales/zh-CN.ts` + `locales/en.ts`
   - `main.ts` 中 `app.use(i18n)`
   - 语言检测：`localStorage` + `navigator.language`

2. **逐文件替换**（主要工作量 ~1500-2000 行）：
   - 模板中 `{{ $t('key') }}` 替换硬编码
   - JS 中 `t('key')` 替换字符串
   - 动态拼接如 `` `确定删除第 ${n} 行？` `` → `$t('confirmDeleteLine', {n})`

3. **语言包文件**：~500-800 行

**风险评估：** 高。工作量最大（预估 150+ 人时）。动态拼接字符串需使用插值，Markdown 渲染中的固定文本提取较复杂。

**预估改动：** ~2000-3000 行

---

#### #15 Android确认框样式优化

**现状代码位置**（共 **10 处** `confirm()` 调用）：

| # | 文件 | 行号 | 上下文 |
|---|------|------|--------|
| 1 | `ChatInputBar.vue` | 236 | 删除当前会话 |
| 2 | `SessionManager.vue` | 233 | 删除会话 |
| 3 | `SessionManager.vue` | 276 | 删除任务 |
| 4 | `SessionDrawer.vue` | 151 | 删除会话（抽屉） |
| 5 | `FileHeader.vue` | 157 | 删除文件 |
| 6 | `ProjectDialog.vue` | 171 | 删除项目目录 |
| 7 | `TaskDrawer.vue` | 113 | 删除任务（抽屉） |
| 8 | `TaskManager.vue` | 102 | 删除任务（管理） |
| 9 | `stores/app.ts` | 275 | 删除文件（store 层） |
| 10 | `useLongPressLineMenu.ts` | 113 | 删除代码行 |

另有 **5 处** `alert()` 调用（`useLongPressLineMenu.ts:103,106,123,171,213`）

**现有可复用组件**：`ModalDialog.vue` — 通用模态框（有 header/body/footer slot），但不是 confirm 对话框，需封装

**改动方案：**

1. **新建 ConfirmDialog 组件**（`common/ConfirmDialog.vue` ~60 行）— 基于 ModalDialog
2. **新建 `useConfirm` composable**（`composables/useConfirm.ts` ~30 行）— Promise 模式
3. **替换 10 处 `confirm()`**（~30 行）— 调用方改为 `async`，`await confirm(message)`
4. **替换 5 处 `alert()`**（~15 行）— 改为 toast 或 AlertDialog
5. **App.vue 挂载**（~5 行）

**风险评估：** 中。`confirm()` 是同步的，替换为异步 Promise 后调用方需改为 `async`；需处理全局挂载点（provide/inject）和焦点陷阱；ConfirmDialog z-index 需高于 ModalDialog(2100)。

**预估改动：** ~120-150 行

---

#### #20 文件管理器长按菜单添加下载选项

**现状代码位置：**
- 上下文菜单：`FileManager.vue:102-143` — 当前 8 个菜单项（复制/剪切/粘贴/新建/重命名/删除/打开为项目），**无下载**
- 可复用下载逻辑：`FileViewer.vue:266-271` — `handleDownload(path)` 支持 `AndroidNative.downloadFile()` + Web `<a download>`

**改动方案：**

1. **菜单模板添加下载项**（`FileManager.vue:130` 后插入 ~8 行）：
   - 条件：`v-if="ctxMenu.entry && ctxMenu.entry.type !== 'dir'"`（目录不显示下载）
   - 图标：下载 SVG

2. **script 添加下载逻辑**（~15-25 行）：
   - 引入 `useAppMode`
   - appMode → `AndroidNative.downloadFile(path)`
   - Web → `document.createElement('a')` + `<a download>`

**风险评估：** 低。需注意 `ctxMenu.entry.path` 是相对路径，Android 原生可能需要拼接 `store.state.projectRoot`。菜单项增加后共 9 个，考虑分组。

**预估改动：** ~25-35 行

---

### B. 部分完成需求（7 条）

---

#### #2 TTS朗读失败提示分离

**已完成部分：**
- 后端 `tts.go:47`：`ttsGenerateResponse` 已包含 `SummarizeFailed bool`
- 后端 `tts.go:113-121`：Summarize 失败时设置 `summarizeFailed=true` 并回退原文
- 前端 `useAutoSpeech.ts:108-110`：检测 `data.summarizeFailed` 提示"摘要生成失败，将朗读原文"

**未完成部分：**
- Synthesize 失败时直接返回 HTTP 500（`tts.go:146-153`），**无** `SynthesizeFailed` 字段
- 前端 `useAutoSpeech.ts:103`：`!resp.ok` 时只抛通用错误 `语音生成失败 (HTTP ${resp.status})`
- 前端 `useAutoSpeech.ts:127-132`：`audio.onerror` 不区分播放失败原因

**补全方案：**
1. 后端 `ttsGenerateResponse` 增加 `SynthesizeFailed bool` + `SynthesizeError string`
2. Synthesize 失败返回 200 + `synthesizeFailed=true`（而非 500），让前端区分
3. 前端 `_speak()` 增加 `data.synthesizeFailed` 处理分支

**风险：** 低。新增字段 `omitempty` 向后兼容。需注意将 Synthesize 失败从 500 改为 200 需同步前端改动。

---

#### #5 总结功能使用自定义AI后端

**已完成部分：**
- `config.go:32`：`SummarizeModel string` 配置字段，可选模型
- `minimax.go:127`：`--model p.SummarizeModel` 传递给 mmx CLI

**未完成部分：**
- 只能选模型，**无法选后端**（只能用 mmx CLI，无法切到 Claude/CodeBuddy 等）
- `AIBackend.ExecuteStream()` 是面向对话流的设计，Summarize 需要 `prompt -> response` 单次生成，接口不匹配

**补全方案：**
- 新增 `TextGenerator` 接口：`Generate(ctx, systemPrompt, userPrompt) (string, error)`
- 为每个已有后端实现 `TextGenerator`（复用 CLI 调用逻辑但简化解析）
- `MiniMaxProvider` 增加 `SummarizeBackend ai.TextGenerator` 字段
- 配置增加 `tts.summarize_backend: "codebuddy"` 等

**风险：** 中。各 AI CLI 的非流式输出模式需逐一验证，建议先实现 codebuddy 后端（底层 mmx 兼容性好）。

---

#### #10 移动端支持 iOS

**已完成部分：**
- `index.html:5`：`viewport-fit=cover`
- `index.html:12-14`：`apple-mobile-web-app-capable` 等 PWA meta
- 多处 `env(safe-area-inset-bottom)` 适配
- `@media (hover: hover)` 限制部分 hover 样式

**未完成部分**（5 个 iOS Safari 兼容性问题）：

| 问题 | 影响 | 说明 |
|------|------|------|
| 大量裸 `:hover` 未加 `@media (hover: hover)` | 触摸粘滞 | SessionManager(8处)、FileManager(6处)、FileHeader(4处) 等共 30+ 处 |
| viewport 高度使用 100vh | 底部被遮挡 | iOS Safari 的 100vh 含地址栏，需改用 `100dvh` |
| Audio autoplay 限制 | TTS 首次播放失败 | 需在用户首次交互时预解锁 AudioContext |
| SSE 长连接后台被挂起 | 聊天消息中断 | iOS 激进限制后台进程，重连可能不触发 |
| BottomSheet 弹性滚动穿透 | 抽屉交互异常 | 需 `overscroll-behavior: contain` |

**补全方案：**
1. 全局 hover 修复：`base.css` 加 `@media (hover: none) { *:hover { /* 禁用 */ } }`
2. viewport 修复：CSS 变量 `--app-height: 100dvh` + JS `window.innerHeight` 降级
3. Audio 预解锁：首次 touchend 时 `new AudioContext().resume()`

**风险：** 低-中。hover 修复不影响桌面端，Audio 预解锁需实测 iOS 15-18。

---

#### #13 二进制文件检测与限制

**已完成部分：**
- `file.go`：`IsTextFile()`/`IsImageFile()` 等基于扩展名匹配
- `file.go:181-184`：10MB 大小限制
- `file.go:189-201`：非文本文件标记 `IsBinary: true` 不读内容

**未完成部分：**
- 无 magic bytes 检测，无法识别扩展名被篡改的二进制文件
- `forceText=1` 参数可绕过二进制检测，大文件可能被意外加载
- `upload.go` 只检查危险扩展名，不检查内容

**补全方案：**
1. 新增 `IsBinaryContent(f *os.File) bool` — 读前 512 字节检查 magic bytes（ELF/PE/PNG/JPEG/ZIP/GZIP/PDF 等）+ NULL 字节检测
2. `GetFile()` 中 `forceText=1` 时增加可执行文件拒绝
3. 可选：用 Go 标准库 `net/http.DetectContentType()` 替代手动 magic bytes

**风险：** 低。纯增量安全增强。注意需正确处理"二进制但扩展名正确"的场景（如 .png 包含 PNG magic bytes 是正常的）。

---

#### #16 会话切换时UI残留

**已完成部分：**
- `useSwipeSession.ts`：完整滑动切换逻辑
- `useChatSession.ts:80-81`：`switchSessionSeq` 防并发
- `ChatPanel.vue:43-47`：切换遮罩和过渡动画
- `ChatMessageList.vue:91-93`：`watch(messages)` 时重置 `expandedSet`

**未完成部分**（4 个具体 Bug）：

| Bug | 根因 | 修复 |
|-----|------|------|
| **消息列表 key 不稳定** | `ChatMessageList.vue:45` 用 `` `${msg.createdAt || ''}-${i}` `` 作 key，`createdAt` 可能空缺导致 key 冲突 | key 加入 `currentSessionId`：`` `${currentSessionId}-${msg.id || msg.createdAt}-${i}` `` |
| **renderedContents 残留** | `switchSession()` 中 `messages.value` 被替换但 `renderedContents.value` 可能在同一帧内仍为旧数组 | fetch 前先 `messages.value = []; renderedContents.value = []` |
| **streaming 消息残留** | `switchSession()` 断开 SSE 但未清理 streaming 消息的 DOM 状态（加载动画/光标） | 切换时主动清理 `streaming` 标记 |
| **indicatorText 定时器** | `useSwipeSession.ts:42-49` 1500ms 定时器可能被旧定时器清除 | 已有 `clearTimeout`，基本无问题 |

**风险：** 低-中。先清空再填充可能导致短暂空白闪烁，需配合已有 `switching` overlay。

---

#### #18 TTS失败后重试跳过总结

**已完成部分：**
- `tts.go:80-106`：基于 SHA256 的缓存键，音频存在则直接返回
- `tts.go:99-104`：缓存命中时读取 `.summary.txt`
- `tts.go:113-121`：Summarize 失败回退原文 + `summarizeFailed=true`

**未完成部分：**
- 缓存只检查"音频文件是否存在"，Synthesize 失败 → 音频不存在 → 缓存未命中 → 重新走完整流程
- `.summary.txt` 虽然写入了，但下次请求不会检查这个文件来跳过 Summarize
- 没有"summary 已缓存但音频需重新生成"的中间状态

**补全方案：**

在 `tts.go` 缓存检查逻辑中，增加 summary 独立缓存检查：

```go
// 全量缓存命中（音频存在）→ 直接返回
if info, err := os.Stat(absAudioPath); err == nil && info.Size() > 0 { ... }

// 部分缓存命中（summary 存在但音频不存在）→ 跳过 Summarize
summaryPath := absAudioPath + ".summary.txt"
cachedSummary, err := os.ReadFile(summaryPath)
if err == nil && len(cachedSummary) > 0 {
    summary = string(cachedSummary)  // 跳过 Summarize
} else {
    summary, err = speechProvider.Summarize(ctx, req.Text)  // 正常流程
    // 缓存 summary...
}

// Synthesize 始终执行（包括重试）
```

**风险：** 低。纯增量逻辑。需注意 summary 文件可能与修改后的 prompt 不一致，建议缓存中存储版本/hash。

---

#### #19 Android端文件下载支持

**已完成部分：**
- `FileViewer.vue:57,85`：`<a download>` 下载链接
- `FileHeader.vue:52`：下拉菜单下载项
- `MainActivity.java:157-181`：`webView.setDownloadListener()` + `DownloadManager`
- `MainActivity.java:511-520`：`@JavascriptInterface downloadFile(String path)`
- `useAppMode.ts`：Android WebView 环境检测

**未完成部分**（4 个问题）：

| 问题 | 详情 |
|------|------|
| **downloadFile() 实现有缺陷** | 通过 `webView.loadUrl(url)` 间接触发 DownloadListener，某些 MIME 类型（如 PDF）会被 WebView 直接渲染而非下载 |
| **Cookie 认证问题** | SSH 隧道模式下 localhost cookie 域名可能不匹配 |
| **缺乏下载进度反馈** | 前端无任何反馈，用户可能重复点击 |
| **Scoped Storage 兼容** | Android 10+ 的 `setDestinationInExternalPublicDir()` 可能需要权限适配 |

**补全方案：**
1. 改 `downloadFile()` 直接使用 `DownloadManager.Request`（而非 `loadUrl` 间接触发）
2. 添加 Cookie header + 文件名提取
3. 前端添加 toast 提示"下载已开始"
4. SSH 隧道模式下使用 localhost URL

**风险：** 中。Android 11+ Scoped Storage 对直接写入 Downloads 目录有限制，需实测。

---

### C. 未完成需求汇总对比

| # | 需求 | 状态 | 涉及文件 | 改动行数 | 风险 | 建议 |
|---|------|------|---------|---------|------|------|
| 1 | 删除按钮颜色 | ⬜ 未开始 | 1 | ~8 | 低 | 🔥 最简单，可立即做 |
| 3 | 总结存数据库 | ⬜ 未开始 | 3-4 | ~45-60 | 中 | 需仔细测试迁移 |
| 4 | 会话数量上限 | ⬜ 未开始 | 4-5 | ~25-35 | 中 | 注意自动创建路径不限 |
| 11 | 中英双语 | ⬜ 未开始 | 54+ | ~2000-3000 | 高 | 工作量巨大，建议分阶段 |
| 15 | Android确认框 | ⬜ 未开始 | 8-10 | ~120-150 | 中 | 组件化改造，体验提升明显 |
| 20 | 长按菜单下载 | ⬜ 未开始 | 1-2 | ~25-35 | 低 | 复用已有逻辑 |
| 2 | TTS提示分离 | 🔶 部分 | 2-3 | ~20 | 低 | 补全 synthesizeFailed 字段 |
| 5 | 总结自定义后端 | 🔶 部分 | 3-4 | ~80-120 | 中 | 新增 TextGenerator 接口 |
| 10 | iOS适配 | 🔶 部分 | 10+ | ~100-150 | 低-中 | hover + viewport + Audio |
| 13 | 二进制检测增强 | 🔶 部分 | 2-3 | ~40-60 | 低 | magic bytes + forceText 安全 |
| 16 | 会话切换残留 | 🔶 部分 | 2-3 | ~15-20 | 低-中 | key 稳定 + 清空顺序 |
| 18 | TTS重试跳过总结 | 🔶 部分 | 1-2 | ~25-35 | 低 | summary 独立缓存 |
| 19 | Android下载增强 | 🔶 部分 | 2-3 | ~60-80 | 中 | DownloadManager 直接调用 |

---

*报告生成时间：2026-04-30*
*数据来源：`docs/requirements.md` + 代码库深度审计*
*分析方法：3 个并行智能体（需求分析 + 问题分析 + 代码审计）*
