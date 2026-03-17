import { NextRequest, NextResponse } from 'next/server';
import { getWhopClient } from '@/lib/whop/client';

/**
 * Whop webhook handler.
 * Processes membership and payment events to keep user subscription status in sync.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const whop = getWhopClient();
    const body = await request.text();
    const headers = Object.fromEntries(request.headers);

    // Verify signature and unwrap the webhook event
    const event = whop.webhooks.unwrap(body, { headers });

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    switch (event.type) {
      case 'membership.activated': {
        const membership = event.data;
        const whopUserId = membership.user?.id;
        if (!whopUserId) break;

        // Find user by whop_user_id and activate their subscription
        const { error } = await supabase
          .from('users')
          .update({
            subscription_tier: 'paid',
            subscription_status: 'active',
            whop_membership_id: membership.id,
          })
          .eq('whop_user_id', whopUserId);

        if (error) {
          console.error('Failed to activate membership:', error);
        }
        break;
      }

      case 'membership.deactivated': {
        const membership = event.data;
        const whopUserId = membership.user?.id;
        if (!whopUserId) break;

        const { error } = await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            whop_membership_id: null,
          })
          .eq('whop_user_id', whopUserId);

        if (error) {
          console.error('Failed to deactivate membership:', error);
        }
        break;
      }

      case 'payment.succeeded': {
        // Log successful payment — subscription state is handled by membership events
        console.log('Payment succeeded:', event.data.id);
        break;
      }

      case 'payment.failed': {
        const payment = event.data;
        const membershipId = payment.membership?.id;
        if (!membershipId) break;

        // Mark subscription as past_due on payment failure
        const { error } = await supabase
          .from('users')
          .update({ subscription_status: 'past_due' })
          .eq('whop_membership_id', membershipId);

        if (error) {
          console.error('Failed to update payment status:', error);
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    );
  }
}
