// Ethos Tool wrappers around MarketDataStore
// Implemented per Section 14 of tools-nse-market-data.md
// @ethosagent/types is an optional peer dep — types re-declared locally to avoid hard import

// ---------------------------------------------------------------------------
// Local type re-declarations (mirrors @ethosagent/types Tool interface)
// ---------------------------------------------------------------------------

type ToolResult =
  | { ok: true; value: string }
  | { ok: false; error: string; code: string };

interface ToolContext {
  abortSignal?: AbortSignal;
  emit?: (event: {
    type: 'progress';
    toolName: string;
    message: string;
    audience?: 'user' | 'internal';
    percent?: number;
  }) => void;
}

interface Tool {
  name: string;
  description: string;
  toolset: string;
  maxResultChars?: number;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Singleton store
// ---------------------------------------------------------------------------

import { homedir } from 'node:os';
import { join } from 'node:path';
import { MarketDataStore } from './store';

let _store: MarketDataStore | null = null;

function getStore(): MarketDataStore {
  if (!_store) {
    const dbPath =
      process.env['NSE_MARKET_DATA_DB'] ??
      join(homedir(), '.ethos', 'market-data', 'market.db');
    _store = new MarketDataStore(dbPath);
  }
  return _store;
}

// ---------------------------------------------------------------------------
// Tool stubs — implement per Section 14 of tools-nse-market-data.md
// ---------------------------------------------------------------------------

const nseMarketCleanTool: Tool = {
  name: 'nse_market_clean',
  description: 'Delete all market data from the local SQLite database. Use before a fresh backfill.',
  toolset: 'market',
  schema: { type: 'object', properties: {} },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseMarketBackfillTool: Tool = {
  name: 'nse_market_backfill',
  description:
    'Download 1 year of daily OHLCV history for NSE stocks and store locally. One-time operation. Shows progress.',
  toolset: 'market',
  maxResultChars: 5000,
  schema: {
    type: 'object',
    properties: {
      symbols: {
        type: 'string',
        description:
          'Comma-separated NSE symbols (e.g. RELIANCE.NS,TCS.NS). Defaults to watchlist.',
      },
      from_date: {
        type: 'string',
        description: 'Start date YYYY-MM-DD. Defaults to 1 year ago.',
      },
    },
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseMarketUpdateTool: Tool = {
  name: 'nse_market_update',
  description:
    'Fetch missing trading days for tracked symbols. Checks last sync date and fills the gap to today.',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['watchlist', 'all'],
        description:
          'Update watchlist symbols only (default) or all instruments.',
      },
    },
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseWatchlistAddTool: Tool = {
  name: 'nse_watchlist_add',
  description: 'Add a stock to your watchlist.',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'NSE symbol (e.g. RELIANCE.NS)' },
      list_name: { type: 'string', description: 'Watchlist name (default: "default")' },
      notes: {
        type: 'string',
        description: 'Optional notes about why you are watching this stock',
      },
    },
    required: ['symbol'],
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseWatchlistRemoveTool: Tool = {
  name: 'nse_watchlist_remove',
  description: 'Remove a stock from your watchlist.',
  toolset: 'market',
  schema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'NSE symbol to remove' },
      list_name: { type: 'string', description: 'Watchlist name (default: "default")' },
    },
    required: ['symbol'],
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseWatchlistShowTool: Tool = {
  name: 'nse_watchlist_show',
  description: 'Show your watchlist with last close price and metadata.',
  toolset: 'market',
  maxResultChars: 5000,
  schema: {
    type: 'object',
    properties: {
      list_name: { type: 'string', description: 'Watchlist name (default: "default")' },
    },
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseMarketHistoryTool: Tool = {
  name: 'nse_market_history',
  description:
    'Get daily OHLCV history for a stock from local database. Used for technical analysis.',
  toolset: 'market',
  maxResultChars: 30000,
  schema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'NSE symbol (e.g. RELIANCE.NS)' },
      days: {
        type: 'number',
        description: 'Number of trading days to return (default 252, max 504)',
      },
    },
    required: ['symbol'],
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

const nseMarketScreenTool: Tool = {
  name: 'nse_market_screen',
  description: 'Scan stocks against technical criteria. Returns matches with key metrics.',
  toolset: 'market',
  maxResultChars: 10000,
  schema: {
    type: 'object',
    properties: {
      list_name: { type: 'string', description: 'Watchlist to screen (default: "default")' },
      min_volume_surge: {
        type: 'number',
        description:
          'Minimum volume/20d-avg ratio (e.g. 1.5 = 50% above average)',
      },
      near_high_pct: {
        type: 'number',
        description: 'Within N% of 52-week high (e.g. 5 = within 5%)',
      },
    },
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    throw new Error('Not implemented');
  },
};

export function createNseMarketDataTools(): Tool[] {
  // Touch store to initialize DB on first call
  getStore();
  return [
    nseMarketCleanTool,
    nseMarketBackfillTool,
    nseMarketUpdateTool,
    nseWatchlistAddTool,
    nseWatchlistRemoveTool,
    nseWatchlistShowTool,
    nseMarketHistoryTool,
    nseMarketScreenTool,
  ];
}
