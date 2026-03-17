import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  // Validate next parameter to prevent open redirect
  const safeNext = /^\/[a-zA-Z0-9\/_-]*$/.test(next) ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    console.error('Auth callback error:', error.message, error);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
