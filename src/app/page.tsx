import Link from 'next/link';
import { TerminalAnimation } from '@/components/landing/TerminalAnimation';
import { GapChart } from '@/components/landing/GapChart';
import { ComparisonTable } from '@/components/landing/ComparisonTable';

/* ─────────────── DATA ─────────────── */

const PAIN_CARDS = [
  {
    quote:
      'I lost $300, then immediately took another trade to make it back. Lost $500 more.',
    label: 'This is revenge trading. Flinch catches it.',
  },
  {
    quote:
      'I was up $200 on NVDA. Took profit at $80. It ran to $400 after I sold.',
    label:
      'This is premature exit. Flinch measures what you left on the table.',
  },
  {
    quote:
      'I took 14 trades on a choppy Tuesday. My average is 5. I lost on 11 of them.',
    label: 'This is overtrading. Flinch flags it automatically.',
  },
  {
    quote:
      'After 3 losses in a row, I doubled my position size. That one trade wiped out my whole week.',
    label: 'This is size escalation. Flinch shows you the exact cost.',
  },
];

const FEATURES = [
  {
    title: '4 Behavioral Patterns',
    desc: 'Automatically detects overtrading, revenge trading, size escalation, and premature exits. Each one labeled with confidence: HIGH or MEDIUM. No guessing \u2014 data only.',
  },
  {
    title: 'Dollar Cost Per Pattern',
    desc: '\u201CYour revenge trades cost you $1,847 this quarter.\u201D Not a score. Not a grade. The exact dollar amount each habit is costing you.',
  },
  {
    title: 'AI Coaching Debrief',
    desc: 'After every upload, get a coaching-style session review. References YOUR specific trades by ticker, time, and P&L. Like a trading coach who actually read your data.',
  },
  {
    title: 'Edge Scorecard',
    desc: 'Where do you make money? Where do you lose it? By time of day. By hold time. By day of week. \u201CDo More: morning trades held 20+ min\u201D \u201CDo Less: afternoon re-entries after losses\u201D',
  },
  {
    title: 'Weekly Review',
    desc: 'Every week, see how your behavior changed. Week-over-week comparison: P&L, win rate, trade count, behavior cost, top pattern. Track your improvement.',
  },
  {
    title: 'Multi-Broker Support',
    desc: 'IBKR. Schwab. TD Ameritrade. Webull. Plus a smart universal parser that handles any US broker CSV \u2014 even formats we\u2019ve never seen.',
  },
];

const YES_LIST = [
  'You trade stocks, options, or futures actively',
  'You use IBKR, Schwab, TD Ameritrade, or Webull',
  "You're still building your edge (0\u20135 years experience)",
  'You suspect your habits are costing you money',
  "You've tried journaling and quit after a week",
  'You want data, not opinions',
];

const NO_LIST = [
  'You\u2019re a buy-and-hold investor',
  'You trade crypto only (coming soon)',
  'You already have a profitable, systematic edge',
  'You don\u2019t want to know the truth',
];

const TRUST_CARDS = [
  {
    title: 'YOUR DATA IS YOURS',
    desc: 'Your trade data is encrypted, never shared, and never sold. We don\u2019t connect to your broker. We don\u2019t have your login. You upload a CSV \u2014 that\u2019s it. Delete your account and everything is wiped.',
  },
  {
    title: 'TRANSPARENT METHODOLOGY',
    desc: 'Every pattern detection has a clear explanation. Every dollar amount shows its math. No black boxes. No mystery scores. You can see exactly how Flinch reaches its conclusions.',
  },
  {
    title: 'BUILT BY A TRADER',
    desc: 'Flinch was built by someone who lost money to the same patterns you do. It exists because journaling didn\u2019t work, and no tool on the market actually answered the question: \u201CWhat are my habits costing me?\u201D',
  },
];

