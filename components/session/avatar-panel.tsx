'use client'
import { useEffect, useRef, useState } from 'react'
import {
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  AgentEventsEnum,
} from '@heygen/liveavatar-web-sdk'

interface AvatarPanelProps {
  sessionToken: string
}

// Track which tokens have been used across Strict Mode remounts
const usedTokens = new Set<string>()

export function AvatarPanel({ sessionToken }: AvatarPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<LiveAvatarSession | null>(null)
  const [state, setState] = useState<string>('idle')
  const [isAvatarTalking, setIsAvatarTalking] = useState(false)
  const [isUserTalking, setIsUserTalking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  async function startSession() {
    if (sessionRef.current || usedTokens.has(sessionToken)) return
    usedTokens.add(sessionToken)

    setState('connecting')
    const session = new LiveAvatarSession(sessionToken, {
      voiceChat: { defaultMuted: false },
    })
    sessionRef.current = session

    session.on(SessionEvent.SESSION_STATE_CHANGED, (s: SessionState) => {
      setState(s)
      if (s === SessionState.DISCONNECTED) {
        setError('Session ended')
      }
    })

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (videoRef.current) {
        session.attach(videoRef.current)
      }
    })

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => setIsAvatarTalking(true))
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setIsAvatarTalking(false))
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => setIsUserTalking(true))
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setIsUserTalking(false))

    try {
      await session.start()
    } catch (err) {
      console.error('[avatar] Failed to start session:', err)
      setError('Failed to connect to avatar')
      usedTokens.delete(sessionToken)
    }
  }

  // Cleanup on unmount (but don't clear usedTokens — prevents Strict Mode double-start)
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(console.error)
        sessionRef.current = null
      }
    }
  }, [])

  // Start on button click (satisfies Chrome autoplay policy — user gesture required)
  function handleStart() {
    setStarted(true)
    startSession()
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
        <button
          onClick={handleStart}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Start Consultation
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-full rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Connection state overlay */}
      {state !== SessionState.CONNECTED && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <p className="text-slate-400 text-sm">Connecting to avatar...</p>
        </div>
      )}

      {/* Speech indicators */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        {isAvatarTalking && (
          <span className="bg-indigo-600/80 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            Avatar speaking
          </span>
        )}
        {isUserTalking && (
          <span className="bg-emerald-600/80 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            Listening...
          </span>
        )}
      </div>
    </div>
  )
}
