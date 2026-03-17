# protoAgent-starter

AI agent framework — build, compose, and deploy AI agents with prompt management, flow orchestration, and tool integration.

## Architecture

pnpm monorepo with Turborepo. 8 packages under `packages/`:

| Package | Name | Purpose |
|---------|------|---------|
| `app` | proto-agent-app | React frontend (Vite) |
| `server` | proto-agent-server | Express API backend |
| `flows` | proto-agent-flows | LangGraph state graphs, routers, reducers |
| `prompts` | proto-agent-prompts | Git-versioned prompt templates with section composition |
| `tools` | proto-agent-tools | Standalone tools — deploy across MCP, LangGraph, Express |
| `mcp` | proto-agent-mcp | MCP server integration |
| `tracing` | proto-agent-tracing | Observability — Langfuse tracing + file-based logging |
| `ui` | proto-agent-ui | Shared UI components |

## Git Workflow

- **Single branch flow:** `feature/* → main` (no dev/staging branches)
- PRs target `main` directly
- Squash merge strategy
- CI must pass before merge

## Commands

```bash
pnpm dev          # Start server + app in dev mode
pnpm build        # Build all packages (respects Turbo dependency graph)
pnpm typecheck    # TypeScript type checking
pnpm test         # Run tests
pnpm lint         # Run ESLint
pnpm format       # Format with Prettier
pnpm format:check # Check formatting
```

## Conventions

- **Package manager:** pnpm (v10.18.2) — never use npm or yarn
- **Node:** >=20
- **TypeScript:** strict mode, composite project references
- **Formatting:** Prettier (enforced via pre-commit hook with Husky + lint-staged)
- **Imports:** Use package names (`proto-agent-flows`, `proto-agent-tools`, etc.) for cross-package imports
- **Build order:** Turbo handles dependency graph — `build` and `typecheck` depend on `^build`
