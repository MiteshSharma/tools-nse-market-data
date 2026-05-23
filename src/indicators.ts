export function computeSma(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const result: number[] = [];
  let windowSum = closes.slice(0, period).reduce((a, b) => a + b, 0);
  result.push(windowSum / period);
  for (let i = period; i < closes.length; i++) {
    windowSum += (closes[i] ?? 0) - (closes[i - period] ?? 0);
    result.push(windowSum / period);
  }
  return result;
}

export function computeEma(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const multiplier = 2 / (period + 1);
  const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result: number[] = [seed];
  for (let i = period; i < closes.length; i++) {
    result.push(
      (closes[i] ?? 0) * multiplier + (result[result.length - 1] ?? 0) * (1 - multiplier),
    );
  }
  return result;
}

export function computeRsi(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push((closes[i] ?? 0) - (closes[i - 1] ?? 0));
  }

  // Seed: simple mean of first `period` gains/losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i] ?? 0;
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  const result: number[] = [];

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0));

  // Wilder's smoothing for remaining values
  for (let i = period; i < changes.length; i++) {
    const c = changes[i] ?? 0;
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? Math.abs(c) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return result;
}

export function computeMacd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): Array<{ macd: number; signal: number; histogram: number }> {
  const fastEma = computeEma(closes, fast);
  const slowEma = computeEma(closes, slow);

  if (fastEma.length === 0 || slowEma.length === 0) return [];

  // Align: slowEma is shorter, take last slowEma.length values of fastEma
  const alignedFast = fastEma.slice(fastEma.length - slowEma.length);
  const macdLine = alignedFast.map((v, i) => v - (slowEma[i] ?? 0));

  const signalLine = computeEma(macdLine, signal);
  if (signalLine.length === 0) return [];

  // Align macdLine to signalLine length
  const alignedMacd = macdLine.slice(macdLine.length - signalLine.length);

  return alignedMacd.map((v, i) => ({
    macd: v,
    signal: signalLine[i] ?? 0,
    histogram: v - (signalLine[i] ?? 0),
  }));
}
