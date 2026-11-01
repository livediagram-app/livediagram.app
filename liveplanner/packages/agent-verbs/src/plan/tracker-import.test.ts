import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEMS_MAX, ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { importTrackerBoard, readTrackerInput, trackerImportAnswer } from './tracker-import';

// Importing a board from another tool (docs/specs/026-plan/tracker-import.md "Agents"): read and planned as the
// editor does, written as a card type, a Board tab and the cards with their comments; or as a new plan.

const D = 'plan1';
const TAB = 'tab-new-0001';

const TRELLO = JSON.stringify({
  name: 'Website Relaunch',
  lists: [
    { id: 'l1', name: 'To Do', pos: 1 },
    { id: 'l2', name: 'Done', pos: 2 },
  ],
  members: [{ id: 'm1', fullName: 'Ana Lopez' }],
  cards: [
    { id: 'c1', name: 'Hero', idList: 'l1', idMembers: ['m1'], desc: 'Big', closed: false },
    { id: 'c2', name: 'Footer', idList: 'l2', closed: false },
    { id: 'c3', name: 'Old', idList: 'l2', closed: true },
  ],
  actions: [
    {
      type: 'commentCard',
      date: '2026-10-27T09:05:00.000Z',
      data: { text: 'Looks good', card: { id: 'c1' } },
      memberCreator: { fullName: 'Ben Okafor' },
    },
  ],
});

const JIRA = [
  'Summary,Issue key,Status,Assignee',
  'Checkout fails,SHOP-1,In Progress,Ana Lopez',
  'Apple Pay,SHOP-2,To Do,',
].join('\n');

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const item = (id: string, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});

type Sent = { path: string; method: string; body: Record<string, unknown> };

function planApi(
  over: {
    items?: Item[];
    types?: readonly ItemTypeDef[];
    statuses?: { status: string; name: string }[];
    staleTimes?: number;
    rev?: number;
  } = {},
) {
  const sent: Sent[] = [];
  let stale = over.staleTimes ?? 0;
  const keep = (answer: unknown) => async (r: Request) => {
    sent.push({
      path: new URL(r.url).pathname.replace(/^\/api/, ''),
      method: r.method,
      body: JSON.parse(await r.text()) as Record<string, unknown>,
    });
    return Response.json(answer, { status: 200 });
  };
  const api = fakeApi({
    [`/projects/${D}/items`]: { items: over.items ?? [], rev: 0 },
    [`/projects/${D}/plan`]: {
      boards: [],
      statuses: over.statuses ?? [{ status: 'todo~a', name: 'To Do' }],
      types: over.types ?? [ITEM_TYPES[0]],
      itemTypesRev: over.rev ?? 4,
    },
    [`/projects/${D}/item-types`]: async (r: Request) => {
      if (stale > 0) {
        stale -= 1;
        return Response.json({ error: 'item_types_stale' }, { status: 409 });
      }
      return keep({ itemTypes: null })(r);
    },
    [`/projects/${D}/tabs/${TAB}/changesets`]: keep({ changeset: { id: 'cs', rev: 1 } }),
    [`/projects/${D}/items/bulk`]: keep({ items: [], rev: 2 }),
    '/projects': keep({ project: { id: 'new-plan' } }),
    '/projects/new-plan/items/bulk': keep({ items: [], rev: 2 }),
  });
  return { api, sent };
}

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(TAB as ReturnType<typeof crypto.randomUUID>);
});
afterEach(() => vi.restoreAllMocks());

