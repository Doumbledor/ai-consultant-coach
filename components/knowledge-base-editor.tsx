'use client'
import { useState } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import type { KnowledgeBaseEntry, SessionTag, SessionTagFilter } from '@/lib/types'

interface Props {
  initialEntries: KnowledgeBaseEntry[]
  syncedCount: number
  pendingCount: number
  totalCount: number
}

const SESSION_TAG_LABELS: Record<string, string> = {
  session_1: 'Session 1',
  session_2: 'Session 2',
}

const SYNC_STATUS_DISPLAY: Record<string, string> = {
  synced: '✓',
  pending: '⏳',
  draft: '—',
}

export function KnowledgeBaseEditor({ initialEntries, syncedCount, pendingCount, totalCount }: Props) {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<SessionTagFilter>('all')
  const [saving, setSaving] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)

  const [synced, setSynced] = useState(syncedCount)
  const [pending, setPending] = useState(pendingCount)
  const [total, setTotal] = useState(totalCount)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  const [draftQuestion, setDraftQuestion] = useState(selected?.question ?? '')
  const [draftAnswer, setDraftAnswer] = useState(selected?.answer ?? '')
  const [draftTag, setDraftTag] = useState<SessionTag | ''>(selected?.session_tag ?? '')

  function selectEntry(entry: KnowledgeBaseEntry) {
    setSelectedId(entry.id)
    setDraftQuestion(entry.question)
    setDraftAnswer(entry.answer)
    setDraftTag(entry.session_tag ?? '')
  }

  async function saveEntry(syncStatus: 'draft' | 'pending') {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/kb/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: draftQuestion,
          answer: draftAnswer,
          session_tag: draftTag || null,
          sync_status: syncStatus,
        }),
      })
      if (!res.ok) return
      const updated: KnowledgeBaseEntry = await res.json()
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    } finally {
      setSaving(false)
    }
  }

  async function createEntry() {
    const res = await fetch('/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'New question', answer: 'New answer', sync_status: 'draft' }),
    })
    if (!res.ok) return
    const created: KnowledgeBaseEntry = await res.json()
    setEntries((prev) => [created, ...prev])
    setTotal((t) => t + 1)
    selectEntry(created)
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/kb/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    const remaining = entries.filter((e) => e.id !== id)
    setEntries(remaining)
    setTotal((t) => t - 1)
    setSelectedId(remaining[0]?.id ?? null)
    if (remaining[0]) selectEntry(remaining[0])
  }

  async function queueAllForSync() {
    setSyncingAll(true)
    try {
      const drafts = entries.filter((e) => e.sync_status !== 'synced')
      await Promise.all(
        drafts.map((e) =>
          fetch(`/api/kb/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sync_status: 'pending' }),
          })
        )
      )
      setEntries((prev) =>
        prev.map((e) => (e.sync_status !== 'synced' ? { ...e, sync_status: 'pending' } : e))
      )
      setPending(drafts.length)
    } finally {
      setSyncingAll(false)
    }
  }

  const filtered = entries.filter((e) => {
    if (tagFilter !== 'all' && e.session_tag !== tagFilter) return false
    if (search && !e.question.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex flex-1 gap-0 overflow-hidden rounded-xl border border-slate-700">
        {/* Left panel — list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-slate-800">
          <div className="border-b border-slate-700 p-3">
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded border border-slate-600 bg-slate-700 pl-6 pr-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={createEntry}
                className="flex items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>
            <div className="flex gap-1">
              {(['all', 'session_1', 'session_2'] as SessionTagFilter[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    tagFilter === tag
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tag === 'all' ? 'All' : SESSION_TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                onClick={() => selectEntry(entry)}
                className={`cursor-pointer border-b border-slate-700/50 px-3 py-2 ${
                  selectedId === entry.id ? 'bg-indigo-900/40' : 'hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-white">{entry.question}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {SYNC_STATUS_DISPLAY[entry.sync_status]}
                  </span>
                </div>
                {entry.session_tag && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {SESSION_TAG_LABELS[entry.session_tag]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Right panel — editor */}
        <div className="flex flex-1 flex-col bg-slate-900">
          {selected ? (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-4">
                <label className="mb-1 block text-xs text-slate-400">Question</label>
                <input
                  type="text"
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="mb-4 flex-1">
                <label className="mb-1 block text-xs text-slate-400">Answer</label>
                <textarea
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  rows={10}
                  className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="mb-6">
                <label className="mb-1 block text-xs text-slate-400">Session tag</label>
                <select
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value as SessionTag | '')}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  <option value="session_1">Session 1</option>
                  <option value="session_2">Session 2</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEntry('draft')}
                    disabled={saving}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => saveEntry('pending')}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Sync to HeyGen'}
                  </button>
                </div>
                <button
                  onClick={() => deleteEntry(selected.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>

              {selected.last_synced_at && (
                <p className="mt-2 text-xs text-slate-500">
                  Last synced: {new Date(selected.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select an entry or create a new one.
            </div>
          )}
        </div>
      </div>

      {/* Sync bar */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-2">
        <p className="text-xs text-slate-400">
          {synced} of {total} synced
          {pending > 0 && ` · ${pending} pending (syncs within 60 seconds)`}
        </p>
        <button
          onClick={queueAllForSync}
          disabled={syncingAll}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Queuing...' : 'Queue all for sync'}
        </button>
      </div>
    </div>
  )
}
