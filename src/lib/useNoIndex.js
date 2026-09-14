import { useEffect } from 'react'

/** Adds <meta name="robots" content="noindex"> for the lifetime of the page (8 — profile/friends pages are noindex). */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => document.head.removeChild(meta)
  }, [])
}
