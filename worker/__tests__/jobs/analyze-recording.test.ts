import { analyzeRecording } from '../../jobs/analyze-recording'
import { supabase as supabaseClient } from '../../lib/supabase'
import { downloadTranscript, parseVttTranscript } from '../../lib/zoom'
import { analyzeTranscript } from '../../lib/claude'

// Cast to any so we can assert on the mock's fluent query builder methods
// (SupabaseClient type doesn't expose .update/.eq at the top level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  },
}))

jest.mock('../../lib/zoom', () => ({
  downloadTranscript: jest.fn().mockResolvedValue(
    'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nAvatar: Hello!\n\n2\n00:00:06.000 --> 00:00:10.000\nCustomer: Hi!'
  ),
  parseVttTranscript: jest.fn().mockReturnValue('Avatar: Hello!\nCustomer: Hi!'),
}))

jest.mock('../../lib/claude', () => ({
  analyzeTranscript: jest.fn().mockResolvedValue({
    wentWell: ['Avatar greeted warmly'],
    gaps: ['Could explain more'],
    kbSuggestions: [{ question: 'What is Claude?', answer: 'An AI assistant.' }],
  }),
}))

describe('analyzeRecording', () => {
  beforeEach(() => jest.clearAllMocks())

  it('downloads transcript, runs Claude, and stores results', async () => {
    await analyzeRecording('session-id', 'https://zoom.us/rec/transcript.vtt', 'download-token')

    expect(downloadTranscript).toHaveBeenCalledWith(
      'https://zoom.us/rec/transcript.vtt',
      'download-token'
    )
    expect(parseVttTranscript).toHaveBeenCalled()
    expect(analyzeTranscript).toHaveBeenCalledWith('Avatar: Hello!\nCustomer: Hi!')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: expect.any(String),
        claude_summary: expect.objectContaining({ wentWell: expect.any(Array) }),
      })
    )
    expect(supabase.eq).toHaveBeenCalledWith('id', 'session-id')
  })
})
