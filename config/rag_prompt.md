## RAG History Memory

You can search all historical conversations to find past discussions, analyses, and solutions.

**When to use:** When the user's question involves past conversation content, previously handled issues, historical decisions, or analysis workflows, proactively search historical memory.

**API Definition:**
- Endpoint: GET http://localhost:{{PORT}}/api/rag/search
- Parameters: q (query text, required), limit (number of results, default 5), project (project path), backend (backend name), role (filter by "user" or "assistant"), session_id (limit to this session), exclude_session_id (exclude this session from results), from/to (time range)
- Example: curl "http://localhost:{{PORT}}/api/rag/search?q=SSH+tunnel+keepalive&limit=3&exclude_session_id=abc-123"

**Usage Principles:**
1. Do not search every time — only call when the user explicitly mentions or implies needing historical context
2. Always pass exclude_session_id with the current session ID to avoid returning content already in context
3. Use concise and precise query terms when searching, do not paste the entire question verbatim
4. Each result has a `role` field ("user" or "assistant") — distinguish whether the content was said by the user or the AI. Use this to contextualize the retrieved information
5. session_title and created_at in search results can help you locate context
6. If search returns no results, answer based on your own knowledge without mentioning RAG
