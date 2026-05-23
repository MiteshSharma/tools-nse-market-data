# tools-nse-market-data — Implementation Plan

**Status:** Draft  
**Date:** 2026-05-23  
**Scope:** Standalone npm package; lives in its own git repo outside the ethos monorepo

---

## Table of Contents

1. [Overview](#1-overview)
2. [Repository Structure](#2-repository-structure)
3. [Tech Stack — Exact Versions](#3-tech-stack--exact-versions)
4. [package.json — Complete File](#4-packagejson--complete-file)
5. [tsconfig.json — Complete File](#5-tsconfigjson--complete-file)
6. [tsup.config.ts — Complete File](#6-tsupconfigts--complete-file)
7. [biome.json — Complete File](#7-biomejson--complete-file)
8. [SQLite Schema (schema.ts)](#8-sqlite-schema-schemats)
9. [MarketDataStore Class API (store.ts)](#9-marketdatastore-class-api-storets)
10. [fetcher.ts — Yahoo Finance HTTP Fetching](#10-fetcherts--yahoo-finance-http-fetching)
11. [bhavcopy.ts — NSE Bhavcopy Scaffold](#11-bhavcopysts--nse-bhavcopy-scaffold)
12. [indicators.ts — Technical Indicators](#12-indicatorsts--technical-indicators)
13. [CLI (cli.ts) — All Commands](#13-cli-clits--all-commands)
14. [Tools (tools.ts) — All 8 Tools](#14-tools-toolsts--all-8-tools)
15. [src/index.ts — Public API Barrel](#15-srcindexts--public-api-barrel)
16. [Testing Strategy](#16-testing-strategy)
17. [npm Publishing Setup](#17-npm-publishing-setup)
18. [Wiring into Ethos (3 Steps)](#18-wiring-into-ethos-3-steps)
19. [README.md Structure](#19-readmemd-structure)
20. [NSE500 Built-in Symbol List (symbols.ts)](#20-nse500-built-in-symbol-list-symbolsts)
21. [Implementation Phases with Exit Gates](#21-implementation-phases-with-exit-gates)

---

## 1. Overview

**Package name:** `tools-nse-market-data`  
**npm scope:** `@ethosagent/tools-nse-market-data`  
**npm registry:** https://registry.npmjs.org  
**License:** MIT

### Purpose

Provides NSE India stock market data tooling for AI agents. Core capabilities:

- Historical OHLCV (Open/High/Low/Close/Volume) data stored locally in SQLite
- Daily incremental sync from Yahoo Finance (`.NS` symbols)
- Watchlist management (add/remove/list symbols)
- Technical screener queries (volume surge, near 52-week high, etc.)
- Technical indicator computation (RSI, EMA, MACD, SMA)

### Ethos Integration

Exposes `createNseMarketDataTools()` returning `Tool[]` fully compatible with `@ethosagent/types`. Drop these tools into any ethos personality to give an AI agent the ability to manage a local market database and run analysis queries.

### Standalone Usage

Also works without ethos:

- **CLI:** `nse-market-data` binary for humans to manage the database directly
- **Direct API:** `MarketDataStore` class for Node.js scripts

### Design Constraints

- `@ethosagent/types` is an **optional peer dependency** — the store, CLI, and indicators work without it; only `createNseMarketDataTools()` requires it at runtime.
- All data is local-first: SQLite on the user's machine. No server, no cloud sync.
- Yahoo Finance is the primary data source (15-min delay on free tier). NSE Bhavcopy is scaffolded for future use.
- The package is published to npm and consumed by ethos as an external dependency installed with `pnpm add`.

---

## 2. Repository Structure

Create this exact file tree. Every file listed here must be created.

```
tools-nse-market-data/
├── .github/
│   └── workflows/
│       ├── ci.yml              # typecheck + lint + test on every PR/push
│       └── release.yml         # publish to npm on v* tag push
├── src/
│   ├── index.ts                # Public API barrel — all exports
│   ├── store.ts                # MarketDataStore class
│   ├── schema.ts               # SQL CREATE TABLE statements + migrate()
│   ├── fetcher.ts              # Yahoo Finance HTTP fetching
│   ├── bhavcopy.ts             # NSE Bhavcopy download (scaffold, TODO)
│   ├── indicators.ts           # RSI, EMA, SMA, MACD computed from OHLCV
│   ├── symbols.ts              # Built-in NSE Nifty 50 symbol list
│   ├── tools.ts                # Tool wrapper objects + createNseMarketDataTools()
│   └── cli.ts                  # Standalone CLI entry point (bin: nse-market-data)
├── src/__tests__/
│   ├── store.test.ts           # MarketDataStore unit tests (no network)
│   ├── fetcher.test.ts         # Fetcher tests with mocked fetch
│   └── indicators.test.ts      # Indicator math tests with known values
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── biome.json
├── .gitignore
├── .npmignore
├── CHANGELOG.md
├── LICENSE                     # MIT license text
└── README.md
```

### File purposes at a glance

| File | Role |
|------|------|
| `schema.ts` | Pure SQL strings + `migrate(db)` function. No business logic. |
| `store.ts` | Imports `schema.ts` and `fetcher.ts`. All DB reads/writes live here. |
| `fetcher.ts` | Pure HTTP — takes a symbol and date range, returns `OhlcvRow[]`. No DB access. |
| `bhavcopy.ts` | Scaffold with typed interfaces; all functions throw `'not implemented'`. |
| `indicators.ts` | Pure functions over `number[]`. No DB, no network. |
| `symbols.ts` | Constant arrays. No imports. |
| `tools.ts` | Imports `store.ts`. Creates singleton store, wraps each method in a `Tool` object. |
| `cli.ts` | Imports `store.ts` and `symbols.ts`. Uses `process.argv` directly (no CLI framework). |
| `index.ts` | Re-exports public surface. |

---

## 3. Tech Stack — Exact Versions

### Runtime dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | `^12.9.0` | Synchronous SQLite — WAL mode, STRICT tables |

### Development dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^6.0.0` | Language |
| `@types/better-sqlite3` | `^7.6.12` | Types for better-sqlite3 |
| `@types/node` | `^22.10.0` | Node.js built-in types |
| `zod` | `^4.3.6` | Schema validation for CLI args and fetcher responses |
| `tsup` | `^8.5.1` | ESM bundler (no build step in dev with tsx) |
| `vitest` | `^4.1.5` | Test runner |
| `@biomejs/biome` | `^2.4.13` | Lint + format (single quotes, 2-space indent) |

### Peer dependencies

```json
"peerDependencies": {
  "@ethosagent/types": ">=0.4.0"
},
"peerDependenciesMeta": {
  "@ethosagent/types": {
    "optional": true
  }
}
```

`@ethosagent/types` must NOT be in `dependencies` — it would create a second copy inside the consumer's `node_modules`. Only `tools.ts` imports from it, and only when the consumer has ethos installed.

### Node.js minimum

`>=24` — required for `import.meta.dirname`, native fetch, and TypeScript 6's ESM output.

---

## 4. package.json — Complete File

```json
{
  "name": "@ethosagent/tools-nse-market-data",
  "version": "0.1.0",
  "description": "NSE India market data tools for the Ethos AI agent framework — local SQLite OHLCV storage, daily sync, watchlist, and screener",
  "keywords": [
    "nse",
    "india",
    "stock-market",
    "market-data",
    "ohlcv",
    "ethos",
    "ai-agent",
    "sqlite",
    "yahoo-finance"
  ],
  "homepage": "https://github.com/MiteshSharma/tools-nse-market-data#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/MiteshSharma/tools-nse-market-data.git"
  },
  "bugs": {
    "url": "https://github.com/MiteshSharma/tools-nse-market-data/issues"
  },
  "license": "MIT",
  "author": "Mitesh Sharma",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./cli": {
      "import": "./dist/cli.js",
      "types": "./dist/cli.d.ts"
    }
  },
  "bin": {
    "nse-market-data": "./dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "prepublishOnly": "npm run build && npm run typecheck && npm run lint && npm run test"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.13",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.0",
    "tsup": "^8.5.1",
    "tsx": "^4.19.2",
    "typescript": "^6.0.0",
    "vitest": "^4.1.5",
    "zod": "^4.3.6"
  },
  "peerDependencies": {
    "@ethosagent/types": ">=0.4.0"
  },
  "peerDependenciesMeta": {
    "@ethosagent/types": {
      "optional": true
    }
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3"]
  }
}
```

**Note on `tsx` in devDependencies:** `tsx` is listed as a dev dependency so `npm run dev` works (`tsx src/cli.ts`). The compiled `dist/cli.js` does not depend on `tsx` at runtime.

---

## 5. tsconfig.json — Complete File

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "ignoreDeprecations": "6.0",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key choices:**

- `moduleResolution: "bundler"` — matches ethos conventions; tsup handles resolution
- `verbatimModuleSyntax: true` — required for TypeScript 6 strict ESM; forces `import type` for type-only imports
- `ignoreDeprecations: "6.0"` — suppresses TS6 deprecation warnings that would block compilation

---

## 6. tsup.config.ts — Complete File

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node24',
  splitting: false,
  sourcemap: true,
  external: ['@ethosagent/types'],
})
```

**Notes:**

- `external: ['@ethosagent/types']` — do NOT bundle the peer dependency; let the consumer's node_modules resolve it
- `splitting: false` — produces two self-contained files (`index.js`, `cli.js`) rather than shared chunks, which is correct for a library
- `dts: true` — generates `.d.ts` files alongside JS output

---

## 7. biome.json — Complete File

Matches ethos code style exactly: 2-space indent, single quotes, 100-char line width.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.13/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsole": {
          "level": "warn",
          "options": {
            "allow": ["warn", "error"]
          }
        }
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  },
  "files": {
    "includes": ["src/**/*.ts", "*.ts", "*.json", "!dist/", "!node_modules/"]
  }
}
```

**Note on `noConsole`:** `cli.ts` is the only file that may use `console.log` freely. All other files (`store.ts`, `fetcher.ts`, `tools.ts`, etc.) should use `console.warn` / `console.error` for exceptional cases only, never for normal output.

---

## 8. SQLite Schema (schema.ts)

### Full file contents

```typescript
import type Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Table definitions (STRICT mode enforces column types at insert time)
// ---------------------------------------------------------------------------

export const SQL_CREATE_INSTRUMENTS = `
  CREATE TABLE IF NOT EXISTS instruments (
    symbol    TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    exchange  TEXT NOT NULL DEFAULT 'NSE',
    sector    TEXT,
    isin      TEXT,
    added_at  INTEGER NOT NULL
  ) STRICT;
`

export const SQL_CREATE_OHLCV_DAILY = `
  CREATE TABLE IF NOT EXISTS ohlcv_daily (
    symbol    TEXT NOT NULL,
    date      TEXT NOT NULL,
    open      REAL NOT NULL,
    high      REAL NOT NULL,
    low       REAL NOT NULL,
    close     REAL NOT NULL,
    volume    INTEGER NOT NULL,
    adj_close REAL,
    PRIMARY KEY (symbol, date)
  ) STRICT;
`

export const SQL_CREATE_OHLCV_DATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON ohlcv_daily(date);
`

export const SQL_CREATE_SYNC_META = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    symbol    TEXT PRIMARY KEY,
    last_sync INTEGER NOT NULL,
    last_date TEXT NOT NULL
  ) STRICT;
`

export const SQL_CREATE_WATCHLIST = `
  CREATE TABLE IF NOT EXISTS watchlist (
    symbol    TEXT NOT NULL,
    list_name TEXT NOT NULL DEFAULT 'default',
    notes     TEXT,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (symbol, list_name)
  ) STRICT;
`

// ---------------------------------------------------------------------------
// migrate() — run once in MarketDataStore constructor
// ---------------------------------------------------------------------------

export function migrate(db: Database.Database): void {
  // Enable WAL mode for concurrent reads alongside writes
  db.pragma('journal_mode = WAL')

  // Enable foreign key enforcement (not used yet, but good practice)
  db.pragma('foreign_keys = ON')

  // Create all tables and indexes
  db.exec(SQL_CREATE_INSTRUMENTS)
  db.exec(SQL_CREATE_OHLCV_DAILY)
  db.exec(SQL_CREATE_OHLCV_DATE_INDEX)
  db.exec(SQL_CREATE_SYNC_META)
  db.exec(SQL_CREATE_WATCHLIST)
}
```

### Table descriptions

| Table | Purpose |
|-------|---------|
| `instruments` | Master list of symbols. Optional — populated as symbols are synced. Not required to exist before backfill. |
| `ohlcv_daily` | One row per (symbol, date). Primary key prevents duplicates on re-sync. `adj_close` is nullable because some symbols don't have adjusted close data. |
| `sync_meta` | Tracks when each symbol was last synced and its most-recent data date. Used by `updateSymbol()` to determine the gap to fill. Updated atomically with each sync. |
| `watchlist` | User's tracked symbols, organized by named lists. `list_name` defaults to `'default'`. Multiple list names per symbol are allowed. |

### STRICT mode note

`STRICT` mode is **critical**. Without it, SQLite silently coerces types (inserting a string `"252"` into an INTEGER column succeeds). With STRICT, mismatched types throw immediately. This catches bugs in the fetcher and store before they corrupt data. All four tables use it.

### WAL mode note

WAL (Write-Ahead Log) allows readers to access the database while a write is in progress. This matters because the CLI and the ethos tools may run concurrently (though it's uncommon). WAL also improves write throughput for batch inserts during backfill.

---

## 9. MarketDataStore Class API (store.ts)

### Type definitions

```typescript
export interface OhlcvRow {
  symbol: string
  date: string       // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  volume: number
  adjClose: number | null
}

export interface SyncResult {
  symbol: string
  rowsInserted: number
  fromDate: string   // YYYY-MM-DD — earliest date requested
  toDate: string     // YYYY-MM-DD — latest date fetched
}

export interface ScreenerRow {
  symbol: string
  close: number
  volume: number
  high52w: number
  low52w: number
  pctFrom52wHigh: number   // (high52w - close) / high52w * 100
  avgVolume20d: number
  volumeSurge: number      // volume / avgVolume20d
}

export interface WatchlistEntry {
  symbol: string
  notes: string | null
  addedAt: number          // unix ms
}
```

### Constructor

```typescript
export class MarketDataStore {
  constructor(dbPath: string)
}
```

**Behavior:**

1. Opens the SQLite database at `dbPath` using `better-sqlite3`. Automatically creates the file and parent directories if they do not exist.
2. Calls `migrate(db)` immediately — all tables and indexes are created on first open.
3. The database handle is stored as a private field.

**Implementation note:** To create parent directories automatically, use `mkdirSync(dirname(dbPath), { recursive: true })` before opening the database. This is one of the allowed `node:fs` exceptions (it's infrastructure, not `~/.ethos/` data access).

### Method reference

#### `close(): void`

Closes the SQLite database handle. Call this when the process exits or the store is no longer needed. After calling `close()`, all other methods will throw.

---

#### `clean(): { rowsDeleted: { ohlcv: number; watchlist: number; syncMeta: number } }`

Deletes all rows from `ohlcv_daily`, `watchlist`, and `sync_meta`. Does NOT drop tables. Returns counts of deleted rows.

```typescript
clean(): { rowsDeleted: { ohlcv: number; watchlist: number; syncMeta: number } }
```

**Implementation:** Use `DELETE FROM table_name` (not `DROP TABLE`). Wrap all three deletes in a single transaction for atomicity.

---

#### `backfillSymbol(symbol: string, fromDate: string): Promise<SyncResult>`

Downloads historical OHLCV data for a single symbol from `fromDate` to today and inserts into `ohlcv_daily`.

```typescript
backfillSymbol(symbol: string, fromDate: string): Promise<SyncResult>
```

**Parameters:**
- `symbol` — NSE symbol with `.NS` suffix (e.g. `'RELIANCE.NS'`). Caller is responsible for the suffix.
- `fromDate` — `YYYY-MM-DD` string. Fetch starts from this date.

**Behavior:**

1. Calls `fetchOhlcv(symbol, fromDate, today)` from `fetcher.ts`.
2. Inserts all returned rows using `INSERT OR REPLACE INTO ohlcv_daily` (upsert semantics — re-running a backfill is safe).
3. Updates `sync_meta` for the symbol: `last_sync = Date.now()`, `last_date = max(date)` from the inserted rows.
4. Upserts into `instruments` (symbol, name from fetcher metadata, exchange='NSE', added_at=Date.now()) using `INSERT OR IGNORE`.
5. Returns `{ symbol, rowsInserted, fromDate, toDate }`.

**Error handling:** If the fetcher throws (network error, symbol not found), propagate the error. The caller (`backfillAll`) catches it and continues with remaining symbols.

---

#### `backfillAll(symbols: string[], fromDate: string, onProgress?: (done: number, total: number, symbol: string) => void): Promise<SyncResult[]>`

Calls `backfillSymbol` for each symbol sequentially (not parallel — avoids Yahoo Finance rate limits).

```typescript
backfillAll(
  symbols: string[],
  fromDate: string,
  onProgress?: (done: number, total: number, symbol: string) => void
): Promise<SyncResult[]>
```

**Behavior:**

1. Iterates `symbols` in order.
2. For each symbol: calls `backfillSymbol(symbol, fromDate)`, then calls `onProgress(i + 1, symbols.length, symbol)`.
3. If `backfillSymbol` throws, logs the error to `console.warn` and continues. Errors do not stop the batch.
4. Returns array of successful `SyncResult` objects (failed symbols are omitted).

**Rate limiting:** Between each symbol, respect the 100ms minimum delay already enforced inside `fetcher.ts`. No additional delay needed in `backfillAll`.

---

#### `updateSymbol(symbol: string): Promise<SyncResult>`

Gap-fills from the last synced date to today for a single symbol.

```typescript
updateSymbol(symbol: string): Promise<SyncResult>
```

**Behavior:**

1. Reads `sync_meta` for `symbol`. If no row exists, treats `last_date` as 1 year ago (same as a fresh backfill).
2. Computes `fromDate = addDays(last_date, 1)` (the day after the last stored date).
3. If `fromDate > today`, returns early with `rowsInserted: 0` (already up to date).
4. Calls `backfillSymbol(symbol, fromDate)` and returns its result.

---

#### `updateWatchlist(): Promise<SyncResult[]>`

Calls `updateSymbol` for every symbol in the `watchlist` table (any list).

```typescript
updateWatchlist(): Promise<SyncResult[]>
```

**Behavior:** Reads distinct symbols from `watchlist`, calls `updateSymbol` for each sequentially, returns array of results. Same error-swallowing behavior as `backfillAll`.

---

#### `updateAll(): Promise<SyncResult[]>`

Calls `updateSymbol` for every symbol in the `sync_meta` table (all symbols ever synced).

```typescript
updateAll(): Promise<SyncResult[]>
```

**Behavior:** Reads all symbols from `sync_meta`, calls `updateSymbol` for each. Same as `updateWatchlist` but broader scope.

---

#### Watchlist methods

```typescript
watchlistAdd(symbol: string, listName?: string, notes?: string): void
watchlistRemove(symbol: string, listName?: string): void
watchlistList(listName?: string): WatchlistEntry[]
```

**`watchlistAdd`:**
- `listName` defaults to `'default'`
- Uses `INSERT OR REPLACE INTO watchlist` to handle duplicate adds gracefully
- `added_at` is `Date.now()`

**`watchlistRemove`:**
- `listName` defaults to `'default'`
- If the symbol is not in the watchlist, silently does nothing (no error)

**`watchlistList`:**
- `listName` defaults to `'default'`
- Returns all entries for that list, ordered by `added_at ASC`
- Returns `WatchlistEntry[]` with camelCase fields (`addedAt`, not `added_at`)

---

#### `getHistory(symbol: string, days?: number): OhlcvRow[]`

Returns the most recent `days` rows for `symbol` in chronological order (oldest first).

```typescript
getHistory(symbol: string, days?: number): OhlcvRow[]
```

**Parameters:**
- `days` defaults to `252` (approximately 1 trading year)

**Implementation:**

```sql
SELECT *
FROM (
  SELECT symbol, date, open, high, low, close, volume, adj_close
  FROM ohlcv_daily
  WHERE symbol = ?
  ORDER BY date DESC
  LIMIT ?
)
ORDER BY date ASC
```

Map `adj_close` → `adjClose` in the returned objects.

---

#### `screen(opts: { listName?: string; minVolumeSurge?: number; nearHighPct?: number }): ScreenerRow[]`

Scans stocks in a watchlist against technical criteria and returns matching rows.

```typescript
screen(opts: {
  listName?: string
  minVolumeSurge?: number
  nearHighPct?: number
}): ScreenerRow[]
```

**Parameters:**
- `listName` defaults to `'default'`
- `minVolumeSurge` — if set, only return stocks where `volume / avgVolume20d >= minVolumeSurge`. E.g. `1.5` means volume is at least 50% above 20-day average.
- `nearHighPct` — if set, only return stocks where `pctFrom52wHigh <= nearHighPct`. E.g. `5` means within 5% of 52-week high.

**Implementation approach:**

The screener cannot be expressed as a single SQL query because `avgVolume20d` requires a rolling window. Use this two-step approach:

1. For each symbol in the watchlist, fetch the last 252 rows from `ohlcv_daily` (1 year of history).
2. Compute the metrics in TypeScript:
   - `close` — most recent close
   - `volume` — most recent volume
   - `high52w` — max(high) over last 252 rows
   - `low52w` — min(low) over last 252 rows
   - `pctFrom52wHigh` — `(high52w - close) / high52w * 100`
   - `avgVolume20d` — mean of volume over last 20 rows
   - `volumeSurge` — `volume / avgVolume20d`
3. Filter by `minVolumeSurge` and `nearHighPct` if provided.
4. Return the matching rows sorted by `volumeSurge DESC`.

**Note:** If a symbol has fewer than 20 rows, set `avgVolume20d = volume` (no surge calculation possible). If fewer than 1 row, skip the symbol.

---

## 10. fetcher.ts — Yahoo Finance HTTP Fetching

### Ethos `Tool` interface (verbatim — implementer reference)

```typescript
interface Tool<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  toolset: string;
  maxResultChars?: number;
  outputIsUntrusted?: boolean;
  capabilities?: {
    network?: { allowedHosts: string[] };
    secrets?: string[];
    fs?: { read?: string[]; write?: string[] };
  };
  isAvailable?(): boolean;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(args: TArgs, ctx: ToolContext): Promise<ToolResult>;
}

interface ToolContext {
  abortSignal?: AbortSignal;
  secretsResolver?: { get(ref: string): Promise<string | null> };
  scopedFetch?: { fetch(url: string, init?: RequestInit): Promise<Response> };
  emit?(event: { type: 'progress'; toolName: string; message: string; audience?: 'user' | 'internal'; percent?: number }): void;
}

type ToolResult = { ok: true; value: string } | { ok: false; error: string; code: string };
```

### Yahoo Finance endpoints

#### Historical OHLCV (last 1 year by range)

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y&includeAdjustedClose=true
```

#### Historical OHLCV (custom date range)

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&period1={unixSec}&period2={unixSec}&includeAdjustedClose=true
```

- `period1` and `period2` are Unix timestamps in **seconds** (not milliseconds).
- To fetch from `2024-01-01` to today: `period1 = new Date('2024-01-01').getTime() / 1000`, `period2 = Date.now() / 1000`.

#### Live quote (latest price)

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d
```

Uses the same endpoint with `range=1d`. The `meta.regularMarketPrice` field contains the current price.

#### Symbol search

```
GET https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=10&newsCount=0
```

### Response shape

```typescript
interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string
        currency: string
        regularMarketPrice: number
        longName?: string          // company name (may be absent)
        shortName?: string
        exchangeTimezoneName: string  // e.g. "Asia/Calcutta"
      }
      timestamp: number[]           // Unix seconds, one per trading day
      indicators: {
        quote: Array<{
          open: (number | null)[]
          high: (number | null)[]
          low: (number | null)[]
          close: (number | null)[]
          volume: (number | null)[]
        }>
        adjclose?: Array<{
          adjclose: (number | null)[]
        }>
      }
    }> | null
    error: {
      code: string
      description: string
    } | null
  }
}
```

**Important:** Individual values in the arrays may be `null` (e.g. on holidays or when data is missing). Filter out any row where `open`, `high`, `low`, `close`, or `volume` is null.

### Required HTTP headers

```typescript
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; tools-nse-market-data/1.0)',
  'Accept': 'application/json',
}
```

Yahoo Finance returns HTTP 429 or garbage without a valid User-Agent.

### NSE and BSE symbol format

| Exchange | Format | Example |
|----------|--------|---------|
| NSE | Append `.NS` | `RELIANCE` → `RELIANCE.NS` |
| BSE | Append `.BO` | `RELIANCE` → `RELIANCE.BO` |

All tools in this package use `.NS` by default. The caller passes the full symbol including the suffix.

### Rate limiting

Yahoo Finance has informal rate limits. To avoid bans:

1. Maintain a module-level `lastCallTime = 0` variable.
2. Before every fetch, compute `elapsed = Date.now() - lastCallTime`. If `elapsed < 100`, `await sleep(100 - elapsed)`.
3. Update `lastCallTime = Date.now()` after the delay.

```typescript
let lastCallTime = 0
const MIN_INTERVAL_MS = 100

async function throttledFetch(url: string): Promise<Response> {
  const elapsed = Date.now() - lastCallTime
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastCallTime = Date.now()
  return fetch(url, { headers: HEADERS })
}
```

### Retry on 429

```typescript
async function fetchWithRetry(url: string): Promise<Response> {
  const res = await throttledFetch(url)
  if (res.status === 429) {
    // Wait 2 seconds and retry once
    await new Promise(resolve => setTimeout(resolve, 2000))
    return throttledFetch(url)
  }
  return res
}
```

If the retry also returns 429, throw an error with message `'Yahoo Finance rate limit exceeded — wait 30s and retry'`.

### Timestamp → YYYY-MM-DD conversion (IST timezone)

Yahoo Finance returns timestamps in UTC seconds. NSE trading days are in IST (UTC+5:30). Convert correctly:

```typescript
function timestampToIstDate(unixSeconds: number): string {
  // Create date in IST: UTC timestamp + 5.5h offset
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istMs = unixSeconds * 1000 + istOffsetMs
  const d = new Date(istMs)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

**Do NOT use `toLocaleDateString()` or `Intl.DateTimeFormat`** — these depend on the system timezone, which may not be IST. The arithmetic approach above is deterministic across all environments.

### Public fetcher API

```typescript
// Fetch OHLCV rows for symbol between fromDate and toDate (inclusive)
// fromDate, toDate: YYYY-MM-DD strings
export async function fetchOhlcv(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<OhlcvRow[]>

// Fetch the current market price (live quote, not from DB)
export async function fetchQuote(
  symbol: string
): Promise<{ symbol: string; price: number; currency: string; name: string }>

// Search Yahoo Finance for a symbol query
export async function searchSymbol(
  query: string
): Promise<Array<{ symbol: string; shortName: string; exchange: string }>>
```

### Error handling

| HTTP status | Action |
|-------------|--------|
| 200 | Parse body, check `chart.error !== null` (Yahoo returns 200 with an error body for unknown symbols) |
| 404 | Throw `new Error('Symbol not found: ' + symbol)` |
| 429 | Retry once after 2s, then throw |
| Other 4xx/5xx | Throw `new Error('Yahoo Finance error: ' + status)` |

When `chart.result` is `null` or empty, throw `new Error('No data returned for symbol: ' + symbol)`.

---

## 11. bhavcopy.ts — NSE Bhavcopy Scaffold

NSE publishes official end-of-day bhavcopy files at:

```
https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip
```

Where `YYYYMMDD` is the trading date (e.g. `20260523`).

This URL requires an NSE session cookie obtained by first visiting `https://www.nseindia.com`. Implementing this is deferred.

### File contents (scaffold only)

```typescript
export interface BhavcopyRow {
  symbol: string        // e.g. RELIANCE
  isin: string
  open: number
  high: number
  low: number
  close: number
  prevClose: number
  volume: number        // total traded quantity
  date: string          // YYYY-MM-DD
}

export interface BhavcopyDownloadResult {
  date: string
  rows: BhavcopyRow[]
}

/**
 * Download and parse the NSE bhavcopy CSV for a given trading date.
 *
 * TODO: implement NSE Bhavcopy download
 * Requires: NSE session cookie (visit nseindia.com to obtain)
 * URL pattern: https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip
 *
 * @param date - YYYY-MM-DD trading date
 * @param nseCookie - NSE session cookie value (from browser or automated login)
 */
export async function downloadBhavcopy(
  date: string,
  nseCookie: string
): Promise<BhavcopyDownloadResult> {
  throw new Error('Not implemented: NSE Bhavcopy download')
}

/**
 * Check if a given date is an NSE trading day (i.e. bhavcopy exists).
 *
 * TODO: implement using NSE holiday calendar API
 */
export async function isTradingDay(date: string): Promise<boolean> {
  throw new Error('Not implemented: NSE holiday calendar check')
}
```

The types are used in `store.ts` import so the interfaces are stable. `store.ts` should import `BhavcopyRow` from `./bhavcopy` now so no changes are needed when the implementation is added.

---

## 12. indicators.ts — Technical Indicators

All functions are pure: they take `number[]` and return computed values. No database access, no network.

### Edge case rule (applies to all functions)

If `closes.length < period`, return an empty array `[]`. Never return `NaN` or partial arrays.

### RSI — Relative Strength Index

```typescript
export function computeRsi(closes: number[], period = 14): number[]
```

**Returns:** Array of RSI values, same length as `closes`. The first `period` entries are `null`-padded — actually return an array of length `closes.length - period` starting from index `period`. (i.e. `result[0]` corresponds to `closes[period]`.)

**Algorithm (Wilder's smoothing):**

```
Step 1: Compute daily changes
  changes[i] = closes[i] - closes[i-1]   for i = 1..n-1

Step 2: Separate gains and losses
  gain[i] = max(changes[i], 0)
  loss[i] = abs(min(changes[i], 0))

Step 3: First average (simple mean over first `period` values)
  avgGain = mean(gain[1..period])
  avgLoss = mean(loss[1..period])

Step 4: Wilder's smoothing for subsequent values (i > period)
  avgGain = (prevAvgGain * (period - 1) + gain[i]) / period
  avgLoss = (prevAvgLoss * (period - 1) + loss[i]) / period

Step 5: RS and RSI
  RS = avgGain / avgLoss
  RSI = 100 - (100 / (1 + RS))

  Special case: if avgLoss === 0, RSI = 100
```

**Verification values (Investopedia example):**
Use a 14-period RSI. With the following 15 closes:
`[44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.15, 43.61, 44.33, 44.83, 45.10, 45.15, 43.61, 44.33]`
The first RSI value (at index 14) should be approximately `70.53`. Write this as a test assertion.

---

### EMA — Exponential Moving Average

```typescript
export function computeEma(closes: number[], period: number): number[]
```

**Returns:** Array of EMA values. Length = `closes.length - period + 1`. `result[0]` is the SMA of the first `period` values (seed value). `result[1]` onward use the EMA formula.

**Algorithm:**

```
multiplier = 2 / (period + 1)

ema[0] = mean(closes[0..period-1])    // seed with SMA
ema[i] = closes[period - 1 + i] * multiplier + ema[i-1] * (1 - multiplier)
```

---

### SMA — Simple Moving Average

```typescript
export function computeSma(closes: number[], period: number): number[]
```

**Returns:** Array of SMA values. Length = `closes.length - period + 1`.

**Algorithm:**

```
sma[i] = mean(closes[i..i+period-1])
```

Use a sliding window (add next, subtract dropped) for efficiency, not recalculating from scratch.

---

### MACD — Moving Average Convergence Divergence

```typescript
export function computeMacd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): Array<{ macd: number; signal: number; histogram: number }>
```

**Returns:** Array of `{ macd, signal, histogram }` objects. Length = `closes.length - slow - signal + 2` (determined by the slow EMA and signal line length).

**Algorithm:**

```
fastEma  = computeEma(closes, fast)
slowEma  = computeEma(closes, slow)

# Align: slowEma is shorter. Take the last slowEma.length values of fastEma.
macdLine = fastEma.slice(fastEma.length - slowEma.length).map((v, i) => v - slowEma[i])

signalLine = computeEma(macdLine, signal)

# Align again: signalLine is shorter. Take last signalLine.length values of macdLine.
alignedMacd = macdLine.slice(macdLine.length - signalLine.length)

histogram = alignedMacd.map((v, i) => v - signalLine[i])

return alignedMacd.map((v, i) => ({
  macd: v,
  signal: signalLine[i],
  histogram: histogram[i],
}))
```

---

## 13. CLI (cli.ts) — All Commands

### DB path resolution

The CLI resolves the database path in this order:

1. `--db <path>` flag (if provided)
2. `NSE_MARKET_DATA_DB` environment variable
3. Default: `~/.ethos/market-data/market.db`

```typescript
function resolveDbPath(args: string[]): string {
  const dbFlag = args.indexOf('--db')
  if (dbFlag !== -1 && args[dbFlag + 1]) return args[dbFlag + 1]
  if (process.env['NSE_MARKET_DATA_DB']) return process.env['NSE_MARKET_DATA_DB']
  return join(homedir(), '.ethos', 'market-data', 'market.db')
}
```

### Argument parsing

Do NOT use a CLI framework (no `commander`, no `yargs`). Parse `process.argv.slice(2)` manually. The commands are simple enough that manual parsing is 20 lines and has zero dependencies.

Pattern for flag parsing:
```typescript
function getFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
}
```

### Commands

#### `nse-market-data clean`

```bash
$ nse-market-data clean
Cleaned: 45230 OHLCV rows, 50 sync records, 12 watchlist entries
```

No flags. Calls `store.clean()` and prints the returned counts.

---

#### `nse-market-data backfill [--symbols RELIANCE.NS,TCS.NS] [--from 2024-01-01] [--all]`

```bash
# Backfill watchlist symbols, last 1 year
$ nse-market-data backfill

# Backfill specific symbols
$ nse-market-data backfill --symbols RELIANCE.NS,TCS.NS,HDFCBANK.NS

# Backfill from specific date
$ nse-market-data backfill --symbols RELIANCE.NS --from 2020-01-01

# Backfill all Nifty 50 symbols
$ nse-market-data backfill --all
```

**Output (one line per symbol):**
```
Backfilling RELIANCE.NS (1/50)... 252 rows inserted
Backfilling TCS.NS (2/50)... 252 rows inserted
...
Done. 50 symbols, 12600 total rows inserted.
```

**Flag behavior:**

| Flag | Default |
|------|---------|
| `--symbols A,B,C` | Use watchlist symbols |
| `--from YYYY-MM-DD` | 1 year ago from today |
| `--all` | Use `NSE_NIFTY50` built-in list from `symbols.ts` |

`--all` takes precedence over `--symbols`. If none of `--symbols`, `--all` is provided, use the watchlist. If the watchlist is empty and no symbols flag is given, print an error and exit with code 1.

---

#### `nse-market-data update [--mode watchlist|all]`

```bash
$ nse-market-data update
$ nse-market-data update --mode all
```

**Output:**
```
Updating 3 watchlist symbols...
RELIANCE.NS: +7 rows (up to 2026-05-23)
TCS.NS: +7 rows (up to 2026-05-23)
HDFCBANK.NS: already up to date
Done. 2 symbols updated, 14 new rows total.
```

**Flag behavior:**

| Value | Action |
|-------|--------|
| `watchlist` (default) | Calls `store.updateWatchlist()` |
| `all` | Calls `store.updateAll()` |

---

#### `nse-market-data watchlist add SYMBOL [--list default] [--notes "text"]`

```bash
$ nse-market-data watchlist add RELIANCE.NS
Added RELIANCE.NS to watchlist 'default'

$ nse-market-data watchlist add TCS.NS --list tech --notes "core holding"
Added TCS.NS to watchlist 'tech' (notes: "core holding")
```

---

#### `nse-market-data watchlist remove SYMBOL [--list default]`

```bash
$ nse-market-data watchlist remove RELIANCE.NS
Removed RELIANCE.NS from watchlist 'default'
```

If symbol is not in the list: print `RELIANCE.NS not found in watchlist 'default'` and exit 0 (not an error).

---

#### `nse-market-data watchlist show [--list default]`

```bash
$ nse-market-data watchlist show
Watchlist 'default' (3 symbols):
  RELIANCE.NS    added 2026-05-01
  TCS.NS         added 2026-05-01   "core holding"
  HDFCBANK.NS    added 2026-05-02
```

---

#### `nse-market-data history SYMBOL [--days 252]`

```bash
$ nse-market-data history RELIANCE.NS --days 5
RELIANCE.NS — last 5 days
Date         Open     High     Low      Close    Volume
2026-05-19   1420.00  1435.50  1415.25  1430.00  8234512
2026-05-20   1432.00  1445.00  1428.00  1440.50  6123400
...
```

Print as a right-aligned table. Use `String.padStart` / `String.padEnd` for alignment. Do NOT use an external table-printing library.

---

#### `nse-market-data screen [--list default] [--volume-surge 1.5] [--near-high 5]`

```bash
$ nse-market-data screen --volume-surge 2.0 --near-high 3
Screening watchlist 'default'...
Symbol        Close    VolSurge  From52wH%  52wH     52wL
TATASTEEL.NS  160.50   2.3x      1.8%       163.40   102.10
HINDALCO.NS   640.00   2.1x      2.5%       656.00   401.00
```

If no symbols match the criteria: print `No symbols matched the screen criteria.`

---

#### `nse-market-data quote SYMBOL`

```bash
$ nse-market-data quote RELIANCE.NS
RELIANCE.NS
Price: ₹1,430.50 INR
(15-minute delayed data via Yahoo Finance)
```

Calls `fetchQuote(symbol)` directly — no DB access. Always live from Yahoo Finance.

---

### Entry point boilerplate

```typescript
#!/usr/bin/env node

import { join } from 'node:path'
import { homedir } from 'node:os'
import { MarketDataStore } from './store.js'
import { NSE_NIFTY50 } from './symbols.js'
import { fetchQuote } from './fetcher.js'

const args = process.argv.slice(2)
const command = args[0]

// ... dispatch on command ...

process.exit(0)
```

The shebang `#!/usr/bin/env node` is required for the `bin` entry to work.

---

## 14. Tools (tools.ts) — All 8 Tools

### Singleton store

```typescript
import { join } from 'node:path'
import { homedir } from 'node:os'
import { MarketDataStore } from './store.js'

let storeInstance: MarketDataStore | null = null

function getStore(): MarketDataStore {
  if (!storeInstance) {
    const dbPath =
      process.env['NSE_MARKET_DATA_DB'] ??
      join(homedir(), '.ethos', 'market-data', 'market.db')
    storeInstance = new MarketDataStore(dbPath)
  }
  return storeInstance
}
```

**Note on `@ethosagent/types` import:** Because it's an optional peer dependency, guard the import:

```typescript
// tools.ts — top of file
// The Tool, ToolContext, ToolResult types come from the peer dependency.
// We re-declare them locally so this file compiles without the peer.
// If @ethosagent/types is installed, the consumer's TypeScript will validate
// that createNseMarketDataTools() returns the correct Tool[] type.

type ToolResult = { ok: true; value: string } | { ok: false; error: string; code: string }

interface ToolContext {
  abortSignal?: AbortSignal
  secretsResolver?: { get(ref: string): Promise<string | null> }
  scopedFetch?: { fetch(url: string, init?: RequestInit): Promise<Response> }
  emit?(event: {
    type: 'progress'
    toolName: string
    message: string
    audience?: 'user' | 'internal'
    percent?: number
  }): void
}

interface Tool<TArgs = Record<string, unknown>> {
  name: string
  description: string
  toolset: string
  maxResultChars?: number
  outputIsUntrusted?: boolean
  capabilities?: {
    network?: { allowedHosts: string[] }
    secrets?: string[]
    fs?: { read?: string[]; write?: string[] }
  }
  isAvailable?(): boolean
  schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(args: TArgs, ctx: ToolContext): Promise<ToolResult>
}
```

This avoids a hard import while keeping the types correct. When the consumer has `@ethosagent/types` installed and calls `createNseMarketDataTools()`, TypeScript checks structural compatibility automatically.

---

### Tool 1: `nse_market_clean`

```typescript
const nseMarketCleanTool: Tool = {
  name: 'nse_market_clean',
  description: 'Delete all market data from the local SQLite database. Use before a fresh backfill to start from scratch.',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(_args, _ctx) {
    const result = getStore().clean()
    return {
      ok: true,
      value: `Cleaned database: ${result.rowsDeleted.ohlcv} OHLCV rows, ${result.rowsDeleted.syncMeta} sync records, ${result.rowsDeleted.watchlist} watchlist entries deleted.`,
    }
  },
}
```

---

### Tool 2: `nse_market_backfill`

```typescript
interface BackfillArgs {
  symbols?: string          // comma-separated, e.g. "RELIANCE.NS,TCS.NS"
  from_date?: string        // YYYY-MM-DD
}

const nseMarketBackfillTool: Tool<BackfillArgs> = {
  name: 'nse_market_backfill',
  description:
    'Download 1 year of daily OHLCV history for NSE stocks and store locally. ' +
    'This is a one-time setup operation. Takes ~2 minutes for 50 symbols. ' +
    'Shows progress. Defaults to watchlist symbols if no symbols provided.',
  toolset: 'market',
  maxResultChars: 5000,
  capabilities: {
    network: { allowedHosts: ['query1.finance.yahoo.com'] },
  },
  schema: {
    type: 'object',
    properties: {
      symbols: {
        type: 'string',
        description:
          'Comma-separated NSE symbols with .NS suffix (e.g. "RELIANCE.NS,TCS.NS"). ' +
          'Omit to use all watchlist symbols.',
      },
      from_date: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format. Defaults to 1 year ago.',
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const store = getStore()
    const fromDate =
      args.from_date ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    let symbols: string[]
    if (args.symbols) {
      symbols = args.symbols.split(',').map(s => s.trim()).filter(Boolean)
    } else {
      const watchlist = store.watchlistList()
      symbols = watchlist.map(e => e.symbol)
      if (symbols.length === 0) {
        return { ok: false, error: 'No symbols provided and watchlist is empty. Add symbols with nse_watchlist_add first.', code: 'no_symbols' }
      }
    }

    const results: string[] = []
    let totalRows = 0
    let done = 0

    for (const symbol of symbols) {
      ctx.emit?.({
        type: 'progress',
        toolName: 'nse_market_backfill',
        message: `Backfilling ${symbol} (${done + 1}/${symbols.length})...`,
        audience: 'user',
        percent: Math.round((done / symbols.length) * 100),
      })
      // backfillSymbol throws on error; we catch and continue
      try {
        const result = await store.backfillSymbol(symbol, fromDate)
        results.push(`${symbol}: ${result.rowsInserted} rows`)
        totalRows += result.rowsInserted
      } catch (err) {
        results.push(`${symbol}: ERROR — ${(err as Error).message}`)
      }
      done++
    }

    return {
      ok: true,
      value: results.join('\n') + `\n\nTotal: ${symbols.length} symbols, ${totalRows} rows inserted.`,
    }
  },
}
```

---

### Tool 3: `nse_market_update`

```typescript
interface UpdateArgs {
  mode?: 'watchlist' | 'all'
}

const nseMarketUpdateTool: Tool<UpdateArgs> = {
  name: 'nse_market_update',
  description:
    'Fetch missing trading days for tracked symbols. Checks the last sync date for each symbol ' +
    'and fills the gap to today. Much faster than backfill — only downloads new rows.',
  toolset: 'market',
  capabilities: {
    network: { allowedHosts: ['query1.finance.yahoo.com'] },
  },
  schema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['watchlist', 'all'],
        description: "'watchlist' (default) updates only watchlist symbols. 'all' updates all synced symbols.",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const store = getStore()
    const mode = args.mode ?? 'watchlist'

    ctx.emit?.({
      type: 'progress',
      toolName: 'nse_market_update',
      message: `Updating ${mode === 'all' ? 'all' : 'watchlist'} symbols...`,
      audience: 'user',
    })

    const results = mode === 'all' ? await store.updateAll() : await store.updateWatchlist()
    const totalRows = results.reduce((sum, r) => sum + r.rowsInserted, 0)
    const summary = results
      .map(r => `${r.symbol}: +${r.rowsInserted} rows`)
      .join('\n')

    return {
      ok: true,
      value: `${summary}\n\nTotal: ${results.length} symbols updated, ${totalRows} new rows.`,
    }
  },
}
```

---

### Tool 4: `nse_watchlist_add`

```typescript
interface WatchlistAddArgs {
  symbol: string
  list_name?: string
  notes?: string
}

const nseWatchlistAddTool: Tool<WatchlistAddArgs> = {
  name: 'nse_watchlist_add',
  description: 'Add a stock to your watchlist. Use the NSE symbol with .NS suffix (e.g. RELIANCE.NS).',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'NSE symbol with .NS suffix, e.g. RELIANCE.NS',
      },
      list_name: {
        type: 'string',
        description: "Watchlist name (default: 'default')",
      },
      notes: {
        type: 'string',
        description: 'Optional notes for this symbol',
      },
    },
    required: ['symbol'],
  },
  async execute(args, _ctx) {
    getStore().watchlistAdd(args.symbol, args.list_name, args.notes)
    const list = args.list_name ?? 'default'
    return { ok: true, value: `Added ${args.symbol} to watchlist '${list}'.` }
  },
}
```

---

### Tool 5: `nse_watchlist_remove`

```typescript
interface WatchlistRemoveArgs {
  symbol: string
  list_name?: string
}

const nseWatchlistRemoveTool: Tool<WatchlistRemoveArgs> = {
  name: 'nse_watchlist_remove',
  description: 'Remove a stock from your watchlist.',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'NSE symbol with .NS suffix',
      },
      list_name: {
        type: 'string',
        description: "Watchlist name (default: 'default')",
      },
    },
    required: ['symbol'],
  },
  async execute(args, _ctx) {
    getStore().watchlistRemove(args.symbol, args.list_name)
    const list = args.list_name ?? 'default'
    return { ok: true, value: `Removed ${args.symbol} from watchlist '${list}'.` }
  },
}
```

---

### Tool 6: `nse_watchlist_show`

```typescript
interface WatchlistShowArgs {
  list_name?: string
}

const nseWatchlistShowTool: Tool<WatchlistShowArgs> = {
  name: 'nse_watchlist_show',
  description:
    'Show your watchlist. For each symbol shows the last stored close price and date.',
  toolset: 'market',
  maxResultChars: 5000,
  schema: {
    type: 'object',
    properties: {
      list_name: {
        type: 'string',
        description: "Watchlist name (default: 'default')",
      },
    },
    required: [],
  },
  async execute(args, _ctx) {
    const store = getStore()
    const list = args.list_name ?? 'default'
    const entries = store.watchlistList(list)
    if (entries.length === 0) {
      return { ok: true, value: `Watchlist '${list}' is empty. Add symbols with nse_watchlist_add.` }
    }

    const lines = [`Watchlist '${list}' (${entries.length} symbols):`, '']
    for (const entry of entries) {
      const history = store.getHistory(entry.symbol, 1)
      const last = history[0]
      const price = last ? `close ${last.close} on ${last.date}` : 'no data'
      const notePart = entry.notes ? `  — ${entry.notes}` : ''
      lines.push(`  ${entry.symbol.padEnd(20)} ${price}${notePart}`)
    }
    return { ok: true, value: lines.join('\n') }
  },
}
```

---

### Tool 7: `nse_market_history`

```typescript
interface HistoryArgs {
  symbol: string
  days?: number
}

const nseMarketHistoryTool: Tool<HistoryArgs> = {
  name: 'nse_market_history',
  description:
    'Get daily OHLCV history for a stock from the local database. ' +
    'Use for technical analysis, charting, or passing to indicator functions. ' +
    'Data must be backfilled first with nse_market_backfill.',
  toolset: 'market',
  maxResultChars: 30000,
  schema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'NSE symbol with .NS suffix, e.g. RELIANCE.NS',
      },
      days: {
        type: 'number',
        description: 'Number of trading days to return (default: 252, max: 504)',
      },
    },
    required: ['symbol'],
  },
  async execute(args, _ctx) {
    const days = Math.min(args.days ?? 252, 504)
    const rows = getStore().getHistory(args.symbol, days)
    if (rows.length === 0) {
      return {
        ok: false,
        error: `No data for ${args.symbol}. Run nse_market_backfill first.`,
        code: 'no_data',
      }
    }
    const header = 'Date        Open      High      Low       Close     Volume'
    const lines = rows.map(r =>
      `${r.date}  ${String(r.open).padStart(9)}  ${String(r.high).padStart(9)}  ${String(r.low).padStart(9)}  ${String(r.close).padStart(9)}  ${String(r.volume).padStart(10)}`
    )
    return { ok: true, value: [header, ...lines].join('\n') }
  },
}
```

---

### Tool 8: `nse_market_screen`

```typescript
interface ScreenArgs {
  list_name?: string
  min_volume_surge?: number
  near_high_pct?: number
}

const nseMarketScreenTool: Tool<ScreenArgs> = {
  name: 'nse_market_screen',
  description:
    'Scan stocks in your watchlist against technical criteria. ' +
    'Returns matching symbols with close price, volume surge, and distance from 52-week high. ' +
    'Data must be backfilled first.',
  toolset: 'market',
  maxResultChars: 10000,
  schema: {
    type: 'object',
    properties: {
      list_name: {
        type: 'string',
        description: "Watchlist name to screen (default: 'default')",
      },
      min_volume_surge: {
        type: 'number',
        description:
          'Minimum ratio of today\'s volume to 20-day average. E.g. 1.5 means at least 50% above average.',
      },
      near_high_pct: {
        type: 'number',
        description:
          'Only include stocks within this % of their 52-week high. E.g. 5 means within 5%.',
      },
    },
    required: [],
  },
  async execute(args, _ctx) {
    const rows = getStore().screen({
      listName: args.list_name,
      minVolumeSurge: args.min_volume_surge,
      nearHighPct: args.near_high_pct,
    })
    if (rows.length === 0) {
      return { ok: true, value: 'No symbols matched the screen criteria.' }
    }
    const header = 'Symbol               Close     VolSurge  From52wH%  52wH      52wL'
    const lines = rows.map(r =>
      `${r.symbol.padEnd(20)} ${String(r.close).padStart(9)} ${(r.volumeSurge.toFixed(1) + 'x').padStart(9)} ${(r.pctFrom52wHigh.toFixed(1) + '%').padStart(10)} ${String(r.high52w).padStart(9)} ${String(r.low52w).padStart(9)}`
    )
    return { ok: true, value: [header, ...lines].join('\n') }
  },
}
```

---

### Exported function

```typescript
export function createNseMarketDataTools(): Tool[] {
  return [
    nseMarketCleanTool,
    nseMarketBackfillTool,
    nseMarketUpdateTool,
    nseWatchlistAddTool,
    nseWatchlistRemoveTool,
    nseWatchlistShowTool,
    nseMarketHistoryTool,
    nseMarketScreenTool,
  ]
}
```

---

## 15. src/index.ts — Public API Barrel

```typescript
// Core store and types
export { MarketDataStore } from './store.js'
export type { OhlcvRow, SyncResult, ScreenerRow, WatchlistEntry } from './store.js'

// Ethos tool integration
export { createNseMarketDataTools } from './tools.js'

// Technical indicators (pure functions)
export { computeRsi, computeEma, computeSma, computeMacd } from './indicators.js'

// Built-in symbol list
export { NSE_NIFTY50 } from './symbols.js'
```

**Note on `.js` extensions:** All internal imports must use `.js` extensions (not `.ts`). tsup and Node.js ESM both resolve `.js` to the compiled output. This is required for ESM compatibility.

---

## 16. Testing Strategy

### vitest configuration

Add to `package.json`:

```json
"vitest": {
  "include": ["src/__tests__/**/*.test.ts"],
  "environment": "node"
}
```

Or create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
```

### store.test.ts

Use `:memory:` as the dbPath to avoid temp file cleanup:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MarketDataStore } from '../store.js'

describe('MarketDataStore', () => {
  let store: MarketDataStore

  beforeEach(() => {
    store = new MarketDataStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  describe('clean()', () => {
    it('empties all tables and returns row counts', () => {
      // Insert fixture rows directly via store methods
      store.watchlistAdd('RELIANCE.NS', 'default')
      store.watchlistAdd('TCS.NS', 'default')
      const result = store.clean()
      expect(result.rowsDeleted.watchlist).toBe(2)
      expect(result.rowsDeleted.ohlcv).toBe(0)
    })
  })

  describe('getHistory()', () => {
    it('returns rows in chronological (ascending date) order', () => {
      // Insert rows via the DB directly (access private db field in tests via cast)
      // OR provide a test helper method that accepts OhlcvRow[]
      // Recommended: add a protected/internal method `_insertRows(rows: OhlcvRow[]): void`
      // gated behind a test flag, OR use better-sqlite3 directly in the test:
      const db = (store as unknown as { db: import('better-sqlite3').Database }).db
      db.prepare(
        'INSERT INTO ohlcv_daily (symbol, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('RELIANCE.NS', '2026-05-20', 1400, 1450, 1390, 1430, 5000000)
      db.prepare(
        'INSERT INTO ohlcv_daily (symbol, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('RELIANCE.NS', '2026-05-21', 1432, 1460, 1420, 1445, 4200000)

      const rows = store.getHistory('RELIANCE.NS', 252)
      expect(rows.length).toBe(2)
      expect(rows[0].date).toBe('2026-05-20')   // chronological order
      expect(rows[1].date).toBe('2026-05-21')
    })

    it('returns at most `days` rows (most recent)', () => {
      // Insert 5 rows, request 3
      // ... setup ...
      const rows = store.getHistory('RELIANCE.NS', 3)
      expect(rows.length).toBe(3)
      // Should be the 3 most recent dates
    })
  })

  describe('screen()', () => {
    it('computes correct 52-week high and low', () => {
      // Insert 252 rows with known max/min values
      // Call screen()
      // Assert high52w and low52w match expected values
    })

    it('filters by min_volume_surge', () => {
      // Insert rows where some have high volume and some do not
      // screen({ minVolumeSurge: 2.0 }) should return only high-volume ones
    })

    it('filters by near_high_pct', () => {
      // screen({ nearHighPct: 5 }) should return only stocks within 5% of 52w high
    })
  })

  describe('watchlist()', () => {
    it('add and list', () => {
      store.watchlistAdd('RELIANCE.NS', 'default', 'core holding')
      const entries = store.watchlistList('default')
      expect(entries).toHaveLength(1)
      expect(entries[0].symbol).toBe('RELIANCE.NS')
      expect(entries[0].notes).toBe('core holding')
    })

    it('remove is idempotent', () => {
      store.watchlistAdd('RELIANCE.NS')
      store.watchlistRemove('RELIANCE.NS')
      store.watchlistRemove('RELIANCE.NS')  // second remove should not throw
      expect(store.watchlistList()).toHaveLength(0)
    })

    it('separate lists are independent', () => {
      store.watchlistAdd('RELIANCE.NS', 'default')
      store.watchlistAdd('TCS.NS', 'tech')
      expect(store.watchlistList('default')).toHaveLength(1)
      expect(store.watchlistList('tech')).toHaveLength(1)
    })
  })
})
```

### fetcher.test.ts

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOhlcv } from '../fetcher.js'

// Fixture response matching Yahoo Finance v8 API shape
const FIXTURE_RESPONSE = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'RELIANCE.NS',
          currency: 'INR',
          regularMarketPrice: 1430.5,
          longName: 'Reliance Industries Limited',
          exchangeTimezoneName: 'Asia/Calcutta',
        },
        timestamp: [1716076200, 1716162600],  // 2024-05-19, 2024-05-20 in IST
        indicators: {
          quote: [
            {
              open: [1400.0, 1432.0],
              high: [1450.0, 1460.0],
              low: [1390.0, 1420.0],
              close: [1430.0, 1445.0],
              volume: [5000000, 4200000],
            },
          ],
          adjclose: [
            { adjclose: [1430.0, 1445.0] },
          ],
        },
      },
    ],
    error: null,
  },
}

describe('fetchOhlcv()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FIXTURE_RESPONSE,
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses Yahoo Finance response into OhlcvRow[]', async () => {
    const rows = await fetchOhlcv('RELIANCE.NS', '2024-05-01', '2024-05-31')
    expect(rows).toHaveLength(2)
    expect(rows[0].symbol).toBe('RELIANCE.NS')
    expect(rows[0].open).toBe(1400.0)
    expect(rows[0].close).toBe(1430.0)
  })

  it('converts timestamp to YYYY-MM-DD in IST timezone', async () => {
    const rows = await fetchOhlcv('RELIANCE.NS', '2024-05-01', '2024-05-31')
    // timestamp 1716076200 = 2024-05-19 03:30:00 UTC = 2024-05-19 09:00:00 IST
    expect(rows[0].date).toBe('2024-05-19')
  })

  it('filters out rows with null values', async () => {
    const responseWithNulls = {
      ...FIXTURE_RESPONSE,
      chart: {
        result: [{
          ...FIXTURE_RESPONSE.chart.result[0],
          timestamp: [1716076200, 1716162600, 1716249000],
          indicators: {
            quote: [{ open: [1400, null, 1432], high: [1450, null, 1460], low: [1390, null, 1420], close: [1430, null, 1445], volume: [5000000, null, 4200000] }],
          },
        }],
        error: null,
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => responseWithNulls,
    }))
    const rows = await fetchOhlcv('RELIANCE.NS', '2024-05-01', '2024-05-31')
    expect(rows).toHaveLength(2)   // null row filtered out
  })

  it('retries on 429 and throws if retry also fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 429, ok: false }))
    await expect(fetchOhlcv('RELIANCE.NS', '2024-05-01', '2024-05-31')).rejects.toThrow('rate limit')
  })

  it('throws on symbol not found (Yahoo returns error body)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ chart: { result: null, error: { code: 'Not Found', description: 'No fundamentals data found' } } }),
    }))
    await expect(fetchOhlcv('INVALID.NS', '2024-05-01', '2024-05-31')).rejects.toThrow()
  })
})
```

### indicators.test.ts

```typescript
import { describe, it, expect } from 'vitest'
import { computeRsi, computeEma, computeSma, computeMacd } from '../indicators.js'

describe('computeRsi()', () => {
  it('returns empty array when input is shorter than period', () => {
    expect(computeRsi([1, 2, 3], 14)).toEqual([])
  })

  it('returns RSI ≈ 70.53 for Investopedia example values', () => {
    // 15 closes where first 14 establish the average, 15th gives first RSI value
    const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.15, 43.61, 44.33, 44.83, 45.10, 45.15, 43.61, 44.33]
    const rsi = computeRsi(closes, 14)
    expect(rsi.length).toBe(1)
    expect(rsi[0]).toBeCloseTo(70.53, 0)   // within 0.5 of expected
  })

  it('returns RSI = 100 when all days are up', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const rsi = computeRsi(closes, 14)
    expect(rsi[rsi.length - 1]).toBe(100)
  })
})

