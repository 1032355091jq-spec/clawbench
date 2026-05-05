# Multi-Agent Workflow Design

## Overview

AI自然语言生成工作流——用户在输入栏点击工作流按钮 → 描述任务 → 主智能体生成工作流定义（JSON DAG）→ 用户确认 → 后端调度执行（支持并行分支）→ 主智能体汇总结果。子智能体仅接收委派prompt，不看主会话上下文。步骤执行过程在侧边抽屉展示。用户显式触发，普通对话不受影响。

## Architecture

```
用户点击[🔄]按钮 → 输入描述 "帮我设计并实现一个登录页面"
        ↓
主智能体收到带 workflow_mode 标记的请求
        ↓
主智能体输出 <workflow-definition> JSON
        ↓
后端解析 JSON → 生成 WorkflowInstance（DAG）
        ↓
前端展示工作流确认卡片（步骤列表、智能体、依赖关系）
        ↓
用户点击[确认执行]
        ↓
后端按 DAG 拓扑排序执行：
  - 无依赖步骤并行启动（各自创建子会话 + CLI 进程）
  - 前置步骤完成后，输出注入后续步骤的 prompt
  - 每个步骤的 SSE 事件通过主会话流转发（带 step_id 标记）
        ↓
所有步骤完成 → 自动创建汇总子任务（原主智能体）
        ↓
汇总结果写入主会话作为最终回复
```

## Workflow Definition Format (JSON DAG)

```json
{
  "title": "登录页面设计与实现",
  "description": "设计并实现一个完整的登录页面",
  "steps": [
    {
      "id": "design",
      "agent_id": "designer",
      "prompt": "设计一个现代化的登录页面UI，包含邮箱/密码登录、第三方登录、记住我选项。输出设计稿描述和配色方案。",
      "depends_on": [],
      "parallel": true
    },
    {
      "id": "backend",
      "agent_id": "opencode",
      "prompt": "实现登录API接口：POST /api/auth/login，包含参数验证、JWT签发、错误处理。使用Go标准库。",
      "depends_on": [],
      "parallel": true
    },
    {
      "id": "frontend",
      "agent_id": "handyman",
      "prompt": "根据设计稿实现登录页面前端：{{design.output}}\n\n使用Vue 3 + TypeScript，风格参考项目现有组件。",
      "depends_on": ["design"],
      "parallel": false
    },
    {
      "id": "test",
      "agent_id": "opencode",
      "prompt": "为登录功能编写测试：\n- 后端API测试：{{backend.output}}\n- 前端组件测试：{{frontend.output}}",
      "depends_on": ["backend", "frontend"],
      "parallel": false
    }
  ],
  "summary_agent_id": "assistant"
}
```

| Field | Description |
|-------|-------------|
| `title` | 工作流标题，展示在确认卡片和侧边抽屉 |
| `description` | 一句话描述工作流目标 |
| `steps[]` | 步骤列表，有序但执行按依赖拓扑排序 |
| `step.id` | 步骤唯一标识，用于依赖引用和模板插值 |
| `step.agent_id` | 执行此步骤的智能体 ID |
| `step.prompt` | 委派给子智能体的 prompt，支持 `{{stepId.output}}` 插值 |
| `step.depends_on` | 前置步骤 ID 列表，空数组 = 可立即执行 |
| `step.parallel` | 提示标记，同层级无依赖的步骤可并行 |
| `summary_agent_id` | 汇总步骤使用的智能体，通常是触发工作流的原始智能体 |

**Interpolation**: `{{design.output}}` 在前置步骤完成后被替换为该步骤的最终输出文本。子智能体只看到主智能体精心编写的 prompt + 前置步骤的输出，看不到主会话全部历史。

**DAG validation rules** (backend must check):
1. No cycles in `depends_on`
2. All referenced step IDs must exist in `steps`
3. All `agent_id` values must exist in `model.Agents`
4. `{{stepId.output}}` can only reference steps listed in `depends_on`

## Backend Design

### New Package: `internal/workflow/`

```
internal/workflow/
  model.go        — WorkflowDefinition, WorkflowStep, WorkflowInstance 等数据结构
  parser.go       — 解析 <workflow-definition> 标签，提取 JSON，DAG 验证
  scheduler.go    — 工作流调度器：拓扑排序、并行启动、依赖等待、插值替换
  executor.go     — 单步骤执行器：创建子会话、调用 AIBackend.ExecuteStream、收集输出
```

