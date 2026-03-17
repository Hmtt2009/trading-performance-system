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

        // Try metadata-based lookup first (initial activation from checkout)
        const metadata = membership.metadata as Record<string, string> | undefined;
        const supabaseUserId = metadata?.supabase_user_id;

        let activateResult;
        if (supabaseUserId) {
          // First activation: link by supabase user ID from checkout metadata
          activateResult = await supabase
            .from('users')
            .update({
              subscription_tier: 'paid',
              subscription_status: 'active',
              whop_membership_id: membership.id,
              whop_user_id: whopUserId,
            })
            .eq('id', supabaseUserId)
            .select();
        } else {
          // Renewal/reactivation: user already linked, find by whop_user_id
          activateResult = await supabase
            .from('users')
            .update({
              subscription_tier: 'paid',
              subscription_status: 'active',
              whop_membership_id: membership.id,
            })
            .eq('whop_user_id', whopUserId)
            .select();
        }

        if (activateResult.error) {
          console.error('Failed to activate membership:', activateResult.error);
        } else if (!activateResult.data || activateResult.data.length === 0) {
          console.error('Membership activated but no matching user found:', {
            whopUserId,
            supabaseUserId: supabaseUserId || null,
            membershipId: membership.id,
          });
        }
        break;
      }

      case 'membership.deactivated': {
        const membership = event.data;
        const whopUserId = membership.user?.id;
        if (!whopUserId) break;

        const { data: deactivateData, error: deactivateError } = await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            whop_membership_id: null,
          })
          .eq('whop_user_id', whopUserId)
          .select();

        if (deactivateError) {
          console.error('Failed to deactivate membership:', deactivateError);
        } else if (!deactivateData || deactivateData.length === 0) {
          console.error('Membership deactivated but no matching user found:', {
            whopUserId,
            membershipId: membership.id,
          });
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
        const { data: paymentData, error: paymentError } = await supabase
          .from('users')
          .update({ subscription_status: 'past_due' })
          .eq('whop_membership_id', membershipId)
          .select();

        if (paymentError) {
          console.error('Failed to update payment status:', paymentError);
        } else if (!paymentData || paymentData.length === 0) {
          console.error('Payment failed but no matching user found:', {
            membershipId,
            paymentId: payment.id,
          });
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
