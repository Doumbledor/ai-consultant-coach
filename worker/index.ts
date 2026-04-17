import crypto from 'crypto'
import express from 'express'
import { handleCalcomWebhook } from './webhooks/calcom'
import { handleStripeWebhook } from './webhooks/stripe'
import { handleZoomWebhook } from './webhooks/zoom'
import { syncCalcomBookings } from './jobs/sync-calcom'
import { syncHeygenKb } from './jobs/sync-heygen'

const app = express()
const PORT = process.env.PORT || 3001

// Stripe needs the raw body for signature verification — register BEFORE express.json()
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature']
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' })
    return
  }
  res.json({ received: true }) // respond first
  await handleStripeWebhook(req.body.toString(), signature)
})

// All other routes use JSON parsing
app.use(express.json())

// Health check for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', worker: 'ai-consultant-worker' })
})

// Cal.com webhook
app.post('/webhooks/calcom', async (req, res) => {
  res.json({ received: true })
  const { triggerEvent, payload } = req.body
  if (triggerEvent && payload) {
    await handleCalcomWebhook(triggerEvent, payload).catch(err =>
      console.error('[calcom webhook] Error:', err)
    )
  }
})

// Zoom webhook
app.post('/webhooks/zoom', async (req, res) => {
  // Handle Zoom's one-time URL validation challenge (required when registering the webhook)
  if (req.body?.event === 'endpoint.url_validation') {
    const hashForValidate = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? '')
      .update(req.body.payload.plainToken)
      .digest('hex')
    res.json({ plainToken: req.body.payload.plainToken, encryptedToken: hashForValidate })
    return
  }

  res.json({ received: true })
  await handleZoomWebhook(req.body).catch(err =>
    console.error('[zoom webhook] Error:', err)
  )
})

// Start the server
app.listen(PORT, () => {
  console.log(`Worker running on port ${PORT}`)
})

// Cal.com polling: sync bookings every 5 minutes
syncCalcomBookings() // run immediately on startup
setInterval(syncCalcomBookings, 5 * 60 * 1000)

// HeyGen sync: check for pending KB entries every 60 seconds
setInterval(syncHeygenKb, 60 * 1000)
