import { useEffect, useState } from 'react'

/**
 * Animates from 0 to `value` over `duration` ms using an easeOutQuad curve,
 * then hands the final formatted string to `format`. Used for the 800ms
 * "Countup 0 → Zielwert" reveal (spec 5.2).
 */
export default function CountUp({ value, duration = 800, format = (n) => Math.round(n).toString() }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf
    const start = performance.now()

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress) // easeOutQuad
      setDisplay(value * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{format(display)}</>
}
