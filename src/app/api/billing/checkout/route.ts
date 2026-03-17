import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getWhopClient } from '@/lib/whop/client';

/**
 * POST /api/billing/checkout
 * Creates a Whop checkout configuration and returns the checkout URL.
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

    const whop = getWhopClient();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: 'Application URL not configured' },
        { status: 503 }
      );
    }
    const returnUrl = `${appUrl}/dashboard?checkout=success`;

    // Create checkout using plan_id variant (no company_id needed)
    const checkout = await whop.checkoutConfigurations.create({
      plan_id: planId,
      redirect_url: returnUrl,
      metadata: {
        supabase_user_id: user.id,
        email: user.email || '',
      },
    });

    const checkoutUrl = checkout.purchase_url;

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
