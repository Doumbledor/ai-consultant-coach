import { getAllSessions } from '@/lib/data/sessions'
import { SessionSearch } from '@/components/session-search'
import Link from 'next/link'
import { Suspense } from 'react'
import type { SessionStatus, SessionType } from '@/lib/types'

interface Props {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>
}

const STATUS_FILTERS: { label: string; value: string | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const TYPE_FILTERS: { label: string; value: string | undefined }[] = [
  { label: 'Session 1', value: 'session_1' },
  { label: 'Session 2', value: 'session_2' },
]

const STATUS_BADGE: Record<string, string> = {
  upcoming: 'bg-blue-900 text-blue-300',
  completed: 'bg-emerald-900 text-emerald-300',
  cancelled: 'bg-slate-700 text-slate-400',
  live: 'bg-red-900 text-red-300',
}

function buildHref(current: URLSearchParams, key: string, value: string | undefined) {
  const next = new URLSearchParams(current.toString())
  if (value) next.set(key, value)
  else next.delete(key)
  const s = next.toString()
  return `/dashboard/sessions${s ? `?${s}` : ''}`
}

export default async function SessionsPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status as SessionStatus | undefined
  const sessionType = params.type as SessionType | undefined
  const search = params.q

  const sessions = await getAllSessions({ status, sessionType, search })

  const currentParams = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  )

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Sessions</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status filter tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {STATUS_FILTERS.map((f) => {
            const active = params.status === f.value || (!params.status && !f.value)
            return (
              <Link
                key={f.label}
                href={buildHref(currentParams, 'status', f.value)}
                className={`rounded-md px-3 py-1 text-sm ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {TYPE_FILTERS.map((f) => {
            const active = params.type === f.value
            return (
              <Link
                key={f.label}
                href={buildHref(currentParams, 'type', active ? undefined : f.value)}
                className={`rounded-md px-3 py-1 text-sm ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        <Suspense fallback={<div className="h-9 w-48 animate-pulse rounded-lg bg-slate-700" />}>
          <SessionSearch />
        </Suspense>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No sessions found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Date & Time</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    {s.status === 'completed' ? (
                      <Link
                        href={`/dashboard/call-review/${s.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {s.customer_email}
                      </Link>
                    ) : (
                      <span className="text-white">{s.customer_email}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(s.scheduled_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.stripe_payment_id ? '$20' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[s.status] ?? 'bg-slate-700 text-slate-400'}`}
                    >
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
