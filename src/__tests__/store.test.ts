import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OhlcvRow } from '../store';
import { MarketDataStore } from '../store';

function makeRow(symbol: string, date: string, close: number, volume = 1_000_000): OhlcvRow {
  return {
    symbol,
    date,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
    adjClose: null,
  };
}

describe('MarketDataStore', () => {
  let store: MarketDataStore;

  beforeEach(() => {
    store = new MarketDataStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  // ---------------------------------------------------------------------------
  // clean()
  // ---------------------------------------------------------------------------

  describe('clean()', () => {
    it('returns zero counts when tables are empty', () => {
      const result = store.clean();
      expect(result.rowsDeleted.ohlcv).toBe(0);
      expect(result.rowsDeleted.watchlist).toBe(0);
      expect(result.rowsDeleted.syncMeta).toBe(0);
    });

    it('deletes all rows and returns correct counts', () => {
      store.insertOhlcv([makeRow('RELIANCE.NS', '2024-01-01', 2400)]);
      store.insertOhlcv([makeRow('TCS.NS', '2024-01-01', 3800)]);
      store.watchlistAdd('RELIANCE.NS');
      store.watchlistAdd('TCS.NS');

      const result = store.clean();
      expect(result.rowsDeleted.ohlcv).toBe(2);
      expect(result.rowsDeleted.watchlist).toBe(2);

      expect(store.getHistory('RELIANCE.NS')).toHaveLength(0);
      expect(store.watchlistList()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // watchlist
  // ---------------------------------------------------------------------------

  describe('watchlistAdd / watchlistRemove / watchlistList', () => {
    it('adds a symbol and lists it', () => {
      store.watchlistAdd('RELIANCE.NS');
      const list = store.watchlistList();
      expect(list).toHaveLength(1);
      expect(list[0]?.symbol).toBe('RELIANCE.NS');
      expect(list[0]?.notes).toBeNull();
    });

    it('adds with notes', () => {
      store.watchlistAdd('TCS.NS', 'default', 'IT bellwether');
      const list = store.watchlistList();
      expect(list[0]?.notes).toBe('IT bellwether');
    });

    it('duplicate add is idempotent (INSERT OR REPLACE)', () => {
      store.watchlistAdd('INFY.NS');
      store.watchlistAdd('INFY.NS');
      expect(store.watchlistList()).toHaveLength(1);
    });

    it('removes a symbol', () => {
      store.watchlistAdd('RELIANCE.NS');
      store.watchlistRemove('RELIANCE.NS');
      expect(store.watchlistList()).toHaveLength(0);
    });

    it('remove on non-existent symbol does not throw', () => {
      expect(() => store.watchlistRemove('UNKNOWN.NS')).not.toThrow();
    });

    it('supports named lists', () => {
      store.watchlistAdd('RELIANCE.NS', 'core');
      store.watchlistAdd('TCS.NS', 'tech');
      expect(store.watchlistList('core')).toHaveLength(1);
      expect(store.watchlistList('tech')).toHaveLength(1);
      expect(store.watchlistList('default')).toHaveLength(0);
    });

    it('returns entries ordered by addedAt ASC', async () => {
      store.watchlistAdd('A.NS');
      await new Promise((r) => setTimeout(r, 5));
      store.watchlistAdd('B.NS');
      const list = store.watchlistList();
      expect(list[0]?.symbol).toBe('A.NS');
      expect(list[1]?.symbol).toBe('B.NS');
    });
  });

  // ---------------------------------------------------------------------------
  // insertOhlcv / getHistory
  // ---------------------------------------------------------------------------

  describe('insertOhlcv / getHistory', () => {
    it('inserts rows and retrieves them in chronological order', () => {
      store.insertOhlcv([
        makeRow('RELIANCE.NS', '2024-01-03', 2400),
        makeRow('RELIANCE.NS', '2024-01-01', 2380),
        makeRow('RELIANCE.NS', '2024-01-02', 2390),
      ]);
      const history = store.getHistory('RELIANCE.NS');
      expect(history).toHaveLength(3);
      expect(history[0]?.date).toBe('2024-01-01');
      expect(history[1]?.date).toBe('2024-01-02');
      expect(history[2]?.date).toBe('2024-01-03');
    });

    it('respects the days limit', () => {
      const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow('TCS.NS', `2024-01-${String(i + 1).padStart(2, '0')}`, 3800 + i),
      );
      store.insertOhlcv(rows);
      expect(store.getHistory('TCS.NS', 5)).toHaveLength(5);
    });

    it('returns most recent N rows when days < total', () => {
      const rows = Array.from({ length: 5 }, (_, i) =>
        makeRow('INFY.NS', `2024-01-0${i + 1}`, 1500 + i),
      );
      store.insertOhlcv(rows);
      const history = store.getHistory('INFY.NS', 3);
      expect(history[0]?.date).toBe('2024-01-03');
      expect(history[2]?.date).toBe('2024-01-05');
    });

    it('INSERT OR REPLACE is idempotent', () => {
      store.insertOhlcv([makeRow('RELIANCE.NS', '2024-01-01', 2400)]);
      store.insertOhlcv([makeRow('RELIANCE.NS', '2024-01-01', 2450)]);
      const history = store.getHistory('RELIANCE.NS');
      expect(history).toHaveLength(1);
      expect(history[0]?.close).toBe(2450);
    });

    it('maps adj_close to adjClose', () => {
      const row: OhlcvRow = { ...makeRow('RELIANCE.NS', '2024-01-01', 2400), adjClose: 2395 };
      store.insertOhlcv([row]);
      expect(store.getHistory('RELIANCE.NS')[0]?.adjClose).toBe(2395);
    });

    it('returns empty array for unknown symbol', () => {
      expect(store.getHistory('UNKNOWN.NS')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // screen()
  // ---------------------------------------------------------------------------

  describe('screen()', () => {
    beforeEach(() => {
      store.watchlistAdd('RELIANCE.NS');
      store.watchlistAdd('TCS.NS');

      // RELIANCE: 252 days, increasing close, high volume on last day
      const relianceRows = Array.from({ length: 252 }, (_, i) =>
        makeRow(
          'RELIANCE.NS',
          `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
          2400 + i,
          500_000,
        ),
      );
      // Last row has a volume surge
      const lastReliance = relianceRows[251];
      if (lastReliance) {
        relianceRows[251] = makeRow('RELIANCE.NS', lastReliance.date, 2651, 2_000_000);
      }
      store.insertOhlcv(relianceRows);

      // TCS: 252 days, flat, normal volume
      const tcsRows = Array.from({ length: 252 }, (_, i) =>
        makeRow(
          'TCS.NS',
          `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
          3800,
          1_000_000,
        ),
      );
      store.insertOhlcv(tcsRows);
    });

    it('returns all watchlist symbols when no filters', () => {
      const results = store.screen({});
      expect(results).toHaveLength(2);
    });

    it('filters by minVolumeSurge', () => {
      // RELIANCE last day volume is 2_000_000, avg ~500k → surge ~4x
      // TCS all days same volume → surge = 1
      const results = store.screen({ minVolumeSurge: 2 });
      expect(results.map((r) => r.symbol)).toContain('RELIANCE.NS');
      expect(results.map((r) => r.symbol)).not.toContain('TCS.NS');
    });

    it('sorts by volumeSurge DESC', () => {
      const results = store.screen({});
      expect(results[0]?.symbol).toBe('RELIANCE.NS');
    });

    it('returns empty array when watchlist is empty', () => {
      store.clean();
      expect(store.screen({})).toHaveLength(0);
    });
  });
});
