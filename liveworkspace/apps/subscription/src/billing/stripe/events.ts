// The events Stripe's webhook endpoint is subscribed to (subscription.md "Stripe"). No imports, so the setup script
// (scripts/stripe-setup.ts) reads the same list the Worker handles.
export const STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;
