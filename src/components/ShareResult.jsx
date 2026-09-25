import { useState } from 'react'
import { ShareFat } from '@phosphor-icons/react'

/**
 * Wordle-style share button: builds a plain-text summary client-side and
 * copies it to the clipboard (falls back to the native share sheet on
 * mobile where available). No image generation/server round-trip needed.
 */
export default function ShareResult({ gameName, lines, url = 'https://topxi.app' }) {
  const [copied, setCopied] = useState(false)

  const text = [`TopXI — ${gameName}`, ...lines, url].join('\n')

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // user cancelled the share sheet — fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — nothing more we can do silently
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-xl bg-amber-glow px-4 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110 transition"
    >
      {copied ? (
        'Copied!'
      ) : (
        <>
          <ShareFat weight="fill" /> Share Result
        </>
      )}
    </button>
  )
}
