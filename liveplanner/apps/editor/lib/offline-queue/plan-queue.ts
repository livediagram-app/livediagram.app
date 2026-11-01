// A plan's queue of waiting changes (docs/specs/007-editor/offline-changes.md; blueprint offline-changes.md): the
// card and sheet writes this browser made that the server has not answered for want of a connection, in the order
// they were made, stored in localStorage as each joins so a reload, a closed tab or a crash keeps them. One queue per
// plan and person (the key names both), shared by the item store and the sheet store.
import type { ItemWrite } from '@liveplanner/items';
import type { SheetCreateRequest } from '@liveplanner/api-schema';
import type { SheetWrite } from '@liveplanner/sheets';
import { OFFLINE_QUEUE_KEY_PREFIX } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// Spec "Bounds": at most this many changes, and this many characters of their stored JSON, per plan. Safe ranges
// 100..2000 and 256 KB..2 MB (localStorage holds about 5 MB for the whole origin).
export const PLAN_QUEUE_MAX_CHANGES = 500;
export const PLAN_QUEUE_MAX_BYTES = 1_000_000;

export const PLAN_QUEUE_FULL_MESSAGE =
  'Too many changes are waiting to save. Reconnect, then try again.';

const VERSION = 1;

export type SheetWriteFlags = { undo?: true; unchecked?: true };

export type QueuedChange =
  | { id: string; seq: number; store: 'items'; write: ItemWrite }
  | {
      id: string;
      seq: number;
      store: 'sheets';
      op: 'write';
      sheetId: string;
      write: SheetWrite;
      flags: SheetWriteFlags;
    }
  | {
      id: string;
      seq: number;
      store: 'sheets';
      op: 'create';
      sheetId: string;
      create: SheetCreateRequest & { id: string };
    }
  | { id: string; seq: number; store: 'sheets'; op: 'delete'; sheetId: string };

export type QueueStore = QueuedChange['store'];

type Stored = { v: number; changes: QueuedChange[] };

let lastSeq = 0;
// When a change was made, as a number that only grows within the page and across reloads (milliseconds times a
// thousand, then a step): the queue sorts by it, so a write that failed after a later one joined still goes first.
export function nextSeq(now = Date.now()): number {
  lastSeq = Math.max(now * 1000, lastSeq + 1);
  return lastSeq;
}

export function planQueueKey(projectId: string, ownerId: string): string {
  return `${OFFLINE_QUEUE_KEY_PREFIX}v${VERSION}:${projectId}:${ownerId}`;
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isQueuedChange(raw: unknown): raw is QueuedChange {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || typeof c.seq !== 'number') return false;
  if (c.store === 'items') return !!c.write && typeof c.write === 'object';
  if (c.store !== 'sheets' || typeof c.sheetId !== 'string') return false;
  if (c.op === 'write') return !!c.write && typeof c.write === 'object';
  if (c.op === 'create') return !!c.create && typeof c.create === 'object';
  return c.op === 'delete';
}

// What the key holds: its changes, or none when it is missing, unreadable or of another version.
export function readStoredChanges(storage: Storage | null, key: string): QueuedChange[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed.v !== VERSION || !Array.isArray(parsed.changes)) return [];
    return parsed.changes.filter(isQueuedChange).sort((a, b) => a.seq - b.seq);
  } catch {
    debugLog('[offline-queue] queue.read-failed', {});
    return [];
  }
}

export class PlanQueue {
  readonly key: string;
  private readonly storage: Storage | null;
  private readonly onChange: () => void;
  private list: QueuedChange[];
  private readonly sizes = new Map<string, number>();
  private bytes = 0;
  private readonly counts: Record<QueueStore, number> = { items: 0, sheets: 0 };

  constructor(key: string, storage: Storage | null, onChange: () => void = () => {}) {
    this.key = key;
    this.storage = storage;
    this.onChange = onChange;
    this.list = readStoredChanges(storage, key);
    for (const c of this.list) this.account(c, 1);
  }

