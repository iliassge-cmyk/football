export default function Legal() {
  return (
    <div className="mx-auto max-w-2xl prose-invert">
      <h1 className="font-display text-3xl font-bold text-white mb-6">Legal &amp; Privacy</h1>

      <section className="mb-8">
        <h2 className="font-display text-xl font-semibold text-white mb-2">Trademark Disclaimer</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          All club names, logos, and trademarks are the property of their respective owners. This site is
          not affiliated with FIFA, UEFA, any national football association, or any of the clubs
          mentioned. Used for non-commercial, editorial/statistical purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl font-semibold text-white mb-2">Data Sources</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Player statistics, transfer fees, match records and Daily Top 10 rankings are compiled from
          public sources (club and competition statistics pages, Wikipedia, and established football
          statistics sites) and verified as of the dates noted with each dataset. Data is not updated
          live — see the README for the exact cutoff dates used.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl font-semibold text-white mb-2">Privacy Policy</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          If you create an account, we store your email address (for authentication only, via Supabase
          Auth), a public username, and your game results. We do not sell your data, run ads, or use
          tracking cookies. Guest play never touches our servers — scores stay in your browser.
        </p>
        <p className="text-white/70 text-sm leading-relaxed mt-3">
          You can delete your account at any time from your profile settings. This permanently removes
          your profile, friendships, highscores, and Daily Top 10 attempt history.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-white mb-2">Contact</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Questions about this site or a takedown request? Reach out via the contact details provided in
          the site's hosting/deployment configuration.
        </p>
      </section>
    </div>
  )
}
