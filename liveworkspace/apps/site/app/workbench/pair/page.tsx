import type { Metadata } from 'next';
import { PairWorkbench } from '@/components/workbench/PairWorkbench';

// The one pairing page for every app's workbenches, /workbench/pair?code=… (liveworkspace/docs/workbench.md). Static;
// the page reads the code from the address. No Referer, since the address carries it.
export const metadata: Metadata = {
  title: 'Allow a workbench · liveworkspace',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <PairWorkbench />;
}
