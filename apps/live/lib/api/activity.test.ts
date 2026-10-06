// @vitest-environment jsdom

// The Activity read (docs/specs/013-workspace/activity-page.md §3): a failed read is null, never an empty
// inbox, and a body missing a kind (an older api before Plan cards, §2.4) reads as none of that kind.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiListActivity } from './activity';

afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = (res: Response | Error) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (res instanceof Error) throw res;
      return res;
    }),
  );

describe('apiListActivity', () => {
  it('returns every kind the api sends', async () => {
    const card = { id: 'it1' };
    answer(Response.json({ actions: [], threads: [], cards: [card] }));
    expect(await apiListActivity('me')).toEqual({ actions: [], threads: [], cards: [card] });
  });

  it('reads a missing kind as none', async () => {
    answer(Response.json({ actions: [] }));
    expect(await apiListActivity('me')).toEqual({ actions: [], threads: [], cards: [] });
  });

  it('is null when the read fails or the network does', async () => {
    answer(new Response('nope', { status: 500 }));
    expect(await apiListActivity('me')).toBeNull();
    answer(new Error('offline'));
    expect(await apiListActivity('me')).toBeNull();
  });
});
