import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

/**
 * GET /api/billing/status
 * Returns the current user's subscription status.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        trialEndsAt: null,
        isPro: false,
      });
    }

    const isPro = profile.subscription_tier === 'paid' && profile.subscription_status === 'active';

    return NextResponse.json({
      tier: profile.subscription_tier,
      status: profile.subscription_status,
      trialEndsAt: profile.trial_ends_at,
      isPro,
    });
  } catch (err) {
    console.error('Billing status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
