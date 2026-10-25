// The Inbox's This Browser rows for the Explorer page on livedocuments's own address (docs/specs/013-workspace/inbox.md
// "This Browser"), which can't read the offline store: the shared snapshot (@liveworkspace/explorer/this-browser
// `inboxSnapshotKeeper`), worked out again once the store has been quiet a moment after a write (this-browser.ts), as
// the page learns who is signed in (useAccountBootstrap), and from the rows the panel's Inbox reads anyway
// (explorer-inbox-host). The read and the rows' shape load on first use, off the offline store's own graph.

import { inboxSnapshotKeeper, readThisBrowser } from '@liveworkspace/explorer/this-browser';

const APP = 'livedocuments';

export const inboxSnapshot = inboxSnapshotKeeper({
  app: APP,
  hasItems: () => readThisBrowser(APP).length > 0,
  compute: async (account) => {
    const [{ getGuestSelfId }, { readOfflineActivity }, { localInboxRows }] = await Promise.all([
      import('../local-identity'),
      import('./offline-activity'),
      import('../explorer-inbox-host'),
    ]);
    const ownerIds = [...new Set([account, getGuestSelfId()].filter((id): id is string => !!id))];
    const me = ownerIds[0];
    if (!me) return null;
    return { ownerIds, rows: localInboxRows(await readOfflineActivity(ownerIds), me) };
  },
});
