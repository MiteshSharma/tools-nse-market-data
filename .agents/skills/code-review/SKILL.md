---
name: code-review
description: |
  Code review guidelines for tools-nse-market-data. Apply before declaring any implementation task done.
  Covers the self-review checklist, TypeScript-specific issues to catch, and SQLite-specific gotchas
  in this codebase.
---

# Code Review — tools-nse-market-data

## Self-review checklist (run before every task completion)

- [ ] `npm run check` passes (typecheck + lint + test)
- [ ] No `console.log` in library files (`store.ts`, `fetcher.ts`, `indicators.ts`, `tools.ts`)
- [ ] All imports are extensionless (`./store` not `./store.ts`)
- [ ] No unused imports or variables (biome will catch most, but check manually)
- [ ] New public methods have corresponding tests
- [ ] Tool `execute()` returns typed `ToolResult` — never throws, always catches

## TypeScript issues to catch

- `noUncheckedIndexedAccess` is on — `array[i]` is `T | undefined`, not `T`. Guard before use.
- `better-sqlite3` rows are `unknown` — cast explicitly after validating shape
- `zod` parse results: use `.safeParse()` not `.parse()` in tool execute() to avoid unhandled throws
- Peer dependency `@ethosagent/types` is optional — `tools.ts` must not import it at the top level; use dynamic import or local type re-declaration

## SQLite gotchas specific to this codebase

- **STRICT mode is on** — `INTEGER` columns reject `REAL` values. `volume` must be inserted as integer (`Math.round(v)`)
- **`better-sqlite3` is synchronous** — never `await` inside `.run()`. All async wrapping is purely for API surface, not actual async I/O
- **WAL mode** — set `db.pragma('journal_mode = WAL')` in constructor, before any queries
- **`SELECT *` does not include `rowid`** — if you need rowid for tie-breaking, select it explicitly: `SELECT *, rowid AS _row FROM ohlcv_daily`

## Yahoo Finance gotchas

- Timestamps in the chart response are **Unix seconds** (not ms) — multiply by 1000 before `new Date()`
- Convert to `YYYY-MM-DD` using **UTC methods** (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`) after adding IST offset (+5:30 = +19800 seconds)
- `volume` array can contain `null` for holidays — filter before inserting
- `open/high/low/close` arrays can also contain `null` on non-trading days — skip those rows

## Indicators gotchas

- RSI: first `period` values produce the seed average via simple mean; subsequent values use Wilder's smoothing. Never mix the two.
- EMA: seed from the first `period`-day SMA, then apply the multiplier. Never use 0 as seed.
- If fewer rows than `period`, return `[]` — do not throw.
