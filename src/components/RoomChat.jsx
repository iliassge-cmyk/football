import { useEffect, useRef, useState } from 'react'
import { ChatCircle, PaperPlaneRight, X } from '@phosphor-icons/react'

/** The messages of a room and the box to write one. Messages are only passed between the players of the room, nothing is stored. */
export function RoomChat({ messages, onSend, myKey, height = 'h-48' }) {
  const [text, setText] = useState('')
  const listRef = useRef(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])
  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }
  return (
    <div>
      <div ref={listRef} className={`${height} overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left`}>
        {messages.length === 0 ? (
          <p className="text-sm text-white/30">Say hi to the others 👋</p>
        ) : (
          <ul className="space-y-1.5">
            {messages.map((m) => (
              <li key={m.id} className={`text-sm ${m.key === myKey ? 'text-right' : ''}`}>
                <span className={`mr-1.5 text-xs font-semibold ${m.key === myKey ? 'text-orange-glow' : 'text-white/50'}`}>{m.key === myKey ? 'You' : m.name}</span>
                <span className="break-words text-white/90">{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Write a message"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-glow"
        />
        <button type="submit" aria-label="Send" className="shrink-0 rounded-xl bg-orange-glow px-3.5 text-ink-950 hover:brightness-110 transition">
          <PaperPlaneRight weight="fill" size={18} />
        </button>
      </form>
      <p className="mt-1.5 text-[11px] text-white/30">Only the players in this room see the chat. Messages are not saved.</p>
    </div>
  )
}

/** A button in the corner that opens the chat during the game; shows how many messages you have not read yet. */
export function ChatDock({ messages, onSend, myKey }) {
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState(0)
  const unread = open ? 0 : messages.filter((m) => m.key !== myKey).length - read
  function toggle() {
    if (!open) setRead(messages.filter((m) => m.key !== myKey).length)
    setOpen(!open)
  }
  return (
    <>
      <button
        onClick={toggle}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-orange-glow text-ink-950 shadow-lg shadow-black/40 hover:brightness-110 transition"
      >
        {open ? <X weight="bold" size={22} /> : <ChatCircle weight="fill" size={24} />}
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-sm rounded-2xl border border-white/15 bg-ink-950/95 p-3 shadow-2xl backdrop-blur">
          <RoomChat messages={messages} onSend={onSend} myKey={myKey} height="h-44" />
        </div>
      )}
    </>
  )
}
