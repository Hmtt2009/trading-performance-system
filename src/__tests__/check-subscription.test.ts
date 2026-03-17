import { describe, it, expect } from 'vitest';
import { getFeatureAccess, filterPatternsByTier } from '@/lib/auth/checkSubscription';

describe('getFeatureAccess', () => {
  it('should grant full access for paid tier', () => {
    const access = getFeatureAccess('paid');
    expect(access.aiDebrief).toBe(true);
    expect(access.weeklyReview).toBe(true);
    expect(access.maxPatterns).toBe(4);
  });

  it('should restrict access for free tier', () => {
    const access = getFeatureAccess('free');
    expect(access.aiDebrief).toBe(false);
    expect(access.weeklyReview).toBe(false);
    expect(access.maxPatterns).toBe(1);
  });
});

describe('filterPatternsByTier', () => {
  const patterns = [
    { pattern_type: 'overtrading', id: '1' },
    { pattern_type: 'size_escalation', id: '2' },
    { pattern_type: 'rapid_reentry', id: '3' },
    { pattern_type: 'premature_exit', id: '4' },
  ];

  it('should return all patterns for paid users', () => {
    const result = filterPatternsByTier(patterns, 'paid');
    expect(result).toHaveLength(4);
  });

  it('should return only 1 pattern type for free users', () => {
    const result = filterPatternsByTier(patterns, 'free');
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('should return the first pattern type encountered for free users', () => {
    const result = filterPatternsByTier(patterns, 'free');
    expect(result).toHaveLength(1);
    expect(result[0].pattern_type).toBe('overtrading');
  });

  it('should handle empty patterns array', () => {
    const result = filterPatternsByTier([], 'free');
    expect(result).toHaveLength(0);
  });

  it('should handle multiple patterns of the same type for free users', () => {
    const sameType = [
      { pattern_type: 'overtrading', id: '1' },
      { pattern_type: 'overtrading', id: '2' },
      { pattern_type: 'size_escalation', id: '3' },
    ];
    const result = filterPatternsByTier(sameType, 'free');
    // All overtrading patterns should be included (same type counts as 1)
    expect(result.every((p) => p.pattern_type === 'overtrading')).toBe(true);
  });

  it('should preserve pattern objects unchanged', () => {
    const result = filterPatternsByTier(patterns, 'paid');
    expect(result[0]).toBe(patterns[0]);
  });
});
