import { useEffect, useState } from 'react'
import BiddingMatch from './BiddingMatch'
import { botDecide, botDelay } from '../lib/biddingBot'
import { actorOf, applyAction, createGame } from '../lib/biddingEngine'

const newGame = (name) => createGame({ names: [name, 'Bot'], seed: Math.floor(Math.random() * 2 ** 31) })

/** You against the bot: starts at once, no setup. */
export default function BiddingBotGame({ playerName = 'You', initial = null, me = 0, bots = null, onLeave }) {
  const ME = me
  const botSeats = bots ?? [1 - me]
  const botKey = botSeats.join(',')
  const [state, setState] = useState(() => initial ?? newGame(playerName))

  // the bot acts after a short "thinking" pause, the sale is confirmed automatically
  useEffect(() => {
    const actor = actorOf(state)
    if (typeof actor === 'number' && botSeats.includes(actor)) {
      const id = setTimeout(() => setState((s) => (actorOf(s) === actor ? applyAction(s, botDecide(s)) ?? s : s)), botDelay())
      return () => clearTimeout(id)
    }
    if (actor === 'sell') {
      const id = setTimeout(() => setState((s) => (actorOf(s) === 'sell' ? applyAction(s, { type: 'sell' }) ?? s : s)), 900)
      return () => clearTimeout(id)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, botKey])

  return (
    <BiddingMatch
      state={state}
      me={ME}
      onAction={(action) => setState((s) => (actorOf(s) === ME ? applyAction(s, action) ?? s : s))}
      waitingText="Bot is thinking"
      onAgain={() => setState(createGame({ names: ME === 0 ? [playerName, 'Bot'] : ['Bot', playerName], seed: Math.floor(Math.random() * 2 ** 31) }))}
      againLabel="Play again"
      onLeave={onLeave}
    />
  )
}
