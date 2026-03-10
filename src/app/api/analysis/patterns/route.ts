import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patternType = searchParams.get('type');
    const sessionId = searchParams.get('sessionId');

    let query = supabase
      .from('pattern_detections')
      .select(`
        *,
        trading_sessions (session_date)
      `)
      .eq('user_id', user.id)
      .eq('user_dismissed', false)
      .order('created_at', { ascending: false });

    if (patternType) {
      query = query.eq('pattern_type', patternType);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: patterns, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
    }

    return NextResponse.json({ patterns });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
