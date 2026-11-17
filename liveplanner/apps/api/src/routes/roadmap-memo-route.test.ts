import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicRoadmap } from '@liveplanner/api-schema';
import { defaultCatalogue } from '@liveplanner/items';
import { listItems } from '../db';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { roadmapWorld, type RoadmapWorld } from './roadmap-test-world';

// The room keeps a roadmap's built page for the reads after it (docs/specs/026-plan/public-roadmap.md "How it
// answers"; roadmap/roadmap-memo.ts): a second read skips the build, and every write to the plan clears it, so the
// page never shows a card, a vote, a setting or a roadmap that changed or went.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);
// The build reads every card once (listItems): counting its calls counts the builds.
vi.mock('../db', async (actual) => {
  const real = await actual<typeof import('../db')>();
  return { ...real, listItems: vi.fn(real.listItems) };
});
const builds = vi.mocked(listItems);

let w: RoadmapWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await roadmapWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  builds.mockClear();
  endRepeatWorld();
});

const BROWSER = 'browser-1234-abcd';

async function readOk(code: string, query = ''): Promise<PublicRoadmap> {
  const res = await w.read(code, query);
  expect(res.status).toBe(200);
  return res.json<PublicRoadmap>();
}
const titles = (page: PublicRoadmap) => page.columns.flatMap((c) => c.cards.map((x) => x.title));

// Reads once to build and once more from the memo, so the next read shows whether a write cleared it.
async function warm(code: string): Promise<PublicRoadmap> {
  await readOk(code);
  builds.mockClear();
  const kept = await readOk(code);
  expect(builds).not.toHaveBeenCalled();
  return kept;
}

describe('the kept page', () => {
  it('a second read skips the build and answers the same page', async () => {
    await w.make('A', { title: 'Dark mode', description: 'Soon' }, 'todo');
    const r = await w.publish();
    builds.mockClear();
    const first = await readOk(r.code);
    expect(builds).toHaveBeenCalledTimes(1);
    const second = await readOk(r.code);
    expect(builds).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("marks each browser's own votes on a kept page", async () => {
    const card = await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    await warm(r.code);
    expect((await readOk(r.code, `?browser=${BROWSER}`)).columns[0]!.cards[0]).toMatchObject({
      votes: 1,
      voted: true,
    });
    expect((await readOk(r.code, '?browser=someone-else-123')).columns[0]!.cards[0]).toMatchObject({
      votes: 1,
      voted: false,
    });
    expect(builds).not.toHaveBeenCalled();
  });

  it('a new card clears it', async () => {
    const r = await w.publish();
    expect(titles(await warm(r.code))).toEqual([]);
    await w.make('A', { title: 'Fresh idea' }, 'todo');
    builds.mockClear();
    expect(titles(await readOk(r.code))).toEqual(['Fresh idea']);
    expect(builds).toHaveBeenCalledTimes(1);
  });

  it('a card changed by any path clears it', async () => {
    const card = await w.make('A', { title: 'Before' }, 'todo');
    const r = await w.publish();
    expect(titles(await warm(r.code))).toEqual(['Before']);
    // Made a type the roadmap does not show, straight in the plan's tables, past every route.
    await w
      .planEnv()
      .PLAN_DB.prepare('UPDATE items SET type = ? WHERE id = ?')
      .bind('note', card.id)
      .run();
    expect(titles(await readOk(r.code))).toEqual([]);
  });

  it('a vote clears it', async () => {
    const card = await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    expect((await warm(r.code)).columns[0]!.cards[0]!.votes).toBe(0);
    expect((await w.vote(r.code, { card: card.id, browser: BROWSER, up: true })).status).toBe(200);
    expect((await readOk(r.code)).columns[0]!.cards[0]!.votes).toBe(1);
  });

  it("a change to the roadmap's settings clears it", async () => {
    await w.make('A', { title: 'Dark mode', description: 'Soon' }, 'todo');
    const r = await w.publish();
    await warm(r.code);
    const changed = await w.publish({ title: 'Renamed', fields: [], voting: false });
    expect(changed.code).toBe(r.code);
    const page = await readOk(r.code);
    expect(page.title).toBe('Renamed');
    expect(page.voting).toBe(false);
    expect(page.columns[0]!.cards[0]).toEqual({ id: expect.any(String), title: 'Dark mode' });
  });

  it("a change to the plan's card types clears it", async () => {
    await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    expect(titles(await warm(r.code))).toEqual(['Dark mode']);
    // Task taken off the plan: its cards no longer match a type the board shows.
    const catalogue = defaultCatalogue();
    await setPlanItemTypes(w.planEnv(), 'A', {
      ...catalogue,
      types: catalogue.types.filter((t) => t.id !== 'task'),
    });
    expect(titles(await readOk(r.code))).toEqual([]);
  });

  it('Unpublish ends it at once, and a new link never answers the old page', async () => {
    await w.make('A', { title: 'Dark mode' }, 'todo');
    const r = await w.publish();
    await warm(r.code);
    expect((await w.as('owner', 'DELETE', '/roadmaps/b1')).status).toBe(204);
    expect((await w.read(r.code)).status).toBe(404);
    const again = await w.publish({ title: 'Again' });
    expect((await readOk(again.code)).title).toBe('Again');
    expect((await w.read(r.code)).status).toBe(404);
  });

  it('a board gone is never answered from the memo', async () => {
    const r = await w.publish();
    await warm(r.code);
    expect((await w.send('DELETE', '/api/projects/A/tabs/t1')).status).toBeLessThan(300);
    expect((await w.read(r.code)).status).toBe(404);
  });
});