### Core Data Structures (`model.go`)

```go
type WorkflowDefinition struct {
    Title          string         `json:"title"`
    Description    string         `json:"description"`
    Steps          []WorkflowStep `json:"steps"`
    SummaryAgentID string         `json:"summary_agent_id"`
}

type WorkflowStep struct {
    ID        string   `json:"id"`
    AgentID   string   `json:"agent_id"`
    Prompt    string   `json:"prompt"`
    DependsOn []string `json:"depends_on"`
    Parallel  bool     `json:"parallel"`
}

type WorkflowInstance struct {
    ID          string
    SessionID   string                    // 主会话 ID
    Definition  WorkflowDefinition
    Status      WorkflowStatus            // pending / running / completed / failed / cancelled
    StepStates  map[string]*StepState     // step_id → 运行状态
    CancelFunc  context.CancelFunc
    CreatedAt   time.Time
}

type StepState struct {
    Status     StepStatus  // pending / running / completed / failed / skipped
    SessionID  string      // 子会话 ID（临时）
    Output     string      // 步骤最终输出文本
    StartedAt  *time.Time
    FinishedAt *time.Time
    Error      string
}

type WorkflowStatus string
const (
    WorkflowPending   WorkflowStatus = "pending"
    WorkflowRunning   WorkflowStatus = "running"
    WorkflowCompleted WorkflowStatus = "completed"
    WorkflowFailed    WorkflowStatus = "failed"
    WorkflowCancelled WorkflowStatus = "cancelled"
)

type StepStatus string
const (
    StepPending   StepStatus = "pending"
    StepRunning   StepStatus = "running"
    StepCompleted StepStatus = "completed"
    StepFailed    StepStatus = "failed"
    StepSkipped   StepStatus = "skipped"
)
```

WorkflowInstance is in-memory only, NOT persisted to database. Rationale:
1. State changes are too frequent (multiple step content events per second)
2. On restart, orphaned sub-sessions are cleaned up
3. Future "save workflow template" or "workflow history" can add a table later

### Scheduler (`scheduler.go`)

```
func (s *Scheduler) Run(instance *WorkflowInstance) {
    1. Topological sort → execution levels:
       Level 0: [design, backend]     (no deps, parallel)
       Level 1: [frontend]            (depends on design)
       Level 2: [test]                (depends on backend + frontend)
       Level 3: [summary]             (depends on all)

    2. Execute level by level:
       for each level:
         - Launch steps in goroutines (parallel within level)
         - Each goroutine calls executor.Execute(step, resolvedPrompt)
         - sync.WaitGroup for level completion
         - On step failure → mark downstream dependents as skipped
         - Collect outputs → replace {{stepId.output}} in downstream prompts

    3. After all steps complete:
       - Build summary prompt = "原始用户需求\n\n各步骤结果：\n{step_id}: {output}"
       - Call summary_agent ExecuteStream
       - Write summary result as final message in main session

    4. Relay all events via main session's SSE stream
}
```

### Executor (`executor.go`)

```go
func (e *Executor) Execute(ctx context.Context, step WorkflowStep, prompt string, instance *WorkflowInstance) (*StepState, error) {
    // 1. Resolve agent config
    backend, model, systemPrompt, command, ok := resolveAgentConfig(step.AgentID)

    // 2. Create temporary sub-session (is_sub_session=true, parent_session_id=instance.SessionID)
    subSession := createSubSession(instance.SessionID, step.AgentID)

    // 3. Build request
    chatReq := buildChatRequest(prompt, subSession.ID, backend, step.AgentID)

    // 4. Create AIBackend and execute
    aiBackend, _ := ai.NewBackend(backend)
    eventCh := aiBackend.ExecuteStream(ctx, chatReq)

    // 5. Consume event stream, accumulate output
    var output strings.Builder
    for event := range eventCh {
        output.WriteString(event.Content)
        // Relay event to main session SSE stream (with step_id marker)
        relayEvent(instance.SessionID, step.ID, event)
    }

    // 6. Return step state
    return &StepState{Status: Completed, Output: output.String()}, nil
}
```

### SSE Events

New workflow-specific SSE events added to the existing stream:

