import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { boardImport } from './board-import';

// `board import` (docs/specs/026-plan/tracker-import.md "Agents"; docs/specs/015-api/cli.md "Commands").

const TAB = 'tab-new-0001';
const LINEAR = [
  'ID,Title,Status,Team',
  'X-1,One,Todo,Eng',
  'X-2,Two,Done,Eng',
  'X-3,Gone,Done,Eng',
].join('\n');
const ARCHIVED = [
  'ID,Title,Status,Team,Archived',
  'X-1,One,Todo,Eng,',
  'X-2,Old,Done,Eng,2026-01-01',
].join('\n');

function ctxWith(files: Record<string, string>) {
  const sent: string[] = [];
  const keep = (answer: unknown) => async (r: Request) => {
    sent.push(`${r.method} ${new URL(r.url).pathname.replace(/^\/api/, '')}`);
    return Response.json(answer);
  };
  const api = fakeApi({
    ...library,
    ...tabsOfA,
    [`/projects/${DOC_A}/items`]: { items: [], rev: 0 },
    [`/projects/${DOC_A}/plan`]: {
      boards: [],
      statuses: [],
      types: [ITEM_TYPES[0]],
      itemTypesRev: 1,
    },
    [`/projects/${DOC_A}/item-types`]: keep({ itemTypes: null }),
    [`/projects/${DOC_A}/tabs/${TAB}/changesets`]: keep({ changeset: { id: 'cs', rev: 1 } }),
    [`/projects/${DOC_A}/items/bulk`]: keep({ items: [], rev: 2 }),
    // The library lists on a GET; a new plan is a POST.
    '/projects': (r: Request) =>
      r.method === 'GET'
        ? Response.json(library['/projects'])
        : keep({ project: { id: 'new-1' } })(r),
  });
  const ctx = contextOf(api, [], [], { readInput: async (p) => files[p]! });
  return { ctx, sent };
}

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(TAB as ReturnType<typeof crypto.randomUUID>);
});
afterEach(() => vi.restoreAllMocks());

describe('board import', () => {
  it('adds a Board tab to the plan named, printing the board and the link', async () => {
    const { ctx, sent } = ctxWith({ 'exports/linear.csv': LINEAR });
    const out = await boardImport.run!(
      ctx,
      boardImport.input.parse({
        file: 'exports/linear.csv',
        project: 'Auth flow',
        from: 'linear',
        name: 'Q4',
      }),
    );
    expect(sent).toEqual([
      `PUT /projects/${DOC_A}/item-types`,
      `POST /projects/${DOC_A}/tabs/${TAB}/changesets`,
      `POST /projects/${DOC_A}/items/bulk`,
    ]);
    expect(boardImport.text!(out)).toEqual([
      '+ board "Q4" from Linear: 3 cards, 2 columns',
      `https://liveplanner.app/project/${DOC_A}`,
    ]);
    expect(boardImport.quiet!(out)).toEqual([TAB]);
  });

  it('previews from stdin as a new plan, writing nothing and naming what is left out', async () => {
    const { ctx, sent } = ctxWith({ '-': ARCHIVED });
    const out = await boardImport.run!(ctx, boardImport.input.parse({ file: '-', preview: true }));
    expect(sent).toEqual([]);
    expect(out).toMatchObject({ written: false, title: 'Imported Board', url: null });
    expect(boardImport.text!(out)).toEqual([
      '? board "Imported Board" from Linear: 1 card, 1 column',
      '  left out: Archived cards (1)',
      'Makes a new plan with a Board tab of 1 column and 1 card.',
    ]);
    expect(boardImport.quiet!(out)).toEqual([]);
  });

  it('makes a new plan named after the file', async () => {
    const { ctx, sent } = ctxWith({ 'C:\\Downloads\\Roadmap.csv': LINEAR });
    const out = await boardImport.run!(
      ctx,
      boardImport.input.parse({ file: 'C:\\Downloads\\Roadmap.csv' }),
    );
    expect(sent).toEqual(['POST /projects']);
    expect(out).toMatchObject({
      written: true,
      newPlan: true,
      projectId: 'new-1',
      title: 'Roadmap',
    });
  });

  it('refuses a file it cannot read, with a hint', async () => {
    const { ctx } = ctxWith({ 'notes.csv': 'Name,Due\nA,B' });
    const err = await boardImport.run!(ctx, boardImport.input.parse({ file: 'notes.csv' })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(VerbRefusal);
    expect(err).toMatchObject({
      code: 'unknown_source',
      hint: 'exports: a Trello board JSON, or an Asana, Jira or Linear CSV',
    });
  });
});
