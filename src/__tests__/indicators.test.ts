import { describe, expect, it } from 'vitest';
import { computeRsi, computeEma, computeSma } from '../indicators';

describe('indicators', () => {
  it('returns empty array when fewer closes than period', () => {
    // TODO: implement
    expect(computeRsi([], 14)).toStrictEqual([]);
    expect(computeEma([], 20)).toStrictEqual([]);
    expect(computeSma([], 14)).toStrictEqual([]);
  });
});