| Event Type | Data | Description |
|------------|------|-------------|
| `workflow_proposal` | `{definition, instance_id}` | AI-generated workflow definition, frontend shows confirm card |
| `workflow_accepted` | `{instance_id}` | User confirmed execution |
| `workflow_step_start` | `{instance_id, step_id, agent_id, agent_name}` | Step started |
| `workflow_step_content` | `{instance_id, step_id, content}` | Step real-time output |
| `workflow_step_complete` | `{instance_id, step_id, output_summary}` | Step completed (with output summary) |
| `workflow_step_failed` | `{instance_id, step_id, error}` | Step failed |
| `workflow_complete` | `{instance_id, summary}` | All done, with summary result |
| `workflow_cancelled` | `{instance_id}` | User cancelled |

### Handler Integration

In `executeStreamRun` (`chat_stream.go`), add workflow detection alongside existing `<ask-question>` and `<schedule-proposal>` detection:

```go
if strings.Contains(accumulatedContent, "<workflow-definition>") {
    def, err := workflow.ParseDefinition(accumulatedContent)
    if err == nil {
        sendSSE(writer, "workflow_proposal", map[string]any{
            "definition": def,
        })
        // Pause stream, wait for frontend POST /api/ai/workflow/{instance_id}/confirm
        // After confirmation, start Scheduler.Run()
    }
}
```

New API endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/workflow/{id}/confirm` | Confirm execution |
| POST | `/api/ai/workflow/{id}/cancel` | Cancel execution |
| POST | `/api/ai/workflow/{id}/retry` | Retry failed steps |
| GET | `/api/ai/workflow/{id}/step/{stepId}/messages` | Get sub-session messages (drawer detail view) |
| GET | `/api/ai/workflow/{id}/status` | Get current workflow status (polling fallback) |

## Frontend Design

### New Files

```
web/src/
  components/
    workflow/
      WorkflowConfirmCard.vue    — 工作流确认卡片（内联在对话流中）
      WorkflowDrawer.vue         — 侧边抽屉，展示工作流执行详情
      WorkflowStepItem.vue       — 单步骤状态卡片
      WorkflowStepDetail.vue     — 步骤实时输出查看（嵌入抽屉内）
    chat/
      ChatWorkflowToggle.vue     — 输入栏工作流按钮
  composables/
    useWorkflow.ts              — 工作流状态管理、SSE 事件处理、API 调用
```

### Input Bar Trigger

Add a 🔄 button to the left of the send button in `ChatInputBar.vue`:

```
[附件] [🔄] [输入框............] [发送]
```

- Click 🔄 toggles workflow mode
- Input box background changes + placeholder becomes "描述你的多智能体任务..."
- Send with `{ workflowMode: true }` in request body
- State managed by `useWorkflow().isWorkflowMode` ref

### Confirm Card (WorkflowConfirmCard.vue)

Embedded in the chat message flow, replacing the normal AI text reply:

```
┌─────────────────────────────────────┐
│ 🔄 登录页面设计与实现                  │
│ 设计并实现一个完整的登录页面            │
│                                     │
│ ┌─ Step 1: design ────────────────┐ │
│ │ 🎨 设计师   ⚡ 可并行            │ │
│ │ 设计现代化登录页面UI...           │ │
│ └─────────────────────────────────┘ │
│ ┌─ Step 2: backend ───────────────┐ │
│ │ 🛠 OpenCode  ⚡ 可并行          │ │
│ │ 实现登录API接口...              │ │
│ └─────────────────────────────────┘ │
│ ┌─ Step 3: frontend ─────────────┐ │
│ │ 🔧 勤杂工   ⏳ 等待 Step 1      │ │
│ │ 根据设计稿实现登录页面前端...     │ │
│ └─────────────────────────────────┘ │
│ ┌─ Step 4: test ─────────────────┐ │
│ │ 🛠 OpenCode  ⏳ 等待 Step 2,3   │ │
│ │ 为登录功能编写测试...            │ │
│ └─────────────────────────────────┘ │
│                                     │
│              [取消]  [✓ 确认执行]     │
└─────────────────────────────────────┘
```

- Each step shows: agent icon + name + dependency status
- Steps are expandable to view full prompt
- Confirm calls `POST /api/ai/workflow/{id}/confirm`

### Side Drawer (WorkflowDrawer.vue)

Auto-opens after confirmation, implemented as `BottomSheet`:

```
┌──────────────────────────────────┐
│ 🔄 登录页面设计与实现        [✕]   │
│──────────────────────────────────│
│ ✅ design    🎨 设计师   12s     │ ← click to expand detail
│ ✅ backend   🛠 OpenCode  28s    │
│ 🔄 frontend  🔧 勤杂工   进行中.. │ ← real-time output
│ ⏳ test      🛠 OpenCode  等待中   │
│──────────────────────────────────│
│ 📋 汇总：顶梁柱                   │
│──────────────────────────────────│
│                                  │
│ ┌─ frontend 实时输出 ───────────┐ │ ← shown when step is clicked
│ │ <template>                    │ │
│ │   <LoginForm />               │ │
│ │   ...                         │ │
│ └───────────────────────────────┘ │
│                                  │
│         [⏹ 取消工作流]            │
└──────────────────────────────────┘
```

- Step status updates in real-time via `workflow_step_*` SSE events
- Click completed step → view output
- Click running step → view real-time output stream
- Cancel calls `POST /api/ai/workflow/{id}/cancel`

### State Management (useWorkflow.ts)

```typescript
// Module-level singleton (same pattern as useAutoSpeech)
const isWorkflowMode = ref(false)
const activeWorkflows = reactive<Map<string, WorkflowInstance>>(new Map())

