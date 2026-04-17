'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DisplayContent } from '@/lib/types'

interface DisplayPanelProps {
  sessionId: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
      title="Copy to clipboard"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ConceptCard({ content }: { content: { title: string; body: string; tags: string[] } }) {
  return (
    <div className="rounded-xl border border-indigo-800 bg-slate-900 overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concept</span>
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-2">{content.title}</h3>
        <p className="text-slate-300 text-sm leading-relaxed">{content.body}</p>
        {content.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <span key={tag} className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommandCard({ content }: { content: { title: string; commands: string[]; note: string } }) {
  const allCommands = content.commands.join('\n')

  return (
    <div className="rounded-xl border border-emerald-800 bg-slate-900 overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Command</span>
        </div>
        <CopyButton text={allCommands} />
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-3">{content.title}</h3>
        <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm space-y-1">
          {content.commands.map((cmd, i) => (
            <div key={i} className="flex items-center justify-between group">
              <span className="text-emerald-400">
                <span className="text-slate-600">$ </span>{cmd}
              </span>
              <CopyButton text={cmd} />
            </div>
          ))}
        </div>
        {content.note && (
          <p className="mt-3 text-slate-400 text-xs">{content.note}</p>
        )}
      </div>
    </div>
  )
}

function StepsCard({ content }: { content: { title: string; steps: string[] } }) {
  const allSteps = content.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return (
    <div className="rounded-xl border border-amber-800 bg-slate-900 overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step-by-step</span>
        </div>
        <CopyButton text={allSteps} />
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-4">{content.title}</h3>
        <ol className="space-y-3">
          {content.steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-slate-300 text-sm leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function DisplayCard({ display }: { display: DisplayContent }) {
  if (display.type === 'concept') return <ConceptCard content={display.content} />
  if (display.type === 'command') return <CommandCard content={display.content} />
  if (display.type === 'steps') return <StepsCard content={display.content} />
  return null
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
      <div className="text-center">
        <p className="text-slate-500 text-sm">Ask a question to get started.</p>
        <p className="text-slate-600 text-xs mt-1">Tips and guides will appear here.</p>
      </div>
    </div>
  )
}

export function DisplayPanel({ sessionId }: DisplayPanelProps) {
  const [cards, setCards] = useState<DisplayContent[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`session:display:${sessionId}`)

    channel
      .on('broadcast', { event: 'display' }, ({ payload }: { payload: DisplayContent }) => {
        if (payload.type !== 'none') {
          setCards((prev) => [...prev, payload])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  if (cards.length === 0) return <EmptyState />

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full pr-1">
      {cards.map((card, i) => (
        <DisplayCard key={i} display={card} />
      ))}
    </div>
  )
}