/* ─────────────── PAGE ─────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-[#f4f4f5]">
      {/* ── NAV BAR ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[#1c1c22] bg-[#070709]/90 backdrop-blur-md">
        <Link
          href="/"
          className="font-[family-name:var(--font-bebas-neue)] text-2xl tracking-wider text-[#00e87a]"
        >
          FLINCH
          <span className="animate-pulse">_</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          <Link
            href="/pricing"
            className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/guide"
            className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
          >
            Guide
          </Link>
          <Link
            href="/about"
            className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
          >
            About
          </Link>
          <Link
            href="/login"
            className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] hover:text-[#f4f4f5] transition-colors border border-[#1c1c22] rounded px-4 py-1.5"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-[family-name:var(--font-space-mono)] text-sm font-bold bg-[#00e87a] text-[#070709] rounded px-4 py-1.5 hover:bg-[#00e87a]/90 transition-colors"
          >
            Upload Your Trades
          </Link>
        </div>
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section className="px-6 pt-20 pb-24 sm:pt-28 sm:pb-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <h1 className="font-[family-name:var(--font-bebas-neue)] text-5xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-wide leading-[0.95] mb-6">
              YOUR TRADES TELL A STORY
              <br />
              <span className="text-[#00e87a]">YOU&apos;RE NOT READING.</span>
            </h1>
            <p className="font-[family-name:var(--font-space-mono)] text-sm sm:text-base text-[#6b7280] leading-relaxed max-w-lg mb-10">
              Flinch reads your CSV and finds the behavioral patterns costing
              you money. No journaling. No tagging. No effort. Just upload and
              see what you&apos;re really doing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-block text-center font-[family-name:var(--font-space-mono)] text-sm font-bold bg-[#00e87a] text-[#070709] rounded px-8 py-4 hover:bg-[#00e87a]/90 transition-colors shadow-[0_0_20px_rgba(0,232,122,0.2)]"
              >
                Upload Your Trades &mdash; Free
              </Link>
              <a
                href="#how-it-works"
                className="inline-block text-center font-[family-name:var(--font-space-mono)] text-sm font-bold border border-[#1c1c22] text-[#f4f4f5] rounded px-8 py-4 hover:bg-[#0d0d12] transition-colors"
              >
                See How It Works &darr;
              </a>
            </div>
          </div>

          {/* Right column — terminal animation */}
          <div className="w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto">
            <TerminalAnimation />
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE GAP ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-5xl mx-auto">
          <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase tracking-[0.2em] text-[#6b7280] text-center mb-4">
            THE COST OF NOT KNOWING
          </p>
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-4">
            WHAT IF YOUR BIGGEST LOSS ISN&apos;T A BAD TRADE?
          </h2>
          <p className="font-[family-name:var(--font-space-mono)] text-base sm:text-lg text-[#6b7280] text-center mb-12 max-w-2xl mx-auto">
            It&apos;s the pattern you keep repeating.
          </p>

          {/* Gap Chart */}
          <div className="border border-[#1c1c22] rounded-lg bg-[#0d0d12] p-4 sm:p-6">
            <GapChart />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="border border-[#ef4444]/20 rounded-lg bg-[#ef4444]/5 p-6 text-center">
              <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase text-[#6b7280] tracking-wider mb-2">
                REVENGE TRADES
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#ef4444]">
                -$1,847
              </p>
              <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] mt-1">
                11 instances
              </p>
            </div>
            <div className="border border-[#ef4444]/20 rounded-lg bg-[#ef4444]/5 p-6 text-center">
              <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase text-[#6b7280] tracking-wider mb-2">
                PREMATURE EXITS
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#ef4444]">
                -$1,230
              </p>
              <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] mt-1">
                18 instances
              </p>
            </div>
            <div className="border border-[#ef4444]/20 rounded-lg bg-[#ef4444]/5 p-6 text-center">
              <p className="font-[family-name:var(--font-space-mono)] text-xs uppercase text-[#6b7280] tracking-wider mb-2">
                OVERTRADING
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#ef4444]">
                -$1,123
              </p>
              <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] mt-1">
                7 days
              </p>
            </div>
          </div>

          <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] text-center mt-8 max-w-2xl mx-auto leading-relaxed">
            These aren&apos;t hypothetical. These are real numbers from real
            trades. Flinch calculates your exact cost &mdash; down to the
            dollar.
          </p>
        </div>
      </section>

      {/* ── SECTION 3: PAIN POINTS ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-16">
            SOUND FAMILIAR?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PAIN_CARDS.map((card) => (
              <div
                key={card.label}
                className="border border-[#1c1c22] rounded-lg bg-[#0d0d12] p-6 hover:border-[#28282f] transition-colors"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-[#ef4444] text-lg shrink-0 mt-0.5">
                    &#10060;
                  </span>
                  <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#f4f4f5] leading-relaxed italic">
                    &ldquo;{card.quote}&rdquo;
                  </p>
                </div>
                <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#00e87a] leading-relaxed pl-8">
                  {card.label}
                </p>
              </div>
            ))}
          </div>
          <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] text-center mt-12 max-w-2xl mx-auto leading-relaxed">
            Every trader has these patterns. Most never see them. Flinch finds
            them in your data &mdash; not your memory.
          </p>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section
        id="how-it-works"
        className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-16">
            THREE STEPS. ZERO EFFORT.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 01 */}
            <div className="border border-[#00e87a]/20 rounded-lg bg-[#0d0d12] p-6 hover:border-[#00e87a]/40 transition-colors">
              <p className="font-[family-name:var(--font-space-mono)] text-[#00e87a] text-xs tracking-wider mb-1">
                STEP
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#00e87a] mb-4">
                01
              </p>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl tracking-wide mb-3">
                EXPORT
              </h3>
              <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] leading-relaxed mb-4">
                Download your trade history from your broker. IBKR, Schwab, TD
                Ameritrade, Webull &mdash; or any US broker. One CSV file. Takes
                30 seconds.
              </p>
              <Link
                href="/guide"
                className="font-[family-name:var(--font-space-mono)] text-xs text-[#00e87a] hover:underline"
              >
                Need help exporting? &rarr;
              </Link>
            </div>

            {/* Step 02 */}
            <div className="border border-[#00e87a]/20 rounded-lg bg-[#0d0d12] p-6 hover:border-[#00e87a]/40 transition-colors">
              <p className="font-[family-name:var(--font-space-mono)] text-[#00e87a] text-xs tracking-wider mb-1">
                STEP
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#00e87a] mb-4">
                02
              </p>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl tracking-wide mb-3">
                UPLOAD
              </h3>
              <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] leading-relaxed">
                Drag. Drop. Done. Flinch auto-detects your broker format. No
                manual input. No column mapping. No tagging.
              </p>
            </div>

            {/* Step 03 */}
            <div className="border border-[#00e87a]/20 rounded-lg bg-[#0d0d12] p-6 hover:border-[#00e87a]/40 transition-colors">
              <p className="font-[family-name:var(--font-space-mono)] text-[#00e87a] text-xs tracking-wider mb-1">
                STEP
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-4xl text-[#00e87a] mb-4">
                03
              </p>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl tracking-wide mb-3">
                SEE WHAT YOU&apos;RE DOING
              </h3>
              <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] leading-relaxed">
                Your behavioral patterns. Their dollar cost. Which ones are
                getting worse. What to change. All from a single file.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: FEATURES ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-16">
            WHAT FLINCH FINDS FOR YOU
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="border border-[#1c1c22] rounded-lg bg-[#0d0d12] p-6 hover:border-[#28282f] transition-colors"
              >
                <h3 className="font-[family-name:var(--font-bebas-neue)] text-xl tracking-wide mb-3 text-[#f4f4f5]">
                  {feature.title}
                </h3>
                <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON TABLE ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-16">
            WHY TRADERS SWITCH TO FLINCH
          </h2>
          <div className="border border-[#1c1c22] rounded-lg bg-[#0d0d12] p-2 sm:p-4">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* ── SECTION 7: WHO THIS IS FOR ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide text-center mb-16">
            IS FLINCH FOR YOU?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Yes column */}
            <div>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-[#00e87a] tracking-wide mb-6">
                YES, IF:
              </h3>
              <div className="space-y-4">
                {YES_LIST.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="text-[#00e87a] text-lg shrink-0 mt-0.5">
                      &#10003;
                    </span>
                    <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#f4f4f5] leading-relaxed">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* No column */}
            <div>
              <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-[#6b7280] tracking-wide mb-6">
                NOT YET, IF:
              </h3>
              <div className="space-y-4">
                {NO_LIST.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="text-[#6b7280] text-lg shrink-0 mt-0.5">
                      &#10007;
                    </span>
                    <p className="font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] leading-relaxed">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: TRUST ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRUST_CARDS.map((card) => (
              <div
                key={card.title}
                className="border border-[#1c1c22] rounded-lg bg-[#0d0d12] p-6"
              >
                <h3 className="font-[family-name:var(--font-bebas-neue)] text-xl tracking-wide mb-3 text-[#f4f4f5]">
                  {card.title}
                </h3>
                <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: FINAL CTA ── */}
      <section className="px-6 py-24 sm:py-28 border-t border-[#1c1c22] text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl lg:text-6xl tracking-wide leading-[1.05] mb-10">
            YOUR TRADES ARE ALREADY
            <br />
            TELLING THE STORY.
            <br />
            <span className="text-[#00e87a]">START READING IT.</span>
          </h2>
          <Link
            href="/signup"
            className="inline-block font-[family-name:var(--font-space-mono)] text-base font-bold bg-[#00e87a] text-[#070709] rounded px-12 py-5 hover:bg-[#00e87a]/90 transition-colors shadow-[0_0_30px_rgba(0,232,122,0.25)]"
          >
            Upload Your Trades &mdash; Free
          </Link>
          <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] mt-6 leading-relaxed max-w-lg mx-auto">
            Free account. 7-day full access trial. No credit card required. See
            your #1 pattern in under 30 seconds.
          </p>
        </div>
      </section>

      {/* ── SECTION 10: FOOTER ── */}
      <footer className="px-6 py-8 border-t border-[#1c1c22]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left */}
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-bebas-neue)] text-xl text-[#00e87a] tracking-wider">
              FLINCH
            </span>
            <span className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280]">
              Built for traders who want the truth.
            </span>
          </div>

          {/* Center links */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/pricing"
              className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/guide"
              className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
            >
              Guide
            </Link>
            <Link
              href="/about"
              className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] hover:text-[#f4f4f5] transition-colors"
            >
              Terms
            </Link>
          </div>

          {/* Right */}
          <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280]">
            &copy; 2026 Flinch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
