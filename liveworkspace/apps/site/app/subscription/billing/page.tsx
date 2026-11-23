import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { MockBillingPage } from '@/components/subscription/MockBillingPage';

// The mock billing portal, /subscription/billing?session=… (liveworkspace/docs/specs/019-subscription/subscription.md
// "Billing"): where Manage Billing sends the browser until Stripe is wired in. Static, so the page reads the session
// from its address. Never indexed, no Referer (the address carries the session), and no such page with Pro off.
export const metadata: Metadata = {
  title: 'Billing · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  if (!proOn()) notFound();
  return <MockBillingPage />;
}
