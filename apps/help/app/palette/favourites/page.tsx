import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// Favourites is gone (docs/specs/010-palette/palette-favourites.md), and so is Popular, which replaced it: the
// palette's categories sit on the strip, each one press away (docs/specs/007-editor/toolbar-layout.md "The category
// bar"). This stub keeps the old help URL alive (it redirects there) but is noindex, so search engines consolidate on
// the canonical article rather than this thin redirect.
const NEW_URL = '/help/palette/toolbar-layout/';

export const metadata: Metadata = {
  title: 'Toolbar Layout',
  description:
    'Favourites is gone: the palette shows its categories on the strip, each one press away.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function FavouritesRedirectPage() {
  return <Redirect href={NEW_URL} label="Toolbar Layout guide" />;
}
