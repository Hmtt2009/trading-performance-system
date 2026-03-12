'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-14 h-14 rounded bg-green/10 text-green font-display text-3xl tracking-wider">
              T
            </div>
          </div>
          <h1 className="font-display text-4xl tracking-wide mb-2">
            CHECK YOUR EMAIL
          </h1>
          <p className="text-sm text-muted font-mono mb-6">
            We sent a confirmation link to{' '}
            <span className="text-foreground font-bold">{email}</span>.
            <br />
            Click the link to activate your account.
          </p>
          <Link
            href="/login"
            className="text-green hover:text-green/80 transition-colors text-sm font-mono font-bold"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded bg-green/10 text-green font-display text-3xl tracking-wider">
            T
          </div>
        </div>

        <h1 className="font-display text-4xl tracking-wide text-center mb-1">
          CREATE ACCOUNT
        </h1>
        <p className="text-sm text-muted text-center mb-8 font-mono">
          Start tracking your trading performance
        </p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-bg border border-red/20 text-red text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-widest font-mono font-bold mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 text-sm font-mono rounded bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-green/50 transition-colors"
              placeholder="trader@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] text-muted uppercase tracking-widest font-mono font-bold mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm font-mono rounded bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-green/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-[10px] text-muted uppercase tracking-widest font-mono font-bold mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm font-mono rounded bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-green/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green text-background rounded text-sm font-mono font-bold hover:bg-green/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                CREATING ACCOUNT...
              </>
            ) : (
              'CREATE ACCOUNT'
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-background text-[10px] text-muted font-mono uppercase tracking-widest">
              or
            </span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={googleLoading}
          className="w-full py-2.5 border border-border-light text-foreground rounded text-sm font-mono font-bold hover:bg-panel transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {googleLoading ? (
            <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          CONTINUE WITH GOOGLE
        </button>

        <p className="mt-6 text-center text-xs text-muted font-mono">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-green hover:text-green/80 transition-colors font-bold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
