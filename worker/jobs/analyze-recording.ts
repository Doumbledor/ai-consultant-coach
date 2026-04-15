import { supabase } from '../lib/supabase'
import { downloadTranscript, parseVttTranscript } from '../lib/zoom'
import { analyzeTranscript } from '../lib/claude'

export async function analyzeRecording(
  sessionId: string,
  transcriptDownloadUrl: string,
  downloadToken: string
): Promise<void> {
  console.log('[analyze-recording] Starting for session:', sessionId)

  try {
    const rawVtt = await downloadTranscript(transcriptDownloadUrl, downloadToken)
    const transcript = parseVttTranscript(rawVtt)

    const claudeSummary = await analyzeTranscript(transcript)

    const { error } = await supabase
      .from('sessions')
      .update({ transcript, claude_summary: claudeSummary })
      .eq('id', sessionId)

    if (error) console.error('[analyze-recording] Supabase error:', error.message)
    else console.log('[analyze-recording] Done for session:', sessionId)
  } catch (err) {
    console.error('[analyze-recording] Failed for session:', sessionId, err)
  }
}
