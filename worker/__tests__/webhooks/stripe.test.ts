import { handleStripeWebhook } from '../../webhooks/stripe'
import { supabase as supabaseClient } from '../../lib/supabase'
import Stripe from 'stripe'

// Cast to any so we can assert on the mock's fluent query builder methods
// (SupabaseClient type doesn't expose .update etc. at the top level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    // select returns `this` so the chain .select().eq().is().order().limit() works;
    // limit resolves with the final select result
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [{ id: 'session-id' }],
      error: null,
    }),
  },
}))

jest.mock('../../lib/stripe', () => ({
  verifyStripeWebhook: jest.fn(),
}))

import { verifyStripeWebhook } from '../../lib/stripe'

describe('handleStripeWebhook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates stripe_payment_id on checkout.session.completed', async () => {
    const mockCheckoutSession = {
      object: 'checkout.session',
      id: 'cs_test_123',
      payment_intent: 'pi_test_456',
      customer_email: 'customer@example.com',
    } as Stripe.Checkout.Session

    const mockEvent = {
      type: 'checkout.session.completed',
      data: { object: mockCheckoutSession },
    } as Stripe.Event

    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)

    await handleStripeWebhook('raw-body', 'stripe-signature')

    expect(supabase.update).toHaveBeenCalledWith({
      stripe_payment_id: 'pi_test_456',
    })
  })

  it('ignores unrelated event types', async () => {
    const mockEvent = {
      type: 'customer.created',
      data: { object: {} },
    } as unknown as Stripe.Event

    ;(verifyStripeWebhook as jest.Mock).mockReturnValue(mockEvent)

    await handleStripeWebhook('raw-body', 'stripe-signature')

    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('returns early on invalid signature', async () => {
    ;(verifyStripeWebhook as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    await handleStripeWebhook('raw-body', 'bad-signature')

    expect(supabase.update).not.toHaveBeenCalled()
  })
})
