---
name: nse-market-data
description: |
  Domain knowledge for NSE India market data, Yahoo Finance integration, and the tools-nse-market-data
  package architecture. Read before implementing any data fetching, storage, or tool logic.
---

# NSE Market Data — Domain Knowledge

## NSE symbol format

| Exchange | Suffix | Example |
|---|---|---|
| NSE (National Stock Exchange) | `.NS` | `RELIANCE.NS` |
| BSE (Bombay Stock Exchange) | `.BO` | `RELIANCE.BO` |
| Nifty 50 Index | none (Yahoo) | `^NSEI` |

Use `.NS` for all equity tools unless the user specifies BSE.

## Yahoo Finance endpoints

```
# Historical OHLCV (1 year, daily)
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y&includeAdjustedClose=true

# Historical with date range
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&period1={unixSec}&period2={unixSec}

# Symbol search
GET https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=10&newsCount=0
```

Always include header: `User-Agent: Mozilla/5.0 (compatible; tools-nse-market-data/1.0)`

## Rate limiting

- 100ms minimum between calls
- Retry once on HTTP 429 (too many requests), then throw
- Do not parallelize more than 3 concurrent requests

## IST timezone conversion

Yahoo Finance timestamps are Unix seconds in UTC. NSE trading dates are in IST (UTC+5:30).

```typescript
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const d = new Date(timestamp * 1000 + IST_OFFSET_MS);
const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
```

Use UTC methods after adding the offset — never use local timezone methods.

## NSE trading calendar

- Market closed on weekends (Saturday, Sunday)
- Market closed on NSE holidays (Holi, Diwali, Independence Day, etc.)
- Trading hours: 09:15 – 15:30 IST
- Data available after 15:30 IST each trading day

## NSE Bhavcopy (future)

NSE publishes daily bulk data files (Bhavcopy) with all instrument prices:
```
https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip
```
Requires an active NSE session cookie — cannot be downloaded anonymously. Not implemented yet; scaffold exists in `src/bhavcopy.ts`.

## Key metrics for swing trading

| Metric | Definition | Typical use |
|---|---|---|
| 52-week high | `MAX(high)` over last 252 trading days | Breakout detection |
| 52-week low | `MIN(low)` over last 252 trading days | Support level |
| Volume surge | `volume / AVG(volume) over last 20 days` | Breakout confirmation |
| RSI(14) | 14-period Wilder's RSI | Overbought/oversold |
| EMA(20) | 20-day exponential moving average | Trend filter |
| EMA(50) | 50-day exponential moving average | Trend confirmation |

## Database location

Default: `~/.ethos/market-data/market.db`
Override: `NSE_MARKET_DATA_DB` environment variable or `--db` CLI flag
