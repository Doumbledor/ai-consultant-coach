import { getSessionById } from '@/lib/data/sessions'
import { AddToKbButton } from '@/components/add-to-kb-button'
import { notFound } from 'next/navigation'
import type { ClaudeSummary } from '@/lib/types'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function CallReviewDetailPage({ params }: Props) {
  const { sessionId } = await params
  const session = await getSessionById(sessionId)

  if (!session) notFound()

  const summary = session.claude_summary as ClaudeSummary | null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{session.customer_email}</h1>
        <p className="text-sm text-slate-400">
          {new Date(session.scheduled_at).toLocaleString()} ·{' '}
          {session.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
        </p>
      </div>

      {/* Video player */}
      {session.recording_url ? (
        <div className="mb-6">
          <video
            src={session.recording_url}
            controls
            className="w-full rounded-xl border border-slate-700 bg-slate-900"
          />
        </div>
      ) : (
        <div className="mb-6 flex h-48 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-500">
          Recording not yet available.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Claude summary */}
        <div className="space-y-4">
          {summary ? (
            <>
              {summary.wentWell.length > 0 && (
                <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
                  <h3 className="mb-2 text-sm font-medium text-emerald-400">What went well</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {summary.wentWell.map((item, i) => (
                      <li key={i}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.gaps.length > 0 && (
                <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
                  <h3 className="mb-2 text-sm font-medium text-amber-400">Gaps to address</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {summary.gaps.map((item, i) => (
                      <li key={i}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.kbSuggestions.length > 0 && (
                <div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4">
                  <h3 className="mb-3 text-sm font-medium text-indigo-400">
                    Suggested KB additions
                  </h3>
                  <ul className="space-y-3">
                    {summary.kbSuggestions.map((s, i) => (
                      <li key={i} className="rounded-lg bg-slate-800 p-3">
                        <p className="mb-1 text-sm font-medium text-white">{s.question}</p>
                        <p className="mb-2 text-xs text-slate-400">{s.answer}</p>
                        <AddToKbButton question={s.question} answer={s.answer} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-500">
              Analysis not yet available.
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-400">Transcript</h3>
          {session.transcript ? (
            <pre className="max-h-[500px] overflow-y-auto whitespace-pre-wrap text-xs text-slate-300 leading-relaxed">
              {session.transcript}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">Transcript not yet available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