export function useWorkflow() {
  function toggleWorkflowMode() { ... }

  function handleWorkflowEvent(eventType: string, data: any) {
    switch (eventType) {
      case 'workflow_proposal':   // store in activeWorkflows, render confirm card
      case 'workflow_step_start': // update step status to running
      case 'workflow_step_content': // append step real-time output
      case 'workflow_step_complete': // update step status to completed
      case 'workflow_step_failed': // update step status to failed
      case 'workflow_complete': // workflow done, close drawer, result in chat
      case 'workflow_cancelled': // cleanup
    }
  }

  async function confirmWorkflow(instanceId: string) { ... }
  async function cancelWorkflow(instanceId: string) { ... }

  return { isWorkflowMode, activeWorkflows, toggleWorkflowMode,
           handleWorkflowEvent, confirmWorkflow, cancelWorkflow }
}
```

### SSE Event Integration (useChatStream.ts)

In existing event parsing logic, recognize `workflow_*` event types and forward to `useWorkflow().handleWorkflowEvent()`.

### ChatPanel Integration

```vue
<!-- Confirm card embedded in message flow -->
<WorkflowConfirmCard v-if="message.workflowDefinition" :definition="message.workflowDefinition" />

<!-- Side drawer -->
<WorkflowDrawer v-if="workflowStore.hasActive" />
```

## Session Limit Isolation

Sub-sessions are temporary and must NOT count toward `session.max_count`.

### Database (direct CREATE TABLE, no migration)

`chat_sessions` table new columns added directly to initial CREATE TABLE:

```sql
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    backend TEXT NOT NULL,
    title TEXT NOT NULL,
    agent_id TEXT DEFAULT '',
    agent_source TEXT DEFAULT 'default',
    model TEXT DEFAULT '',
    external_session_id TEXT DEFAULT '',
    is_sub_session INTEGER DEFAULT 0,
    parent_session_id TEXT DEFAULT '',
    workflow_id TEXT DEFAULT '',
    last_read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_path, backend, id)
);
```

New indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_sub ON chat_sessions(is_sub_session);
CREATE INDEX IF NOT EXISTS idx_sessions_workflow ON chat_sessions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON chat_sessions(parent_session_id);
```

Remove all existing ALTER TABLE migration code from `database.go`.

### Counting Isolation

```sql
-- Before: counts all sessions
SELECT COUNT(*) FROM chat_sessions WHERE project_path = ? AND backend = ?

-- After: counts only user sessions
SELECT COUNT(*) FROM chat_sessions WHERE project_path = ? AND backend = ? AND is_sub_session = 0
```

### Sub-session Lifecycle

1. Created with `is_sub_session=1`, `parent_session_id=main_session_id`, `workflow_id=workflow_instance_id`
2. NOT counted toward `max_count`
3. NOT returned by `GET /api/ai/sessions` (WHERE is_sub_session = 0)
4. Deleted 5 minutes after workflow completion (delayed cleanup for viewing)
5. Deleted immediately on workflow cancellation
6. Orphaned sub-sessions cleaned on server startup

### Sub-session Limit

New config `workflow.max_sub_sessions` (default: 20) prevents resource exhaustion from concurrent workflows.

## Error Handling & Timeout

### Step Error Types

