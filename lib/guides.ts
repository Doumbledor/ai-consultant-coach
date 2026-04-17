import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export interface Guide {
  title: string
  trigger_phrases: string[]
  steps: string[]
}

export function loadGuidesFromDir(dir: string): Guide[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Guide)
}

let _cached: Guide[] | null = null

export function getGuides(): Guide[] {
  if (!_cached) _cached = loadGuidesFromDir(join(process.cwd(), 'guides'))
  return _cached
}

export function findGuideByTrigger(text: string, guides = getGuides()): Guide | null {
  const lower = text.toLowerCase()
  for (const guide of guides) {
    if (guide.trigger_phrases.some((p) => lower.includes(p.toLowerCase()))) {
      return guide
    }
  }
  return null
}

export function getGuideTitles(guides = getGuides()): string[] {
  return guides.map((g) => g.title)
}