describe('computeEma()', () => {
  it('returns empty array for insufficient input', () => {
    expect(computeEma([1, 2, 3], 5)).toEqual([])
  })

  it('first value equals SMA of seed window', () => {
    const closes = [10, 20, 30, 40, 50]
    const ema = computeEma(closes, 3)
    // First EMA = SMA([10, 20, 30]) = 20
    expect(ema[0]).toBe(20)
  })
})

describe('computeSma()', () => {
  it('computes correct values', () => {
    const closes = [2, 4, 6, 8, 10]
    const sma = computeSma(closes, 3)
    expect(sma).toEqual([4, 6, 8])  // [2+4+6]/3, [4+6+8]/3, [6+8+10]/3
  })
})

describe('computeMacd()', () => {
  it('returns empty array for insufficient input', () => {
    expect(computeMacd([1, 2, 3], 12, 26, 9)).toEqual([])
  })

  it('result length is correct', () => {
    // Need at least slow + signal - 1 = 26 + 9 - 1 = 34 data points
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10)
    const result = computeMacd(closes)
    // Verify result has entries and each has macd, signal, histogram
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('macd')
    expect(result[0]).toHaveProperty('signal')
    expect(result[0]).toHaveProperty('histogram')
  })

  it('histogram = macd - signal', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5)
    const result = computeMacd(closes)
    for (const row of result) {
      expect(row.histogram).toBeCloseTo(row.macd - row.signal, 10)
    }
  })
})
```

---

## 17. npm Publishing Setup

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  check:
    name: Typecheck, lint, test, build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

### .github/workflows/release.yml

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    name: Publish to npm
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup required:** In the GitHub repository settings, add a repository secret named `NPM_TOKEN` containing an npm access token with `publish` scope.

### Release process

1. Update `version` in `package.json` (follow semver: `0.1.0` → `0.1.1` for patches, `0.2.0` for new features).
2. Add an entry to `CHANGELOG.md`:
   ```markdown
   ## [0.1.1] — 2026-05-30
   ### Fixed
   - Fixed timestamp conversion for IST timezone edge case
   ```
3. Stage and commit:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release v0.1.1"
   ```