describe('readTrackerInput', () => {
  it('reads the file, refusing what is too big, unreadable or of another source', () => {
    expect(readTrackerInput({ content: TRELLO })).toMatchObject({
      source: 'trello',
      title: 'Website Relaunch',
    });
    expect(readTrackerInput({ content: JIRA, fileName: 'Shop.csv' })).toMatchObject({
      source: 'jira',
      title: 'Shop',
    });
    expect(readTrackerInput({ content: TRELLO, name: '  Q4  ' })).toMatchObject({ title: 'Q4' });
    expect(readTrackerInput({ content: 'x'.repeat(20 * 1024 * 1024 + 1) })).toMatchObject({
      ok: false,
      code: 'file_too_large',
    });
    expect(readTrackerInput({ content: 'a,b\n1,2' })).toEqual({
      ok: false,
      code: 'unknown_source',
      message: "This file isn't a Trello, Asana, Jira or Linear export.",
    });
    expect(readTrackerInput({ content: TRELLO, source: 'jira' })).toEqual({
      ok: false,
      code: 'source_mismatch',
      message: 'That file is a Trello export, not Jira. Leave source out to read it as it is.',
    });
  });
});

describe('importTrackerBoard into a plan', () => {
  it('previews without writing', async () => {
    const { api, sent } = planApi();
    const r = await importTrackerBoard(
      api,
      { content: TRELLO, projectId: D, preview: true },
      'mcp',
    );
    expect(sent).toEqual([]);
    expect(r).toMatchObject({
      ok: true,
      written: false,
      projectId: D,
      newPlan: false,
      tabId: null,
      summary: 'Makes a Board tab with 2 columns and 2 cards.',
    });
  });

  it('saves the card type, adds the tab, then the cards with their imported comments', async () => {
    const { api, sent } = planApi();
    const r = await importTrackerBoard(api, { content: TRELLO, projectId: D }, 'cli');
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      `PUT /projects/${D}/item-types`,
      `POST /projects/${D}/tabs/${TAB}/changesets`,
      `POST /projects/${D}/items/bulk`,
    ]);
    const types = (sent[0]!.body['itemTypes'] as { types: { id: string }[] }).types;
    expect(types.map((t) => t.id)).toEqual([ITEM_TYPES[0].id, 'trello-card']);
    expect(sent[0]!.body['expectedRev']).toBe(4);
    const replace = sent[1]!.body['replace'] as {
      kind: string;
      name: string;
      elements: { planBoard: { columns: { name: string; status: string }[] } }[];
    };
    expect(replace).toMatchObject({ kind: 'board', name: 'Website Relaunch' });
    // A column the plan names already shares its state.
    expect(replace.elements[0]!.planBoard.columns[0]).toMatchObject({
      name: 'To Do',
      status: 'todo~a',
    });
    const items = sent[2]!.body['items'] as {
      fields: { title: string };
      threads?: { title: string; comments: { text: string; authorId?: string }[] }[];
    }[];
    expect(items.map((i) => i.fields.title)).toEqual(['Hero', 'Footer']);
    expect(items[0]!.threads![0]).toMatchObject({ title: 'Imported comments' });
    expect(items[0]!.threads![0]!.comments[0]!.text).toBe('Ben Okafor · 27 Oct 2026\nLooks good');
    expect(items[0]!.threads![0]!.comments[0]!.authorId).toBeUndefined();
    expect(items[1]).not.toHaveProperty('threads');
    expect(r).toMatchObject({
      ok: true,
      written: true,
      projectId: D,
      newPlan: false,
      tabId: TAB,
      summary: 'Imported 2 cards from Trello, 1 left out',
    });
  });

  it('saves no card type when the plan already has it as the import leaves it', async () => {
    const first = planApi();
    await importTrackerBoard(first.api, { content: JIRA, projectId: D }, 'cli');
    const type = (first.sent[0]!.body['itemTypes'] as { types: ItemTypeDef[] }).types[1]!;
    const replace = first.sent[1]!.body['replace'] as {
      elements: { planBoard: { columns: { name: string; status: string }[] } }[];
    };
    const statuses = replace.elements[0]!.planBoard.columns.map((c) => ({
      status: c.status,
      name: c.name,
    }));
    const again = planApi({ types: [type], statuses });
    await importTrackerBoard(again.api, { content: JIRA, projectId: D }, 'mcp');
    expect(again.sent.map((s) => s.method)).toEqual(['POST', 'POST']);
  });

  it('merges into the plan’s own type of the source, and answers a refused save', async () => {
    const own = { ...ITEM_TYPES[0], id: 'jira-issue', label: 'Bugs', fields: ['title', 'status'] };
    const merged = planApi({ types: [ITEM_TYPES[0], own] });
    await importTrackerBoard(merged.api, { content: JIRA, projectId: D }, 'cli');
    const types = (
      merged.sent[0]!.body['itemTypes'] as {
        types: { id: string; label: string; fields: string[] }[];
      }
    ).types;
    expect(types.map((t) => t.label)).toEqual([ITEM_TYPES[0].label, 'Bugs']);
    expect(types[1]!.fields).toContain('assignee');
    const refused = fakeApi({
      [`/projects/${D}/items`]: { items: [], rev: 0 },
      [`/projects/${D}/plan`]: { boards: [], statuses: [], types: [], itemTypesRev: 1 },
      [`/projects/${D}/item-types`]: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    expect(await importTrackerBoard(refused, { content: JIRA, projectId: D }, 'mcp')).toMatchObject(
      {
        ok: false,
        code: 'forbidden',
      },
    );
  });

  it('plans again when the card types changed first, and stops after its tries', async () => {
    const once = planApi({ staleTimes: 1 });
    expect(
      await importTrackerBoard(once.api, { content: JIRA, projectId: D }, 'cli'),
    ).toMatchObject({
      ok: true,
      written: true,
    });
    const always = planApi({ staleTimes: 9 });
    expect(await importTrackerBoard(always.api, { content: JIRA, projectId: D }, 'cli')).toEqual({
      ok: false,
      code: 'item_types_stale',
      message: 'The card types kept changing. Try again.',
    });
    expect(always.sent).toEqual([]);
  });

  it('refuses a plan without room for every card, or for the card type', async () => {
    const full = planApi({
      items: Array.from({ length: ITEMS_MAX - 1 }, (_, i) => item(`i${i}`, { title: 'x' })),
    });
    expect(await importTrackerBoard(full.api, { content: JIRA, projectId: D }, 'cli')).toEqual({
      ok: false,
      code: 'items_full',
      message:
        'This plan has room for 1 more card and this file has 2. Leave projectId out to import it as a new plan.',
    });
    const types = Array.from({ length: 32 }, (_, i) => ({
      ...ITEM_TYPES[0],
      id: `t${i}`,
      label: `T${i}`,
    }));
    const crowded = planApi({ types });
    expect(
      await importTrackerBoard(crowded.api, { content: JIRA, projectId: D }, 'cli'),
    ).toMatchObject({
      ok: false,
      code: 'item_types_full',
    });
    expect([...full.sent, ...crowded.sent]).toEqual([]);
  });

  it('answers the api’s refusal, and lets anything else throw', async () => {
    const api = fakeApi({});
    expect(await importTrackerBoard(api, { content: JIRA, projectId: D }, 'cli')).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    const broken = fakeApi({
      [`/projects/${D}/items`]: () => new Response('boom', { status: 500 }),
    });
    await expect(
      importTrackerBoard(broken, { content: JIRA, projectId: D }, 'cli'),
    ).rejects.toThrow();
    expect(await importTrackerBoard(api, { content: '{', projectId: D }, 'cli')).toMatchObject({
      code: 'not_json',
    });
  });
});

