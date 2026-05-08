---
name: rag-search
description: Search historical conversations for past decisions and analyses
condition: rag.enabled
triggers:
  - Searching past conversations or discussions
  - Finding previously handled issues or decisions
  - User mentions "before", "last time", "previously discussed"
  - Needing historical context to understand a current issue
---

## RAG History Memory

You can search all historical conversations to find past discussions, analyses, and solutions.

**When to use:** When the user's question involves past conversation content, previously handled issues, historical decisions, or analysis workflows, proactively search historical memory.

## CLI Reference

All commands use `clawbench rag` and output JSON to stdout. Run them via the Bash tool.

### Search

```bash
clawbench rag search -q "QUERY" [--limit N] [--project PATH] [--backend NAME] [--role ROLE] [--session-id ID] [--exclude-session-id ID] [--from TIME] [--to TIME]
```

- `-q` (required): Search query text
- `--limit`: Number of results (default from config, typically 5)
- `--project`: Filter by project path
- `--backend`: Filter by backend name
- `--role`: Filter by role (`user` or `assistant`)
- `--session-id`: Limit results to this session
- `--exclude-session-id`: Exclude this session from results
- `--from` / `--to`: Time range filter

**Response:** `{"results": [{"chunk_text": "...", "score": 0.85, "session_id": "...", "session_title": "...", "message_id": 42, "role": "assistant", ...}], "total": 3}`

Search results return `chunk_text` (a text excerpt) and `message_id`. The chunk only contains the text portion of a message — thinking blocks and tool calls are excluded from the index.

### Message Detail

```bash
clawbench rag message --id MESSAGE_ID
# or: clawbench rag message MESSAGE_ID
```

Returns the complete message including all content blocks (text, thinking, tool_use, warning, error). Use this when you need to see the full context around a search hit — especially tool calls and thinking process that were not included in the chunk.

### Session

```bash
clawbench rag session --id SESSION_ID
# or: clawbench rag session SESSION_ID
```

Returns all messages in a session (complete conversation including user messages, AI responses with thinking and tool_use blocks). Use this when you need the full conversation flow around a search hit — e.g., to understand the complete problem-solving process.

**Response:** `{"session_id": "...", "messages": [...], "total": 15}`

## Usage Tips

1. Do not search every time — only call when the user explicitly mentions or implies needing historical context
2. Use concise and precise query terms when searching, do not paste the entire question verbatim
3. Each search result has a `role` field ("user" or "assistant") — distinguish whether the content was said by the user or the AI
4. `session_title` and `created_at` in search results can help you locate context
5. When a search hit is relevant but the `chunk_text` is incomplete, fetch the full message using `clawbench rag message` with its `message_id` — this reveals tool_use blocks and thinking process
6. For deeper context, use `clawbench rag session` with `session_id` to retrieve the entire conversation — this shows the full problem-solving flow including all user messages, AI reasoning, and tool interactions