4. Create and push the tag:
   ```bash
   git tag v0.1.1
   git push && git push --tags
   ```
5. GitHub Actions picks up the `v*` tag, runs `npm run build`, then `npm publish`.

### .gitignore

```
node_modules/
dist/
*.db
*.db-shm
*.db-wal
.env
```

### .npmignore

Exclude source files, config, and tests from the published package:

```
src/
*.test.ts
.github/
biome.json
tsconfig.json
tsup.config.ts
vitest.config.ts
*.db
*.db-shm
*.db-wal
.gitignore
```

The `files` field in `package.json` already gates what is published (`dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`). `.npmignore` is a belt-and-suspenders guard.

---

## 18. Wiring into Ethos (3 Steps)

### Step 1 — Install the package

From the ethos monorepo root:

```bash
pnpm add @ethosagent/tools-nse-market-data
```

This installs the package in the monorepo root `node_modules`. The package should then be imported where tools are wired.

If using a workspace-specific install (e.g. installing only into the `packages/wiring` package):

```bash
pnpm --filter @ethosagent/wiring add @ethosagent/tools-nse-market-data
```

### Step 2 — Register tools in `packages/wiring/src/index.ts`

Open `packages/wiring/src/index.ts` in the ethos monorepo. Find the section where tools are registered (look for calls to `tools.register(...)` or a loop over tool arrays). Add:

```typescript
import { createNseMarketDataTools } from '@ethosagent/tools-nse-market-data'

// Inside the wire() function, after other tool registrations:
for (const tool of createNseMarketDataTools()) {
  tools.register(tool)
}
```

The tools will be registered but only exposed to personalities that include them in `toolset.yaml`.

### Step 3 — Add to personality toolset

Create a personality for stock market analysis. Create the directory:

```bash
mkdir -p ~/.ethos/personalities/swing-trader
```

Create `~/.ethos/personalities/swing-trader/SOUL.md`:

```markdown
I am a swing trading assistant specializing in NSE India equities.
I help analyze stocks using technical indicators and market data.
I maintain a local database of historical prices and use it to run
screeners and generate trading ideas.
```

Create `~/.ethos/personalities/swing-trader/config.yaml`:

```yaml
name: Swing Trader
description: NSE India swing trading analysis with local market data
model: claude-sonnet-4-6
memoryScope: personality:swing-trader
```

Create `~/.ethos/personalities/swing-trader/toolset.yaml`:

```yaml
- nse_market_clean
- nse_market_backfill
- nse_market_update
- nse_watchlist_add
- nse_watchlist_remove
- nse_watchlist_show
- nse_market_history
- nse_market_screen
- memory_read
- memory_write
```

