import { handleZoomWebhook } from '../../webhooks/zoom'
import { supabase as supabaseClient } from '../../lib/supabase'

// Cast to any so we can assert on the mock's fluent query builder methods
// (SupabaseClient type doesn't expose .update etc. at the top level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'session-id' },
      error: null,
    }),
  },
}))

// Prevent the async fire-and-forget analysis from running in tests
jest.mock('../../jobs/analyze-recording', () => ({
  analyzeRecording: jest.fn().mockResolvedValue(undefined),
}))

const mockZoomPayload = {
  event: 'recording.completed',
  download_token: 'test-download-token',
  payload: {
    object: {
      id: '87654321',
      uuid: 'meeting-uuid==',
      topic: 'Session 1 - AI Basics',
      start_time: '2026-04-15T14:00:00Z',
      recording_files: [
        {
          file_type: 'MP4',
          download_url: 'https://zoom.us/rec/download/video.mp4',
          status: 'completed',
        },
        {
          file_type: 'TRANSCRIPT',
          download_url: 'https://zoom.us/rec/download/transcript.vtt',
          status: 'completed',
        },
      ],
    },
  },
}

describe('handleZoomWebhook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('stores recording_url and triggers analysis on recording.completed', async () => {
    await handleZoomWebhook(mockZoomPayload)

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        recording_url: 'https://zoom.us/rec/download/video.mp4',
        status: 'completed',
      })
    )
    expect(supabase.eq).toHaveBeenCalledWith('zoom_meeting_id', '87654321')
  })

  it('ignores non-recording events', async () => {
    await handleZoomWebhook({ event: 'meeting.started', payload: {} })
    expect(supabase.update).not.toHaveBeenCalled()
  })
})
