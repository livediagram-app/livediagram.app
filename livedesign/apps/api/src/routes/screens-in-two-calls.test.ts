import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PagesAnswer } from '@livedesign/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// Screens written in two calls (Work Tracker 1324; docs/specs/024-agents/pages-for-agents.md "Text slots"): create
// the design, then one change_pages call lays out the screens and a logo with their words, each answering its texts.

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

afterEach(() => vi.restoreAllMocks());

describe('wireframe screens and a logo with real text', () => {
  it('are made in two calls, each page answering its texts', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1({ DESIGN_ROOM: room() } as unknown as Partial<Env>);
    const post = (path: string, body: unknown) =>
      handleDesigns(makeTestRouteContext('POST', path, { env: db.env, ...as, body }));

    expect(
      (
        await post('/api/designs', {
          id: 'D',
          name: 'Acme app',
          tabs: [
            { id: 't1', name: 'Screens', elements: [] },
            { id: 't2', name: 'Logo', elements: [] },
          ],
        })
      ).status,
    ).toBe(201);

    const screens = await post('/api/designs/D/tabs/t1/pages', {
      pages: [
        {
          op: 'add',
          kind: 'wireframe',
          device: 'iphone',
          layout: 'wf-sign-in',
          text: { title: 'Welcome back', subtitle: 'Sign in to Acme' },
        },
        {
          op: 'add',
          kind: 'wireframe',
          device: 'iphone',
          layout: 'wf-settings',
          text: { title: 'Settings' },
        },
      ],
    });
    expect(screens.status).toBe(200);
    const answer = await screens.json<PagesAnswer>();
    expect(answer.pages.map((p) => p.texts!.find((t) => t.slot === 'title')?.text)).toEqual([
      'Welcome back',
      'Settings',
    ]);

    const logo = await post('/api/designs/D/tabs/t2/pages', {
      pages: [
        {
          op: 'add',
          kind: 'logo',
          layout: 'logo-stacked',
          text: { title: 'Acme', subtitle: 'Since 1999' },
        },
      ],
    });
    const logoAnswer = await logo.json<PagesAnswer>();
    expect(logoAnswer.pages[0]!.texts!.map((t) => [t.slot, t.text])).toEqual([
      ['title', 'Acme'],
      ['subtitle', 'Since 1999'],
    ]);
  });
});
