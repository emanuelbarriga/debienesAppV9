import { describe, it, expect } from 'vitest';
import { buildBalanceId, getNextIndexOnSkip } from '../utils/importBalanceHelpers';

describe('importBalanceHelpers', () => {
  it('buildBalanceId crea IDs determinísticos {NIT}_{YYYYMM} con NIT normalizado', () => {
    expect(buildBalanceId('123.456-7', 2025, 3)).toBe('1234567_202503');
    expect(buildBalanceId(' 805.031.544-8 ', 2024, 11)).toBe('8050315448_202411');
    expect(buildBalanceId('099', 2023, 1)).toBe('099_202301');
  });

  it('getNextIndexOnSkip avanza y marca done en el último', () => {
    // total 3
    expect(getNextIndexOnSkip(0, 3)).toEqual({ next: 1, done: false });
    expect(getNextIndexOnSkip(1, 3)).toEqual({ next: 2, done: false });
    expect(getNextIndexOnSkip(2, 3)).toEqual({ next: 2, done: true });
    // bordes
    expect(getNextIndexOnSkip(0, 0)).toEqual({ next: 0, done: true });
    expect(getNextIndexOnSkip(5, 1)).toEqual({ next: 0, done: true });
  });
});
