import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// Popular is gone from the palette (docs/specs/007-editor/toolbar-layout.md "The category bar"): the strip shows every
// category by name, each one press away, so a pick from across them added nothing. This stub keeps the old help URL
// alive (it redirects to the strip's article) but is noindex, so search engines consolidate on the canonical article
// rather than this thin redirect.
const NEW_URL = '/help/palette/toolbar-layout/';

export const metadata: Metadata = {
  title: 'Toolbar Layout',
  description:
    'Popular is gone: the palette shows its categories on the strip, each one press away.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function PopularRedirectPage() {
  return <Redirect href={NEW_URL} label="Toolbar Layout guide" />;
}
