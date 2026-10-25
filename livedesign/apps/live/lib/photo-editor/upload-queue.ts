// Pending uploads and the save gate (docs/specs/031-photo/photo-store.md "Committing an edit"): the
// blobs a commit named that the store does not have yet, per tab, sent in batches (asking which the
// tab holds first), two at a time, retried at 2, 4, 8 and 16 seconds; the tab's save waits until none
// are pending, so a save never names a blob the store lacks. Other tabs never wait.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import { PHOTO_BATCH_BLOBS, PHOTO_BATCH_BYTES } from '@livedesign/photo-engine';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { blobsHeld, uploadBlobs, type PhotoBlobScope } from './blob-client';

export type UploadState = 'idle' | 'uploading' | 'failed';

export type UploadTransport = {
  held: (tabId: string, ids: readonly string[]) => Promise<Set<string>>;
  upload: (tabId: string, entries: readonly PhotoBlobEntry[]) => Promise<void>;
};

export function apiTransport(scope: () => PhotoBlobScope): UploadTransport {
  return {
    held: (tabId, ids) => blobsHeld(scope(), tabId, ids),
    upload: (tabId, entries) => uploadBlobs(scope(), tabId, entries),
  };
}

export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000] as const;
const IN_FLIGHT = 2;

type TabQueue = {
  pending: Map<string, PhotoBlobEntry>;
  state: UploadState;
  running: boolean;
  waiters: (() => void)[];
  attempt: number;
};

/** Splits blobs into batches of at most PHOTO_BATCH_BLOBS and PHOTO_BATCH_BYTES. */
export function batchesOf(entries: readonly PhotoBlobEntry[]): PhotoBlobEntry[][] {
  const out: PhotoBlobEntry[][] = [];
  let cur: PhotoBlobEntry[] = [];
  let bytes = 0;
  for (const e of entries) {
    if (
      cur.length > 0 &&
      (cur.length >= PHOTO_BATCH_BLOBS || bytes + e.bytes.length > PHOTO_BATCH_BYTES)
    ) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(e);
    bytes += e.bytes.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

export class PhotoUploadQueue {
  private readonly tabs = new Map<string, TabQueue>();
  private transport: UploadTransport | null = null;
  private readonly listeners = new Set<(tabId: string, state: UploadState) => void>();
  private readonly wait: (ms: number) => Promise<void>;

  constructor(wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
    this.wait = wait;
  }

  setTransport(t: UploadTransport | null): void {
    this.transport = t;
  }

  onState(fn: (tabId: string, state: UploadState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private tab(tabId: string): TabQueue {
    let q = this.tabs.get(tabId);
    if (!q) {
      q = { pending: new Map(), state: 'idle', running: false, waiters: [], attempt: 0 };
      this.tabs.set(tabId, q);
    }
    return q;
  }

  private setState(tabId: string, q: TabQueue, state: UploadState): void {
    if (q.state === state) return;
    q.state = state;
    for (const fn of this.listeners) fn(tabId, state);
  }

  /** Blobs to send for the tab. */
  enqueue(tabId: string, entries: readonly PhotoBlobEntry[]): void {
    if (entries.length === 0) return;
    const q = this.tab(tabId);
    // New blobs after a failure start the retries over.
    if (q.state === 'failed') q.attempt = 0;
    for (const e of entries) q.pending.set(e.id, e);
    void this.drain(tabId);
  }

  pending(tabId: string): boolean {
    return (this.tabs.get(tabId)?.pending.size ?? 0) > 0;
  }

  stateOf(tabId: string): UploadState {
    return this.tabs.get(tabId)?.state ?? 'idle';
  }

  /** Resolves once nothing is pending for the tab. */
  whenSettled(tabId: string): Promise<void> {
    const q = this.tabs.get(tabId);
    if (!q || q.pending.size === 0) return Promise.resolve();
    return new Promise((resolve) => q.waiters.push(resolve));
  }

  /** A failed tab tried again now. */
  retry(tabId: string): void {
    const q = this.tabs.get(tabId);
    if (!q || q.state !== 'failed') return;
    q.attempt = 0;
    void this.drain(tabId);
  }

  private async drain(tabId: string): Promise<void> {
    const q = this.tab(tabId);
    if (q.running) return;
    q.running = true;
    this.setState(tabId, q, 'uploading');
    try {
      while (q.pending.size > 0) {
        const t = this.transport;
        if (!t) throw new Error('no transport');
        const ids = [...q.pending.keys()];
        try {
          const held = await t.held(tabId, ids);
          for (const id of held) q.pending.delete(id);
          const batches = batchesOf([...q.pending.values()]);
          for (let i = 0; i < batches.length; i += IN_FLIGHT) {
            const now = batches.slice(i, i + IN_FLIGHT);
            await Promise.all(now.map((b) => t.upload(tabId, b)));
            for (const b of now) {
              for (const e of b) q.pending.delete(e.id);
              debugLog('[photo] upload-batch', {
                n: b.length,
                bytes: b.reduce((n, e) => n + e.bytes.length, 0),
              });
            }
          }
          q.attempt = 0;
        } catch (err) {
          const delay = RETRY_DELAYS_MS[q.attempt];
          q.attempt += 1;
          if (delay === undefined) {
            console.warn('[photo] upload-failed', {
              tabId,
              pending: q.pending.size,
              error: String(err),
            });
            this.setState(tabId, q, 'failed');
            return;
          }
          await this.wait(delay);
        }
      }
      this.setState(tabId, q, 'idle');
      const waiters = q.waiters.splice(0);
      for (const w of waiters) w();
    } catch (err) {
      console.warn('[photo] upload-failed', { tabId, error: String(err) });
      this.setState(tabId, q, 'failed');
    } finally {
      q.running = false;
    }
  }
}

/** The editor's one queue. */
export const photoUploads = new PhotoUploadQueue();