  private account(change: QueuedChange, sign: 1 | -1, size?: number): void {
    const bytes = size ?? this.sizes.get(change.id) ?? JSON.stringify(change).length;
    if (sign === 1) this.sizes.set(change.id, bytes);
    else this.sizes.delete(change.id);
    this.bytes += sign * bytes;
    this.counts[change.store] += sign;
  }

  /** How many changes wait, of one store or of both. O(1). */
  count(store?: QueueStore): number {
    return store ? this.counts[store] : this.counts.items + this.counts.sheets;
  }

  /** The bytes the queue's changes take as stored JSON. */
  size(): number {
    return this.bytes;
  }

  has(id: string): boolean {
    return this.sizes.has(id);
  }

  /** One store's changes, oldest first. */
  changes(store: QueueStore): QueuedChange[] {
    return this.list.filter((c) => c.store === store);
  }

  /** Adds a change in its place by `seq`; 'full' past a bound or when the browser cannot store it (nothing added).
   *  Adding one already held is a no-op. */
  add(change: QueuedChange): 'ok' | 'full' {
    if (this.sizes.has(change.id)) return 'ok';
    const size = JSON.stringify(change).length;
    if (this.list.length + 1 > PLAN_QUEUE_MAX_CHANGES || this.bytes + size > PLAN_QUEUE_MAX_BYTES) {
      console.warn('[offline-queue] queue.full', { changes: this.list.length, bytes: this.bytes });
      return 'full';
    }
    // Almost always the newest: found from the end.
    let at = this.list.length;
    while (at > 0 && this.list[at - 1]!.seq > change.seq) at--;
    this.list.splice(at, 0, change);
    this.account(change, 1, size);
    if (!this.persist()) {
      this.list.splice(at, 1);
      this.account(change, -1);
      console.warn('[offline-queue] queue.storage-full', { changes: this.list.length });
      return 'full';
    }
    this.onChange();
    return 'ok';
  }

  /** Drops the changes with these ids (sent, or refused); ids not held are ignored. */
  remove(ids: readonly string[]): void {
    const gone = new Set(ids.filter((id) => this.sizes.has(id)));
    if (gone.size === 0) return;
    this.list = this.list.filter((c) => {
      if (!gone.has(c.id)) return true;
      this.account(c, -1);
      return false;
    });
    this.persist();
    this.onChange();
  }

  // Writes the queue whole (an empty one removes its key). False when the browser refused it (storage full).
  private persist(): boolean {
    if (!this.storage) return true;
    try {
      if (this.list.length === 0) this.storage.removeItem(this.key);
      else this.storage.setItem(this.key, JSON.stringify({ v: VERSION, changes: this.list }));
      return true;
    } catch {
      return false;
    }
  }
}

// ---- The page's queues, and how many changes wait in them ------------------------------------------------------

const queues = new Map<string, PlanQueue>();
const listeners = new Set<() => void>();
let waiting = 0;

function recount(): void {
  let n = 0;
  for (const q of queues.values()) n += q.count();
  if (n === waiting) return;
  waiting = n;
  for (const l of listeners) l();
}

/** The queue of a plan for this person, read from storage on first use and kept for the page. */
export function planQueue(projectId: string, ownerId: string): PlanQueue {
  const key = planQueueKey(projectId, ownerId);
  let q = queues.get(key);
  if (!q) {
    q = new PlanQueue(key, storageOrNull(), recount);
    queues.set(key, q);
    recount();
  }
  return q;
}

/** How many changes wait in this page's queues (the offline banner's count). */
export function waitingChangeCount(): number {
  return waiting;
}

export function subscribeWaitingChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests: forget every queue (their storage is left as it is). */
export function forgetPlanQueues(): void {
  queues.clear();
  waiting = 0;
  lastSeq = 0;
}
