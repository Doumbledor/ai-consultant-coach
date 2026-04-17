import { supabase } from '../lib/supabase'
import { analyzeRecording } from '../jobs/analyze-recording'

interface ZoomRecordingFile {
  file_type: string
  download_url: string
  status: string
}

interface ZoomWebhookPayload {
  event: string
  download_token?: string
  payload?: {
    object?: {
      id?: string | number
      recording_files?: ZoomRecordingFile[]
    }
  }
}

export async function handleZoomWebhook(body: ZoomWebhookPayload): Promise<void> {
  if (body.event !== 'recording.completed') return

  const obj = body.payload?.object
  if (!obj?.id) return

  const zoomMeetingId = String(obj.id)
  const files = obj.recording_files ?? []

  const mp4File = files.find(f => f.file_type === 'MP4' && f.status === 'completed')
  const transcriptFile = files.find(f => f.file_type === 'TRANSCRIPT' && f.status === 'completed')

  if (!mp4File) {
    console.warn('[zoom] No completed MP4 recording for meeting:', zoomMeetingId)
    return
  }

  // Find the session by zoom_meeting_id
  const { data: session, error: selectError } = await supabase
    .from('sessions')
    .select('id')
    .eq('zoom_meeting_id', zoomMeetingId)
    .single()

  if (selectError || !session) {
    console.warn('[zoom] No session found for zoom_meeting_id:', zoomMeetingId)
    return
  }

  // Store recording URL and mark as completed
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ recording_url: mp4File.download_url, status: 'completed' })
    .eq('zoom_meeting_id', zoomMeetingId)

  if (updateError) {
    console.error('[zoom] Update error:', updateError.message)
    return
  }

  // Fire-and-forget: run Claude analysis async (Zoom requires response within 3s)
  if (transcriptFile && body.download_token) {
    setImmediate(() => {
      analyzeRecording(session.id, transcriptFile.download_url, body.download_token!)
        .catch(err => console.error('[zoom] Analysis failed:', err))
    })
  }

  console.log('[zoom] Recording stored for session:', session.id)
}
