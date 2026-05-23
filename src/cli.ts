#!/usr/bin/env node

import { homedir } from 'node:os';
import { join } from 'node:path';
import { fetchQuote } from './fetcher';
import type { SyncResult } from './store';
import { MarketDataStore } from './store';
import { NSE_NIFTY50 } from './symbols';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDbPath(args: string[]): string {
  const dbFlag = args.indexOf('--db');
  if (dbFlag !== -1 && args[dbFlag + 1]) return args[dbFlag + 1] as string;
  const envDb = process.env.NSE_MARKET_DATA_DB;
  if (envDb) return envDb;
  return join(homedir(), '.ethos', 'market-data', 'market.db');
}

function getFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const dbPath = resolveDbPath(rawArgs);

  // Strip --db and its value from args before dispatching
  const dbIdx = rawArgs.indexOf('--db');
  const args = dbIdx !== -1 ? [...rawArgs.slice(0, dbIdx), ...rawArgs.slice(dbIdx + 2)] : rawArgs;

  const command = args[0];

  // Help
  if (!command || command === '--help' || command === '-h') {
    console.log(`nse-market-data — NSE India market data CLI

Commands:
  clean                     Delete all local market data
  backfill [--symbols A,B] [--from YYYY-MM-DD] [--all]
                            Download 1 year of OHLCV history
  update [--mode watchlist|all]
                            Fill missing days since last sync
  watchlist add SYMBOL [--list NAME] [--notes TEXT]
  watchlist remove SYMBOL [--list NAME]
  watchlist show [--list NAME]
  history SYMBOL [--days N]
                            Show OHLCV history from local DB
  screen [--list NAME] [--volume-surge N] [--near-high N]
                            Scan watchlist against technical criteria
  quote SYMBOL              Live price from Yahoo Finance

Options:
  --db PATH                 Override DB path (default: ~/.ethos/market-data/market.db)
  --help, -h                Show this help`);
    process.exit(0);
  }

  const store = new MarketDataStore(dbPath);

  try {
    switch (command) {
      // -----------------------------------------------------------------------
      case 'clean': {
        const { rowsDeleted } = store.clean();
        console.log(
          `Cleaned: ${rowsDeleted.ohlcv} OHLCV rows, ${rowsDeleted.syncMeta} sync records, ${rowsDeleted.watchlist} watchlist entries`,
        );
        break;
      }

      // -----------------------------------------------------------------------
      case 'backfill': {
        let symbols: string[];

        if (hasFlag(args, '--all')) {
          symbols = NSE_NIFTY50;
        } else {
          const symbolsFlag = getFlag(args, '--symbols');
          if (symbolsFlag) {
            symbols = symbolsFlag
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          } else {
            const watchlistEntries = store.watchlistList();
            if (watchlistEntries.length === 0) {
              console.error(
                'No symbols specified. Use --symbols A,B,C or --all, or add symbols to your watchlist first.',
              );
              process.exit(1);
            }
            symbols = watchlistEntries.map((e) => e.symbol);
          }
        }

        const fromDate =
          getFlag(args, '--from') ??
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const results: SyncResult[] = [];
        let idx = 0;
        for (const sym of symbols) {
          idx++;
          process.stdout.write(`Backfilling ${sym} (${idx}/${symbols.length})... `);
          try {
            const r = await store.backfillSymbol(sym, fromDate);
            results.push(r);
            console.log(`${r.rowsInserted} rows inserted`);
          } catch (e) {
            console.log(`ERROR: ${(e as Error).message}`);
            results.push({ symbol: sym, rowsInserted: 0, fromDate, toDate: '' });
          }
        }

        const totalRows = results.reduce((s, r) => s + r.rowsInserted, 0);
        console.log(`Done. ${symbols.length} symbols, ${totalRows} total rows inserted.`);
        break;
      }

      // -----------------------------------------------------------------------
      case 'update': {
        const mode = getFlag(args, '--mode') ?? 'watchlist';

        if (mode === 'watchlist') {
          const watchlistEntries = store.watchlistList();
          console.log(`Updating ${watchlistEntries.length} watchlist symbols...`);
        }

        const results = mode === 'all' ? await store.updateAll() : await store.updateWatchlist();

        if (mode === 'all') {
          console.log(`Updating ${results.length} all symbols...`);
        }

        let totalRows = 0;
        for (const r of results) {
          if (r.rowsInserted > 0) {
            console.log(`  ${r.symbol}: +${r.rowsInserted} rows (up to ${r.toDate})`);
            totalRows += r.rowsInserted;
          } else {
            console.log(`  ${r.symbol}: already up to date`);
          }
        }

        const updated = results.filter((r) => r.rowsInserted > 0).length;
        console.log(`Done. ${updated} symbols updated, ${totalRows} new rows total.`);
        break;
      }

      // -----------------------------------------------------------------------
      case 'watchlist': {
        const subcommand = args[1];

        if (subcommand === 'add') {
          const symbol = args[2];
          if (!symbol) {
            console.error('Usage: watchlist add SYMBOL');
            process.exit(1);
          }
          const list = getFlag(args, '--list') ?? 'default';
          const notes = getFlag(args, '--notes');
          store.watchlistAdd(symbol, list, notes);
          console.log(
            notes
              ? `Added ${symbol} to watchlist '${list}' (notes: "${notes}")`
              : `Added ${symbol} to watchlist '${list}'`,
          );
        } else if (subcommand === 'remove') {
          const symbol = args[2];
          if (!symbol) {
            console.error('Usage: watchlist remove SYMBOL');
            process.exit(1);
          }
          const list = getFlag(args, '--list') ?? 'default';
          const before = store.watchlistList(list);
          store.watchlistRemove(symbol, list);
          const after = store.watchlistList(list);
          if (before.length === after.length) {
            console.log(`${symbol} not found in watchlist '${list}'`);
          } else {
            console.log(`Removed ${symbol} from watchlist '${list}'`);
          }
        } else if (subcommand === 'show') {
          const list = getFlag(args, '--list') ?? 'default';
          const entries = store.watchlistList(list);
          if (entries.length === 0) {
            console.log(`Watchlist '${list}' is empty.`);
          } else {
            console.log(`Watchlist '${list}' (${entries.length} symbols):`);
            for (const entry of entries) {
              const dateStr = new Date(entry.addedAt).toISOString().slice(0, 10);
              const notePart = entry.notes ? `  "${entry.notes}"` : '';
              console.log(`  ${entry.symbol.padEnd(20)} added ${dateStr}${notePart}`);
            }
          }
        } else {
          console.error(
            `Unknown watchlist subcommand: ${subcommand ?? '(none)'}. Use add, remove, or show.`,
          );
          process.exit(1);
        }
        break;
      }

      // -----------------------------------------------------------------------
      case 'history': {
        const symbol = args[1];
        if (!symbol) {
          console.error('Usage: history SYMBOL [--days N]');
          process.exit(1);
        }
        const days = parseInt(getFlag(args, '--days') ?? '252', 10);
        const rows = store.getHistory(symbol, days);
        if (rows.length === 0) {
          console.log(`No data for ${symbol}. Run backfill first.`);
        } else {
          console.log(`${symbol} — last ${rows.length} days`);
          console.log('Date         Open      High      Low       Close     Volume');
          for (const r of rows) {
            console.log(
              `${r.date}  ${String(r.open.toFixed(2)).padStart(9)}  ${String(r.high.toFixed(2)).padStart(9)}  ${String(r.low.toFixed(2)).padStart(9)}  ${String(r.close.toFixed(2)).padStart(9)}  ${String(r.volume).padStart(10)}`,
            );
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      case 'screen': {
        const list = getFlag(args, '--list') ?? 'default';
        const volumeSurgeFlag = getFlag(args, '--volume-surge');
        const nearHighFlag = getFlag(args, '--near-high');
        const minVolumeSurge =
          volumeSurgeFlag !== undefined ? parseFloat(volumeSurgeFlag) : undefined;
        const nearHighPct = nearHighFlag !== undefined ? parseFloat(nearHighFlag) : undefined;
        console.log(`Screening watchlist '${list}'...`);
        const rows = store.screen({ listName: list, minVolumeSurge, nearHighPct });
        if (rows.length === 0) {
          console.log('No symbols matched the screen criteria.');
        } else {
          console.log('Symbol               Close     VolSurge  From52wH%  52wH      52wL');
          for (const r of rows) {
            console.log(
              `${r.symbol.padEnd(20)} ${String(r.close.toFixed(2)).padStart(9)} ${`${r.volumeSurge.toFixed(1)}x`.padStart(9)} ${`${r.pctFrom52wHigh.toFixed(1)}%`.padStart(10)} ${String(r.high52w.toFixed(2)).padStart(9)} ${String(r.low52w.toFixed(2)).padStart(9)}`,
            );
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      case 'quote': {
        const symbol = args[1];
        if (!symbol) {
          console.error('Usage: quote SYMBOL');
          process.exit(1);
        }
        const q = await fetchQuote(symbol);
        console.log(q.name);
        console.log(
          `Price: ₹${q.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${q.currency}`,
        );
        console.log('(15-minute delayed data via Yahoo Finance)');
        break;
      }

      // -----------------------------------------------------------------------
      default: {
        console.error(`Unknown command: ${command}. Run nse-market-data --help for usage.`);
        process.exit(1);
      }
    }
  } finally {
    store.close();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
