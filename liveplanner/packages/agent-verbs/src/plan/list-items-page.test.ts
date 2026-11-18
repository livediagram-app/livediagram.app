// list_items a page at a time (docs/specs/026-plan/plan-agents.md "What list_items leaves out unless asked",
// "Filters", "Paging"; Work Tracker 900).
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  cardRefOrKey,
  ITEMS_MAX,
  ITEM_TYPES,
  TRASH_STATUS,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import {
  LIST_ITEMS_BUDGET,
  LIST_ITEMS_LIMIT_MAX,
  listItemsPage,
  omittedNote,
  resolveListItemsPage,
  type ListItemsAnswer,
  type ListItemsPageArgs,
} from './list-items-page';
import { planListing, resolveListingFilter } from './plan-listing';
import type { PlanState } from './plan-state';

const URL = 'https://liveplanner.app/p/plan';
const person = { id: 'p', name: 'P', color: '#000000' };
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);

// The Work Tracker's shape: a Work Item type with Type, Priority, App and two Long Text fields; Backlog, In Flight and
// Results boards, Done and Cancelled counting as done.
const TASK = ITEM_TYPES.find((t) => t.id === 'task');
const WORK: ItemTypeDef = {
  ...TASK,
  id: 'work',
  label: 'Work Item',
  custom: [
    { id: 'f-type', label: 'Type', kind: 'choice', options: ['Bug', 'Feature', 'Chore'] },
    { id: 'f-severity', label: 'Priority', kind: 'choice', options: ['Low', 'Medium', 'High'] },
    { id: 'f-apps', label: 'App', kind: 'choice', options: ['liveplanner', 'livediagram'] },
    { id: 'f-criteria', label: 'Acceptance Criteria', kind: 'longtext' },
    { id: 'f-risks', label: 'Risks', kind: 'longtext' },
  ],
} as ItemTypeDef;
const column = (status: string, name: string, done = false) => ({
  status,
  name,
  ...(done ? { done: true as const } : {}),
});
const board = (tabId: string, title: string, columns: ReturnType<typeof column>[]) => ({
  tabId,
  tabName: title,
  elementId: `b-${tabId}`,
  title,
  kind: 'board' as const,
  types: ['work', 'idea'],
  columns,
});
const BOARDS = [
  board('t1', 'Backlog', [
    column('review', 'Under Review'),
    column('reviewed', 'Reviewed'),
    column('selected', 'Selected for Development'),
  ]),
  board('t2', 'In Flight', [
    column('selected', 'Selected for Development'),
    column('progress', 'In Progress'),
    column('failed', 'Development Failure'),
  ]),
  board('t3', 'Results', [
    column('implemented', 'Implemented'),
    column('done', 'Done', true),
    column('cancelled', 'Cancelled', true),
  ]),
];
const STATUSES = [
  { status: 'review', name: 'Under Review' },
  { status: 'reviewed', name: 'Reviewed' },
  { status: 'selected', name: 'Selected for Development' },
  { status: 'progress', name: 'In Progress' },
  { status: 'failed', name: 'Development Failure' },
  { status: 'implemented', name: 'Implemented' },
  { status: 'done', name: 'Done' },
  { status: 'cancelled', name: 'Cancelled' },
];
const OPEN = ['review', 'reviewed', 'selected', 'progress', 'failed', 'implemented'];

const WORDS =
  'the board answers every card in every column with each description twice so a chat assistant ' +
  'gets an error and a coding agent saves it to a file and filters it with jq before it can plan';
// Text of about `n` characters, the same each run.
const prose = (n: number, seed: number) => {
  let out = '';
  while (out.length < n) out += `${WORDS.slice(seed % 40)} `;
  return out.slice(0, n);
};
// A description's formatting: a heading run, then the text in a few runs, as the editor stores them.
const runs = (text: string) => [
  { text: 'Problem\n', bold: true, heading: 2 },
  { text: text.slice(0, 200), italic: true },
  { text: text.slice(200) },
];