describe('importTrackerBoard as a new plan', () => {
  it('previews a new plan without writing', async () => {
    const { api, sent } = planApi();
    const r = await importTrackerBoard(api, { content: TRELLO, preview: true }, 'mcp');
    expect(sent).toEqual([]);
    expect(r).toMatchObject({ written: false, projectId: null, newPlan: true });
    if (!r.ok) throw new Error('refused');
    expect(r.summary).toBe('Makes a new plan with a Board tab of 2 columns and 2 cards.');
  });

  it('makes the plan in one create carrying the tab, the card type and the cards', async () => {
    const { api, sent } = planApi();
    const r = await importTrackerBoard(api, { content: TRELLO }, 'mcp', () => 'new-plan');
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(['POST /projects']);
    const body = sent[0]!.body as {
      id: string;
      name: string;
      source: string;
      tabs: { kind: string; name: string }[];
      itemTypes: { types: { id: string }[] };
      items: { threads?: { home: string }[] }[];
    };
    expect(body).toMatchObject({ id: 'new-plan', name: 'Website Relaunch', source: 'mcp' });
    expect(body.tabs[0]).toMatchObject({ kind: 'board', name: 'Website Relaunch' });
    expect(body.itemTypes.types.map((t) => t.id)).toEqual(['trello-card']);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]!.threads![0]!.home).toBe('new-plan');
    expect(r).toMatchObject({ written: true, projectId: 'new-plan', newPlan: true, tabId: TAB });
  });

  it('sends the cards past the create’s room after it', async () => {
    const big = JSON.stringify({
      name: 'Big',
      lists: [{ id: 'l', name: 'To Do' }],
      cards: Array.from({ length: 450 }, (_, i) => ({
        id: `c${i}`,
        name: `Card ${i}`,
        idList: 'l',
      })),
    });
    const { api, sent } = planApi();
    await importTrackerBoard(api, { content: big }, 'cli', () => 'new-plan');
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      'POST /projects',
      'POST /projects/new-plan/items/bulk',
      'POST /projects/new-plan/items/bulk',
    ]);
    expect((sent[0]!.body['items'] as unknown[]).length).toBe(200);
  });

  it('makes a create with no cards when its own room is spent, and mints its own id', async () => {
    const title = 'T'.repeat(80);
    const huge = JSON.stringify({
      name: title,
      lists: [{ id: 'l', name: 'To Do' }],
      cards: Array.from({ length: 1 }, () => ({
        id: 'c',
        name: 'One',
        idList: 'l',
        desc: 'd'.repeat(9000),
      })),
    });
    const { api, sent } = planApi();
    const r = await importTrackerBoard(api, { content: huge }, 'cli');
    expect(r).toMatchObject({ ok: true, projectId: TAB });
    expect(sent[0]!.path).toBe('/projects');
  });
});

