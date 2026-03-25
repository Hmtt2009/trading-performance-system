import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Flinch',
  description: 'Flinch terms of service — rules and disclaimers for using the platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e0e8]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22]">
        <Link href="/" className="font-display text-2xl tracking-wider text-[#00e87a]">
          FLINCH
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Privacy
          </Link>
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide mb-4">TERMS OF SERVICE</h1>
        <p className="text-sm font-mono text-[#6b6b78] mb-12">Effective Date: March 25, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-[#c0c0c8]">
          {/* 1 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">1. SERVICE DESCRIPTION</h2>
            <p>
              Flinch is an AI-powered trade analysis platform that detects behavioral patterns in your trading history.
              By uploading broker CSV exports, you receive automated analysis of patterns such as overtrading, size
              escalation, revenge trading, and premature exits &mdash; along with their estimated dollar impact on your
              account.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">2. NOT FINANCIAL ADVICE</h2>
            <div className="p-4 rounded border border-[#ef4444]/20 bg-[#ef4444]/5 text-[#e0e0e8] space-y-3">
              <p>
                <strong className="text-[#ef4444]">IMPORTANT DISCLAIMER:</strong> Flinch does{' '}
                <strong>NOT</strong> provide financial advice, investment recommendations, or trading signals.
              </p>
              <p>
                All analysis is <strong>educational and informational only</strong>. Past pattern detection does not
                guarantee future results. Historical behavioral analysis is not predictive of future trading outcomes.
              </p>
              <p>
                <strong>You are solely responsible for your own trading decisions.</strong> Flinch is a tool for
                self-reflection, not a substitute for professional financial advice. If you need financial advice,
                consult a licensed financial advisor.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">3. RISK ACKNOWLEDGMENT</h2>
            <p>
              Trading in financial instruments involves substantial risk of loss and is not suitable for all investors.
              You acknowledge that you understand the risks involved in trading and that Flinch bears no responsibility
              for any trading losses you may incur. The dollar-impact estimates provided by our analysis are
              approximations and should not be relied upon as exact figures.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">4. ACCOUNT &amp; ELIGIBILITY</h2>
            <p>
              You must be at least 18 years old to use Flinch. You are responsible for maintaining the confidentiality
              of your account credentials and for all activity under your account. You agree to provide accurate and
              complete information when creating your account.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">5. SUBSCRIPTION &amp; BILLING</h2>
            <p className="mb-3">Flinch offers subscription plans billed through Whop.</p>
            <ul className="list-none space-y-3">
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">BILLING</span>
                <p className="mt-1">
                  Subscriptions are billed on a recurring basis (monthly or annually) as selected at checkout. All
                  prices are in USD unless otherwise stated.
                </p>
              </li>
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">CANCELLATION</span>
                <p className="mt-1">
                  You may cancel your subscription at any time. Upon cancellation, you retain access until the end of
                  your current billing period. No partial refunds are provided for unused time within a billing cycle.
                </p>
              </li>
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">REFUNDS</span>
                <p className="mt-1">
                  We offer a full refund within 7 days of your initial subscription purchase if you are unsatisfied.
                  After 7 days, no refunds are provided. Contact support to request a refund.
                </p>
              </li>
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">FREE TIER</span>
                <p className="mt-1">
                  Free accounts have limited functionality. We reserve the right to modify free tier features at any
                  time.
                </p>
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">6. ACCOUNT TERMINATION</h2>
            <p className="mb-3">We may suspend or terminate your account if you:</p>
            <ul className="list-none space-y-2">
              {[
                'Violate these Terms of Service',
                'Use the service for illegal purposes',
                'Attempt to reverse-engineer, scrape, or exploit our systems',
                'Engage in abusive behavior toward other users or our team',
                'Provide false or misleading account information',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#ef4444] mt-0.5 shrink-0">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Upon termination, your access is revoked immediately. You may request an export of your data before
              termination takes effect, where feasible.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">7. INTELLECTUAL PROPERTY</h2>
            <p>
              All analysis algorithms, pattern detection methods, scoring systems, and software code powering Flinch are
              proprietary and owned by Flinch. You may not copy, modify, distribute, reverse-engineer, or create
              derivative works based on our technology. Your trade data remains yours &mdash; we claim no ownership over
              data you upload.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">8. ACCEPTABLE USE</h2>
            <p className="mb-3">You agree <strong>not</strong> to:</p>
            <ul className="list-none space-y-2">
              {[
                'Use automated tools, bots, or scrapers to access the service',
                'Resell, redistribute, or sublicense access to Flinch or its data',
                'Upload malicious files or attempt to exploit system vulnerabilities',
                'Use the service to harass, abuse, or harm others',
                'Circumvent rate limits, access controls, or security measures',
                'Share your account credentials with third parties',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#ef4444] mt-0.5 shrink-0">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">9. LIMITATION OF LIABILITY</h2>
            <p>
              To the maximum extent permitted by law, Flinch and its officers, directors, employees, and agents shall
              not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, trading losses, data loss, or other intangible losses, arising from your use
              of or inability to use the service. Our total liability for any claim arising from these Terms shall not
              exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">10. DISCLAIMER OF WARRANTIES</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
              whether express or implied, including but not limited to implied warranties of merchantability, fitness for
              a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted,
              error-free, or completely secure.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">11. GOVERNING LAW</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
              United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or
              the service shall be resolved in the state or federal courts located in Delaware.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">12. CHANGES TO THESE TERMS</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting
              the updated terms on this page and updating the effective date. Your continued use of the service after
              changes are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">13. CONTACT</h2>
            <p>
              For questions about these Terms, contact us at:
            </p>
            <p className="mt-3 font-mono text-[#00e87a] text-xs">
              legal@flinch.trade
            </p>
          </section>
        </div>
      </article>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#1c1c22]">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#6b6b78] font-mono">
            &copy; 2026 Flinch. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/" className="text-xs font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
