import { describe, expect, it } from 'vitest';
import { toNullableNumber } from '@/lib/nullableNumber';

describe('toNullableNumber', () => {
  it('preserves null values', () => {
    expect(toNullableNumber(null)).toBeNull();
  });

  it('preserves zero values', () => {
    expect(toNullableNumber(0)).toBe(0);
    expect(toNullableNumber('0')).toBe(0);
  });

  it('converts populated numeric values', () => {
    expect(toNullableNumber(12.5)).toBe(12.5);
    expect(toNullableNumber('12.5')).toBe(12.5);
  });
});