| Type | Cause | Handling |
|------|-------|----------|
| `startup_fail` | CLI process won't start | Mark step failed, skip downstream |
| `crash` | CLI exits with non-zero code | Mark step failed, skip downstream |
| `timeout` | Step exceeds time limit | Kill process, mark step failed, skip downstream |
| `idle_timeout` | No SSE events for N minutes | Kill process, mark step failed, skip downstream |
| `cancelled` | User cancels workflow | Stop all running steps, cleanup |
| `empty_input` | Interpolated dependency output is empty | Mark step failed, skip downstream |

### Cascade Skip Logic

When a step fails, all downstream dependents are marked `skipped`:

```go
func (s *Scheduler) handleStepFailure(stepID string, err StepError) {
    instance.StepStates[stepID].Status = Failed
    instance.StepStates[stepID].Error = err.Message

    for _, step := range instance.Definition.Steps {
        if contains(step.DependsOn, stepID) {
            instance.StepStates[step.ID].Status = Skipped
            instance.StepStates[step.ID].Error = "前置步骤 " + stepID + " 失败"
        }
    }

    if !s.hasRunnableSteps(instance) {
        instance.Status = WorkflowFailed
    }
}
```

### Three-Level Timeout

| Level | Config Key | Default | Description |
|-------|-----------|---------|-------------|
| Per-step | `workflow.step_timeout` | 10m | Max time for a single step |
| Whole workflow | `workflow.total_timeout` | 60m | Max time for entire workflow |
| SSE idle | `workflow.idle_timeout` | 3m | Max time with no SSE events during a step |

```go
func (e *Executor) Execute(ctx context.Context, step WorkflowStep, ...) (*StepState, error) {
    stepCtx, stepCancel := context.WithTimeout(ctx, cfg.Workflow.StepTimeout)
    defer stepCancel()

    cmd := exec.CommandContext(stepCtx, ...)

    // Idle detection goroutine
    idleTimer := time.NewTimer(cfg.Workflow.IdleTimeout)
    go func() {
        for {
            select {
            case <-idleTimer.C:
                stepCancel()
            case <-eventCh:
                idleTimer.Reset(cfg.Workflow.IdleTimeout)
            case <-stepCtx.Done():
                idleTimer.Stop()
                return
            }
        }
    }()
}
```

### Partial Failure UI

```
┌──────────────────────────────────┐
│ 🔄 登录页面设计与实现              │
│ ✅ design    🎨 设计师   12s      │
│ ❌ backend   🛠 OpenCode  超时    │ ← red, click for error details
│ ⏭ frontend  🔧 勤杂工   已跳过    │ ← gray
│ ⏭ test      🛠 OpenCode  已跳过    │
│                                  │
│ ⚠️ 工作流执行失败                  │
│ [重试失败步骤]  [关闭]             │
└──────────────────────────────────┘
```

### Retry Mechanism

```go
func (s *Scheduler) RetryFailed(instance *WorkflowInstance) {
    failedSteps := filterByStatus(instance, Failed)
    downstream := getDownstream(instance, failedSteps...)

    // Reset failed + downstream to pending
    for _, step := range append(failedSteps, downstream) {
        instance.StepStates[step.ID].Status = Pending
        instance.StepStates[step.ID].Output = ""
        instance.StepStates[step.ID].Error = ""
    }

    // Re-run (completed steps keep their output, not re-executed)
    s.Run(instance)
}
```

New API: `POST /api/ai/workflow/{id}/retry`

## Cleanup Strategy

| Trigger | Action |
|---------|--------|
| Workflow completed | Delete sub-sessions + messages after 5 min delay |
| Workflow cancelled | Delete sub-sessions + messages immediately |
| Server restart | Scan for orphaned sub-sessions (workflow_id not in memory), delete all |
| User viewing | Reset cleanup timer when user views step output in drawer |

Startup cleanup query:

```sql
DELETE FROM chat_history WHERE session_id IN (
    SELECT id FROM chat_sessions WHERE is_sub_session = 1
);
DELETE FROM chat_sessions WHERE is_sub_session = 1;
```

## AI Prompt Engineering

### agent_common_prompt.md Addition

