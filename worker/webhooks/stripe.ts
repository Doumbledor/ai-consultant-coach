import Stripe from 'stripe'
import { verifyStripeWebhook } from '../lib/stripe'
import { supabase } from '../lib/supabase'

export async function handleStripeWebhook(
  rawBody: string,
  signature: string
): Promise<void> {
  let event: Stripe.Event
  try {
    event = verifyStripeWebhook(rawBody, signature)
  } catch (err) {
    console.error('[stripe] Invalid webhook signature:', err)
    return
  }

  if (event.type !== 'checkout.session.completed') return

  const session = event.data.object as Stripe.Checkout.Session
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  const customerEmail = session.customer_email

  if (!paymentIntentId || !customerEmail) {
    console.warn('[stripe] Missing payment_intent or customer_email in event')
    return
  }

  // Match to most recent upcoming session with this email that has no payment yet
  const { data: sessions, error: selectError } = await supabase
    .from('sessions')
    .select('id')
    .eq('customer_email', customerEmail)
    .eq('status', 'upcoming')
    .is('stripe_payment_id', null)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (selectError) {
    console.error('[stripe] Select error:', selectError.message)
    return
  }

  if (!sessions?.length) {
    console.warn('[stripe] No matching session found for email:', customerEmail)
    return
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ stripe_payment_id: paymentIntentId })
    .eq('id', sessions[0].id)

  if (updateError) console.error('[stripe] Update error:', updateError.message)
  else console.log('[stripe] Payment recorded for session:', sessions[0].id)
}