// A card; a field given as undefined is left off it.
function card(key: number, status: string, over: Record<string, unknown> = {}): Item {
  const description = prose(150 + ((key * 37) % 300), key);
  const criteria = prose(60 + ((key * 13) % 120), key + 1);
  const fields = {
    title: `Work item ${key}: ${prose(40, key)}`,
    status,
    description,
    descriptionRich: runs(description),
    'f-type': ['Bug', 'Feature', 'Chore'][key % 3]!,
    'f-severity': ['Low', 'Medium', 'High'][key % 3]!,
    'f-apps': 'liveplanner',
    'f-criteria': criteria,
    'f-criteriaRich': runs(criteria),
    'f-risks': prose(80, key + 2),
    ...over,
  };
  return {
    id: `id${key}`,
    type: key % 9 === 0 ? 'idea' : 'work',
    key,
    rank: `a${String(key).padStart(5, '0')}`,
    fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
    rev: 1,
    createdAt: T0,
    updatedAt: T0 + key * DAY,
    createdBy: person,
    updatedBy: person,
  } as Item;
}

const IDEA = { ...TASK, id: 'idea', label: 'Idea' } as ItemTypeDef;
const planOf = (items: Item[]): PlanState => ({
  items,
  plan: { boards: BOARDS, statuses: STATUSES, types: [WORK, IDEA] } as unknown as PlanState['plan'],
});

// A plan shaped like the Work Tracker on 2026-11-14: 833 cards, 760 of them Done or Cancelled, 73 open.
function workTracker(cards = 833, closed = 760): PlanState {
  const items: Item[] = [];
  for (let key = 1; key <= cards; key++) {
    const status =
      key <= closed ? (key % 12 === 0 ? 'cancelled' : 'done') : OPEN[key % OPEN.length]!;
    items.push(card(key, status));
  }
  return planOf(items);
}

const textOf = (answer: unknown) => JSON.stringify(answer, null, 2);

function page(
  state: PlanState,
  args: ListItemsPageArgs & { type?: string[]; status?: string[] } = {},
) {
  const filter = resolveListingFilter(state, args);
  if (!filter.ok) throw new Error(filter.message);
  const read = resolveListItemsPage(args);
  if (!read.ok) throw new Error(read.message);
  return listItemsPage(state, filter, read, { url: URL });
}

// Every page from the first, following nextCursor.
function allPages(state: PlanState, args: ListItemsPageArgs = {}): ListItemsAnswer[] {
  const pages = [page(state, args)];
  while (pages.at(-1)!.nextCursor)
    pages.push(page(state, { ...args, cursor: pages.at(-1)!.nextCursor }));
  return pages;
}

