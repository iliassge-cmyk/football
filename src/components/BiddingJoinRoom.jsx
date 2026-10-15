import { useState } from 'react'

/** Type the room code of a friend; it joins by itself as soon as the code is complete. */
export default function BiddingJoinRoom({ onJoin, onCancel, codeLength = 5 }) {
  const [code, setCode] = useState('')
  function change(e) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, codeLength)
    setCode(v)
    if (v.length === codeLength) onJoin(v)
  }
  return (
    <div className="mx-auto max-w-sm pt-10 text-center">
      <h2 className="font-display text-2xl font-bold text-white mb-1">Join a room</h2>
      <p className="text-sm text-white/55 mb-6">Enter the code of your friend's room.</p>
      <input
        autoFocus
        value={code}
        onChange={change}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="•••••"
        aria-label="Room code"
        className="w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-4 text-center font-display text-4xl font-bold tracking-[0.3em] text-orange-glow placeholder:text-white/20 focus:outline-none focus:border-orange-glow"
      />
      <button onClick={() => code.length === codeLength && onJoin(code)} disabled={code.length !== codeLength} className="mt-4 w-full rounded-2xl bg-orange-glow px-4 py-4 text-base font-bold text-ink-950 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40">
        Join
      </button>
      <button onClick={onCancel} className="mt-6 text-sm text-white/40 hover:text-white/70 transition">Back</button>
    </div>
  )
}