```markdown
## Multi-Agent Workflow (Highest Priority)

When the user triggers workflow mode (indicated by `workflow_mode: true` in the request), you MUST analyze the task and generate a workflow definition instead of executing it yourself.

**Workflow generation rules:**

1. Analyze the task, identify subtasks that can benefit from different agents' specialties
2. Output a `<workflow-definition>` tag containing a JSON DAG
3. do NOT execute any of the subtasks yourself — only plan and delegate
4. Each step's prompt must be self-contained — the assigned agent sees ONLY that prompt, not the full conversation
5. Use `{{stepId.output}}` to reference outputs from prerequisite steps
6. Maximize parallelism: steps with no dependency on each other MUST have empty `depends_on`
7. Minimize steps: do NOT create unnecessary steps. 2-5 steps is typical

**DAG constraints:**
- No cycles in `depends_on`
- All referenced step IDs must exist in the steps array
- All `agent_id` values must be from the available agents list
- `{{stepId.output}}` can only reference steps listed in `depends_on`
- `summary_agent_id` should be your own agent ID

**Output format:**

<workflow-definition>
{
  "title": "Concise workflow title",
  "description": "One-line goal",
  "steps": [
    {
      "id": "unique_short_id",
      "agent_id": "agent_id_from_available_list",
      "prompt": "Self-contained instruction for this step. Use {{otherStep.output}} if you need prior results.",
      "depends_on": [],
      "parallel": true
    }
  ],
  "summary_agent_id": "your_own_agent_id"
}
</workflow-definition>

**Agent specialty reference:**
{{AVAILABLE_AGENTS}}

**Important:**
- Only generate workflows when `workflow_mode: true` — for normal conversations, respond directly
- If a task is simple enough for a single agent, explain why and suggest using normal mode instead
- Never put more than 6 steps in a workflow — if the task is that complex, break it into multiple workflows
```

### Handler Prompt Injection

In `buildChatRequest`, when `workflow_mode: true`:

```go
if workflowMode {
    chatReq.SystemPrompt += "\n\n" + model.WorkflowModePrompt
}
```

### JSON Parse Error Recovery

If AI generates invalid JSON:

1. Do NOT show error to user
2. Insert a warning message in chat: "工作流定义格式有误，正在尝试修复..."
3. Send original output + error back to same agent for correction
4. Max 1 retry; if still fails, fall back to normal chat mode with a hint

```go
func ParseDefinition(content string) (*WorkflowDefinition, error) {
    raw := extractTag(content, "workflow-definition")
    if raw == "" {
        return nil, ErrNoWorkflowTag
    }

    raw = cleanJSON(raw)  // strip markdown code fences, trailing commas, comments

    var def WorkflowDefinition
    if err := json.Unmarshal([]byte(raw), &def); err != nil {
        return nil, fmt.Errorf("invalid workflow JSON: %w", err)
    }

    if err := validateDAG(def); err != nil {
        return nil, err
    }

    for _, step := range def.Steps {
        if _, ok := model.Agents[step.AgentID]; !ok {
            return nil, fmt.Errorf("unknown agent_id: %s", step.AgentID)
        }
    }

    return &def, nil
}
```

## Configuration

### config.yaml

```yaml
workflow:
  enabled: true                  # Enable workflow feature, default true
  step_timeout: 10m              # Per-step timeout
  total_timeout: 60m             # Whole-workflow timeout
  idle_timeout: 3m               # SSE idle timeout during step execution
  max_sub_sessions: 20           # Total sub-session limit across all workflows
  max_steps: 6                   # Max steps per workflow
  retry_limit: 1                 # Failed step retry count
  cleanup_delay: 5m              # Delay before cleaning up sub-sessions after completion
```

### Go Config Struct

```go
type WorkflowConfig struct {
    Enabled        bool          `yaml:"enabled"         json:"enabled"`
    StepTimeout    time.Duration `yaml:"step_timeout"    json:"stepTimeout"`
    TotalTimeout   time.Duration `yaml:"total_timeout"   json:"totalTimeout"`
    IdleTimeout    time.Duration `yaml:"idle_timeout"    json:"idleTimeout"`
    MaxSubSessions int           `yaml:"max_sub_sessions" json:"maxSubSessions"`
    MaxSteps       int           `yaml:"max_steps"       json:"maxSteps"`
    RetryLimit     int           `yaml:"retry_limit"     json:"retryLimit"`
    CleanupDelay   time.Duration `yaml:"cleanup_delay"   json:"cleanupDelay"`
}
```

### Defaults (defaults.go)

