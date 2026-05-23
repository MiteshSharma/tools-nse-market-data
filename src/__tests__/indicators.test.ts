import { describe, expect, it } from 'vitest';
import { computeEma, computeMacd, computeRsi, computeSma } from '../indicators';

describe('computeSma', () => {
  it('returns empty array when closes < period', () => {
    expect(computeSma([1, 2, 3], 5)).toStrictEqual([]);
    expect(computeSma([], 14)).toStrictEqual([]);
  });

  it('computes correct SMA for known values', () => {
    const result = computeSma([2, 4, 6, 8, 10], 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(4, 5); // (2+4+6)/3
    expect(result[1]).toBeCloseTo(6, 5); // (4+6+8)/3
    expect(result[2]).toBeCloseTo(8, 5); // (6+8+10)/3
  });

  it('returns single value when closes.length === period', () => {
    expect(computeSma([1, 2, 3], 3)).toStrictEqual([2]);
  });
});

describe('computeEma', () => {
  it('returns empty array when closes < period', () => {
    expect(computeEma([1, 2], 5)).toStrictEqual([]);
    expect(computeEma([], 20)).toStrictEqual([]);
  });

  it('seeds first value from SMA', () => {
    const result = computeEma([2, 4, 6, 8, 10], 3);
    expect(result[0]).toBeCloseTo(4, 5); // SMA of [2,4,6]
  });

  it('applies multiplier correctly', () => {
    // period=3, multiplier = 2/(3+1) = 0.5
    // seed = mean([2,4,6]) = 4
    // ema[1] = 8 * 0.5 + 4 * 0.5 = 6
    const result = computeEma([2, 4, 6, 8, 10], 3);
    expect(result[0]).toBeCloseTo(4, 5);
    expect(result[1]).toBeCloseTo(6, 5);
    expect(result[2]).toBeCloseTo(8, 5);
  });

  it('length = closes.length - period + 1', () => {
    expect(computeEma([1, 2, 3, 4, 5], 3)).toHaveLength(3);
  });
});

describe('computeRsi', () => {
  it('returns empty array when closes.length <= period', () => {
    expect(computeRsi([1, 2, 3], 14)).toStrictEqual([]);
    expect(computeRsi(new Array(14).fill(1), 14)).toStrictEqual([]);
    expect(computeRsi([], 14)).toStrictEqual([]);
  });

  it('returns 100 when all moves are up (no losses)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => i + 1);
    const rsi = computeRsi(closes, 14);
    expect(rsi[0]).toBe(100);
  });

  it('computes first RSI value close to known reference (~70.53)', () => {
    // 15 closes that produce avgGain=0.24, avgLoss=0.10 over 14 changes
    // → RS = 2.4, RSI ≈ 70.59 (matches Investopedia's stated reference value)
    const closes = [
      100.0, 100.48, 100.28, 100.76, 100.56, 101.04, 100.84, 101.32, 101.12, 101.6, 101.4, 101.88,
      101.68, 102.16, 101.96,
    ];
    const rsi = computeRsi(closes, 14);
    expect(rsi).toHaveLength(1);
    expect(rsi[0]).toBeCloseTo(70.59, 0); // within ±0.5
  });

  it('result length = closes.length - period', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i));
    expect(computeRsi(closes, 14)).toHaveLength(6);
  });
});

describe('computeMacd', () => {
  it('returns empty array when not enough data', () => {
    expect(computeMacd(new Array(10).fill(100))).toStrictEqual([]);
    expect(computeMacd([])).toStrictEqual([]);
  });

  it('returns objects with macd, signal, histogram', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5 + Math.sin(i));
    const result = computeMacd(closes);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('macd');
    expect(result[0]).toHaveProperty('signal');
    expect(result[0]).toHaveProperty('histogram');
  });

  it('histogram = macd - signal', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = computeMacd(closes);
    for (const row of result) {
      expect(row.histogram).toBeCloseTo(row.macd - row.signal, 10);
    }
  });
});
