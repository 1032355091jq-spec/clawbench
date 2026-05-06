package ai

import (
	"os/exec"
	"strings"
)

// codebuddyBackend is the CLIBackend instance for Codebuddy CLI.
var codebuddyBackend = &CLIBackend{
	name:           "codebuddy",
	defaultCommand: "codebuddy",
	buildArgs:      buildCodebuddyStreamArgs,
	newParser:      func() LineParser { return &StreamParser{} },
	filterLine: func(line string) (string, bool) {
		line = strings.TrimPrefix(line, "\xEF\xBB\xBF") // UTF-8 BOM
		if line == "" {
			return "", false
		}
		return line, true
	},
	preStart: func(cmd *exec.Cmd, req ChatRequest) {
		// Codebuddy CLI in --print mode with stdout piped (non-TTY) requires
		// prompt via stdin — positional prompt argument is not recognized.
		// Both new sessions and resume sessions use stdin for prompt.
		cmd.Stdin = strings.NewReader(req.Prompt)
	},
}
