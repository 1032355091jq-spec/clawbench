# Agent Auto-Discovery Design

## Overview

When ClawBench starts with no agent configurations (empty `config/agents/` directory or all YAML parsing failed), automatically detect installed AI CLI tools on the system and generate agent YAML files. This is a one-time generation — once any agents exist, the user owns the configuration.

## Trigger Condition

After `model.LoadAgents(agentsDir)` returns, if `len(model.AgentList) == 0`, trigger auto-discovery.

This is more lenient than checking for `.yaml` file existence — it covers directory missing, directory empty, all YAMLs invalid, all YAMLs deleted, etc.

## Flow

```
main.go startup
  → LoadAgents(agentsDir)
  → if len(AgentList) == 0
      → DiscoverAgents(agentsDir)
          → mkdirAll(agentsDir) if not exists
          → iterate BackendRegistry (7 backends)
          → for each: run {command} --version (5s timeout)
          → available: write {id}.yaml to agentsDir
          → unavailable: skip, log
      → LoadAgents(agentsDir)  // reload with generated files
  → continue normal startup
```

## CLI Detection

Each backend is detected by running `{defaultCommand} --version` with a 5-second timeout. Exit code 0 = available. Any error (command not found, timeout, non-zero exit) = skip.

All 7 CLIs support `--version` (verified on the development system):

| Backend | DefaultCmd | `--version` output example |
|---------|-----------|---------------------------|
| claude | `claude` | `2.1.138 (Claude Code)` |
| codebuddy | `codebuddy` | `2.94.2` |
| opencode | `opencode` | `1.14.33` |
| gemini | `gemini` | `0.39.1` |
| codex | `codex` | `0.57.0` |
| qoder | `qodercli` | `0.2.6` |
| vecli | `vecli` | `0.1.31` |

No fallback to `--help` needed — `--version` is universally supported.

Detection runs the command directly (not `LookPath`), inheriting the process environment. API keys, PATH, and other env vars are naturally available if configured. No special env handling.

## Backend Registry

Defined in `internal/model/discovery.go` as `BackendSpec`:

```go
type BackendSpec struct {
    ID        string // agent id, e.g. "claude"
    Backend   string // backend type, e.g. "claude"
    DefaultCmd string // command to detect, e.g. "claude"
    Name      string // display name, e.g. "Claude"
    Icon      string // emoji, e.g. "🤖"
    Specialty string // description, e.g. "代码编写与推理"
}
```

Default values for all 7 backends:

| ID | Backend | DefaultCmd | Name | Icon | Specialty |
|----|---------|-----------|------|------|-----------|
| claude | claude | `claude` | Claude | 🤖 | 代码编写与推理 |
| codebuddy | codebuddy | `codebuddy` | Codebuddy | 🐛 | 全栈开发助手 |
| opencode | opencode | `opencode` | OpenCode | 📟 | 终端编码工具 |
| gemini | gemini | `gemini` | Gemini | 💎 | 多模态推理 |
| codex | codex | `codex` | Codex | 🐙 | OpenAI 编码代理 |
| qoder | qoder | `qodercli` | Qoder | ⚡ | AI 编码助手 |
| vecli | vecli | `vecli` | VeCLI | 🌿 | 字节跳动 AI 助手 |

## Generated YAML Format

Example (`claude.yaml`):

```yaml
id: claude
name: Claude
icon: 🤖
specialty: 代码编写与推理
backend: claude
models: []
system_prompt: ""
```

- `models: []` — V1 does not scan models; CLI uses its default model
- `system_prompt: ""` — `BuildCommonPrompt` injects `rules.md` automatically, so every agent gets the common rules at minimum
- `command` omitted — uses `defaultCommand` from `CLIBackend`
- Filename = `{id}.yaml`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| agentsDir does not exist | `os.MkdirAll(agentsDir, 0755)` then proceed |
| Single YAML write fails | `slog.Warn`, skip that agent, continue others |
| All CLIs not found | 0 agents generated, same as current behavior (server starts, chat unavailable) |
| CLI exists but unrelated binary | Accept the risk — user is responsible for their PATH |

## Logging

```
slog.Info("no agents found, starting auto-discovery")
slog.Info("discovered CLI", "backend", "claude", "command", "claude")
slog.Info("skipped CLI not found", "backend", "opencode", "command", "opencode")
slog.Info("auto-discovery complete", "generated", 2, "skipped", 5)
```

## File Changes

**New file:** `internal/model/discovery.go`
- `BackendSpec` struct
- `BackendRegistry` variable (7 entries)
- `DiscoverAgents(dir string) error`
- `checkCLIExists(cmd string) bool`
- `generateAgentYAML(spec BackendSpec) ([]byte, error)`

**Modified file:** `cmd/server/main.go`
- After `LoadAgents(agentsDir)`, add empty check
- Call `model.DiscoverAgents(agentsDir)` + second `LoadAgents(agentsDir)`

**Unchanged:** `LoadAgents`, `BuildCommonPrompt`, `ai.NewBackend`, all existing backend code

## Future Enhancement

`BackendSpec` includes a reserved `ScanModels func(cmd string) ([]AgentModel, error)` field (nil in V1). When model scanning is needed:
- `claude`: `claude --list-models` or Anthropic API (`/v1/models`)
- `codebuddy`: `codebuddy --list-models` or local config parsing
- `gemini`: Gemini API model listing
- Others: best-effort or nil

Scan failures always degrade gracefully to empty `models: []`.
