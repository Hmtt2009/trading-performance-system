import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

/**
 * POST /api/billing/checkout
 * Returns the Whop checkout URL for the configured plan.
 */
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const planId = process.env.WHOP_PLAN_ID;
    if (!planId) {
      return NextResponse.json(
        { error: 'Payment configuration not set up' },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: 'Application URL not configured' },
        { status: 503 }
      );
    }

    const redirectUrl = encodeURIComponent(`${appUrl}/dashboard?checkout=success`);

    // Build Whop checkout URL directly — more reliable than SDK checkout config creation
    const checkoutUrl = `https://whop.com/checkout/${planId}/?d_metadata_supabase_user_id=${user.id}&d_metadata_email=${encodeURIComponent(user.email || '')}&redirect_url=${redirectUrl}`;

    return NextResponse.json({ url: checkoutUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Checkout error:', message, err);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 }
    );
  }
}
