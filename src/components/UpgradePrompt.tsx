'use client';

import Link from 'next/link';

export function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green/10 mb-4">
        <svg className="w-7 h-7 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-display tracking-wide mb-2">PRO FEATURE</h3>
      <p className="text-sm text-muted font-mono mb-6 max-w-md mx-auto">
        <span className="text-foreground font-bold">{feature}</span> is available on the Pro plan.
        Upgrade to unlock all behavioral patterns, AI debriefs, weekly reviews, and more.
      </p>
      <Link
        href="/pricing"
        className="inline-block px-6 py-2.5 text-xs font-mono font-bold rounded bg-green text-background hover:bg-green/90 transition-colors"
      >
        VIEW PRICING
      </Link>
    </div>
  );
}
