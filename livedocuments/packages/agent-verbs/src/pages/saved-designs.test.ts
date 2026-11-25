import { describe, expect, it } from 'vitest';
import type { PageChange, SavedPageDesign } from '@livedocuments/api-schema';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { pageDesigns } from '../verbs/pages';
import { changePages } from './pages-calls';
import { savedDesigns, withSavedDesigns } from './saved-designs';

// Saved Page Designs for agents (docs/specs/011-theme/page-designs.md "Agents").
const SAVED: SavedPageDesign[] = [
  {
    id: 'saved:lib1',
    title: 'Brand Aurora',
    scope: 'team',
    team: 'Brand',
    design: { id: 'aurora', scale: 1.4, flow: true, rhythm: true },
  },
  { id: 'saved:lib2', title: 'Mine', scope: 'personal', team: null, design: { id: 'waves' } },
  { id: 'saved:lib3', title: 'Lost team', scope: 'team', team: null, design: { id: 'waves' } },
];
const listed = (designs: unknown = SAVED) => fakeApi({ '/page-designs': { designs } });
const status = (code: number) =>
  fakeApi({ '/page-designs': () => Response.json({ error: 'x' }, { status: code }) });

describe('the saved designs list', () => {
  it('is the api’s, none without a Library or a list, and other failures go through', async () => {
    expect(await savedDesigns(listed())).toEqual(SAVED);
    expect(await savedDesigns(listed('nope'))).toEqual([]);
    expect(await savedDesigns(status(503))).toEqual([]);
    await expect(savedDesigns(status(500))).rejects.toBeTruthy();
  });
});

describe('saved:<id> in a change', () => {
  it('leaves changes naming no saved design alone, without asking for the list', async () => {
    const api = listed();
    const changes: PageChange[] = [
      { op: 'tab_design', design: { id: 'aurora' } },
      { op: 'add', kind: 'slide' },
    ];
    expect(await withSavedDesigns(api, changes)).toEqual({ ok: true, changes });
    expect(api.calls).toEqual([]);
  });

  it('swaps each for its design; a page’s own without rhythm and flow', async () => {
    const out = await withSavedDesigns(listed(), [
      { op: 'add', kind: 'slide' },
      { op: 'tab_design', design: 'saved:lib1' },
      { op: 'set', page: 1, design: 'saved:lib1' },
    ] as unknown as PageChange[]);
    expect(out).toEqual({
      ok: true,
      changes: [
        { op: 'add', kind: 'slide' },
        { op: 'tab_design', design: { id: 'aurora', scale: 1.4, flow: true, rhythm: true } },
        { op: 'set', page: 1, design: { id: 'aurora', scale: 1.4 } },
      ],
    });
  });

  it('refuses one the caller can’t see, listing what they can, or saying there is none', async () => {
    const changes = [{ op: 'tab_design', design: 'saved:nope' }] as unknown as PageChange[];
    const some = await withSavedDesigns(listed(), changes);
    expect(some).toMatchObject({ ok: false, code: 'design_unknown', change: 0 });
    expect(!some.ok && some.message).toContain('saved:lib1 (Brand Aurora)');
    const none = await withSavedDesigns(listed([]), changes);
    expect(!none.ok && none.message).toContain('Nothing is saved');
  });

  it('turns a failed list into the api’s refusal on change_pages', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/tab-one-0000`]: { tab: { id: 'tab-one-0000', elements: [] } },
      '/page-designs': () => Response.json({ error: 'not_found' }, { status: 404 }),
    });
    const out = await changePages(
      api,
      DOC_A,
      {
        tabId: 'tab-one-0000',
        changes: [{ op: 'tab_design', design: 'saved:lib1' }] as unknown as PageChange[],
      },
      'cli',
    );
    expect(out).toMatchObject({ ok: false, code: 'not_found' });
    const unknown = await changePages(
      fakeApi({
        ...library,
        ...tabsOfA,
        [`/documents/${DOC_A}/tabs/tab-one-0000`]: { tab: { id: 'tab-one-0000', elements: [] } },
        '/page-designs': { designs: SAVED },
      }),
      DOC_A,
      {
        tabId: 'tab-one-0000',
        changes: [{ op: 'tab_design', design: 'saved:nope' }] as unknown as PageChange[],
      },
      'cli',
    );
    expect(unknown).toMatchObject({ ok: false, code: 'design_unknown', change: 0 });
  });
});

describe('page designs', () => {
  it('lists each saved design: id, whose and name', async () => {
    const ctx = contextOf(listed());
    const out = await pageDesigns.run!(ctx, pageDesigns.input.parse({}));
    expect(out.designs).toEqual([
      { id: 'saved:lib1', title: 'Brand Aurora', whose: 'Brand' },
      { id: 'saved:lib2', title: 'Mine', whose: 'My Work' },
      { id: 'saved:lib3', title: 'Lost team', whose: 'a team' },
    ]);
    expect(pageDesigns.text!(out).join('\n')).toContain('"Brand Aurora"');
    expect(pageDesigns.quiet!(out)).toEqual(['saved:lib1', 'saved:lib2', 'saved:lib3']);
  });
});
