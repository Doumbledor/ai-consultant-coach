import express from 'express'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Health check for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', worker: 'ai-consultant-worker' })
})

// Webhook endpoints — implemented in Plan 2
app.post('/webhooks/calcom', (_req, res) => {
  res.json({ received: true })
})

app.post('/webhooks/stripe', (_req, res) => {
  res.json({ received: true })
})

app.post('/webhooks/zoom', (_req, res) => {
  res.json({ received: true })
})

app.listen(PORT, () => {
  console.log(`Worker running on port ${PORT}`)
})