describe('list_items on a plan shaped like the Work Tracker', () => {
  const state = workTracker();

  it('answers under the budget by default, where the whole plan was far past it', () => {
    const before = textOf({ ...planListing(state), url: URL }).length;
    const answer = page(state);
    const after = textOf(answer).length;
    // Measured 2026-11-14 (the PR’s Performance section): 1,651,198 characters before, 81,428 after.
    expect(before).toBeGreaterThan(LIST_ITEMS_BUDGET * 5);
    expect(after).toBeLessThanOrEqual(LIST_ITEMS_BUDGET);
    expect(answer.items).toHaveLength(73);
    expect(answer.total).toBe(73);
    expect(answer.nextCursor).toBeUndefined();
    expect(answer.omitted).toEqual({ closed: 760, rich: true, note: omittedNote(760, true) });
    console.info(`[list_items] 833 cards: before ${before}, after ${after} characters`);
  });

  it('pages every card with includeClosed, each page under the budget, none lost or repeated', () => {
    const pages = allPages(state, { includeClosed: true, includeRich: true });
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) {
      expect(textOf(p).length).toBeLessThanOrEqual(LIST_ITEMS_BUDGET);
      expect(p.total).toBe(833);
      expect(p.count).toBe(p.items.length);
      expect(p.omitted).toBeUndefined();
    }
    const refs = pages.flatMap((p) => p.items.map((i) => i.ref));
    expect(refs).toEqual(state.items.map((i) => cardRefOrKey(i, state.plan.types)));
    expect(pages.at(-1)!.nextCursor).toBeUndefined();
  });

  it('pages a full plan (ITEMS_MAX cards) within a CPU budget', () => {
    const big = workTracker(ITEMS_MAX, ITEMS_MAX - 200);
    const run = () => void allPages(big, { includeClosed: true });
    run();
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) best = Math.min(best, cpuMsOf(run));
    // Every page reads the whole plan (a request each), so all of them grow with the square of the cards: about 45 ms
    // at 2,000, 208 ms at 5,000, one page staying linear. Building every card's fields before cutting the page, or
    // measuring the whole answer per card (quadratic), takes many times the budget.
    expect(best).toBeLessThan(cpuBudgetMs(400));
    // The budget is CPU time, not wall time. The test pages the plan four times (one warm-up, three timed), so it
    // spends about 0.9 s here and 1.7 s under coverage (2026-11-15), several times that on CI's shared two-core
    // runners: past vitest's 5 s default, which failed the run without a CPU regression.
  }, 30_000);
});

describe('list_items on a 5,000-card plan (Work Tracker 981)', () => {
  // Every card open, so every column lists its card refs: the case where they crowded the cards out.
  const state = workTracker(5_000, 0);
  const pages = allPages(state);

  it('lists the column card refs and notOnBoard on the first page only, every name on each', () => {
    const [first, ...later] = pages;
    const columnRefs = first!.boards.flatMap((b) => b.columns.flatMap((c) => c.cards ?? []));
    // Selected for Development sits on two boards, so its cards are listed twice; every card is on a board.
    expect(new Set(columnRefs)).toEqual(
      new Set(state.items.map((i) => cardRefOrKey(i, state.plan.types))),
    );
    expect(first!.notOnBoard).toEqual([]);
    expect(later.length).toBeGreaterThan(0);
    for (const p of later) {
      expect(p).not.toHaveProperty('notOnBoard');
      expect(p.boards.map((b) => b.title)).toEqual(['Backlog', 'In Flight', 'Results']);
      for (const b of p.boards) for (const c of b.columns) expect(c).not.toHaveProperty('cards');
      expect(p.boards[2]!.columns.map((c) => c.name)).toEqual(['Implemented', 'Done', 'Cancelled']);
      expect(p.types.map((t) => t.name)).toEqual(['Work Item', 'Idea']);
    }
  });

  it('reads the whole plan in far fewer requests, each page under the budget, none lost or repeated', () => {
    for (const p of pages) expect(textOf(p).length).toBeLessThanOrEqual(LIST_ITEMS_BUDGET);
    expect(pages.flatMap((p) => p.items.map((i) => i.ref))).toEqual(
      state.items.map((i) => cardRefOrKey(i, state.plan.types)),
    );
    // Measured 2026-11-17 (the PR's Performance section): 70 pages with the refs on every page, 27 with them on the
    // first page only.
    expect(pages.length).toBeLessThanOrEqual(30);
    console.info(`[list_items] 5,000 cards: ${pages.length} pages`);
  });
});

