import { NextRequest, NextResponse } from 'next/server';
import { getWhopClient } from '@/lib/whop/client';

function truncateId(id: string | undefined | null): string {
  if (!id) return '<none>';
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let dbError = false;

    switch (event.type) {
      case 'membership.activated': {
        const membership = event.data;
        if (!membership || typeof membership !== 'object') {
          console.error('Invalid membership data in activated event');
          dbError = true;
          break;
        }
        const whopUserId = membership.user?.id;
        if (!whopUserId || typeof whopUserId !== 'string') break;

        // Try metadata-based lookup first (initial activation from checkout)
        const rawMetadata = membership.metadata as Record<string, unknown> | null | undefined;
        const supabaseUserId =
          typeof rawMetadata?.supabase_user_id === 'string' && UUID_REGEX.test(rawMetadata.supabase_user_id)
            ? rawMetadata.supabase_user_id
            : undefined;

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
          dbError = true;
        } else if (!activateResult.data || activateResult.data.length === 0) {
          console.error('Membership activated but no matching user found:', {
            whopUserId: truncateId(whopUserId),
            supabaseUserId: truncateId(supabaseUserId),
            membershipId: truncateId(membership.id),
          });
          dbError = true;
        }
        break;
      }

      case 'membership.deactivated': {
        const membership = event.data;
        if (!membership || typeof membership !== 'object') {
          console.error('Invalid membership data in deactivated event');
          dbError = true;
          break;
        }
        const whopUserId = membership.user?.id;
        if (!whopUserId || typeof whopUserId !== 'string') break;

        // Keep whop_membership_id for audit trail and payment.failed lookups
        const { data: deactivateData, error: deactivateError } = await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
          })
          .eq('whop_user_id', whopUserId)
          .select();

        if (deactivateError) {
          console.error('Failed to deactivate membership:', deactivateError);
          dbError = true;
        } else if (!deactivateData || deactivateData.length === 0) {
          console.error('Membership deactivated but no matching user found:', {
            whopUserId: truncateId(whopUserId),
            membershipId: truncateId(membership.id),
          });
          dbError = true;
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
          dbError = true;
        } else if (!paymentData || paymentData.length === 0) {
          console.error('Payment failed but no matching user found:', {
            membershipId: truncateId(membershipId),
            paymentId: truncateId(payment.id),
          });
          dbError = true;
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    // Return 500 on DB failure so Whop retries the webhook
    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to process webhook' },
        { status: 500 }
      );
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
