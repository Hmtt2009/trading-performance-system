import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { data: pattern } = await supabase.from('pattern_detections').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { error } = await supabase.from('pattern_detections').update({ user_dismissed: true, dismissed_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) { console.error('Dismiss error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