describe('trackerImportAnswer', () => {
  it('answers the preview’s counts, with the reason when it would not fit', async () => {
    const full = planApi({
      items: Array.from({ length: ITEMS_MAX - 1 }, (_, i) => item(`i${i}`, { title: 'x' })),
    });
    const r = await importTrackerBoard(
      full.api,
      { content: JIRA, projectId: D, preview: true },
      'mcp',
    );
    if (!r.ok) throw new Error('refused');
    const answer = trackerImportAnswer(r, 'https://liveplanner.app/project/plan1');
    expect(answer).toMatchObject({
      written: false,
      title: 'Imported Board',
      source: 'Jira',
      cards: 2,
      comments: 0,
      people: { onPlan: 0, named: 1 },
      fits: false,
      reason: 'This plan has room for 1 more card and this file has 2.',
      summary: 'This plan has room for 1 more card and this file has 2.',
      url: 'https://liveplanner.app/project/plan1',
    });
    expect(answer.columns).toEqual([
      { name: 'In Progress', cards: 1 },
      { name: 'To Do', cards: 1 },
    ]);
    const fits = await importTrackerBoard(planApi().api, { content: TRELLO, preview: true }, 'mcp');
    if (!fits.ok) throw new Error('refused');
    const a = trackerImportAnswer(fits, null);
    expect(a).not.toHaveProperty('reason');
    expect(a.leftOut).toEqual([{ reason: 'Archived cards', count: 1 }]);
  });
});
