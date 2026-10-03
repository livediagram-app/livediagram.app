import type { Metadata } from 'next';
import { RetiredViewRedirect } from '../RetiredViewRedirect';

// /explorer/generated is retired (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets):
// it replaces itself with its successor, so links to it keep working.
export const metadata: Metadata = {
  title: 'Explorer | livediagram',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RetiredViewRedirect from="generated" />;
}
