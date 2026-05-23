import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { fetchOhlcv } from './fetcher';
import { migrate } from './schema';

export interface OhlcvRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
}

export interface SyncResult {
  symbol: string;
  rowsInserted: number;
  fromDate: string;
  toDate: string;
}

export interface ScreenerRow {
  symbol: string;
  close: number;
  volume: number;
  high52w: number;
  low52w: number;
  pctFrom52wHigh: number;
  avgVolume20d: number;
  volumeSurge: number;
}

export interface WatchlistEntry {
  symbol: string;
  notes: string | null;
  addedAt: number;
}

function addOneDayToDate(date: string): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export class MarketDataStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    migrate(this.db);
  }

  close(): void {
    this.db.close();
  }

  clean(): { rowsDeleted: { ohlcv: number; watchlist: number; syncMeta: number } } {
    const cleanTx = this.db.transaction(() => {
      const ohlcv = this.db.prepare('DELETE FROM ohlcv_daily').run().changes;
      const watchlist = this.db.prepare('DELETE FROM watchlist').run().changes;
      const syncMeta = this.db.prepare('DELETE FROM sync_meta').run().changes;
      return { ohlcv, watchlist, syncMeta };
    });
    const result = cleanTx() as { ohlcv: number; watchlist: number; syncMeta: number };
    return { rowsDeleted: result };
  }

  // ---------------------------------------------------------------------------
  // Network methods
  // ---------------------------------------------------------------------------

  async backfillSymbol(symbol: string, fromDate: string): Promise<SyncResult> {
    const toDate = new Date().toISOString().slice(0, 10);
    const rows = await fetchOhlcv(symbol, fromDate, toDate);
    this.insertOhlcv(rows);
    const lastDate = rows[rows.length - 1]?.date ?? toDate;
    this.db
      .prepare('INSERT OR REPLACE INTO sync_meta (symbol, last_sync, last_date) VALUES (?, ?, ?)')
      .run(symbol, Date.now(), lastDate);
    return { symbol, rowsInserted: rows.length, fromDate, toDate };
  }

  async backfillAll(
    symbols: string[],
    fromDate: string,
    onProgress?: (done: number, total: number, symbol: string) => void,
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    let done = 0;
    for (const symbol of symbols) {
      try {
        const result = await this.backfillSymbol(symbol, fromDate);
        results.push(result);
      } catch (err) {
        console.error(`backfillAll: failed for ${symbol}:`, err);
        results.push({
          symbol,
          rowsInserted: 0,
          fromDate,
          toDate: new Date().toISOString().slice(0, 10),
        });
      }
      done++;
      onProgress?.(done, symbols.length, symbol);
    }
    return results;
  }

  async updateSymbol(symbol: string): Promise<SyncResult> {
    const row = this.db.prepare('SELECT last_date FROM sync_meta WHERE symbol = ?').get(symbol) as
      | { last_date: string }
      | undefined;

    const lastDate =
      row?.last_date ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const fromDate = addOneDayToDate(lastDate);
    const today = new Date().toISOString().slice(0, 10);

    if (fromDate > today) {
      return { symbol, rowsInserted: 0, fromDate, toDate: today };
    }

    return this.backfillSymbol(symbol, fromDate);
  }

  async updateWatchlist(): Promise<SyncResult[]> {
    const rows = this.db.prepare('SELECT DISTINCT symbol FROM watchlist').all() as Array<{
      symbol: string;
    }>;
    const results: SyncResult[] = [];
    for (const row of rows) {
      try {
        results.push(await this.updateSymbol(row.symbol));
      } catch (err) {
        console.error(`updateWatchlist: failed for ${row.symbol}:`, err);
        results.push({
          symbol: row.symbol,
          rowsInserted: 0,
          fromDate: '',
          toDate: new Date().toISOString().slice(0, 10),
        });
      }
    }
    return results;
  }

  async updateAll(): Promise<SyncResult[]> {
    const rows = this.db.prepare('SELECT symbol FROM sync_meta').all() as Array<{ symbol: string }>;
    const results: SyncResult[] = [];
    for (const row of rows) {
      try {
        results.push(await this.updateSymbol(row.symbol));
      } catch (err) {
        console.error(`updateAll: failed for ${row.symbol}:`, err);
        results.push({
          symbol: row.symbol,
          rowsInserted: 0,
          fromDate: '',
          toDate: new Date().toISOString().slice(0, 10),
        });
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Watchlist
  // ---------------------------------------------------------------------------

  watchlistAdd(symbol: string, listName = 'default', notes?: string): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO watchlist (symbol, list_name, notes, added_at) VALUES (?, ?, ?, ?)',
      )
      .run(symbol, listName, notes ?? null, Date.now());
  }

  watchlistRemove(symbol: string, listName = 'default'): void {
    this.db
      .prepare('DELETE FROM watchlist WHERE symbol = ? AND list_name = ?')
      .run(symbol, listName);
  }

  watchlistList(listName = 'default'): WatchlistEntry[] {
    const rows = this.db
      .prepare(
        'SELECT symbol, notes, added_at FROM watchlist WHERE list_name = ? ORDER BY added_at ASC',
      )
      .all(listName) as Array<{ symbol: string; notes: string | null; added_at: number }>;
    return rows.map((r) => ({ symbol: r.symbol, notes: r.notes, addedAt: r.added_at }));
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  getHistory(symbol: string, days = 252): OhlcvRow[] {
    const rows = this.db
      .prepare(
        `SELECT symbol, date, open, high, low, close, volume, adj_close
         FROM (
           SELECT symbol, date, open, high, low, close, volume, adj_close
           FROM ohlcv_daily
           WHERE symbol = ?
           ORDER BY date DESC
           LIMIT ?
         )
         ORDER BY date ASC`,
      )
      .all(symbol, days) as Array<{
      symbol: string;
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      adj_close: number | null;
    }>;
    return rows.map((r) => ({
      symbol: r.symbol,
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      adjClose: r.adj_close,
    }));
  }

  // ---------------------------------------------------------------------------
  // Screener
  // ---------------------------------------------------------------------------

  screen(opts: {
    listName?: string;
    minVolumeSurge?: number;
    nearHighPct?: number;
  }): ScreenerRow[] {
    const listName = opts.listName ?? 'default';
    const symbols = this.watchlistList(listName).map((e) => e.symbol);
    if (symbols.length === 0) return [];

    const results: ScreenerRow[] = [];

    for (const symbol of symbols) {
      const rows = this.getHistory(symbol, 252);
      if (rows.length === 0) continue;

      const last = rows[rows.length - 1];
      if (!last) continue;

      const high52w = Math.max(...rows.map((r) => r.high));
      const low52w = Math.min(...rows.map((r) => r.low));
      const pctFrom52wHigh = high52w > 0 ? ((high52w - last.close) / high52w) * 100 : 0;

      const recent20 = rows.slice(-20);
      const avgVolume20d =
        recent20.length > 0
          ? recent20.reduce((sum, r) => sum + r.volume, 0) / recent20.length
          : last.volume;
      const volumeSurge = avgVolume20d > 0 ? last.volume / avgVolume20d : 1;

      if (opts.minVolumeSurge !== undefined && volumeSurge < opts.minVolumeSurge) continue;
      if (opts.nearHighPct !== undefined && pctFrom52wHigh > opts.nearHighPct) continue;

      results.push({
        symbol,
        close: last.close,
        volume: last.volume,
        high52w,
        low52w,
        pctFrom52wHigh,
        avgVolume20d,
        volumeSurge,
      });
    }

    return results.sort((a, b) => b.volumeSurge - a.volumeSurge);
  }

  // ---------------------------------------------------------------------------
  // Raw insert — used by fetcher (Phase 2) and tests
  // ---------------------------------------------------------------------------

  insertOhlcv(rows: OhlcvRow[]): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ohlcv_daily (symbol, date, open, high, low, close, volume, adj_close)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = this.db.transaction((items: OhlcvRow[]) => {
      for (const r of items) {
        stmt.run(
          r.symbol,
          r.date,
          r.open,
          r.high,
          r.low,
          r.close,
          Math.round(r.volume),
          r.adjClose ?? null,
        );
      }
    });
    insertMany(rows);
    return rows.length;
  }
}
