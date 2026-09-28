// Per-browser memory of the mirror rows the last pass saw
// (docs/specs/022-drive-mirror/drive-mirror.md, "Data": "Finishing a removal
// in Drive"). A purge or a folder deletion takes its row with it in the same
// batch; remembering the row is what lets the next pass finish the Drive side.

import type { DriveItem, DriveItemKind } from '@livediagram/api-schema';

export type SeenRow = { kind: DriveItemKind; ldId: string; driveFileId: string };

export interface SeenStore {
  read(ownerId: string): SeenRow[];
  write(ownerId: string, rows: SeenRow[]): void;
  clear(ownerId: string): void;
}

const keyFor = (ownerId: string) => `livediagram:v2:drive-seen:${ownerId}`;

export function seenRowsOf(items: Iterable<DriveItem>): SeenRow[] {
  return [...items].map((i) => ({ kind: i.kind, ldId: i.ldId, driveFileId: i.driveFileId }));
}

type SeenTuple = [DriveItemKind, string, string];

function isSeenTuple(v: unknown): v is SeenTuple {
  if (!Array.isArray(v) || v.length !== 3) return false;
  return (
    (v[0] === 'diagram' || v[0] === 'folder') &&
    typeof v[1] === 'string' &&
    typeof v[2] === 'string'
  );
}

// Compact tuples in localStorage: about 80 bytes a row.
export function localSeenStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SeenStore {
  return {
    read(ownerId) {
      try {
        const raw: unknown = JSON.parse(storage.getItem(keyFor(ownerId)) ?? '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .filter(isSeenTuple)
          .map(([kind, ldId, driveFileId]) => ({ kind, ldId, driveFileId }));
      } catch {
        return [];
      }
    },
    write(ownerId, rows) {
      try {
        storage.setItem(
          keyFor(ownerId),
          JSON.stringify(rows.map((r) => [r.kind, r.ldId, r.driveFileId])),
        );
      } catch {
        // A full storage only costs the Drive-side finish of a future
        // removal; Drive's own 30-day bin covers it.
      }
    },
    clear(ownerId) {
      storage.removeItem(keyFor(ownerId));
    },
  };
}

export function memorySeenStore(): SeenStore {
  const rows = new Map<string, SeenRow[]>();
  return {
    read: (ownerId) => [...(rows.get(ownerId) ?? [])],
    write: (ownerId, next) => void rows.set(ownerId, [...next]),
    clear: (ownerId) => void rows.delete(ownerId),
  };
}
