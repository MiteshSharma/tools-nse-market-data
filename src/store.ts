import Database from 'better-sqlite3';

// Implemented per Section 9 of tools-nse-market-data.md

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

export class MarketDataStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    // TODO: implement per Section 8 of tools-nse-market-data.md
    throw new Error('Not implemented');
  }

  clean(): { rowsDeleted: { ohlcv: number; watchlist: number; syncMeta: number } } {
    throw new Error('Not implemented');
  }

  async backfillSymbol(_symbol: string, _fromDate: string): Promise<SyncResult> {
    throw new Error('Not implemented');
  }

  async backfillAll(
    _symbols: string[],
    _fromDate: string,
    _onProgress?: (done: number, total: number, symbol: string) => void,
  ): Promise<SyncResult[]> {
    throw new Error('Not implemented');
  }

  async updateSymbol(_symbol: string): Promise<SyncResult> {
    throw new Error('Not implemented');
  }

  async updateWatchlist(): Promise<SyncResult[]> {
    throw new Error('Not implemented');
  }

  async updateAll(): Promise<SyncResult[]> {
    throw new Error('Not implemented');
  }

  watchlistAdd(_symbol: string, _listName = 'default', _notes?: string): void {
    throw new Error('Not implemented');
  }

  watchlistRemove(_symbol: string, _listName = 'default'): void {
    throw new Error('Not implemented');
  }

  watchlistList(
    _listName = 'default',
  ): Array<{ symbol: string; notes: string | null; addedAt: number }> {
    throw new Error('Not implemented');
  }

  getHistory(_symbol: string, _days = 252): OhlcvRow[] {
    throw new Error('Not implemented');
  }

  screen(_opts: {
    listName?: string;
    minVolumeSurge?: number;
    nearHighPct?: number;
  }): ScreenerRow[] {
    throw new Error('Not implemented');
  }

  close(): void {
    this.db.close();
  }
}
