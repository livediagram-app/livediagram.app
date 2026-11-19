'use client';

// The editor's Inbox notices for one reader (inbox-notices.md): the page's watch over their Inbox, the rows seen in
// this browser, and the notice on screen. Each answer, in a visible tab, offers the rows that are news; they join the
// notice and are seen at once, so no other tab shows them too. Dismissing or following a link marks them gone, and a
// notice in another tab showing them closes. Answers the Inbox's count for the Explorer button, and the layer to draw.

import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { App, IndexClient } from '@liveworkspace/index-client';
import { appHasInbox } from '../inbox-apps';
import { inboxCount } from '../explorer/inbox/sections';
import type { InboxData } from '../data/useInbox';
import { createNoticeCenter, type NoticeCenter } from './center';
import { dialogOpenNow, subscribeDialogs } from './dialog-open';
import { InboxNotice } from './InboxNotice';
import { freshRows, noticeRows } from './rows';
import { seenStoreFor, type SeenStore } from './seen';
import { inboxWatchFor, type InboxWatch } from './watch';

export type InboxNoticeEvent = 'Opened' | 'Removed';

export type InboxNoticesOptions = {
  client: IndexClient;
  app: App;
  /** The signed-in account; null for a guest or before sign-in is known, which hears nothing. */
  viewerId: string | null;
  /** The reader's display name, so a quote naming their `@handle` reads their name. */
  viewerName?: string | null;
  /** False where the editor draws no notices (an embed, a workbench frame). */
  enabled?: boolean;
  onTelemetry?: (event: InboxNoticeEvent) => void;
  // Stand-ins for tests.
  watch?: InboxWatch;
  seen?: SeenStore;
  center?: NoticeCenter;
  now?: () => number;
};

export type InboxNotices = {
  /** The Inbox's count (the sidebar's), undefined until read or when off. */
  count: number | undefined;
  /** The notice layer, drawn once a page whoever else asks. */
  notices: ReactNode;
};

const pageCenter = createNoticeCenter();
const noSubscribe = () => () => {};

// One layer a page: the first hook to mount draws it, the next only when that one goes.
const owners: symbol[] = [];
const ownerListeners = new Set<() => void>();
const giveOwners = () => {
  for (const l of ownerListeners) l();
};
function useLayerOwner(on: boolean): boolean {
  const me = useMemo(() => Symbol('inbox-notices'), []);
  useEffect(() => {
    if (!on) return;
    owners.push(me);
    giveOwners();
    return () => {
      owners.splice(owners.indexOf(me), 1);
      giveOwners();
    };
  }, [on, me]);
  return useSyncExternalStore(
    (l) => {
      ownerListeners.add(l);
      return () => ownerListeners.delete(l);
    },
    () => owners[0] === me,
    () => false,
  );
}

const visibleNow = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
function subscribeVisibility(listener: () => void) {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

export function useInboxNotices({
  client,
  app,
  viewerId,
  viewerName = null,
  enabled = true,
  onTelemetry,
  watch: givenWatch,
  seen: givenSeen,
  center: givenCenter,
  now = Date.now,
}: InboxNoticesOptions): InboxNotices {
  const on = enabled && viewerId !== null && appHasInbox(app);
  const watch = givenWatch ?? inboxWatchFor(client);
  const center = givenCenter ?? pageCenter;
  const seen = on ? (givenSeen ?? seenStoreFor(viewerId!)) : null;
  const subscribe = useCallback(
    (listener: () => void) => watch.subscribe(listener, { readNow: true }),
    [watch],
  );
  const data = useSyncExternalStore(
    on ? subscribe : noSubscribe,
    () => (on ? watch.current().data : null),
    () => null,
  );
  const visible = useSyncExternalStore(subscribeVisibility, visibleNow, () => true);
  const notice = useSyncExternalStore(center.subscribe, center.current, () => null);
  // A dialog open over the page: the notice waits, its time held, and shows when the dialog closes.
  const waiting = on && notice !== null;
  const dialog = useSyncExternalStore(
    waiting ? subscribeDialogs : noSubscribe,
    () => waiting && dialogOpenNow(),
    () => false,
  );
  useEffect(() => center.hold(dialog, 'dialog'), [dialog, center]);

  // Each answer, while this tab is in view: what is news here joins the notice, seen at once.
  useEffect(() => {
    if (!seen || !data || !visible) return;
    const rows = noticeRows(data, viewerId!, app, viewerName);
    seen.prune(new Set(rows.map((r) => r.key)));
    const fresh = freshRows(rows, seen, now());
    if (fresh.length === 0) return;
    seen.mark(fresh);
    center.offer(fresh);
  }, [seen, data, visible, viewerId, viewerName, app, center, now]);

  // Dismissed or read elsewhere (another tab, the Inbox list): those rows leave the notice.
  useEffect(() => {
    if (!seen) return;
    return seen.subscribe(() => center.forget((row) => seen.gone(row)));
  }, [seen, center]);

  // Signed out, or off: no notice is left behind.
  useEffect(() => {
    if (!on) center.dismiss();
  }, [on, center]);

  const settle = useCallback(
    (event: InboxNoticeEvent) => {
      const rows = center.current()?.rows ?? [];
      seen?.mark(rows, true);
      center.dismiss();
      onTelemetry?.(event);
    },
    [center, seen, onTelemetry],
  );
  const onDismiss = useCallback(() => settle('Removed'), [settle]);
  const onFollow = useCallback(() => settle('Opened'), [settle]);
  const owner = useLayerOwner(on);
  const count = on ? inboxCount(data as InboxData | null, viewerId) : undefined;
  return {
    count,
    notices:
      on && owner ? (
        <InboxNotice
          notice={dialog ? null : notice}
          inboxHref="/explorer/inbox"
          onDismiss={onDismiss}
          onFollow={onFollow}
          onHold={center.hold}
        />
      ) : null,
  };
}
