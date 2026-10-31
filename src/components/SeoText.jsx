import { useLocation } from 'react-router-dom'
import { SEO_CONTENT } from '../lib/seoContent'
import { normalizePath } from '../lib/seoMeta'

/** Readable "how it works" text and FAQ under the public pages (home and the game pages), for people and for search engines. Same text as in the prerendered HTML. */
export default function SeoText() {
  const { pathname } = useLocation()
  const content = SEO_CONTENT[normalizePath(pathname)]
  if (!content) return null
  return (
    <section className="mx-auto mt-14 max-w-2xl border-t border-white/10 pt-8 text-sm leading-relaxed text-white/60" aria-label={content.heading}>
      <h2 className="font-display text-xl font-bold text-white">{content.heading}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        {content.howTo.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <h2 className="mt-8 font-display text-xl font-bold text-white">Frequently asked questions</h2>
      <dl className="mt-3 space-y-4">
        {content.faq.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold text-white/80">{f.q}</dt>
            <dd className="mt-1">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
