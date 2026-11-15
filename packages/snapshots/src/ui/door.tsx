'use client';

// Where an editor offers Snapshots (liveworkspace/docs/specs/013-snapshots/snapshots.md "In the editor"; blueprint
// SN22): the app's host builds a door from its gate (an Editor of the whole item, stored on the server, not a
// workbench frame or a Community visit) and hands it to the provider, or null for nobody. The footer's button reads
// it and draws nothing without one; the provider draws the dialog while it is open.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SnapshotsApi } from '../client';
import { SnapshotsDialog } from './SnapshotsDialog';

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
      {door && open ? <SnapshotsDialog door={door} onClose={() => setOpen(false)} /> : null}
    </Context.Provider>
  );
}
