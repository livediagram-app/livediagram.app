import { Redirect } from '@liveworkspace/help-site/components/Redirect';
import { favouritesMoved } from '@liveworkspace/help-site/lib/moved';

// Favourites is gone; its guide is toolbar-layout: this stub keeps the old URL alive, noindex (@liveworkspace/help-site/lib/moved).
const moved = favouritesMoved;

export const metadata = moved.metadata;

export default function FavouritesRedirectPage() {
  return <Redirect href={moved.href} label={moved.label} />;
}
