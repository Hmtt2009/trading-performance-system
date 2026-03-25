import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Flinch',
  description: 'Flinch privacy policy — how we collect, store, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e0e8]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c22]">
        <Link href="/" className="font-display text-2xl tracking-wider text-[#00e87a]">
          FLINCH
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Terms
          </Link>
          <Link href="/login" className="text-sm font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide mb-4">PRIVACY POLICY</h1>
        <p className="text-sm font-mono text-[#6b6b78] mb-12">Effective Date: March 25, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-[#c0c0c8]">
          {/* 1 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">1. INTRODUCTION</h2>
            <p>
              Flinch (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information
              when you use the Flinch platform and services.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">2. INFORMATION WE COLLECT</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <ul className="list-none space-y-3">
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">ACCOUNT DATA</span>
                <p className="mt-1">Email address and authentication credentials when you create an account.</p>
              </li>
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">TRADE DATA</span>
                <p className="mt-1">
                  Trade history from CSV files you upload (e.g., IBKR Flex Query exports). This includes trade dates,
                  symbols, quantities, prices, and realized P&amp;L.
                </p>
              </li>
              <li className="pl-4 border-l-2 border-[#1c1c22]">
                <span className="font-mono text-[#00e87a] text-xs">USAGE ANALYTICS</span>
                <p className="mt-1">
                  Basic usage data such as pages visited, features used, and session duration to improve our service.
                </p>
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">3. HOW WE STORE YOUR DATA</h2>
            <p>
              All data is stored in Supabase (built on PostgreSQL), a SOC 2 Type II compliant platform. Your data is
              encrypted at rest using AES-256 and encrypted in transit using TLS 1.2+. Database access is restricted
              through row-level security (RLS) policies, ensuring you can only access your own data.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">4. DATA SHARING &mdash; NEVER</h2>
            <p className="p-4 rounded border border-[#00e87a]/20 bg-[#00e87a]/5 text-[#e0e0e8]">
              Your data is <strong>never shared with third parties</strong>. We do not sell, rent, license, or otherwise
              disclose your personal information or trade data to any external entity. Period.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">5. AI &amp; MODEL TRAINING</h2>
            <p className="p-4 rounded border border-[#00e87a]/20 bg-[#00e87a]/5 text-[#e0e0e8]">
              Your trade data is <strong>never used for AI model training</strong> without your explicit, opt-in consent.
              Our AI-powered debrief feature processes your data in real time and does not retain it for training
              purposes.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">6. DATA DELETION</h2>
            <p>
              You may delete <strong>all</strong> of your data at any time from your account settings. Upon deletion, all
              trade data, analysis results, and associated records are permanently removed from our systems within 30
              days. You may also request deletion by contacting us at the address below.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">7. COOKIES</h2>
            <p>
              We use <strong>minimal cookies</strong> &mdash; strictly limited to authentication session tokens required
              for the service to function. We do not use advertising cookies, tracking pixels, or third-party analytics
              cookies. No cookie consent banner is needed because we only use strictly necessary cookies.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">8. DATA RETENTION</h2>
            <p>
              We retain your data for as long as your account is active. If you cancel your subscription, your data is
              retained for 90 days in case you reactivate. After 90 days of inactivity with no active subscription, your
              data is permanently deleted. You can request immediate deletion at any time.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">9. YOUR RIGHTS (GDPR / CCPA)</h2>
            <p className="mb-3">Depending on your jurisdiction, you have the right to:</p>
            <ul className="list-none space-y-2">
              {[
                'Access the personal data we hold about you',
                'Correct inaccurate personal data',
                'Delete your personal data ("right to be forgotten")',
                'Export your data in a portable format',
                'Object to or restrict processing of your data',
                'Withdraw consent at any time where processing is based on consent',
                'Opt out of the "sale" of personal information (we do not sell your data)',
              ].map((right) => (
                <li key={right} className="flex items-start gap-2">
                  <span className="text-[#00e87a] mt-0.5 shrink-0">&bull;</span>
                  <span>{right}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              For California residents under the CCPA: we do not sell personal information. You have the right to know
              what data we collect, request deletion, and not be discriminated against for exercising your rights.
            </p>
            <p className="mt-3">
              For EU/EEA residents under the GDPR: our legal basis for processing is contract performance (providing the
              service you signed up for) and legitimate interest (improving our service). You may lodge a complaint with
              your local supervisory authority.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">10. SECURITY</h2>
            <p>
              We implement industry-standard security measures including encryption at rest and in transit, row-level
              security policies, secure authentication via Supabase Auth, and regular security reviews. While no system
              is 100% secure, we take reasonable and appropriate measures to protect your data.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">11. CHANGES TO THIS POLICY</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
              updated policy on this page and updating the effective date. Continued use of the service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-display text-2xl tracking-wide text-[#e0e0e8] mb-4">12. CONTACT</h2>
            <p>
              For privacy inquiries, data requests, or concerns, contact us at:
            </p>
            <p className="mt-3 font-mono text-[#00e87a] text-xs">
              privacy@flinch.trade
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
            <Link href="/terms" className="text-xs font-mono text-[#6b6b78] hover:text-[#e0e0e8] transition-colors">
              Terms of Service
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
