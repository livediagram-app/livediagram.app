import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeLogEntry } from '@livediagram/api-schema';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { apiAppendChangeLogEntry } from './change-log';
import { setApiErrorReporter } from './error-report';

// Production's recurring `Error·Api·Http500.AppendChangeLog` (paired with the
// worker's own `Internal`): the editor logs an edit the moment it happens,
// but a brand-new tab only reaches D1 on the debounced autosave, so the first
// edit on it named a tab row that didn't exist yet. The server now answers a
// 409 tab_not_saved there, and the append waits for the save and retries,
// without reporting an error for a race that resolves itself.

const entry = {
  id: 'l1',
  tabId: 't-new',
  participantId: 'p1',
  participantName: 'Ann',
  participantColor: '#000000',
  kind: 'edit',
  summary: 'Added 1 element',
  elementIds: ['e1'],
  beforeState: {},
  afterState: {},
  createdAt: 1,
} as ChangeLogEntry;

const notSaved = () => new Response(JSON.stringify({ error: 'tab_not_saved' }), { status: 409 });
const stored = () => new Response(JSON.stringify({ entry }), { status: 201 });

describe('apiAppendChangeLogEntry on a tab the autosave has not written yet', () => {
  let reported: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    __setOfflineBackend(memBackend());
    reported = [];
    setApiErrorReporter((type) => reported.push(type));
  });
  afterEach(() => {
    vi.useRealTimers();
    __setOfflineBackend(null);
    setApiErrorReporter(null);
    vi.unstubAllGlobals();
  });

  it('retries once the tab lands, and reports nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(notSaved()).mockResolvedValueOnce(stored());
    vi.stubGlobal('fetch', fetchMock);
    const done = apiAppendChangeLogEntry('owner-1', 'd1', entry);
    await vi.runAllTimersAsync();
    await expect(done).resolves.toEqual(entry);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reported).toEqual([]);
  });

  it('gives up and reports once when the tab never arrives', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(notSaved()));
    vi.stubGlobal('fetch', fetchMock);
    const done = apiAppendChangeLogEntry('owner-1', 'd1', entry);
    const settled = expect(done).rejects.toMatchObject({ status: 409 });
    await vi.runAllTimersAsync();
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(reported).toEqual(['Http409.AppendChangeLog.TabNotSaved']);
  });

  it('does not retry any other failure', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiAppendChangeLogEntry('owner-1', 'd1', entry)).rejects.toMatchObject({
      status: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
