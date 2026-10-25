'use client';

// The Inbox's extras (@liveworkspace/explorer `InboxHost`): a Plan card's type glyph, from the Plan glyph set
// liveplanner's own Inbox draws, and the help article on actions, on the app's site. On an app's own address, the rows
// of the app's items kept only in this browser, from the snapshot the app keeps in this origin's localStorage
// (`localInboxHost`); liveworkspace.app, on its own origin, can't read it, so there they stay in the app's Explorer.

import { Glyph } from '@livediagram/ui';
import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';
import type { InboxActions, InboxHost } from '@liveworkspace/explorer';
import { createInboxActions } from '@liveworkspace/explorer/inbox-actions';
import { inboxSnapshotRows, subscribeInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { isAppName, siteOfApp, type AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';
import { workspaceToken } from './token';

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

/** The reading pane's verbs on this page (@liveworkspace/explorer/inbox-actions): Reply and Resolve on a thread,
 *  through the app's own comment routes. On liveworkspace.app every app's threads, as the workspace token's audience
 *  is every app's api; on an app's address that app's alone, as its token is only its own api's. Nothing here can
 *  mark an action done (only the editor that has it open can) or reach This Browser's items. */
export function inboxActionsFor(host: AppName | null, doFetch: typeof fetch = fetch): InboxActions {
  return createInboxActions({
    api: (app) => {
      if (!isAppName(app) || (host !== null && host !== app)) return null;
      return async (path, init) => {
        const token = await workspaceToken();
        const headers = new Headers();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (init.body !== undefined) headers.set('Content-Type', 'application/json');
        return doFetch(`${appOrigin(app)}/api${path}`, {
          method: init.method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          credentials: 'omit',
          signal: init.signal,
        });
      };
    },
  });
}
