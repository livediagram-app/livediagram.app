// Presence on sheets (docs/specs/029-sheets/sheet.md "Collaboration"): each peer's selection, by ids so it follows
// rows that move, heard from the room and drawn in their colour; and this person's own, said when it changes
// (throttled) and said again to a late joiner or after a rejoin. Ephemeral: nothing is stored.
import type { SheetPresenceOp } from '@livediagram/api-schema';
import type { IdRange } from '@livediagram/sheets';
import type { SheetStore } from './sheet-store-client';

export const PRESENCE_THROTTLE_MS = 120;

// `at`: when it was heard (the name tag shows for a while after a move, then hides until hovered).
export type PeerSelection = {
  tabId: string;
  sheetId: string;
  ranges: IdRange[];
  editing: boolean;
  at: number;
};

export class SheetPresence {
  private readonly peers = new Map<string, PeerSelection>();
  private readonly listeners = new Set<() => void>();
  private send: ((op: SheetPresenceOp) => void) | null = null;
  private last: SheetPresenceOp | null = null;
  private lastKey = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: SheetPresenceOp | null = null;
  version = 0;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getVersion = () => this.version;

  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  connect(send: (op: SheetPresenceOp) => void): void {
    this.send = send;
  }

  receive(from: string, op: SheetPresenceOp): void {
    if (op.ranges && op.ranges.length) {
      this.peers.set(from, {
        tabId: op.tabId,
        sheetId: op.sheetId,
        ranges: op.ranges,
        editing: op.editing,
        at: Date.now(),
      });
    } else {
      this.peers.delete(from);
    }
    this.notify();
  }

  on(sheetId: string): [string, PeerSelection][] {
    return [...this.peers].filter(([, p]) => p.sheetId === sheetId);
  }

  // Say this person's selection (null: none), at most every PRESENCE_THROTTLE_MS, the last one always sent.
  say(op: SheetPresenceOp): void {
    const key = JSON.stringify([op.sheetId, op.ranges, op.editing]);
    if (key === this.lastKey) return;
    // Nothing said yet and nothing selected: stay silent.
    if (!op.ranges && !this.last) return;
    this.lastKey = key;
    this.pending = op;
    if (this.timer) return;
    this.flush();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.pending) this.flush();
    }, PRESENCE_THROTTLE_MS);
  }

  private flush(): void {
    const op = this.pending;
    this.pending = null;
    if (!op || !this.send) return;
    this.send(op);
    this.last = op.ranges ? op : null;
  }

  reannounce(): void {
    if (this.last && this.send) this.send(this.last);
  }
}

const BY_STORE = new WeakMap<SheetStore, SheetPresence>();

export function sheetPresenceFor(store: SheetStore): SheetPresence {
  let p = BY_STORE.get(store);
  if (!p) {
    p = new SheetPresence();
    BY_STORE.set(store, p);
  }
  return p;
}