describe('what list_items leaves out', () => {
  const state = planOf([
    card(1, 'review'),
    card(2, 'done'),
    card(3, 'cancelled'),
    card(4, TRASH_STATUS),
    card(5, 'progress', { archived: true }),
    card(6, 'progress', { descriptionRich: undefined, 'f-criteriaRich': undefined }),
  ]);

  it('leaves out done, cancelled, trashed and archived cards, and empties the done columns', () => {
    const answer = page(state);
    expect(answer.items.map((i) => i.ref)).toEqual(['WI-1', 'WI-6']);
    expect(answer.omitted?.closed).toBe(4);
    expect(answer.omitted?.note).toContain('4 closed cards');
    expect(answer.omitted?.note).toContain('includeClosed: true');
    const results = answer.boards.find((b) => b.title === 'Results')!;
    expect(results.columns.map((c) => [c.name, c.cards, c.closed])).toEqual([
      ['Implemented', [], undefined],
      ['Done', [], 1],
      ['Cancelled', [], 1],
    ]);
  });

  it('lists them all with includeClosed, the done columns whole', () => {
    const answer = page(state, { includeClosed: true });
    expect(answer.items.map((i) => i.ref)).toEqual([
      'WI-1',
      'WI-2',
      'WI-3',
      'WI-4',
      'WI-5',
      'WI-6',
    ]);
    expect(answer.omitted?.closed).toBeUndefined();
    const done = answer.boards.find((b) => b.title === 'Results')!.columns[1]!;
    expect(done).toMatchObject({ cards: ['WI-2'] });
    expect(done).not.toHaveProperty('closed');
  });

  it('lists every card in a column a status filter names, closed or not', () => {
    expect(page(state, { status: ['Done', 'trash'] }).items.map((i) => i.ref)).toEqual([
      'WI-2',
      'WI-4',
    ]);
  });

  it('says one closed card in the singular', () => {
    expect(omittedNote(1, false)).toMatch(/^1 closed card \(/);
  });

  it('leaves formatting runs out unless includeRich, saying so only when a listed card had any', () => {
    const plain = page(state);
    expect(plain.items[0]!.fields).not.toHaveProperty('descriptionRich');
    expect(plain.items[0]!.fields).not.toHaveProperty('f-criteriaRich');
    expect(plain.items[0]!.fields['description']).toEqual(expect.any(String));
    expect(plain.items[0]!.fields['Acceptance Criteria']).toEqual(expect.any(String));
    expect(plain.omitted?.rich).toBe(true);
    expect(plain.omitted?.note).toContain('includeRich: true');
    const rich = page(state, { includeRich: true });
    expect(rich.items[0]!.fields).toHaveProperty('descriptionRich');
    expect(rich.items[0]!.fields).toHaveProperty('f-criteriaRich');
    expect(rich.omitted).toEqual({ closed: 4, note: omittedNote(4, false) });
    // A page whose cards have no formatting says nothing of it.
    expect(page(state, { query: 'item 6' }).omitted).toBeUndefined();
  });

  it('has no omitted when nothing was left out', () => {
    const answer = page(
      planOf([card(6, 'progress', { descriptionRich: undefined, 'f-criteriaRich': undefined })]),
    );
    expect(answer).not.toHaveProperty('omitted');
    expect(answer.items).toHaveLength(1);
  });
});

describe('list_items filters', () => {
  const state = planOf([
    card(1, 'review', { title: 'Fix the login page' }),
    card(2, 'selected', { title: 'Board sort', description: 'Sort cards by LOGIN date' }),
    card(3, 'progress', { title: 'Sheet freeze' }),
    { ...card(4, 'progress', { title: 'No status here' }), fields: { title: 'Loose' } },
    card(9, 'review', { title: 'An idea' }),
  ]);
  const refs = (args: Parameters<typeof page>[1]) => page(state, args).items.map((i) => i.ref);

  it('takes several columns and several card types, a card in any of them', () => {
    expect(refs({ status: ['Under Review', 'In Progress'] })).toEqual(['WI-1', 'WI-3', 'I-9']);
    expect(refs({ type: ['Idea'] })).toEqual(['I-9']);
    expect(refs({ type: ['Work Item', 'Idea'], status: ['under-review'] })).toEqual([
      'WI-1',
      'I-9',
    ]);
  });

  it('keeps a card whose title or description holds the text, case aside', () => {
    expect(refs({ query: '  Login ' })).toEqual(['WI-1', 'WI-2']);
    expect(refs({ query: '   ' })).toEqual(['WI-1', 'WI-2', 'WI-3', 'WI-4', 'I-9']);
  });

  it('keeps a card changed at or after updatedSince', () => {
    expect(refs({ updatedSince: new Date(T0 + 3 * DAY).toISOString() })).toEqual([
      'WI-3',
      'WI-4',
      'I-9',
    ]);
    expect(refs({ updatedSince: '2026-10-04' })).toEqual(['WI-3', 'WI-4', 'I-9']);
  });

  it('refuses a time that reads as no date, and a cursor it did not give', () => {
    expect(resolveListItemsPage({ updatedSince: 'last week' })).toMatchObject({
      ok: false,
      code: 'updated_since_invalid',
    });
    expect(resolveListItemsPage({ cursor: '#12' })).toMatchObject({
      ok: false,
      code: 'cursor_invalid',
    });
    expect(resolveListItemsPage({ cursor: 'after-1234567890' })).toMatchObject({ ok: false });
  });
});

describe('list_items paging', () => {
  const state = planOf(Array.from({ length: 10 }, (_, n) => card(n + 1, 'review')));

  it('pages by limit to the last card, none lost or repeated', () => {
    const pages = allPages(state, { limit: 3 });
    expect(pages.map((p) => p.items.map((i) => i.ref))).toEqual([
      ['WI-1', 'WI-2', 'WI-3'],
      ['WI-4', 'WI-5', 'WI-6'],
      ['WI-7', 'WI-8', 'I-9'],
      ['WI-10'],
    ]);
    expect(pages.map((p) => p.nextCursor)).toEqual(['after-3', 'after-6', 'after-9', undefined]);
    expect(pages.every((p) => p.total === 10)).toBe(true);
  });

  it('keeps its place by card number when cards are added or removed between pages', () => {
    const first = page(state, { limit: 4 });
    const changed = planOf([
      ...state.items.filter((i) => i.key !== 2 && i.key !== 6),
      card(11, 'review'),
    ]);
    const next = page(changed, { limit: 4, cursor: first.nextCursor });
    expect(next.items.map((i) => i.ref)).toEqual(['WI-5', 'WI-7', 'WI-8', 'I-9']);
  });

  it('answers no cards past the last one', () => {
    const answer = page(state, { cursor: 'after-99' });
    expect(answer.items).toEqual([]);
    expect(answer.total).toBe(10);
    expect(answer).not.toHaveProperty('nextCursor');
  });

  it('caps a limit at the most a page takes', () => {
    expect(resolveListItemsPage({ limit: 5000 })).toMatchObject({ limit: LIST_ITEMS_LIMIT_MAX });
    expect(resolveListItemsPage({})).toMatchObject({ limit: LIST_ITEMS_LIMIT_MAX, after: 0 });
  });

  it('lists one card alone when it passes the budget by itself, so paging still ends', () => {
    const huge = (key: number) =>
      card(key, 'review', {
        description: 'x'.repeat(LIST_ITEMS_BUDGET),
        descriptionRich: undefined,
      });
    const pages = allPages(planOf([huge(1), huge(2)]));
    expect(pages.map((p) => p.items.map((i) => i.ref))).toEqual([['WI-1'], ['WI-2']]);
  });

  it('answers an empty plan with no cards and no cursor', () => {
    const answer = listItemsPage(
      { items: [], plan: { boards: [], statuses: [], types: [] } as unknown as PlanState['plan'] },
      {},
      { includeClosed: false, includeRich: false, limit: 10, after: 0 },
      { url: URL },
    );
    expect(answer).toMatchObject({ items: [], total: 0, count: 0 });
    expect(answer.hint).toEqual(expect.any(String));
    expect(answer).not.toHaveProperty('nextCursor');
  });
});
