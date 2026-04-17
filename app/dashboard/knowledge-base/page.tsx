import { getKbEntries, getSyncStats } from '@/lib/data/knowledge-base'
import { KnowledgeBaseEditor } from '@/components/knowledge-base-editor'

export default async function KnowledgeBasePage() {
  const [entries, syncStats] = await Promise.all([getKbEntries(), getSyncStats()])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Knowledge Base</h1>
      <KnowledgeBaseEditor
        initialEntries={entries}
        syncedCount={syncStats.synced}
        pendingCount={syncStats.pending}
        totalCount={syncStats.total}
      />
    </div>
  )
}
