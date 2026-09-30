import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiLoadSelf, apiSaveSelf } from './self';

// /new hands the new document to the editor in place (docs/specs/007-editor/new-document-route.md), and
// both load the participant: the editor must reuse the one /new just read and saved rather than
// asking the server again on every new document.

describe('the participant the page already knows', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
        const participant = { id: 'p-1', name: 'Swift Otter', color: '#0ea5e9' };
        return Promise.resolve(new Response(JSON.stringify({ participant }), { status: 200 }));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('answers a load straight after a save without a request', async () => {
    await apiSaveSelf({ id: 'p-save', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    const self = await apiLoadSelf('p-save');
    expect(self?.name).toBe('Brave Heron');
    expect(calls.filter((c) => c.startsWith('GET'))).toEqual([]);
  });

  it('asks the server for a participant it has not seen', async () => {
    await apiSaveSelf({ id: 'p-save-2', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    await apiLoadSelf('p-other');
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(1);
  });

  it('asks again once the handoff window has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await apiSaveSelf({ id: 'p-old', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    vi.setSystemTime(Date.now() + 31_000);
    await apiLoadSelf('p-old');
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(1);
  });
});