```go
// Use presence map pattern: enabled defaults to true
if cfg.Workflow.StepTimeout == 0 {
    cfg.Workflow.StepTimeout = 10 * time.Minute
}
if cfg.Workflow.TotalTimeout == 0 {
    cfg.Workflow.TotalTimeout = 60 * time.Minute
}
if cfg.Workflow.IdleTimeout == 0 {
    cfg.Workflow.IdleTimeout = 3 * time.Minute
}
if cfg.Workflow.MaxSubSessions == 0 {
    cfg.Workflow.MaxSubSessions = 20
}
if cfg.Workflow.MaxSteps == 0 {
    cfg.Workflow.MaxSteps = 6
}
if cfg.Workflow.RetryLimit == 0 {
    cfg.Workflow.RetryLimit = 1
}
if cfg.Workflow.CleanupDelay == 0 {
    cfg.Workflow.CleanupDelay = 5 * time.Minute
}
```

## Phased Implementation Plan

### Phase 1: Minimum Viable (1-2 days)

End-to-end sequential workflow, validate core data path.

| Task | Scope |
|------|-------|
| DB schema (new columns in CREATE TABLE, remove ALTER TABLE migrations) | `model/`, `service/database.go` |
| WorkflowConfig + defaults | `model/config.go`, `model/defaults.go` |
| Workflow package skeleton: model + parser | `internal/workflow/model.go`, `parser.go` |
| Sequential scheduler (no parallelism) | `internal/workflow/scheduler.go` |
| Step executor | `internal/workflow/executor.go` |
| Handler integration: tag detection + new APIs | `handler/chat_stream.go`, `handler/workflow.go` |
| New SSE event types | `handler/chat_stream.go` |
| Frontend: input bar button + workflowMode | `ChatInputBar.vue`, `useWorkflow.ts` |
| Frontend: confirm card | `WorkflowConfirmCard.vue` |

**Acceptance**: User clicks 🔄 → describes task → AI outputs `<workflow-definition>` → confirm card → user confirms → backend executes sequentially → main session receives summary. No side drawer yet.

### Phase 2: Parallel Execution + Side Drawer (1 day)

| Task | Scope |
|------|-------|
| Parallel scheduling: topological sort + goroutine concurrency | `workflow/scheduler.go` |
| Frontend: WorkflowDrawer side drawer | `WorkflowDrawer.vue`, `WorkflowStepItem.vue` |
| Frontend: step real-time output view | `WorkflowStepDetail.vue` |
| Sub-session messages query API | `handler/workflow.go` |
| SSE step_content event relay | `handler/chat_stream.go` |

**Acceptance**: Independent steps run in parallel (frontend shows multiple steps running simultaneously). Side drawer shows step status and real-time output. Sub-sessions not visible in session list.

### Phase 3: Robustness + UX (1 day)

| Task | Scope |
|------|-------|
| Three-level timeout mechanism | `workflow/executor.go` |
| Partial failure + retry | `workflow/scheduler.go`, `handler/workflow.go` |
| Sub-session cleanup (delayed + startup) | `workflow/scheduler.go`, `service/database.go` |
| JSON parse error recovery + auto-retry generation | `workflow/parser.go`, `handler/chat_stream.go` |
| agent_common_prompt.md workflow instructions | `config/agent_common_prompt.md` |
| Sub-session count limit check | `workflow/scheduler.go` |
| WorkflowDrawer retry button | `WorkflowDrawer.vue` |

**Acceptance**: Step timeout correctly terminates process, downstream marked skipped. Partial failure is retriable. Server restart cleans orphaned sub-sessions. Malformed AI JSON auto-retries once.

### Phase 4: Config + Polish (0.5 day)

| Task | Scope |
|------|-------|
| config.example.yaml workflow section | `config/config.example.yaml` |
| workflow.enabled toggle | `handler/chat_stream.go`, `ChatInputBar.vue` |
| Hide button when enabled=false | `ChatInputBar.vue` |

**Total estimate**: 3.5-4.5 days

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI generates unstable JSON | High workflow parse failure rate | Lenient parsing + 1 auto-retry + fallback to normal chat |
| Parallel step resource usage | Multiple CLI processes consume memory | `max_sub_sessions` limit + `step_timeout` |
| Mixed SSE stream events | Workflow and chat events interleaved | All events carry `instance_id` + `step_id`, frontend filters |
| Interpolation circular reference | Steps reference each other causing infinite expansion | DAG validation: only allow referencing `depends_on` steps |
