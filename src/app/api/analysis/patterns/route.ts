import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { searchParams } = new URL(request.url);
    const patternType = searchParams.get('type');
    const sessionId = searchParams.get('sessionId');

    const validPatternTypes = ['overtrading', 'size_escalation', 'rapid_reentry', 'premature_exit'];
    if (patternType && !validPatternTypes.includes(patternType)) {
      return NextResponse.json({ error: 'Invalid pattern type' }, { status: 400 });
    }

    if (sessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    let query = supabase.from('pattern_detections').select('*').eq('user_id', user.id).eq('user_dismissed', false).order('created_at', { ascending: false }).limit(limit);
    if (patternType) query = query.eq('pattern_type', patternType);
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data: patterns, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
    return NextResponse.json({ patterns });
  } catch (err) { console.error('Patterns error:', err); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}