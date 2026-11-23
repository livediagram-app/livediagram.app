import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { MockCheckoutPage } from '@/components/subscription/MockCheckoutPage';

// The mock checkout, /subscription/checkout?session=… (liveworkspace/docs/specs/019-subscription/subscription.md
// "Billing"): where Subscribe sends the browser until Stripe is wired in. Static, so the page reads the session from
// its address. Never indexed, no Referer (the address carries the session), and no such page with Pro off.
export const metadata: Metadata = {
  title: 'Checkout · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  if (!proOn()) notFound();
  return <MockCheckoutPage />;
}
