'use client'
import { useState, useRef, useEffect } from 'react'

interface ScreenShareButtonProps {
  sessionId: string
}

export function ScreenShareButton({ sessionId }: ScreenShareButtonProps) {
  const [active, setActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  async function captureAndUpload() {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    // Resize to max 1024px wide to keep payload size reasonable
    const maxWidth = 1024
    const scale = Math.min(1, maxWidth / canvas.width)
    const resized = document.createElement('canvas')
    resized.width = canvas.width * scale
    resized.height = canvas.height * scale
    const rCtx = resized.getContext('2d')
    if (!rCtx) return
    rCtx.drawImage(canvas, 0, 0, resized.width, resized.height)

    const base64 = resized.toDataURL('image/png').split(',')[1]

    await fetch('/api/session/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, image_base64: base64 }),
    }).catch((err) => console.error('[screen-share] Upload failed:', err))
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      streamRef.current = stream

      // Create a hidden video element to capture frames from
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      videoRef.current = video

      setActive(true)
      intervalRef.current = setInterval(captureAndUpload, 3000)

      // Stop automatically when the user stops sharing via the browser UI
      stream.getVideoTracks()[0].addEventListener('ended', stop)
    } catch (err) {
      console.error('[screen-share] Failed to start:', err)
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    videoRef.current = null
    setActive(false)
  }

  // Cleanup on unmount
  useEffect(() => () => stop(), [])

  return (
    <button
      onClick={active ? stop : start}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-red-300 animate-pulse' : 'bg-slate-400'}`} />
      {active ? 'Stop sharing' : 'Share screen'}
    </button>
  )
}
