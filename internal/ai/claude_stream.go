package ai

// buildClaudeStreamArgs constructs the CLI arguments for Claude streaming
func buildClaudeStreamArgs(req ChatRequest) []string {
	args := []string{
		"--print",
		"--output-format", "stream-json",
		"--verbose",
		"--include-partial-messages",
	}

	if req.Resume {
		args = append(args, "--resume", req.SessionID)
	} else if req.SessionID != "" {
		args = append(args, "--session-id", req.SessionID)
	}

	if req.WorkDir != "" {
		args = append(args, "--add-dir", req.WorkDir)
	}
	args = append(args, "--dangerously-skip-permissions")

	// Disable built-in scheduling/timer tools to force use of ClawBench's
	// <schedule-proposal> mechanism instead of native CronCreate/CronDelete/CronList.
	// Use comma-separated format — Claude CLI treats space-separated values as
	// additional positional arguments, swallowing the prompt.
	args = append(args, "--disallowedTools", "CronCreate,CronDelete,CronList")

	if req.SystemPrompt != "" {
		args = append(args, "--system-prompt", req.SystemPrompt)
	}

	// Pass model name if per-request override is set
	if req.Model != "" {
		args = append(args, "--model", req.Model)
	}

	if req.Resume {
		// With --resume, prompt is read from stdin
	} else {
		// With --session-id, prompt is read from stdin (not positional arg).
		// Claude CLI in --print mode with piped stdout does not accept
		// positional prompt arguments — stdin is required.
	}

	return args
}