### Verification

Start ethos with the swing-trader personality:

```bash
ethos chat --personality swing-trader
```

Then test each tool is available:

```
> Add RELIANCE.NS to my watchlist
```

Expected: `nse_watchlist_add` tool executes and returns `Added RELIANCE.NS to watchlist 'default'.`

```
> Backfill the last year of data for my watchlist
```

Expected: `nse_market_backfill` tool executes with progress events and returns row counts.

---

## 19. README.md Structure

The README must cover these sections in order:

### 1. Header

```markdown
# @ethosagent/tools-nse-market-data

[![npm](https://img.shields.io/npm/v/@ethosagent/tools-nse-market-data)](https://www.npmjs.com/package/@ethosagent/tools-nse-market-data)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
```

### 2. What it does (3-sentence summary)

NSE India market data tooling — downloads historical OHLCV data from Yahoo Finance, stores it in a local SQLite database, and exposes tools for watchlist management, daily sync, and technical screening. Works as an ethos AI agent tool set (via `createNseMarketDataTools()`), a CLI (`nse-market-data`), or a direct Node.js API (`MarketDataStore`). All data is local-first — no cloud sync, no API keys required.

### 3. Quick start

```bash
# Install globally for CLI use
npm install -g @ethosagent/tools-nse-market-data

# Add stocks to watchlist
nse-market-data watchlist add RELIANCE.NS
nse-market-data watchlist add TCS.NS

# Download 1 year of history
nse-market-data backfill

# Get daily updates
nse-market-data update

# Screen for volume breakouts
nse-market-data screen --volume-surge 2.0 --near-high 5
```

