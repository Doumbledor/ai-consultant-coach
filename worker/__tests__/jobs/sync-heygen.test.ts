import { syncHeygenKb } from '../../jobs/sync-heygen'
import { supabase } from '../../lib/supabase'
import { pushKbEntry } from '../../lib/heygen'

const mockPendingEntries = [
  { id: 'entry-1', question: 'What is Claude?', answer: 'An AI assistant.', session_tag: 'session_1' },
  { id: 'entry-2', question: 'How to deploy?', answer: 'Use Vercel.', session_tag: 'all' },
]

// SELECT chain mock
const mockSelectEq = jest.fn().mockResolvedValue({ data: mockPendingEntries, error: null })
const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq })

// UPDATE chain mock
const mockUpdateEq = jest.fn().mockResolvedValue({ error: null })
const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq })

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'knowledge_base_entries') {
        return { select: mockSelect, update: mockUpdate }
      }
      return { select: mockSelect, update: mockUpdate }
    }),
  },
}))

jest.mock('../../lib/heygen', () => ({
  pushKbEntry: jest.fn().mockResolvedValue('heygen-entry-id-123'),
}))

describe('syncHeygenKb', () => {
  beforeEach(() => jest.clearAllMocks())

  it('pushes all pending entries to HeyGen and marks them as synced', async () => {
    // Re-wire mocks after clearAllMocks
    mockSelectEq.mockResolvedValue({ data: mockPendingEntries, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }))
    mockSelect.mockReturnValue({ eq: mockSelectEq })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    await syncHeygenKb()

    expect(pushKbEntry).toHaveBeenCalledTimes(2)
    expect(pushKbEntry).toHaveBeenCalledWith('What is Claude?', 'An AI assistant.')
    expect(pushKbEntry).toHaveBeenCalledWith('How to deploy?', 'Use Vercel.')
  })
})
