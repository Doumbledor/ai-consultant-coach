import { supabase } from '../lib/supabase'

interface CalcomPayload {
  uid: string
  title: string
  startTime: string
  attendees?: Array<{ email: string; name: string }>
  videoCallData?: { type: string; id: string | number }
  metadata?: { videoCallUrl?: string }
}

function detectSessionType(title: string): 'session_1' | 'session_2' {
  const lower = title.toLowerCase()
  if (lower.includes('session 2') || lower.includes('session2')) return 'session_2'
  return 'session_1'
}

function extractZoomMeetingId(payload: CalcomPayload): string | null {
  if (payload.videoCallData?.id != null) return String(payload.videoCallData.id)
  const match = payload.metadata?.videoCallUrl?.match(/\/j\/(\d+)/)
  return match?.[1] ?? null
}

export async function handleCalcomWebhook(
  trigger: string,
  payload: CalcomPayload
): Promise<void> {
  const { uid, title, startTime, attendees } = payload

  if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
    const customerEmail = attendees?.[0]?.email
    if (!customerEmail) {
      console.warn('[calcom] No attendee email in payload, skipping upsert')
      return
    }
    const { error } = await supabase.from('sessions').upsert(
      {
        cal_booking_id: uid,
        customer_email: customerEmail,
        scheduled_at: startTime,
        session_type: detectSessionType(title),
        status: 'upcoming',
        zoom_meeting_id: extractZoomMeetingId(payload),
      },
      { onConflict: 'cal_booking_id' }
    )
    if (error) console.error('[calcom] upsert error:', error.message)
    return
  }

  if (trigger === 'BOOKING_CANCELLED') {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('cal_booking_id', uid)
    if (error) console.error('[calcom] cancel error:', error.message)
    return
  }

  if (trigger === 'MEETING_ENDED') {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('cal_booking_id', uid)
    if (error) console.error('[calcom] meeting-ended error:', error.message)
  }
}
