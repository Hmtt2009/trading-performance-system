'use client';

import { useState } from 'react';
import Link from 'next/link';

const BROKERS = [
  {
    id: 'ibkr',
    name: 'IBKR',
    fullName: 'Interactive Brokers',
    steps: [
      'Log in to Client Portal or Trader Workstation (TWS).',
      'Go to Reports \u2192 Flex Queries (or Performance & Reports \u2192 Activity Statement).',
      'Select your desired date range.',
      'Set the export format to CSV.',
      'Download the file to your computer.',
      'Upload the CSV file to Flinch.',
    ],
  },
  {
    id: 'schwab',
    name: 'SCHWAB',
    fullName: 'Charles Schwab',
    steps: [
      'Log in to schwab.com.',
      'Go to Accounts \u2192 History.',
      'Select "Export" \u2192 CSV.',
      'Choose your desired date range.',
      'Download the CSV file to your computer.',
      'Upload the file to Flinch.',
    ],
  },
  {
    id: 'td',
    name: 'TD AMERITRADE',
    fullName: 'TD Ameritrade (now Schwab)',
    steps: [
      'Log in to tdameritrade.com.',
      'Go to My Account \u2192 History & Statements.',
      'Select Transaction History.',
      'Export as CSV.',
      'Upload the file to Flinch.',
    ],
  },
  {
    id: 'webull',
    name: 'WEBULL',
    fullName: 'Webull',
    steps: [
      'Open the Webull app or desktop client.',
      'Go to Account \u2192 Statements & History.',
      'Select Trade History.',
      'Export as CSV.',
      'Upload the file to Flinch.',
    ],
  },
];

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState('ibkr');
  const activeBroker = BROKERS.find((b) => b.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e0e8]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22]">
        <Link href="/" className="font-display text-2xl tracking-wider text-[#00e87a]">
          FLINCH
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Pricing
          </Link>
          <Link href="/guide" className="text-sm font-mono text-[#e0e0e8] transition-colors">
            Guide
          </Link>
          <Link href="/about" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            About
          </Link>
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="px-6 pt-20 pb-12 max-w-4xl mx-auto text-center">
        <h1 className="font-display text-5xl sm:text-6xl tracking-wide leading-none mb-4">
          EXPORT <span className="text-[#00e87a]">GUIDE</span>
        </h1>
        <p className="text-base text-[#6b6b78] max-w-xl mx-auto font-mono leading-relaxed">
          Step-by-step instructions to export your trade history from your broker and upload it to Flinch.
        </p>
      </section>

      {/* Broker Tabs + Content */}
      <section className="px-6 pb-24 max-w-3xl mx-auto">
        {/* Tabs */}
        <div className="flex border-b border-[#1c1c22] mb-8 overflow-x-auto">
          {BROKERS.map((broker) => (
            <button
              key={broker.id}
              onClick={() => setActiveTab(broker.id)}
              className={`px-5 py-3 font-mono text-sm font-bold tracking-wide transition-colors whitespace-nowrap ${
                activeTab === broker.id
                  ? 'text-[#00e87a] border-b-2 border-[#00e87a]'
                  : 'text-[#6b6b78] hover:text-[#e0e0e8]'
              }`}
            >
              {broker.name}
            </button>
          ))}
        </div>

        {/* Active broker content */}
        <div>
          <h2 className="font-display text-2xl tracking-wide mb-6">
            {activeBroker.fullName}
          </h2>

          <div className="space-y-4">
            {activeBroker.steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded border border-[#1c1c22] bg-[#0c0c0f]"
              >
                <span className="font-mono text-[#00e87a] text-lg font-bold shrink-0 w-7 text-right">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-sm text-[#e0e0e8] leading-relaxed font-mono">
                  {step}
                </p>
              </div>
            ))}
          </div>

          {/* CTA after steps */}
          <div className="mt-10 p-6 rounded border border-[#1c1c22] bg-[#0c0c0f] text-center">
            <p className="text-sm text-[#6b6b78] font-mono mb-4">
              Got your CSV file? You&apos;re ready to go.
            </p>
            <Link
              href="/upload"
              className="inline-block px-8 py-3 bg-[#00e87a] text-[#070709] rounded font-mono font-bold text-sm hover:bg-[#00e87a]/90 transition-colors"
            >
              UPLOAD YOUR TRADES
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#1c1c22] text-center">
        <p className="text-xs text-[#6b6b78] font-mono">
          Flinch &mdash; Built for traders who want the truth.
        </p>
      </footer>
    </div>
  );
}
