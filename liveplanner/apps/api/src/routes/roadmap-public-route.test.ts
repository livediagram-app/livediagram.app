import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicRoadmap, RoadmapVoteResponse } from '@liveplanner/api-schema';
import { ITEM_VOTERS_MAX, presetSetup } from '@liveplanner/items';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { planRoom } from '../plan-client';
import { publicVoterId } from '../roadmap/roadmap-code';
import { ROADMAP_VOTES_PER_HOUR } from '../roadmap/roadmap-public';
import { roadmapWorld, suggestionForm, type RoadmapWorld } from './roadmap-test-world';

// A public roadmap's doors (docs/specs/026-plan/public-roadmap.md "How it answers", "Upvotes"): the read through the
// real worker as no one, Unpublish revoking the link at once, every miss the same 404, and the vote with its limits.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: RoadmapWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await roadmapWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const BROWSER = 'browser-1234-abcd';

async function readOk(code: string, query = ''): Promise<PublicRoadmap> {
  const res = await w.read(code, query);
  expect(res.status).toBe(200);
  return res.json<PublicRoadmap>();
}

const expectMissing = async (res: Response) => {
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'roadmap_not_found' });
};

describe('the read', () => {
  it('answers the shown columns and allowlisted fields, never cached or indexed', async () => {
    const shown = await w.make('A', { title: 'Dark mode', description: 'Soon' }, 'todo');
    await w.make('A', { title: 'Secret triage', description: 'hidden' }, 'backlog');
    const r = await w.publish({ formCode: w.formCode });
    const res = await w.read(r.code);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const body = await res.json<PublicRoadmap>();
    expect(body).toMatchObject({
      title: 'Acme Roadmap',
      voting: true,
      suggestPath: `/form/${w.formCode}`,
    });
    expect(body.columns.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done']);
    expect(body.columns[0]!.cards).toEqual([
      { id: shown.id, title: 'Dark mode', votes: 0, voted: false, description: 'Soon' },
    ]);
    expect(JSON.stringify(body)).not.toContain('Secret triage');
    expect(JSON.stringify(body)).not.toContain('Backlog');
  });

  it("marks this browser's own votes only", async () => {
    const card = await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    const mine = await readOk(r.code, `?browser=${BROWSER}`);
    expect(mine.columns[0]!.cards[0]).toMatchObject({ votes: 1, voted: true });
    const theirs = await readOk(r.code, '?browser=someone-else-123');
    expect(theirs.columns[0]!.cards[0]).toMatchObject({ votes: 1, voted: false });
    const none = await readOk(r.code, '?browser=bad');
    expect(none.columns[0]!.cards[0]).toMatchObject({ voted: false });
  });

  it('leaves out the suggestion form once its cards would land in a shown column, or its link is gone', async () => {
    const r = await w.publish({ formCode: w.formCode });
    await w.setForm(suggestionForm('todo'));
    expect((await readOk(r.code)).suggestPath).toBeNull();
    await w.setForm(suggestionForm('backlog'));
    expect((await readOk(r.code)).suggestPath).toBe(`/form/${w.formCode}`);
    await w
      .planEnv()
      .PLAN_DB.prepare('UPDATE form_links SET deleted_at = 1 WHERE code = ?')
      .bind(w.formCode)
      .run();
    expect((await readOk(r.code)).suggestPath).toBeNull();
  });
});

describe('Unpublish', () => {
  it('revokes the link at once, and publishing again makes a new one', async () => {
    const r = await w.publish();
    await readOk(r.code);
    expect((await w.as('owner', 'DELETE', '/roadmaps/b1')).status).toBe(204);
    await expectMissing(await w.read(r.code));
    const card = await w.make('A', { title: 'x' }, 'todo');
    await expectMissing(await w.vote(r.code, { card: card.id, browser: BROWSER, up: true }));
    const again = await w.publish();
    expect(again.code).not.toBe(r.code);
    await expectMissing(await w.read(r.code));
    await readOk(again.code);
  });
});

describe('every miss is the same 404', () => {
  it.each([
    ['an unknown code', '/api/roadmaps/A/lpr_aaaaaaaaaaaaaaaaaaaaaa'],
    ['a malformed code', '/api/roadmaps/A/nope'],
    ['a plan never stored', '/api/roadmaps/NEVER/lpr_aaaaaaaaaaaaaaaaaaaaaa'],
  ])('%s', async (_, path) => {
    await expectMissing(await w.raw(new Request(`https://api.test${path}`)));
  });

  // A path no roadmap could have is turned away at the worker, before any room wakes, as every unknown path is.
  it.each([
    ['no code', '/api/roadmaps/A'],
    ['a malformed plan id', '/api/roadmaps/bad%20id/lpr_aaaaaaaaaaaaaaaaaaaaaa'],
    ['an extra part', '/api/roadmaps/A/lpr_aaaaaaaaaaaaaaaaaaaaaa/votes/more'],
    ['another door', '/api/roadmaps/A/lpr_aaaaaaaaaaaaaaaaaaaaaa/comments'],
  ])('%s', async (_, path) => {
    const res = await w.raw(new Request(`https://api.test${path}`));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('a plan in the Trash, until it is restored', async () => {
    const r = await w.publish();
    await planRoom(w.env, 'A').takeStanding({ archived: false, trashed: true, at: Date.now() });
    await expectMissing(await w.read(r.code));
    await planRoom(w.env, 'A').takeStanding({
      archived: false,
      trashed: false,
      at: Date.now() + 1,
    });
    await readOk(r.code);
  });

  it('a board deleted or turned into an All Cards board', async () => {
    const r = await w.publish();
    const board = (planBoard: unknown) => ({
      id: 't1',
      name: 'Board',
      kind: 'board',
      elements: [
        {
          id: 'b1',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          planBoard,
        },
      ],
    });
    await w.send('PUT', '/api/projects/A/tabs/t1', board(presetSetup('all-cards')));
    await expectMissing(await w.read(r.code));
    await w.send('PUT', '/api/projects/A/tabs/t1', board(presetSetup('kanban')));
    await readOk(r.code);
    expect((await w.send('DELETE', '/api/projects/A/tabs/t1')).status).toBeLessThan(300);
    await expectMissing(await w.read(r.code));
  });

  it('answers 405 for a write to the read, or a read of the vote', async () => {
    const r = await w.publish();
    const post = await w.raw(
      new Request(`https://api.test/api/roadmaps/A/${r.code}`, { method: 'POST', body: '{}' }),
    );
    expect(post.status).toBe(405);
    expect((await w.read(r.code, '/votes')).status).toBe(405);
  });
});

describe('the vote', () => {
  it('gives one vote per browser, takes it back, and lands in the card votes for the board', async () => {
    const card = await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    const up = await w.vote(r.code, { card: card.id, browser: BROWSER, up: true });
    expect(up.status).toBe(200);
    expect(up.headers.get('Cache-Control')).toBe('no-store');
    expect(await up.json<RoadmapVoteResponse>()).toEqual({ votes: 1, voted: true });
    // Pressed twice: still one vote.
    const twice = await w.vote(r.code, { card: card.id, browser: BROWSER, up: true });
    expect(await twice.json<RoadmapVoteResponse>()).toEqual({ votes: 1, voted: true });
    const other = await w.vote(r.code, { card: card.id, browser: 'another-browser', up: true });
    expect(await other.json<RoadmapVoteResponse>()).toEqual({ votes: 2, voted: true });
    const stored = (await w.items('A')).find((i) => i.id === card.id)!;
    expect(stored.fields['votes']).toEqual({
      [await publicVoterId('A', BROWSER)]: 1,
      [await publicVoterId('A', 'another-browser')]: 1,
    });
    // The voter id is salted by the plan: the same browser votes as someone else on another plan.
    expect(await publicVoterId('B', BROWSER)).not.toBe(await publicVoterId('A', BROWSER));
    const down = await w.vote(r.code, { card: card.id, browser: BROWSER, up: false });
    expect(await down.json<RoadmapVoteResponse>()).toEqual({ votes: 1, voted: false });
  });

  it.each([
    ['a hidden column', 'backlog', {}],
    ['an unchosen type', 'todo', { type: 'action' }],
  ])('treats a card in %s as not there', async (_, status, extra) => {
    const res = await w.send('POST', '/api/projects/A/items', {
      type: 'task',
      ...extra,
      fields: { title: 'Hidden' },
      place: { status },
    });
    const card = (await res.json<{ item: { id: string } }>()).item;
    const r = await w.publish();
    const vote = await w.vote(r.code, { card: card.id, browser: BROWSER, up: true });
    expect(vote.status).toBe(404);
    expect(await vote.json()).toEqual({ error: 'card_not_found' });
    const unknown = await w.vote(r.code, { card: 'nope', browser: BROWSER, up: true });
    expect(unknown.status).toBe(404);
  });

  it.each([
    ['no card', { browser: BROWSER, up: true }],
    ['a bad browser key', { card: 'c', browser: 'x', up: true }],
    ['no direction', { card: 'c', browser: BROWSER }],
    ['a long card id', { card: 'c'.repeat(201), browser: BROWSER, up: true }],
  ])('refuses %s', async (_, body) => {
    const r = await w.publish();
    const res = await w.vote(r.code, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'roadmap_vote_invalid' });
  });

  it('refuses a body that is not JSON', async () => {
    const r = await w.publish();
    const res = await w.raw(
      new Request(`https://api.test/api/roadmaps/A/${r.code}/votes`, {
        method: 'POST',
        body: 'nope',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('answers 404 with voting off', async () => {
    const card = await w.make('A', { title: 'x' }, 'todo');
    const r = await w.publish({ voting: false });
    expect((await readOk(r.code)).columns[0]!.cards[0]).not.toHaveProperty('votes');
    await expectMissing(await w.vote(r.code, { card: card.id, browser: BROWSER, up: true }));
  });

  it('drops a vote that fills the hidden field, answering as a success', async () => {
    const card = await w.make('A', { title: 'x' }, 'todo');
    const r = await w.publish();
    const res = await w.vote(r.code, {
      card: card.id,
      browser: BROWSER,
      up: true,
      website: 'spam',
    });
    expect(res.status).toBe(201);
    expect((await w.items('A')).find((i) => i.id === card.id)!.fields['votes']).toBeUndefined();
  });

  it('refuses a new voter on a full card', async () => {
    const votes: Record<string, number> = {};
    for (let i = 0; i < ITEM_VOTERS_MAX; i++) votes[`rv:${i}`] = 1;
    const card = await w.make('A', { title: 'Popular' }, 'todo');
    await w
      .planEnv()
      .PLAN_DB.prepare('UPDATE items SET fields = json_set(fields, ?, json(?)) WHERE id = ?')
      .bind('$.votes', JSON.stringify(votes), card.id)
      .run();
    const r = await w.publish();
    const res = await w.vote(r.code, { card: card.id, browser: BROWSER, up: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'roadmap_votes_full' });
  });

  it('takes at most ROADMAP_VOTES_PER_HOUR votes an hour, counting only changes', async () => {
    const card = await w.make('A', { title: 'x' }, 'todo');
    const r = await w.publish();
    await w
      .planEnv()
      .PLAN_DB.prepare('UPDATE roadmaps SET hour_start = ?, hour_count = ? WHERE code = ?')
      .bind(Date.now(), ROADMAP_VOTES_PER_HOUR - 1, r.code)
      .run();
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    const busy = await w.vote(r.code, { card: card.id, browser: 'another-one', up: true });
    expect(busy.status).toBe(429);
    expect(await busy.json()).toEqual({ error: 'roadmap_busy' });
  });

  it('starts a fresh hour once the last one is over, and gives back a vote that changed nothing', async () => {
    const card = await w.make('A', { title: 'x' }, 'todo');
    const r = await w.publish();
    const db = w.planEnv().PLAN_DB;
    await db
      .prepare('UPDATE roadmaps SET hour_start = ?, hour_count = ? WHERE code = ?')
      .bind(Date.now() - 2 * 60 * 60 * 1000, ROADMAP_VOTES_PER_HOUR, r.code)
      .run();
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    const row = await db
      .prepare('SELECT hour_count AS n FROM roadmaps WHERE code = ?')
      .bind(r.code)
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
  });
});

describe('the worker limits a roadmap per network, as forms', () => {
  it('keys reads and votes apart, and never on the per-owner write limit', async () => {
    const card = await w.make('A', { title: 'x' }, 'todo');
    const r = await w.publish();
    const keys: string[] = [];
    const write: string[] = [];
    Reflect.set(w.env, 'FORM_RATE_LIMITER', {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: !key.startsWith('roadmap:') };
      },
    });
    Reflect.set(w.env, 'WRITE_RATE_LIMITER', {
      limit: async ({ key }: { key: string }) => {
        write.push(key);
        return { success: true };
      },
    });
    expect((await w.read(r.code)).status).toBe(200);
    const limited = await w.vote(r.code, { card: card.id, browser: BROWSER, up: true });
    expect(limited.status).toBe(429);
    expect(keys.map((k) => k.split(':')[0])).toEqual(['roadmap-read', 'roadmap']);
    expect(write).toEqual([]);
    // The page waits out the limiter's window before reading again (public-roadmap.md "States").
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(await limited.json()).toEqual({ error: 'rate_limited' });
  });

  it('names the window on a limited read, and a form keeps its bare answer', async () => {
    const r = await w.publish();
    Reflect.set(w.env, 'FORM_RATE_LIMITER', { limit: async () => ({ success: false }) });
    const read = await w.read(r.code);
    expect(read.status).toBe(429);
    expect(read.headers.get('Retry-After')).toBe('60');
    const form = await w.raw(new Request(`https://api.test/api/forms/${w.formCode}`));
    expect(form.status).toBe(429);
    expect(form.headers.get('Retry-After')).toBeNull();
  });
});
