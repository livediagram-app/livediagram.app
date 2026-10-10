import type { Metadata } from 'next';
import { RetiredViewRedirect } from '../RetiredViewRedirect';

// /explorer/activity is retired (docs/specs/013-workspace/folders.md#explorer-routes): the Inbox was
// once called Activity, so this address replaces itself with /explorer/inbox and links to it keep
// working.
export const metadata: Metadata = {
  title: 'Explorer | livediagram',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RetiredViewRedirect from="activity" />;
}
