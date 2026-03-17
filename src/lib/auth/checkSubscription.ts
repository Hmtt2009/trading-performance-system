import { createClient } from '@/lib/supabase/server';

export const VALID_PATTERN_TYPES = ['overtrading', 'size_escalation', 'rapid_reentry', 'premature_exit'] as const;
export type PatternType = (typeof VALID_PATTERN_TYPES)[number];

export type SubscriptionTier = 'free' | 'paid';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due';
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .single();

  return {
    tier: (data?.subscription_tier as SubscriptionTier) ?? 'free',
    status: data?.subscription_status ?? 'active',
  };
}

export interface FeatureAccess {
  aiDebrief: boolean;
  weeklyReview: boolean;
  /** Number of pattern types visible (1 for free, 4 for paid) */
  maxPatterns: number;
}

export function getFeatureAccess(tier: SubscriptionTier): FeatureAccess {
  if (tier === 'paid') {
    return {
      aiDebrief: true,
      weeklyReview: true,
      maxPatterns: 4,
    };
  }

  return {
    aiDebrief: false,
    weeklyReview: false,
    maxPatterns: 1,
  };
}

export function filterPatternsByTier<T extends { pattern_type: string }>(
  patterns: T[],
  tier: SubscriptionTier
): T[] {
  const access = getFeatureAccess(tier);
  if (access.maxPatterns >= 4) return patterns;

  // Free users: show only patterns of the first N types encountered
  const allowedTypes = new Set<string>();
  for (const p of patterns) {
    allowedTypes.add(p.pattern_type);
    if (allowedTypes.size >= access.maxPatterns) break;
  }
  return patterns.filter((p) => allowedTypes.has(p.pattern_type));
}
