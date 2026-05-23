// Technical indicators computed from OHLCV close price arrays
// Implemented per Section 12 of tools-nse-market-data.md

// RSI — Relative Strength Index (Wilder's smoothing)
// Returns array of RSI values; first (period-1) values are null (insufficient data)
export function computeRsi(_closes: number[], _period = 14): number[] {
  throw new Error('Not implemented');
}

// EMA — Exponential Moving Average (seeded from first-period SMA)
export function computeEma(_closes: number[], _period: number): number[] {
  throw new Error('Not implemented');
}

// SMA — Simple Moving Average
export function computeSma(_closes: number[], _period: number): number[] {
  throw new Error('Not implemented');
}

// MACD — Moving Average Convergence Divergence
// Returns { macd, signal, histogram }[] aligned to the input array length
export function computeMacd(
  _closes: number[],
  _fast = 12,
  _slow = 26,
  _signalPeriod = 9,
): Array<{ macd: number; signal: number; histogram: number }> {
  throw new Error('Not implemented');
}
