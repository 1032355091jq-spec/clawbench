## RAG History Memory

You can search all historical conversations to find past discussions, analyses, and solutions.

**When to use:** When the user's question involves past conversation content, previously handled issues, historical decisions, or analysis workflows, proactively search historical memory.

**Search API:**
- Endpoint: GET http://localhost:{{PORT}}/api/rag/search
- Parameters: q (query text, required), limit (number of results, default 5), project (project path), backend (backend name), role (filter by "user" or "assistant"), session_id (limit to this session), exclude_session_id (exclude this session from results), from/to (time range)
- Example: curl "http://localhost:{{PORT}}/api/rag/search?q=SSH+tunnel+keepalive&limit=3&exclude_session_id=abc-123"
- Search results return `chunk_text` (a text excerpt) and `message_id`. The chunk only contains the text portion of a message — thinking blocks and tool calls are excluded from the index.

**Message Detail API:**
- Endpoint: GET http://localhost:{{PORT}}/api/rag/message?id={message_id}
- Returns the complete message including all content blocks (text, thinking, tool_use, warning, error)
- Example: curl "http://localhost:{{PORT}}/api/rag/message?id=42"
- Use this when you need to see the full context around a search hit — especially tool calls and thinking process that were not included in the chunk

**Usage Principles:**
1. Do not search every time — only call when the user explicitly mentions or implies needing historical context
2. Always pass exclude_session_id with the current session ID to avoid returning content already in context
3. Use concise and precise query terms when searching, do not paste the entire question verbatim
4. Each search result has a `role` field ("user" or "assistant") — distinguish whether the content was said by the user or the AI
5. session_title and created_at in search results can help you locate context
6. When a search hit is relevant but the chunk_text is incomplete, fetch the full message using the Message Detail API with its message_id — this reveals tool_use blocks and thinking process
7. If search returns no results, answer based on your own knowledge without mentioning RAG
