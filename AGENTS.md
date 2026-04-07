# Agent instructions (Spendly)

Next.js + Supabase (`@supabase/ssr`, `@supabase/supabase-js`). Use `.agents/skills/` when a skill matches the task.

## MCP (Cursor)

Use enabled servers instead of guessing docs or remote Supabase state.

| Server | ID | Use for |
|--------|-----|---------|
| **Context7** | `plugin-context7-plugin-context7` | Library/API/CLI docs (syntax, setup, config, migrations). Prefer over web search for that. Skip for refactors-only, generic CS, or business logic with no doc need. |
| **Supabase** | `plugin-supabase-supabase` | Linked Supabase project: orgs/projects, DB (tables, SQL, migrations, extensions), branches, Edge Functions, logs, advisors, URL/keys, generated types, `search_docs`. |

**Calls:** Read `mcps/<server>/tools/<tool>.json` before invoking. Authenticate if the server requires it; use `.env.example`, do not invent secrets.

**Split:** Context7 = “how does this API work?” · Supabase = “what’s on the project?” / run SQL or migrations.

**Skills:** `.agents/skills/supabase/SKILL.md` and `.agents/skills/context7-mcp/SKILL.md` when relevant.

If your MCP list differs, follow what is actually enabled.
