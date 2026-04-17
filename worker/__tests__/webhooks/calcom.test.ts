import { handleCalcomWebhook } from '../../webhooks/calcom'
import { supabase as supabaseClient } from '../../lib/supabase'

// Cast to any so we can assert on the mock's fluent query builder methods
// (SupabaseClient type doesn't expose .upsert/.update/.eq at the top level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any

// Build a fluent mock where every method returns `this` so arbitrary chains work.
// `.eq` is also thenable (resolves { error: null }) so `await .update().eq()` works.
// `.single` resolves { data: null } so the "fetch existing token" path gets null
// and the handler generates a fresh UUID as expected.
jest.mock('../../lib/supabase', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
  // Make .eq() return an object that chains further AND is directly awaitable
  mock.eq = jest.fn().mockImplementation(() =>
    Object.assign(Object.create(mock), {
      then: (resolve: (v: unknown) => void) => Promise.resolve({ error: null }).then(resolve),
    })
  )
  return { supabase: mock }
})

const mockBookingPayload = {
  uid: 'booking-abc123',
  title: 'Session 1 - AI Basics',
  startTime: '2026-04-15T14:00:00.000Z',
  attendees: [{ email: 'customer@example.com', name: 'Customer' }],
  videoCallData: { type: 'zoom_video', id: '87654321' },
  metadata: { videoCallUrl: 'https://zoom.us/j/87654321' },
}

describe('handleCalcomWebhook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('upserts a session on BOOKING_CREATED', async () => {
    await handleCalcomWebhook('BOOKING_CREATED', mockBookingPayload)

    expect(supabase.from).toHaveBeenCalledWith('sessions')
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cal_booking_id: 'booking-abc123',
        customer_email: 'customer@example.com',
        session_type: 'session_1',
        status: 'upcoming',
        zoom_meeting_id: '87654321',
      }),
      expect.any(Object)
    )
  })

  it('updates status to cancelled on BOOKING_CANCELLED', async () => {
    await handleCalcomWebhook('BOOKING_CANCELLED', mockBookingPayload)

    expect(supabase.update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(supabase.eq).toHaveBeenCalledWith('cal_booking_id', 'booking-abc123')
  })

  it('detects session_2 from title', async () => {
    const session2Payload = { ...mockBookingPayload, title: 'Session 2 - Build a Website' }
    await handleCalcomWebhook('BOOKING_CREATED', session2Payload)

    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ session_type: 'session_2' }),
      expect.any(Object)
    )
  })

  it('cancels session even when attendees array is missing', async () => {
    const noAttendeesPayload = { ...mockBookingPayload, attendees: undefined }
    await handleCalcomWebhook('BOOKING_CANCELLED', noAttendeesPayload)

    expect(supabase.update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(supabase.eq).toHaveBeenCalledWith('cal_booking_id', 'booking-abc123')
  })

  it('marks session completed on MEETING_ENDED', async () => {
    await handleCalcomWebhook('MEETING_ENDED', mockBookingPayload)

    expect(supabase.update).toHaveBeenCalledWith({ status: 'completed' })
    expect(supabase.eq).toHaveBeenCalledWith('cal_booking_id', 'booking-abc123')
  })
})
