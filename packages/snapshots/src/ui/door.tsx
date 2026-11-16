'use client';

// Where an editor offers Snapshots (liveworkspace/docs/specs/013-snapshots/snapshots.md "In the editor"; blueprint
// SN22): the app's host builds a door from its gate (an Editor of the whole item, stored on the server, not a
// workbench frame or a Community visit) and hands it to the provider, or null for nobody. The footer's button reads
// it and draws nothing without one; the provider draws the dialog while it is open. The dialog's code loads the first
// time it opens, so an editor that never opens it pays nothing for it.

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { snapshotsApi, type SnapshotsApi, type SnapshotsApiDeps } from '../client';

const SnapshotsDialog = lazy(() =>
  import('./SnapshotsDialog').then((m) => ({ default: m.SnapshotsDialog })),
);

export type SnapshotsDoor = {
  api: SnapshotsApi;
  /** What the item is called in this app: plan, document, design, Space. */
  noun: string;
  /** The viewer's id, so their own snapshots read "You". */
  viewerId: string | null;
};

type DoorContext = { door: SnapshotsDoor; open: () => void } | null;

const Context = createContext<DoorContext>(null);

/** The open door, or null where Snapshots are not offered. */
export function useSnapshotsDoor(): DoorContext {
  return useContext(Context);
}

/** An app host's door: null unless `allowed` (its gate) and the item has a route; one api per item and caller. */
export function useItemSnapshotsDoor(input: {
  allowed: boolean;
  itemUrl: string | null;
  noun: string;
  viewerId: string | null;
  apiFetch: SnapshotsApiDeps['apiFetch'];
  apiHeaders: SnapshotsApiDeps['apiHeaders'];
}): SnapshotsDoor | null {
  const { allowed, itemUrl, noun, viewerId, apiFetch, apiHeaders } = input;
  return useMemo(
    () =>
      allowed && itemUrl
        ? { api: snapshotsApi({ apiFetch, apiHeaders, itemUrl }), noun, viewerId }
        : null,
    // The host passes stable apiFetch and apiHeaders (module functions, or memoised on who is asking).
    [allowed, itemUrl, noun, viewerId, apiFetch, apiHeaders],
  );
}

/** The editor's door from its session (liveworkspace/docs/specs/013-snapshots/snapshots.md "In the editor"): an Editor
 *  of the whole item stored on the server, never in This Browser, an embed, the workbench frame or a tab-scoped link
 *  (which reads as structure read-only), and never before the editor knows who is asking. The api refuses everyone
 *  else all the same, so this is presentation. */
export function useEditorSnapshotsDoor(input: {
  hydrated: boolean;
  isOffline: boolean;
  embedMode: boolean;
  workbench: unknown;
  isStructureReadOnly: boolean;
  level: string;
  itemId: string | null;
  selfId: string | null;
  shareCode: string | null;
  /** The app's api base and item collection: `${apiBase}/${collection}/<id>`. */
  apiBase: string;
  collection: string;
  noun: string;
  apiFetch: SnapshotsApiDeps['apiFetch'];
  apiHeaders: (
    ownerId: string,
    opts: { share: string | null; body?: boolean },
  ) => Promise<HeadersInit>;
}): SnapshotsDoor | null {
  const ownerId = input.selfId && input.selfId !== 'self' ? input.selfId : null;
  const allowed =
    input.hydrated &&
    !input.isOffline &&
    !input.embedMode &&
    !input.workbench &&
    !input.isStructureReadOnly &&
    input.level === 'edit' &&
    ownerId !== null;
  const { shareCode, apiHeaders } = input;
  const headers = useCallback(
    // Called only through an open door, which needs an owner.
    (opts: { body?: boolean }) =>
      apiHeaders(String(ownerId), { share: shareCode, body: opts.body }),
    [apiHeaders, ownerId, shareCode],
  );
  return useItemSnapshotsDoor({
    allowed,
    itemUrl: input.itemId
      ? `${input.apiBase}/${input.collection}/${encodeURIComponent(input.itemId)}`
      : null,
    noun: input.noun,
    viewerId: ownerId,
    apiFetch: input.apiFetch,
    apiHeaders: headers,
  });
}

export function SnapshotsDoorProvider({
  door,
  children,
}: {
  door: SnapshotsDoor | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const value = useMemo<DoorContext>(
    () => (door ? { door, open: () => setOpen(true) } : null),
    [door],
  );
  return (
    <Context.Provider value={value}>
      {children}
      {door && open ? (
        <Suspense fallback={null}>
          <SnapshotsDialog door={door} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </Context.Provider>
  );
}
