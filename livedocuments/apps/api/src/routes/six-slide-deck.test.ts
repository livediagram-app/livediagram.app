import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PagesAnswer } from '@livedocuments/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A deck written in two calls (Work Tracker 1324; docs/specs/024-agents/pages-for-agents.md "Text slots"): create
// the document from the blank deck, then one change_pages call lays out six slides with their words. Before, the
// same deck took four calls: create, lay out, read the refs, write some 40 texts by ref.

const as = {
  owner: 'user_o',
  accountUserId: null,
  verifiedUserId: 'user_o',
  token: { id: 'tok_1' },
};

function room() {
  return {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string) =>
        String(url).includes('/holds?')
          ? Response.json({ holds: [] })
          : new Response(null, { status: 204 }),
    }),
  };
}

const DECK = [
  {
    layout: 'slide-title',
    text: { title: 'Acme in 2027', subtitle: 'Where we go next', body: ['Ada Lovelace, CEO'] },
  },
  {
    layout: 'slide-bullets',
    text: { title: 'Why now', bullets: ['Costs fell 40%', 'Demand doubled', 'Rivals left'] },
  },
  { layout: 'slide-two-columns', text: { title: 'Before and after' } },
  {
    layout: 'big-number',
    text: { title: 'Three markets', body: ['opened this year', 'and two more by spring'] },
  },
  {
    layout: 'slide-statement',
    text: { title: 'Small teams win', subtitle: 'Each owns one customer' },
  },
  { layout: 'slide-thanks-image', text: { title: 'Thank you', subtitle: 'ada@acme.example' } },
];

afterEach(() => vi.restoreAllMocks());

describe('a six-slide deck with real text', () => {
  it('is made in two calls, each slide answering its texts', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1({ DOCUMENT_ROOM: room() } as unknown as Partial<Env>);
    let calls = 0;
    const post = (path: string, body: unknown) => {
      calls += 1;
      return handleDocuments(makeTestRouteContext('POST', path, { env: db.env, ...as, body }));
    };

    // Call 1: create_document with the blank deck (one empty slide).
    const created = await post('/api/documents', {
      id: 'D',
      name: 'Acme plan',
      tabs: [{ id: 't1', name: 'Deck', template: 'blank-slide-deck' }],
    });
    expect(created.status).toBe(201);

    // Call 2: change_pages, the six slides laid out and written; the first takes the blank slide.
    const res = await post('/api/documents/D/tabs/t1/pages', {
      pages: DECK.map((slide) => ({ op: 'add', kind: 'slide', ...slide })),
    });
    expect(res.status).toBe(200);
    const answer = await res.json<PagesAnswer>();
    expect(calls).toBeLessThanOrEqual(3);
    expect(answer.pages).toHaveLength(6);
    for (const [i, page] of answer.pages.entries()) {
      const title = page.texts!.find((t) => t.slot === 'title');
      expect(title?.text, `slide ${i + 1}`).toBe(DECK[i]!.text.title);
    }
    const second = answer.pages[1]!.texts!.filter((t) => t.slot?.startsWith('bullets'));
    expect(second.map((t) => t.text)).toEqual(['Costs fell 40%', 'Demand doubled', 'Rivals left']);
    // Whatever keeps its sample comes back with its ref, so a third call could change it by ref.
    expect(answer.pages[2]!.texts!.every((t) => t.ref.length >= 4)).toBe(true);
    // And says which still hold the layout's sample: here everything but the title given.
    const third = answer.pages[2]!.texts!;
    expect(third.find((t) => t.slot === 'title')!.sample).toBeUndefined();
    expect(third.filter((t) => t.slot !== 'title').every((t) => t.sample === true)).toBe(true);
  });
});
