'use client';

// The Inbox's extras (@liveworkspace/explorer `InboxHost`): a Plan card's type glyph, from the Plan glyph set
// liveplanner's own Inbox draws, and the help article on actions, on the app's site. On an app's own address, the rows
// of the app's items kept only in this browser, from the snapshot the app keeps in this origin's localStorage
// (`localInboxHost`); liveworkspace.app, on its own origin, can't read it, so there they stay in the app's Explorer.

import { Glyph } from '@livediagram/ui';
import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';
import type { InboxHost } from '@liveworkspace/explorer';
import { inboxSnapshotRows, subscribeInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { siteOfApp, type AppName } from '@liveworkspace/sites';

/** A Plan card type's glyph, by its type id: the type's own, or the plain card glyph for one not built in. */
export function CardGlyph({ type }: { type: string }) {
  return (
    <Glyph size={16} data-card-glyph={type}>
      <path d={planGlyphPath(ITEM_TYPES.find((t) => t.id === type)?.glyph)} />
    </Glyph>
  );
}

export const inboxHost: InboxHost = {
  cardGlyph: (type) => <CardGlyph type={type} />,
  actionsHelpHref: `${siteOfApp('liveplanner').url}/help/plan/cards/`,
};

/** The Inbox on the page served at `app`'s address: `base`, with the app's This Browser rows for this reader (only
 *  when the app's snapshot names them) read again as the app rewrites it. Each row opens like any of the app's items,
 *  on this origin (host.ts `itemHref`). Without an app (liveworkspace.app), `base` as it is. */
export function localInboxHost(
  base: InboxHost,
  app: AppName | null,
  viewerId: string | null,
): InboxHost {
  if (!app) return base;
  return {
    ...base,
    localRows: () => Promise.resolve(inboxSnapshotRows(app, viewerId)),
    subscribeLocal: (onChange) => subscribeInboxSnapshot(app, onChange),
  };
}
