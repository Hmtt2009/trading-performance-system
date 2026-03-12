import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { id } = await params;
    const { data: pattern } = await supabase.from('pattern_detections').select('id, user_id').eq('id', id).single();
    if (!pattern || pattern.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { error } = await supabase.from('pattern_detections').update({ user_dismissed: true, dismissed_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) { console.error('Dismiss error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
