import type { Metadata } from 'next';
import EditorPage from '../diagram/[id]/editor-page';

// Read-only embed view (docs/specs/013-workspace/embeds.md): the same editor page in embed mode,
// served from a plain static route. The share code arrives client-side
// as `?s=<code>` (the same query form the share view uses), so unlike
// `/diagram/<id>` no worker rewrite is needed; the static export ships
// this page directly. The live worker omits X-Frame-Options for
// `/embed` so host pages can iframe it.
export const metadata: Metadata = {
  title: 'Embedded diagram | livediagram',
  robots: { index: false },
};

export default function Page() {
  return <EditorPage embed />;
}
