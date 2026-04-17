'use client'
import { useEffect, useRef, useState } from 'react'
import { use } from 'react'
import { AvatarPanel } from '@/components/session/avatar-panel'
import { DisplayPanel } from '@/components/session/display-panel'
import { ScreenShareButton } from '@/components/session/screen-share-button'

interface Props {
  params: Promise<{ token: string }>
}

export default function SessionPage({ params }: Props) {
  const { token } = use(params)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Prevent Strict Mode double-fetch — each fetch creates a LiveAvatar session token
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid session link')
        return res.json()
      })
      .then((data: { session_token: string; session_id: string }) => {
        setSessionToken(data.session_token)
        setSessionId(data.session_id)
      })
      .catch((err: Error) => setError(err.message))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Session not found</h1>
          <p className="text-slate-400">This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  if (!sessionToken || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-sm">Starting your session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <span className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
          AI Consultation
        </span>
        <ScreenShareButton sessionId={sessionId} />
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Avatar (SDK video) */}
        <div className="flex-1" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <AvatarPanel sessionToken={sessionToken} sessionId={sessionId} />
        </div>

        {/* Right: Display panel */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <DisplayPanel sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