### 4. Data sources

- **Primary:** Yahoo Finance v8 API (free, no API key). Note: 15-minute delay on live quotes during market hours. Historical OHLCV is end-of-day (no intraday data).
- **NSE symbol format:** Append `.NS` to NSE ticker symbols (e.g. `RELIANCE` → `RELIANCE.NS`). BSE symbols use `.BO`.
- **Backfill time:** Approximately 2-4 minutes for 50 symbols (100ms minimum between requests to respect Yahoo Finance limits).
- **Planned:** NSE Bhavcopy (official end-of-day files) for higher accuracy. Requires NSE session cookie. Interfaces are scaffolded in `bhavcopy.ts`.

### 5. CLI reference

Table of all 8 commands with flags, defaults, and example output.

### 6. Using with Ethos

The 3-step wiring from Section 18: install, register in wiring.ts, add to toolset.yaml.

### 7. Tool reference

| Tool | Description | Key Args |
|------|-------------|----------|
| `nse_market_clean` | Delete all local market data | — |
| `nse_market_backfill` | Download OHLCV history | `symbols`, `from_date` |
| `nse_market_update` | Fill gap to today | `mode` |
| `nse_watchlist_add` | Add stock to watchlist | `symbol`, `list_name`, `notes` |
| `nse_watchlist_remove` | Remove from watchlist | `symbol`, `list_name` |
| `nse_watchlist_show` | List watchlist with prices | `list_name` |
| `nse_market_history` | Get OHLCV history | `symbol`, `days` |
| `nse_market_screen` | Technical screener | `list_name`, `min_volume_surge`, `near_high_pct` |

