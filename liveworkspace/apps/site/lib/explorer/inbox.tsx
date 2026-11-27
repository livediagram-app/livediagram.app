'use client';

// The Inbox's extras (@liveworkspace/explorer `InboxHost`): a Plan card's type glyph, from the Plan glyph set
// liveplanner's own Inbox draws, and the help article on actions, on the app's site. On an app's own address, the rows
// of the app's items kept only in this browser, from the snapshot the app keeps in this origin's localStorage
// (`localInboxHost`); liveworkspace.app, on its own origin, can't read it, so there they stay in the app's Explorer.

import type { InboxActions, InboxHost } from '@liveworkspace/explorer';
import { createInboxActions } from '@liveworkspace/explorer/inbox-actions';
import { inboxSnapshotRows, subscribeInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { isAppName, siteOfApp, type AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';
import { workspaceToken } from './token';
import {
  createWorkspaceTokenSource,
  crossAppInboxApi,
  type WorkspaceTokenSource,
} from '@liveworkspace/explorer/inbox-cross-app';
import { ACCOUNT_ROUTE } from '@liveworkspace/sites/workspace-proxy';
import { lazyPanel } from '@liveworkspace/ui/lazy-panel';

let traded: WorkspaceTokenSource | null = null;
// One source per page: the app's bearer (this page's token) traded at the accounts' bearer door through the app's router.
const crossAppToken = (): WorkspaceTokenSource =>
  (traded ??= createWorkspaceTokenSource({
    url: `${ACCOUNT_ROUTE.prefix}/workspace-token`,
    bearer: workspaceToken,
  }));

// A Plan card type's glyph (card-glyph.tsx), from its own chunk: the glyph set is 13 KB the Explorer's first load never
// needs, since only an Inbox row draws one and the Inbox is itself a chunk. A 16px blank holds the place while it lands.
const CardGlyph = lazyPanel('card-glyph', () => import('./card-glyph').then((m) => m.CardGlyph), {
  fallback: () => <span aria-hidden className="inline-block size-4 shrink-0" />,
});

export const inboxHost: InboxHost = {
  cardGlyph: (type) => <CardGlyph type={type} />,
  actionsHelpHref: `${siteOfApp('liveplanner').url}/help/plan/cards/`,
};

/** The Inbox on the page served at `app`'s address: `base`, with the app's Offline rows for this reader (only
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
 *  is every app's api; on an app's address that app's by its own token, and every other app's by the workspace token
 *  traded for it. Mark Done on a
 *  livediagram action goes through its action route; nothing here reaches Offline's items. */
export function inboxActionsFor(
  host: AppName | null,
  signedIn: boolean,
  doFetch: typeof fetch = fetch,
): InboxActions {
  return createInboxActions({
    api: (app) => {
      if (!isAppName(app)) return null;
      // On an app's address its token reaches that app's api alone: another app's goes by the workspace token traded
      // for it (inbox-reading.md "Cross-app verbs").
      // A guest has no account to trade for one, so their Inbox offers no Reply or Resolve there (Open stays).
      if (host !== null && host !== app)
        return signedIn ? crossAppInboxApi(app, crossAppToken(), doFetch) : null;
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
