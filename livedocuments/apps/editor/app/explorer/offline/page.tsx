import type { Metadata } from 'next';
import { RetiredViewRedirect } from '../RetiredViewRedirect';

// /explorer/offline: This Browser is its own page now, /offline (app/offline); links to this address replace
// themselves with it.
export const metadata: Metadata = {
  title: 'This Browser | livedocuments',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RetiredViewRedirect from="offline" />;
}
