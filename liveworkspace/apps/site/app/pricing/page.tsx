import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { PricingPage } from '@/components/subscription/PricingPage';

// Pricing (liveworkspace/docs/specs/019-subscription/subscription.md "What people see", "The pricing page"): the three
// tiers and every limit side by side, with the visitor's own usage when signed in. Static; the prices and the usage
// are asked of the subscription service in the browser. There is no such page in a build with Pro off.

const TITLE = 'Pricing · liveworkspace';
const DESCRIPTION =
  'Every liveworkspace app is free to use. Pro raises the limits for you, and Pro for Teams raises them for a team’s shared library. Every limit, side by side.';

export const metadata: Metadata = proOn()
  ? {
      title: TITLE,
      description: DESCRIPTION,
      alternates: { canonical: '/pricing' },
      openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: '/pricing',
        siteName: 'liveworkspace',
        type: 'website',
      },
      twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
    }
  : { robots: { index: false } };

export default function Page() {
  if (!proOn()) notFound();
  return <PricingPage />;
}
