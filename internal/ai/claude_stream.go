package ai

// buildClaudeStreamArgs constructs the CLI arguments for Claude streaming
func buildClaudeStreamArgs(req ChatRequest) []string {
	return buildBaseStreamArgs(req, func(r ChatRequest) []string {
		return []string{"--verbose"}
	})
}
