'use client';

// A Plan card type's glyph, by its type id: the type's own, or the plain card glyph for one not built in. Drawn from
// its own chunk (inbox.tsx), so the Plan glyph set stays out of the Explorer's first load.

import { Glyph } from '@livediagram/ui';
import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';

export function CardGlyph({ type }: { type: string }) {
  return (
    <Glyph size={16} data-card-glyph={type}>
      <path d={planGlyphPath(ITEM_TYPES.find((t) => t.id === type)?.glyph)} />
    </Glyph>
  );
}
