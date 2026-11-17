import type { Metadata } from 'next';
import { SharedWalkthroughPage } from '@/components/walkthrough/SharedWalkthroughPage';

// A walkthrough's public link, /walkthrough?c=<code> (liveworkspace/docs/specs/006-media/walkthroughs.md "Each
// walkthrough's menu"). One static shell for every link: the page reads the code from the address. Never indexed, and
// no Referer, since the address is the link.
export const metadata: Metadata = {
  title: 'Walkthrough · liveworkspace',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <SharedWalkthroughPage />;
}