### 8. Technical indicators

Available from `import { computeRsi, computeEma, computeSma, computeMacd } from '@ethosagent/tools-nse-market-data'`. Show brief example of loading history and computing RSI.

### 9. Database schema

Describe the 4 tables (`instruments`, `ohlcv_daily`, `sync_meta`, `watchlist`) with column names and purpose. Do not repeat the full SQL — just a readable description.

### 10. Release process

Semver, tag format `v*`, GitHub Actions auto-publishes.

### 11. Contributing

- `npm run lint:fix` before committing (Biome)
- `npm run test` to run vitest tests
- `npm run build` to verify the build compiles
- No framework for the CLI parser — keep it dependency-free

### 12. License

MIT

---

## 20. NSE500 Built-in Symbol List (symbols.ts)

```typescript
/**
 * Nifty 50 index constituents as Yahoo Finance symbols (.NS suffix for NSE).
 * Used by `nse-market-data backfill --all` and `nse_market_backfill` with no symbols arg.
 *
 * Source: NSE India / Nifty 50 index composition (as of 2026)
 * Note: M&M uses 'M%26M.NS' in some Yahoo Finance contexts — use 'MM.NS' if M%26M.NS fails.
 */
export const NSE_NIFTY50: string[] = [
  'RELIANCE.NS',
  'TCS.NS',
  'HDFCBANK.NS',
  'ICICIBANK.NS',
  'HINDUNILVR.NS',
  'INFY.NS',
  'ITC.NS',
  'SBIN.NS',
  'BHARTIARTL.NS',
  'KOTAKBANK.NS',
  'LT.NS',
  'AXISBANK.NS',
  'ASIANPAINT.NS',
  'MARUTI.NS',
  'TITAN.NS',
  'BAJFINANCE.NS',
  'WIPRO.NS',
  'ULTRACEMCO.NS',
  'ONGC.NS',
  'NTPC.NS',
  'POWERGRID.NS',
  'M%26M.NS',
  'SUNPHARMA.NS',
  'HCLTECH.NS',
  'TECHM.NS',
  'NESTLEIND.NS',
  'DRREDDY.NS',
  'BAJAJFINSV.NS',
  'TATAMOTORS.NS',
  'INDUSINDBK.NS',
  'CIPLA.NS',
  'ADANIENT.NS',
  'ADANIPORTS.NS',
  'COALINDIA.NS',
  'EICHERMOT.NS',
  'GRASIM.NS',
  'JSWSTEEL.NS',
  'TATASTEEL.NS',
  'BPCL.NS',
  'HINDALCO.NS',
  'BRITANNIA.NS',
  'DIVISLAB.NS',
  'APOLLOHOSP.NS',
  'TATACONSUM.NS',
  'HEROMOTOCO.NS',
  'SBILIFE.NS',
  'HDFCLIFE.NS',
  'BAJAJ-AUTO.NS',
  'UPL.NS',
  'SHREECEM.NS',
]

/**
 * Alias for backfill --all flag.
 * Extend this list or swap it for NSE500 when you have more data.
 */
export const NSE_DEFAULT_UNIVERSE: string[] = NSE_NIFTY50
```

