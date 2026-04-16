import { supabase } from '../lib/supabase'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

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

async function sendSessionEmail(
  customerEmail: string,
  customerName: string,
  sessionToken: string,
  scheduledAt: string
) {
  const appUrl = process.env.APP_URL ?? 'https://your-domain.com'
  const sessionUrl = `${appUrl}/session/${sessionToken}`
  const formattedDate = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@your-domain.com',
    to: customerEmail,
    subject: 'Your AI Consultation is Ready',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e293b;">Hi ${customerName},</h2>
        <p style="color:#475569;">Your AI consultation is scheduled for <strong>${formattedDate}</strong>.</p>
        <p style="color:#475569;">Click the button below at your scheduled time to join:</p>
        <a href="${sessionUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Join Your Consultation
        </a>
        <p style="color:#94a3b8;font-size:13px;">Or copy this link: ${sessionUrl}</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you have any issues, reply to this email.</p>
      </div>
    `,
  })
}

export async function handleCalcomWebhook(
  trigger: string,
  payload: CalcomPayload
): Promise<void> {
  const { uid, title, startTime, attendees } = payload

  if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
    const customerEmail = attendees?.[0]?.email
    const customerName = attendees?.[0]?.name ?? 'there'

    if (!customerEmail) {
      console.warn('[calcom] No attendee email in payload, skipping')
      return
    }

    // Fetch existing session token to preserve it on reschedule
    const { data: existing } = await supabase
      .from('sessions')
      .select('session_token')
      .eq('cal_booking_id', uid)
      .single()

    const sessionToken = existing?.session_token ?? randomUUID()

    const { error } = await supabase.from('sessions').upsert(
      {
        cal_booking_id: uid,
        customer_email: customerEmail,
        scheduled_at: startTime,
        session_type: detectSessionType(title),
        status: 'upcoming',
        zoom_meeting_id: extractZoomMeetingId(payload),
        session_token: sessionToken,
      },
      { onConflict: 'cal_booking_id' }
    )

    if (error) {
      console.error('[calcom] upsert error:', error.message)
      return
    }

    if (trigger === 'BOOKING_CREATED' && process.env.RESEND_API_KEY) {
      await sendSessionEmail(customerEmail, customerName, sessionToken, startTime)
        .catch((err) => console.error('[calcom] Email send failed:', err))
    }
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
