import type { Metadata } from 'next';
import { Redirect } from '@/components/Redirect';

// Favourites is gone (docs/specs/010-palette/palette-favourites.md): the palette opens on Popular,
// a fixed pick of the tiles most reached for. This stub keeps the old help URL alive (it redirects
// there) but is noindex, so search engines consolidate on the canonical article rather than this
// thin redirect.
const NEW_URL = '/help/palette/popular/';

export const metadata: Metadata = {
  title: 'Popular',
  description: 'Favourites is gone: the palette opens on Popular, the tiles most reached for.',
  robots: { index: false, follow: true },
  alternates: { canonical: NEW_URL },
};

export default function FavouritesRedirectPage() {
  return <Redirect href={NEW_URL} label="Popular guide" />;
}
