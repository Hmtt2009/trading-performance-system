import Link from 'next/link';

const PAIN_POINTS = [
  'I keep losing right after a big loss',
  'I close winners too early but hold losers too long',
  'I trade too much when the market is choppy',
  "I've tried journaling. I quit after 3 days.",
];

const STEPS = [
  {
    num: '01',
    title: 'EXPORT',
    desc: 'Download your trades from IBKR, Schwab, TD Ameritrade, or Webull. One CSV file.',
  },
  {
    num: '02',
    title: 'UPLOAD',
    desc: 'Drag and drop. Done. No manual input. Ever.',
  },
  {
    num: '03',
    title: 'SEE THE TRUTH',
    desc: 'Your behavioral patterns. Their dollar cost. What to fix.',
  },
];

const PATTERNS = [
  {
    name: 'Overtrading',
    desc: "Trading too much when you shouldn't be",
    severity: 'HIGH',
  },
  {
    name: 'Size Escalation',
    desc: 'Betting bigger after losses to make it back',
    severity: 'HIGH',
  },
  {
    name: 'Revenge Trading',
    desc: 'Re-entering too fast after a loss',
    severity: 'MEDIUM',
  },
  {
    name: 'Premature Exit',
    desc: 'Cutting winners before they finish running',
    severity: 'MEDIUM',
  },
];

const FOR_YOU = [
  'You trade on IBKR, Schwab, TD Ameritrade, or Webull',
  "You're still building your edge (0\u20135 years)",
  "Too honest to pretend you don't have bad habits",
  "Too lazy to journal every day \u2014 we built this for you",
];

const NOT_FOR_YOU = [
  'Expert traders with a proven system',
  'Buy-and-hold investors',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e0e8]">
      {/* Minimal top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22]">
        <Link href="/" className="font-display text-2xl tracking-wider text-[#00e87a]">
          FLINCH
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Pricing
          </Link>
          <Link href="/about" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            About
          </Link>
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-6 pt-24 pb-20 max-w-4xl mx-auto text-center">
        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-wide leading-none mb-6">
          YOU&apos;RE GAMBLING.
          <br />
          <span className="text-[#00e87a]">EVERYONE ELSE IS PLANNING TO TAKE YOUR MONEY.</span>
        </h1>
        <p className="text-lg sm:text-xl text-[#6b6b78] max-w-2xl mx-auto mb-10 leading-relaxed">
          Flinch automatically finds the behavioral patterns draining your account &mdash; from a single file upload
          after you create a free account. No journaling. No effort. Just the truth.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 bg-[#00e87a] text-[#070709] rounded font-mono font-bold text-sm hover:bg-[#00e87a]/90 transition-colors"
          >
            Create Free Account &mdash; Upload Your Trades
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-4 border border-[#28282f] text-[#e0e0e8] rounded font-mono font-bold text-sm hover:bg-[#101014] transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>

      {/* PAIN SECTION */}
      <section className="px-6 py-20 border-t border-[#1c1c22]">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl tracking-wide text-center mb-12">
            SOUND FAMILIAR?
          </h2>
          <div className="space-y-4 mb-8">
            {PAIN_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 p-4 rounded border border-[#1c1c22] bg-[#0c0c0f]"
              >
                <span className="text-[#ff4560] text-lg mt-0.5 shrink-0">&#10060;</span>
                <p className="text-base text-[#e0e0e8]">&ldquo;{point}&rdquo;</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[#6b6b78] font-mono">
            If any of these sound like you &mdash; Flinch will show you exactly what&apos;s happening, in dollars.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-20 border-t border-[#1c1c22]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl tracking-wide text-center mb-16">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="font-mono text-[#00e87a] text-4xl font-bold mb-3">
                  {step.num}
                </div>
                <h3 className="font-display text-2xl tracking-wide mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-[#6b6b78] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 PATTERNS */}
      <section className="px-6 py-20 border-t border-[#1c1c22]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl tracking-wide text-center mb-16">
            4 PATTERNS WE DETECT
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PATTERNS.map((pattern) => (
              <div
                key={pattern.name}
                className="p-6 rounded border border-[#1c1c22] bg-[#0c0c0f] hover:border-[#28282f] transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-xl tracking-wide">
                    {pattern.name}
                  </h3>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      pattern.severity === 'HIGH'
                        ? 'bg-[rgba(255,69,96,0.08)] text-[#ff4560] border border-[#ff4560]/20'
                        : 'bg-[rgba(245,166,35,0.08)] text-[#f5a623] border border-[#f5a623]/20'
                    }`}
                  >
                    {pattern.severity}
                  </span>
                </div>
                <p className="text-sm text-[#6b6b78]">{pattern.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR WHO */}
      <section className="px-6 py-20 border-t border-[#1c1c22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl tracking-wide text-center mb-16">
            IS THIS FOR YOU?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              {FOR_YOU.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="text-[#00e87a] text-lg mt-0.5 shrink-0">&#10004;</span>
                  <p className="text-sm text-[#e0e0e8]">{item}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {NOT_FOR_YOU.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="text-[#ff4560] text-lg mt-0.5 shrink-0">&#10060;</span>
                  <p className="text-sm text-[#6b6b78]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="px-6 py-24 border-t border-[#1c1c22] text-center">
        <h2 className="font-display text-5xl sm:text-6xl tracking-wide mb-6">
          STOP GUESSING.
          <br />
          <span className="text-[#00e87a]">START SEEING.</span>
        </h2>
        <Link
          href="/signup"
          className="inline-block mt-6 px-10 py-4 bg-[#00e87a] text-[#070709] rounded font-mono font-bold text-sm hover:bg-[#00e87a]/90 transition-colors"
        >
          Create Free Account &rarr;
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#1c1c22]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
          <p className="text-xs text-[#6b6b78] font-mono">
            Flinch &mdash; Built for traders who want the truth.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
