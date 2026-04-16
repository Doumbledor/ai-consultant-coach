/**
 * @jest-environment node
 */
import { findGuideByTrigger, getGuideTitles } from '@/lib/guides'
import type { Guide } from '@/lib/guides'

const mockGuides: Guide[] = [
  {
    title: 'Install Claude Code',
    trigger_phrases: ['install claude code', 'how do i install'],
    steps: ['Step 1', 'Step 2'],
  },
  {
    title: 'Start a New Project',
    trigger_phrases: ['start a project', 'new project'],
    steps: ['Step A', 'Step B'],
  },
]

describe('findGuideByTrigger', () => {
  it('returns a guide when text contains a trigger phrase', () => {
    const result = findGuideByTrigger('how do i install claude code', mockGuides)
    expect(result?.title).toBe('Install Claude Code')
  })

  it('is case-insensitive', () => {
    const result = findGuideByTrigger('HOW DO I INSTALL', mockGuides)
    expect(result?.title).toBe('Install Claude Code')
  })

  it('returns null when no phrase matches', () => {
    const result = findGuideByTrigger('what is an LLM', mockGuides)
    expect(result).toBeNull()
  })

  it('returns the first matching guide when multiple could match', () => {
    const result = findGuideByTrigger('start a new project', mockGuides)
    expect(result?.title).toBe('Start a New Project')
  })
})

describe('getGuideTitles', () => {
  it('returns all guide titles', () => {
    const titles = getGuideTitles(mockGuides)
    expect(titles).toEqual(['Install Claude Code', 'Start a New Project'])
  })
})
