import { handleZoomWebhook } from '../../webhooks/zoom'
import { supabase as supabaseClient } from '../../lib/supabase'
import { analyzeRecording } from '../../jobs/analyze-recording'

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

  it('stores recording_url, marks session completed, and triggers analysis', async () => {
    await handleZoomWebhook(mockZoomPayload)

    // Flush the setImmediate queue so analyzeRecording has been called
    await new Promise<void>(resolve => setImmediate(resolve))

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        recording_url: 'https://zoom.us/rec/download/video.mp4',
        status: 'completed',
      })
    )
    expect(analyzeRecording).toHaveBeenCalledWith(
      'session-id',
      'https://zoom.us/rec/download/transcript.vtt',
      'test-download-token'
    )
  })

  it('ignores non-recording events', async () => {
    await handleZoomWebhook({ event: 'meeting.started', payload: {} })
    expect(supabase.update).not.toHaveBeenCalled()
    expect(analyzeRecording).not.toHaveBeenCalled()
  })
})
