import { fetchAllBookings } from '../lib/calcom'
import { handleCalcomWebhook } from '../webhooks/calcom'

export async function syncCalcomBookings(): Promise<void> {
  console.log('[sync-calcom] Starting sync...')
  try {
    const bookings = await fetchAllBookings()
    console.log(`[sync-calcom] Found ${bookings.length} bookings`)

    for (const booking of bookings) {
      const trigger =
        booking.status === 'CANCELLED' ? 'BOOKING_CANCELLED' : 'BOOKING_CREATED'
      await handleCalcomWebhook(trigger, booking)
    }

    console.log('[sync-calcom] Sync complete')
  } catch (err) {
    console.error('[sync-calcom] Error:', err)
  }
}