**Note on M&M:** Mahindra & Mahindra's ticker contains an ampersand. Yahoo Finance uses `M%26M.NS` (URL-encoded) in some contexts and `MM.NS` in others. The fetcher should URL-encode the symbol before inserting it into the query string: `encodeURIComponent(symbol)` when building the Yahoo Finance URL. Store and display the raw symbol (`M%26M.NS`) in the database; encode only at the HTTP call site.

---

## 21. Implementation Phases with Exit Gates

### Phase 1 — Core store (no network)

**Files to create:**
- `src/schema.ts`
- `src/store.ts` (constructor, migrate, clean, watchlist CRUD, getHistory, screen)
- `src/indicators.ts`
- `src/__tests__/store.test.ts`
- `src/__tests__/indicators.test.ts`
- `package.json`, `tsconfig.json`, `biome.json`

**What to defer to later phases:**
- `fetcher.ts` is NOT needed — stub out `backfillSymbol` to throw `'not implemented'`
- No CLI yet
- No tools wrapper yet

**Exit gate:** `npm test` passes for `store.test.ts` and `indicators.test.ts` using in-memory SQLite (`:memory:`). All store CRUD methods work. All indicator functions return correct values for known inputs.

**Verify:**

```bash
npm install
npm run typecheck    # must pass
npm run lint         # must pass
npm run test         # store and indicator tests must pass
```

---

### Phase 2 — Yahoo Finance fetcher

**Files to create:**
- `src/fetcher.ts`
- `src/__tests__/fetcher.test.ts`

**Activate in store.ts:**
- Remove the `throw 'not implemented'` stub from `backfillSymbol`
- Implement the real call to `fetchOhlcv`

**Exit gate:**

```bash
# Run directly with tsx (no build needed)
npx tsx src/cli.ts history RELIANCE.NS
```

This requires a minimal `cli.ts` that just calls `store.getHistory('RELIANCE.NS')` and prints rows. If you don't want to build the full CLI yet, create a one-off test script:

```typescript
// scripts/test-fetch.ts
import { MarketDataStore } from '../src/store.js'
const store = new MarketDataStore('/tmp/test-market.db')
await store.backfillSymbol('RELIANCE.NS', '2025-01-01')
const rows = store.getHistory('RELIANCE.NS', 5)
console.log(rows)
store.close()
```

```bash
npx tsx scripts/test-fetch.ts
```

Expected: 5 most recent OHLCV rows for RELIANCE.NS printed to stdout.

---

### Phase 3 — CLI

**Files to create:**
- `src/cli.ts`
- `src/symbols.ts`

**Exit gate:** Run all 8 CLI commands manually and verify correct output:

```bash
npx tsx src/cli.ts watchlist add RELIANCE.NS
npx tsx src/cli.ts watchlist add TCS.NS
npx tsx src/cli.ts backfill --symbols RELIANCE.NS,TCS.NS
npx tsx src/cli.ts update
npx tsx src/cli.ts watchlist show
npx tsx src/cli.ts history RELIANCE.NS --days 5
npx tsx src/cli.ts screen
npx tsx src/cli.ts quote RELIANCE.NS
npx tsx src/cli.ts clean
```

Each command should print expected output without errors. The `backfill` and `update` commands require real network access (Yahoo Finance).

---

### Phase 4 — Tools wrapper

**Files to create:**
- `src/tools.ts`
- `src/index.ts`

**Exit gate:** Write a minimal integration test:

```typescript
// src/__tests__/tools.test.ts
import { describe, it, expect } from 'vitest'
import { createNseMarketDataTools } from '../tools.js'

describe('createNseMarketDataTools()', () => {
  it('returns 8 tools', () => {
    const tools = createNseMarketDataTools()
    expect(tools).toHaveLength(8)
  })

  it('all tools have required fields', () => {
    const tools = createNseMarketDataTools()
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.toolset).toBe('market')
      expect(tool.schema).toBeDefined()
      expect(typeof tool.execute).toBe('function')
    }
  })

  it('tool names match expected list', () => {
    const tools = createNseMarketDataTools()
    const names = tools.map(t => t.name)
    expect(names).toContain('nse_market_clean')
    expect(names).toContain('nse_market_backfill')
    expect(names).toContain('nse_market_update')
    expect(names).toContain('nse_watchlist_add')
    expect(names).toContain('nse_watchlist_remove')
    expect(names).toContain('nse_watchlist_show')
    expect(names).toContain('nse_market_history')
    expect(names).toContain('nse_market_screen')
  })
})
```

```bash
npm run test   # all tests pass
```

---

### Phase 5 — Build and publish

**Files to create:**
- `tsup.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `.gitignore`
- `.npmignore`

**Exit gate:**

```bash
npm run build
# Expected: dist/index.js, dist/cli.js, dist/index.d.ts, dist/cli.d.ts all created

npm publish --dry-run
# Expected: lists files that would be published, no errors
# Verify dist/ files are included, src/ is NOT included
```

Also verify the bin works after build:

```bash
node dist/cli.js --help
# or
npx . watchlist show
```

---

### Phase 6 — Ethos wiring

**Prerequisite:** Phase 5 complete. Package either published to npm or installed locally via `npm link`.

**For local development (before publishing):**

```bash
# In tools-nse-market-data repo:
npm run build
npm link

# In ethos monorepo:
npm link @ethosagent/tools-nse-market-data
# Or with pnpm:
pnpm add /absolute/path/to/tools-nse-market-data
```

**Exit gate:** Inside ethos chat with swing-trader personality:

```
> Add RELIANCE.NS to my watchlist
```

Expected tool call in the output:
```
[tool: nse_watchlist_add]  symbol: "RELIANCE.NS"
Added RELIANCE.NS to watchlist 'default'.
```

Then test the full workflow:

```
> Backfill the last year of data for RELIANCE.NS and TCS.NS
> Update my watchlist to today
> Screen for stocks with volume surge above 1.5x
```

Each should invoke the correct tool and return sensible output.

---

## Appendix: Key Implementation Gotchas

These are non-obvious issues that will waste time if discovered during implementation.

### SQLite STRICT mode: INTEGER vs REAL

`volume` is `INTEGER NOT NULL` in the schema. Yahoo Finance returns volume as a JavaScript `number` (float). Before inserting, always floor volume: `Math.floor(row.volume)`. STRICT mode will reject `5000000.0` (it's typed as REAL in JS) inserted into an INTEGER column.

### better-sqlite3 is synchronous

All `db.prepare().run()` and `.get()` calls are synchronous. Do NOT try to `await` them. The async surface of `MarketDataStore` exists only because `fetcher.ts` is async (network calls). The DB operations inside are all sync.

### better-sqlite3 needs native compilation

On a fresh system, `npm install` will compile `better-sqlite3` from source. This requires `python3`, `make`, and `g++` (or `xcode-select` on macOS). If the install fails with node-gyp errors, install build tools first. The `pnpm.onlyBuiltDependencies: ["better-sqlite3"]` field in `package.json` is what allows pnpm's security sandbox to run the install script.

### Yahoo Finance User-Agent

Yahoo Finance silently returns garbage (malformed JSON or empty result) without a browser User-Agent. The header `'User-Agent': 'Mozilla/5.0 (compatible; tools-nse-market-data/1.0)'` is not optional.

### ESM and `.js` extensions in imports

With `"type": "module"` in `package.json` and `moduleResolution: "bundler"` in tsconfig, all internal imports must use `.js` extensions:

```typescript
// Correct
import { MarketDataStore } from './store.js'

// Wrong — will fail at runtime even though TypeScript compiles it
import { MarketDataStore } from './store'
```

tsup handles the resolution during build, but when running via `tsx src/cli.ts`, the `.js` extension must be present in the source files.

### Timestamp arithmetic: use UTC methods, not local methods

In `timestampToIstDate()`, use `d.getUTCFullYear()`, `d.getUTCMonth()`, `d.getUTCDate()` — NOT `d.getFullYear()`, `d.getMonth()`, `d.getDate()`. The local methods depend on the system timezone. UTC methods are deterministic everywhere.

### Symbol upsert: `INSERT OR IGNORE` not `INSERT OR REPLACE`

When upserting into `instruments` during backfill, use `INSERT OR IGNORE` (not `REPLACE`). `INSERT OR REPLACE` deletes and re-inserts the row, resetting `added_at`. `INSERT OR IGNORE` skips the insert if the primary key already exists, preserving the original `added_at`.

### `screen()` method: compute in TypeScript, not SQL

The screener's `avgVolume20d` requires a rolling 20-day average. This cannot be expressed in SQLite without a window function, and even with window functions the query becomes complex and hard to maintain. Fetching the last 252 rows per symbol and computing in TypeScript is simpler and fast enough (252 × 50 symbols = 12,600 rows, a trivial in-memory computation).
