import type Database from 'better-sqlite3';

export const SQL_CREATE_INSTRUMENTS = `
  CREATE TABLE IF NOT EXISTS instruments (
    symbol    TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    exchange  TEXT NOT NULL DEFAULT 'NSE',
    sector    TEXT,
    isin      TEXT,
    added_at  INTEGER NOT NULL
  ) STRICT;
`;

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
`;

export const SQL_CREATE_OHLCV_DATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON ohlcv_daily(date);
`;

export const SQL_CREATE_SYNC_META = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    symbol    TEXT PRIMARY KEY,
    last_sync INTEGER NOT NULL,
    last_date TEXT NOT NULL
  ) STRICT;
`;

export const SQL_CREATE_WATCHLIST = `
  CREATE TABLE IF NOT EXISTS watchlist (
    symbol    TEXT NOT NULL,
    list_name TEXT NOT NULL DEFAULT 'default',
    notes     TEXT,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (symbol, list_name)
  ) STRICT;
`;

export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SQL_CREATE_INSTRUMENTS);
  db.exec(SQL_CREATE_OHLCV_DAILY);
  db.exec(SQL_CREATE_OHLCV_DATE_INDEX);
  db.exec(SQL_CREATE_SYNC_META);
  db.exec(SQL_CREATE_WATCHLIST);
}
