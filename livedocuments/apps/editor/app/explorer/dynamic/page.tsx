import type { Metadata } from 'next';
import { RetiredViewRedirect } from '../RetiredViewRedirect';

// /explorer/dynamic is retired: it replaces itself with its successor (RetiredViewRedirect), so links to it keep working.
export const metadata: Metadata = {
  title: 'Explorer | livedocuments',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RetiredViewRedirect from="dynamic" />;
}
