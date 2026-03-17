'use client';

import { useState } from 'react';
import Link from 'next/link';

const FREE_FEATURES = [
  'CSV upload & P&L summary',
  'Top 1 pattern detected',
  'Basic dashboard',
  'No account needed',
];

const PRO_FEATURES = [
  'All 4 behavioral patterns',
  'AI-powered debrief',
  'Weekly review & trends',
  'Edge scorecard',
  'Cost of behavior simulation',
  'Unlimited upload history',
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start checkout');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e0e8]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22]">
        <Link href="/" className="font-display text-2xl tracking-wider text-[#00e87a]">
          FLINCH
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            About
          </Link>
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="font-display text-5xl sm:text-6xl tracking-wide text-center mb-4">
          SIMPLE PRICING
        </h1>
        <p className="text-center text-[#6b6b78] font-mono text-sm mb-16">
          Built for beginner and intermediate traders.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FREE */}
          <div className="rounded border border-[#1c1c22] bg-[#0c0c0f] p-8 flex flex-col">
            <h2 className="font-display text-3xl tracking-wide mb-1">FREE</h2>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-mono text-4xl font-bold text-[#e0e0e8]">$0</span>
              <span className="text-sm text-[#6b6b78] font-mono">/forever</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="text-[#00e87a] mt-0.5">&#10004;</span>
                  <span className="text-[#e0e0e8]">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/upload"
              className="block text-center py-3 border border-[#28282f] text-[#e0e0e8] rounded font-mono font-bold text-sm hover:bg-[#101014] transition-colors"
            >
              Start Free
            </Link>
          </div>

          {/* PRO */}
          <div className="rounded border border-[#00e87a]/30 bg-[#0c0c0f] p-8 flex flex-col relative"
            style={{ boxShadow: '0 0 30px rgba(0, 232, 122, 0.08)' }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#070709] border border-[#00e87a]/30 rounded text-[10px] font-mono text-[#00e87a] tracking-wider whitespace-nowrap">
              14-DAY FREE TRIAL &middot; NO CREDIT CARD
            </div>
            <h2 className="font-display text-3xl tracking-wide mb-1 text-[#00e87a]">PRO</h2>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-mono text-4xl font-bold text-[#e0e0e8]">$29</span>
              <span className="text-sm text-[#6b6b78] font-mono">/mo</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="text-[#00e87a] mt-0.5">&#10004;</span>
                  <span className="text-[#e0e0e8]">{f}</span>
                </li>
              ))}
            </ul>
            {error && (
              <div className="mb-3 p-2 rounded bg-[rgba(255,69,96,0.08)] border border-[#ff4560]/20 text-[#ff4560] text-xs font-mono">
                {error}
              </div>
            )}
            <button
              onClick={handleStartTrial}
              disabled={loading}
              className="w-full py-3 bg-[#00e87a] text-[#070709] rounded font-mono font-bold text-sm hover:bg-[#00e87a]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#070709] border-t-transparent rounded-full animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#6b6b78] font-mono mt-10">
          Built for beginner and intermediate traders.
        </p>
      </div>
    </div>
  );
}
