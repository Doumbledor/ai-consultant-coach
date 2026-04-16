import { createClient } from '@/lib/supabase/server'
import type { KnowledgeBaseEntry, SessionTag, SyncStatus } from '@/lib/types'

export interface KbFilters {
  sessionTag?: SessionTag
  search?: string
}

export interface SyncStats {
  total: number
  synced: number
  pending: number
}

export async function getKbEntries(filters: KbFilters = {}): Promise<KnowledgeBaseEntry[]> {
  const supabase = await createClient()
  let query = supabase.from('knowledge_base_entries').select('*')

  if (filters.sessionTag && filters.sessionTag !== 'all') {
    query = query.eq('session_tag', filters.sessionTag)
  }
  if (filters.search) query = query.ilike('question', `%${filters.search}%`)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as KnowledgeBaseEntry[]
}

export async function createKbEntry(input: {
  question: string
  answer: string
  session_tag?: SessionTag | null
  sync_status?: SyncStatus
}): Promise<KnowledgeBaseEntry> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .insert({
      question: input.question,
      answer: input.answer,
      session_tag: input.session_tag ?? null,
      sync_status: input.sync_status ?? 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data as KnowledgeBaseEntry
}

export async function updateKbEntry(
  id: string,
  updates: Partial<Pick<KnowledgeBaseEntry, 'question' | 'answer' | 'session_tag' | 'sync_status'>>
): Promise<KnowledgeBaseEntry> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as KnowledgeBaseEntry
}

export async function deleteKbEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('knowledge_base_entries').delete().eq('id', id)
  if (error) throw error
}

export async function getSyncStats(): Promise<SyncStats> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('knowledge_base_entries').select('sync_status')
  if (error) throw error
  const entries = (data ?? []) as { sync_status: string }[]
  return {
    total: entries.length,
    synced: entries.filter((e) => e.sync_status === 'synced').length,
    pending: entries.filter((e) => e.sync_status === 'pending').length,
  }
}
