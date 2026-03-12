import Link from 'next/link';

export default function AboutPage() {
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
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display text-5xl sm:text-6xl tracking-wide text-center mb-16">
          WHAT IS FLINCH?
        </h1>

        {/* THE PROBLEM */}
        <section className="mb-16">
          <h2 className="font-display text-3xl tracking-wide mb-4 text-[#ff4560]">
            THE PROBLEM
          </h2>
          <p className="text-base text-[#6b6b78] leading-relaxed mb-4">
            Most traders lose. Almost none know why.
          </p>
          <p className="text-sm text-[#6b6b78] leading-relaxed">
            It&apos;s not that traders lack intelligence, discipline, or market knowledge.
            The problem is behavioral. You overtrade after a loss. You size up when you should
            size down. You cut winners early because the fear of giving back profits is louder
            than your trading plan. These patterns repeat invisibly, session after session,
            draining your account in ways that a P&L statement never shows.
          </p>
        </section>

        {/* THE INSIGHT */}
        <section className="mb-16">
          <h2 className="font-display text-3xl tracking-wide mb-4 text-[#f5a623]">
            THE INSIGHT
          </h2>
          <p className="text-sm text-[#6b6b78] leading-relaxed">
            Your trading data already contains the answers. Every trade you&apos;ve ever made
            is a data point: when you entered, how long you held, how much you risked, what
            you did after a win or a loss. When you look at these data points in aggregate,
            behavioral patterns emerge &mdash; and each one has a dollar cost attached to it.
            The difference between your actual P&L and what you would have made without these
            patterns is the price you&apos;re paying for being human.
          </p>
        </section>

        {/* THE SOLUTION */}
        <section className="mb-16">
          <h2 className="font-display text-3xl tracking-wide mb-4 text-[#00e87a]">
            THE SOLUTION
          </h2>
          <p className="text-sm text-[#6b6b78] leading-relaxed mb-4">
            Flinch analyzes your trade history and detects four core behavioral patterns:
            overtrading, size escalation, revenge trading, and premature exits. It doesn&apos;t
            use fixed thresholds &mdash; it compares your behavior against your own baseline,
            so the analysis is personal, not generic.
          </p>
          <p className="text-sm text-[#6b6b78] leading-relaxed">
            Upload a single CSV file from IBKR, Schwab, TD Ameritrade, or Webull.
            No journaling. No manual entry. No daily commitment. Just the truth about
            what your habits are costing you &mdash; and what to change first.
          </p>
        </section>

        {/* WHY "FLINCH" */}
        <section className="mb-16">
          <h2 className="font-display text-3xl tracking-wide mb-4">
            WHY &ldquo;FLINCH&rdquo;?
          </h2>
          <p className="text-sm text-[#6b6b78] leading-relaxed">
            A flinch is an involuntary reaction &mdash; the moment you act on emotion instead
            of your plan. Every revenge trade, every premature exit, every panic size-up is a
            flinch. This tool makes the invisible visible so you can stop flinching and start
            trading with intention.
          </p>
        </section>

        {/* CTA */}
        <div className="text-center pt-8 border-t border-[#1c1c22]">
          <Link
            href="/upload"
            className="inline-block px-10 py-4 bg-[#00e87a] text-[#070709] rounded font-mono font-bold text-sm hover:bg-[#00e87a]/90 transition-colors"
          >
            Upload My Trades Free &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
