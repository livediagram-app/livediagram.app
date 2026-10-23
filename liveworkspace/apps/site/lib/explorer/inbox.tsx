'use client';

// The Inbox's extras on liveworkspace.app (@liveworkspace/explorer `InboxHost`): a Plan card's type glyph, from the
// Plan glyph set liveplanner's own Inbox draws, and the help article on actions, on the app's site. Plans kept only in
// a browser stay with their app (its origin's storage), so their rows are in that app's This Browser view, not here.

import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';
import type { InboxHost } from '@liveworkspace/explorer';
import { siteOfApp } from '@liveworkspace/sites';

/** A Plan card type's glyph, by its type id: the type's own, or the plain card glyph for one not built in. */
export function CardGlyph({ type }: { type: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-card-glyph={type}
    >
      <path d={planGlyphPath(ITEM_TYPES.find((t) => t.id === type)?.glyph)} />
    </svg>
  );
}

export const inboxHost: InboxHost = {
  cardGlyph: (type) => <CardGlyph type={type} />,
  actionsHelpHref: `${siteOfApp('liveplanner').url}/help/plan/cards/`,
};
