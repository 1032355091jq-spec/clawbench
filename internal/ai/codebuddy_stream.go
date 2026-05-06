package ai

// buildCodebuddyStreamArgs constructs the CLI arguments for Codebuddy streaming
func buildCodebuddyStreamArgs(req ChatRequest) []string {
	args := []string{
		"--print",
		"--output-format", "stream-json",
		"--include-partial-messages",
	}

	if req.Resume {
		args = append(args, "--resume", req.SessionID)
	} else {
		args = append(args, "--session-id", req.SessionID)
	}

	args = append(args, "--add-dir", req.WorkDir, "--dangerously-skip-permissions",
		"--disallowedTools", "CronCreate,CronDelete,CronList,ToolSearch,DeferExecuteTool")

	if req.SystemPrompt != "" {
		args = append(args, "--system-prompt", req.SystemPrompt)
	}

	// Pass model name if specified; otherwise let CLI use its default
	if req.Model != "" {
		args = append(args, "--model", req.Model)
	}

	if req.Resume {
		// With --resume, prompt is read from stdin
	} else {
		// With --session-id, prompt is read from stdin (not positional arg).
		// Codebuddy CLI in --print mode with piped stdout does not accept
		// positional prompt arguments — stdin is required.
	}

	return args
}
