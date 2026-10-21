// Build step after `vite build` (see netlify.toml): gives every public page its own HTML file with the right <title>, description, canonical address,
// link-preview tags, structured data (JSON-LD) and a short readable text inside the app shell, and writes sitemap.xml.
// Why: the app is a single page (an empty <div id="root">), so crawlers and link previews (Google, WhatsApp, TikTok, X) would otherwise see the same
// head and no text on every address. The app itself starts as before and replaces the text. Static hosts (Cloudflare Pages, Netlify) serve a real file before their SPA fallback.
// Runs as part of `npm run build`, so it works on whatever host builds the project.
//   node scripts/prerender-seo.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OG_IMAGE, SEO_PAGES, SITE, canonicalFor, jsonLdFor } from '../src/lib/seoMeta.js'

const dist = path.resolve('dist')
const base = readFileSync(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function render(p) {
  const page = SEO_PAGES[p]
  const url = canonicalFor(p)
  let html = base
  const set = (re, value) => {
    if (!re.test(html)) throw new Error(`index.html has no ${re} - the head of the app changed, adapt scripts/prerender-seo.mjs`)
    html = html.replace(re, () => value)
  }
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`)
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`)
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`)
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
  set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${OG_IMAGE}" />`)
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`)
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`)
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`)
  const ld = jsonLdFor(p)
  if (ld) html = html.replace('</head>', () => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n  </head>`)
  const games = Object.entries(SEO_PAGES).filter(([k]) => k !== '/' && k !== p)
  const fallback = `<main style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif"><h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p>${p === '/' ? '' : '<p><a href="/" style="color:#fb7a24">All TopBin games</a></p>'}<h2>${p === '/' ? 'Games' : 'More football games'}</h2><ul>${games.map(([k, v]) => `<li><a href="${k}" style="color:#fb7a24">${esc(v.h1)}</a></li>`).join('')}</ul></main>`
  if (!html.includes('<div id="root"></div>')) throw new Error('index.html has no empty <div id="root"></div>')
  return html.replace('<div id="root"></div>', () => `<div id="root">${fallback}</div>`)
}

let n = 0
for (const p of Object.keys(SEO_PAGES)) {
  const html = render(p)
  if (p === '/') writeFileSync(path.join(dist, 'index.html'), html)
  else {
    // two copies, so it works on every static host: /game/minefield -> minefield.html (Cloudflare Pages, Netlify pretty URLs), /game/minefield/ -> minefield/index.html
    mkdirSync(path.join(dist, p.slice(1)), { recursive: true })
    writeFileSync(path.join(dist, p.slice(1), 'index.html'), html)
    writeFileSync(path.join(dist, p.slice(1) + '.html'), html)
  }
  n++
}
const today = new Date().toISOString().slice(0, 10)
writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(SEO_PAGES).map((p) => `  <url><loc>${canonicalFor(p)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
console.log(`prerender-seo: ${n} pages and sitemap.xml written to ${dist}`)
