const CALCOM_API_BASE = 'https://api.cal.com/v1'

interface CalcomBooking {
  uid: string
  title: string
  startTime: string
  attendees: Array<{ email: string; name: string }>
  videoCallData?: { type: string; id: string | number }
  metadata?: { videoCallUrl?: string }
  status: string
}

interface CalcomBookingsResponse {
  bookings: CalcomBooking[]
}

export async function fetchAllBookings(): Promise<CalcomBooking[]> {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) throw new Error('Missing CALCOM_API_KEY')

  const url = `${CALCOM_API_BASE}/bookings?apiKey=${apiKey}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Cal.com API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as CalcomBookingsResponse
  return data.bookings ?? []
}
