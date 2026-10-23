import type { Metadata } from 'next';
import { RetiredViewRedirect } from '../RetiredViewRedirect';

// /explorer/tags is retired (docs/specs/013-workspace/folders.md#explorer-routes): tags were removed, so this
// address replaces itself with Home and links to it keep working.
export const metadata: Metadata = {
  title: 'Explorer | livediagram',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RetiredViewRedirect from="tags" />;
}
