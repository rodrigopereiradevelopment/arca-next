<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# arca-next — API Backend

```bash
npm run dev          # Usa --webpack (NÃO turbopack)
npm run build        # Build de produção
```

- App Router em `app/api/**/route.ts`
- **Prisma ORM v7** — `prisma/schema.prisma` (models Produto, Categoria), config em `prisma.config.ts`, driver adapter `@prisma/adapter-pg` + `pg`
- Exige `.env.local` com: `MONGODB_URI`, `MONGODB_DB_NAME`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `SYNC_SECRET`, `DATABASE_URL`
- Singleton Prisma em `lib/db/prisma.ts` (global caching, query logging em dev)
- Endpoints: `/api/produtos/search`, `/api/produtos/preco`, `/api/produtos/preco-similar`, `/api/auth/*`, `/api/chat`, `/api/health`
- Deploy automático na Vercel via `git push`
- Sem infra de testes configurada

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **arca-next** (448 symbols, 742 relationships, 21 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/arca-next/context` | Codebase overview, check index freshness |
| `gitnexus://repo/arca-next/clusters` | All functional areas |
| `gitnexus://repo/arca-next/processes` | All execution flows |
| `gitnexus://repo/arca-next/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
