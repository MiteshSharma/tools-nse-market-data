# tools-nse-market-data

NSE India market data package — historical OHLCV in SQLite, daily sync, watchlist, screener, and technical indicators. Published to npm as `@ethosagent/tools-nse-market-data`.

## Implementation plan

Read `tools-nse-market-data.md` first — the full spec is there. Every file, every method signature, every SQL table, every tool definition is documented. Implement from that doc, not from memory.

## What this is

Standalone npm package. Not a monorepo. No worktrees needed — work directly in this directory.

Three layers:
- `src/store.ts` — `MarketDataStore` class (SQLite, no ethos dependency)
- `src/fetcher.ts` — Yahoo Finance HTTP fetching
- `src/tools.ts` — Ethos `Tool[]` wrappers around the store
- `src/cli.ts` — standalone CLI (`nse-market-data` binary)

## Commands

```bash
npm install        # install deps
npm run build      # tsup → dist/
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # biome check .
npm run lint:fix   # biome check --write .
npm run check      # typecheck + lint + test (run before declaring done)
```

## Sandbox

This repo lives at `/Users/mitesh/personal/sandbox/tools-nse-market-data/` inside the sandbox shared directory. Edit files directly — no git, no worktrees. Use `make check` before declaring any task done.

## Key conventions

- **Extensionless imports only**: `import './store'` not `import './store.ts'` or `import './store.js'`
- **No `console.log` in library code** — `store.ts`, `fetcher.ts`, `indicators.ts`, `tools.ts` must be silent. `console.log` is allowed only in `cli.ts`.
- **better-sqlite3 is synchronous** — public methods may be `async` for API consistency but never `await` inside `.run()`, `.prepare()`, or `.exec()` calls
- **STRICT SQLite tables** — column types enforced: use `INTEGER` for volume (not `REAL`), `TEXT` for dates, `REAL` for prices
- **Tool results**: every `execute()` must return `{ ok: true; value: string }` or `{ ok: false; error: string; code: string }`
- **Rate limit Yahoo Finance**: 100ms minimum between HTTP calls — enforced in `fetcher.ts` via module-level timestamp tracking
- **User-Agent required**: Yahoo Finance blocks requests without a browser-like User-Agent

## Testing

- Use `':memory:'` as the SQLite path in all store tests — no temp files, no cleanup needed
- Mock `globalThis.fetch` in fetcher tests — never hit real Yahoo Finance in CI
- Test RSI against known values (period=14, Wilder's smoothing, see plan for exact algorithm)
- Exit gate for each phase: check the plan's "Implementation Phases" section

## NSE symbols

Append `.NS` for NSE (e.g. `RELIANCE.NS`), `.BO` for BSE. Index: `^NSEI` for Nifty 50 index price. The built-in symbol list is in `src/symbols.ts`.

## Publishing

Tag-based: `git tag v0.x.y && git push --tags` triggers GitHub Actions → npm publish.
Always update `CHANGELOG.md` and `package.json` version before tagging.
Run `npm run build` and verify `dist/` before publishing.

## Git safety

- Never commit directly to main without user confirmation
- Never run destructive git operations without confirmation
- Always run `npm run check` before declaring a task done
