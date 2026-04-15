import { supabase } from '../lib/supabase'
import { pushKbEntry } from '../lib/heygen'

export async function syncHeygenKb(): Promise<void> {
  console.log('[sync-heygen] Checking for pending KB entries...')

  const { data: pendingEntries, error } = await supabase
    .from('knowledge_base_entries')
    .select('id, question, answer, session_tag')
    .eq('sync_status', 'pending')

  if (error) {
    console.error('[sync-heygen] Select error:', error.message)
    return
  }

  if (!pendingEntries?.length) {
    console.log('[sync-heygen] No pending entries')
    return
  }

  console.log(`[sync-heygen] Syncing ${pendingEntries.length} entries...`)

  for (const entry of pendingEntries) {
    try {
      const heygenEntryId = await pushKbEntry(entry.question, entry.answer)

      await supabase
        .from('knowledge_base_entries')
        .update({
          sync_status: 'synced',
          heygen_entry_id: heygenEntryId,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', entry.id)

      console.log(`[sync-heygen] Synced entry: ${entry.id}`)
    } catch (err) {
      console.error(`[sync-heygen] Failed to sync entry ${entry.id}:`, err)
    }
  }

  console.log('[sync-heygen] Done')
}
