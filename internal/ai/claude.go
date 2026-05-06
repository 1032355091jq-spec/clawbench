package ai

import (
	"os/exec"
	"strings"
)

// claudeBackend is the CLIBackend instance for Claude CLI.
var claudeBackend = &CLIBackend{
	name:           "claude",
	defaultCommand: "claude",
	buildArgs:      buildClaudeStreamArgs,
	newParser:      func() LineParser { return &StreamParser{} },
	filterLine:     nil, // skip empty lines only (default)
	preStart: func(cmd *exec.Cmd, req ChatRequest) {
		// Claude CLI in --print mode with stdout piped (non-TTY) requires prompt
		// via stdin — positional prompt argument is not recognized.
		// Both new sessions and resume sessions use stdin for prompt.
		cmd.Stdin = strings.NewReader(req.Prompt)
	},
}
