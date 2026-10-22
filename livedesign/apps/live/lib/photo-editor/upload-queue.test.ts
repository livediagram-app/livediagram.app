import { describe, expect, it, vi } from 'vitest';
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import { batchesOf, PhotoUploadQueue, RETRY_DELAYS_MS, type UploadTransport } from './upload-queue';

// Pending uploads and the save gate (docs/specs/031-photo/photo-store.md "Committing an edit").

const blob = (n: number, size = 4): PhotoBlobEntry => ({
  id: `b${n}`.padEnd(22, 'x'),
  type: 'image/png',
  bytes: new Uint8Array(size),
});

function transport(over: Partial<UploadTransport> = {}) {
  const uploaded: string[][] = [];
  const t: UploadTransport = {
    held: vi.fn(async () => new Set<string>()),
    upload: vi.fn(async (_tab: string, entries: readonly PhotoBlobEntry[]) => {
      uploaded.push(entries.map((e) => e.id));
    }),
    ...over,
  };
  return { t, uploaded };
}

const noWait = () => Promise.resolve();

describe('the upload queue', () => {
  it('uploads, skipping what the tab holds, and settles the save gate', async () => {
    const q = new PhotoUploadQueue(noWait);
    const { t, uploaded } = transport({ held: vi.fn(async () => new Set([blob(1).id])) });
    q.setTransport(t);
    const states: string[] = [];
    q.onState((_tab, s) => states.push(s));
    q.enqueue('tab', [blob(1), blob(2)]);
    expect(q.pending('tab')).toBe(true);
    await q.whenSettled('tab');
    expect(uploaded).toEqual([[blob(2).id]]);
    expect(q.pending('tab')).toBe(false);
    expect(q.stateOf('tab')).toBe('idle');
    expect(states).toEqual(['uploading', 'idle']);
    await expect(q.whenSettled('other')).resolves.toBeUndefined();
    q.enqueue('tab', []);
  });

  it('retries with backoff, then fails until retried', async () => {
    const waits: number[] = [];
    const q = new PhotoUploadQueue(async (ms) => {
      waits.push(ms);
    });
    let fail = true;
    const { t } = transport({
      upload: vi.fn(async () => {
        if (fail) throw new Error('offline');
      }),
    });
    q.setTransport(t);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    q.enqueue('tab', [blob(3)]);
    await vi.waitFor(() => expect(q.stateOf('tab')).toBe('failed'));
    expect(waits).toEqual([...RETRY_DELAYS_MS]);
    const settled = q.whenSettled('tab');
    fail = false;
    q.retry('tab');
    await settled;
    expect(q.stateOf('tab')).toBe('idle');
    q.retry('tab');
    q.retry('nothing');
    warn.mockRestore();
  });

  it('starts over when new blobs come after a failure, and fails without a transport', async () => {
    const q = new PhotoUploadQueue(noWait);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    q.enqueue('tab', [blob(4)]);
    await vi.waitFor(() => expect(q.stateOf('tab')).toBe('failed'));
    const { t, uploaded } = transport();
    q.setTransport(t);
    q.enqueue('tab', [blob(5)]);
    await q.whenSettled('tab');
    expect(uploaded.flat().sort()).toEqual([blob(4).id, blob(5).id].sort());
    warn.mockRestore();
  });

  it('splits batches by count and bytes', () => {
    const many = Array.from({ length: 130 }, (_, i) => blob(i));
    expect(batchesOf(many).map((b) => b.length)).toEqual([64, 64, 2]);
    const big = [blob(1, 20 * 1024 * 1024), blob(2, 20 * 1024 * 1024)];
    expect(batchesOf(big).map((b) => b.length)).toEqual([1, 1]);
    expect(batchesOf([])).toEqual([]);
  });
});
