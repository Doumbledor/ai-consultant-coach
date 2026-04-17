'use client'
import { useState } from 'react'

interface AddToKbButtonProps {
  question: string
  answer: string
}

type State = 'idle' | 'loading' | 'done' | 'error'

export function AddToKbButton({ question, answer }: AddToKbButtonProps) {
  const [state, setState] = useState<State>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, sync_status: 'pending' }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') return <span className="text-xs text-emerald-400">Added to KB ✓</span>
  if (state === 'error') return <span className="text-xs text-red-400">Error — try again</span>

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {state === 'loading' ? 'Adding...' : '+ Add to KB'}
    </button>
  )
}
