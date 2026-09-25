const SECTIONS = [
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'trademark', label: 'Trademark Disclaimer' },
  { id: 'sources', label: 'Data Sources' },
]

export default function Legal() {
  return (
    <div className="mx-auto max-w-2xl prose-invert">
      <h1 className="font-display text-3xl font-bold text-white mb-2">Legal &amp; Privacy</h1>
      <p className="text-white/50 text-xs mb-6">Last updated: 2026-09-25</p>

      <nav className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs uppercase tracking-wide text-white/40 mb-2">On this page</p>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-sm text-orange-glow underline underline-offset-2">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------------------------------ */}
      <section id="privacy" className="mb-10 scroll-mt-20">
        <h2 className="font-display text-xl font-semibold text-white mb-3">Privacy Policy</h2>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">1. Controller</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          For any privacy question or to exercise your rights, contact{' '}
          <span className="text-orange-glow">[privacy@yourdomain.example]</span>.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">2. What we collect and why</h3>
        <ul className="list-disc list-inside text-white/70 text-sm leading-relaxed space-y-1">
          <li>
            <strong className="text-white/90">Guest play:</strong> nothing is sent to our servers. Scores
            and progress stay only in your browser's local storage.
          </li>
          <li>
            <strong className="text-white/90">Account (optional):</strong> if you sign up, we store your
            email address (authentication only), a public username, your game results (scores, Daily Top
            10 / Minefield attempts), and friendships you create. Legal basis: performance of a contract
            with you (Art. 6 (1)(b) GDPR) — you're asking us to run an account so your progress and
            leaderboard position persist.
          </li>
          <li>
            <strong className="text-white/90">Server logs:</strong> our hosting and database providers
            (below) automatically process technical data (IP address, request timestamps, browser type)
            for a short period to operate and secure the service. Legal basis: legitimate interest (Art. 6
            (1)(f) GDPR) in keeping the site running and secure.
          </li>
        </ul>
        <p className="text-white/70 text-sm leading-relaxed mt-2">
          We never sell your data, run advertising, or use tracking/analytics cookies.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">3. Local storage (no cookie banner)</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          This site uses your browser's local storage — never third-party tracking cookies — strictly for
          features you directly requested: keeping you signed in, remembering guest scores, and resuming
          an in-progress Daily Top 10 / Minefield round. Because this storage is technically necessary for
          functionality you asked for, no consent banner is required under § 25 (2) No. 2 TTDSG — but we
          disclose it here for transparency. You can clear it any time via your browser settings.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">4. Processors we use</h3>
        <ul className="list-disc list-inside text-white/70 text-sm leading-relaxed space-y-1">
          <li>
            <strong className="text-white/90">Supabase</strong> (Supabase Inc.) — database, authentication,
            and account storage. A Data Processing Agreement (Art. 28 GDPR) governs this relationship.
          </li>
          <li>
            <strong className="text-white/90">Netlify</strong> (Netlify Inc.) — static site hosting and
            content delivery.
          </li>
        </ul>
        <p className="text-white/70 text-sm leading-relaxed mt-2">
          Both providers may process data outside the EU/EEA. Where that happens, it is safeguarded by
          Standard Contractual Clauses (Art. 46 GDPR) between us and the provider. Fonts and all other
          static assets are self-hosted — no data is sent to Google Fonts or any other third party when
          you load the page.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">5. How long we keep your data</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          For as long as your account exists. You can permanently delete your account at any time from
          your Dashboard — this immediately and irreversibly removes your profile, friendships,
          highscores, and Daily Top 10 / Minefield attempt history.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">6. Your rights (GDPR)</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          You have the right to access (Art. 15), rectify (Art. 16), erase (Art. 17), restrict (Art. 18),
          and port (Art. 20) your data, and to object to processing based on legitimate interest (Art.
          21). Contact us at the email above to exercise any of these — account deletion is also
          self-service, see above. You also have the right to lodge a complaint with a data protection
          supervisory authority, in particular in the German federal state where you live, work, or where
          the alleged infringement occurred. A directory of German authorities is available at{' '}
          <a href="https://www.bfdi.bund.de" className="text-orange-glow underline underline-offset-2" target="_blank" rel="noreferrer">
            bfdi.bund.de
          </a>
          .
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">7. Children</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          This service is not directed at children under 16. If you are under 16, please only create an
          account with the consent of a parent or guardian.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="terms" className="mb-10 scroll-mt-20">
        <h2 className="font-display text-xl font-semibold text-white mb-3">Terms of Service</h2>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">Using this site</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          TopBin is a free, non-commercial football trivia site. You may play as a guest or create an
          account. When creating an account, your username must not be offensive, impersonate someone
          else, or infringe on any third-party rights; we may remove content or suspend accounts that
          violate this.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">No warranty</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          This site is provided "as is", without warranty of any kind. Trivia content, statistics, and
          leaderboard rankings are provided for entertainment purposes and compiled from public sources
          (see Data Sources below) — we don't guarantee their accuracy or availability at all times.
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">Limitation of liability</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          To the extent permitted by law, liability is limited to intent and gross negligence, except for
          claims arising from injury to life, body, or health, or under mandatory statutory liability
          (e.g. the German Product Liability Act).
        </p>

        <h3 className="text-white font-semibold text-sm mt-4 mb-1">Governing law</h3>
        <p className="text-white/70 text-sm leading-relaxed">
          These terms are governed by the laws of the Federal Republic of Germany, excluding its conflict
          of law rules. If you are a consumer, mandatory consumer-protection rules of your country of
          residence remain unaffected.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="trademark" className="mb-10 scroll-mt-20">
        <h2 className="font-display text-xl font-semibold text-white mb-2">Trademark Disclaimer</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          All club names, logos, and trademarks are the property of their respective owners. This site is
          not affiliated with FIFA, UEFA, any national football association, or any of the clubs
          mentioned. Used for non-commercial, editorial/statistical purposes.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section id="sources" className="scroll-mt-20">
        <h2 className="font-display text-xl font-semibold text-white mb-2">Data Sources</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Player statistics, transfer fees, match records and Daily Top 10 rankings are compiled from
          public sources (club and competition statistics pages, Wikipedia, and established football
          statistics sites) and verified as of the dates noted with each dataset. Data is not updated
          live — see the README for the exact cutoff dates used.
        </p>
      </section>
    </div>
  )
}
