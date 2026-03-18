import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getSubscription, getFeatureAccess } from '@/lib/auth/checkSubscription';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('email, display_name, subscription_tier, subscription_status, created_at')
      .eq('id', user.id)
      .single();

    const sub = await getSubscription(user.id);
    const access = getFeatureAccess(sub.tier);

    return NextResponse.json({
      user: {
        id: user.id,
        email: profile?.email || user.email,
        displayName: profile?.display_name || null,
        subscriptionTier: sub.tier,
        subscriptionStatus: sub.status,
        createdAt: profile?.created_at || null,
      },
      access,
    });
  } catch (err) {
    console.error('Profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : undefined;

    if (displayName === undefined) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName || null })
      .eq('id', user.id);

    if (error) return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
