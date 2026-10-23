import { describe, expect, it } from 'vitest';
import type { PageChange, PagesAnswer } from '@livedesign/api-schema';
import { VerbRefusal } from '../define';
import { changePages, pagesTabOf } from '../pages/pages-calls';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { pageLs, pageSet } from './pages';

// The Pages verbs and calls (docs/specs/024-agents/pages-for-agents.md "The front doors",
// "Which tab").
const ONE = 'tab-one-0000';
const TWO = 'tab-two-0000';
const tabPath = (id: string) => `/designs/${DOC_A}/tabs/${id}`;

const ANSWER: PagesAnswer = {
  tab: { id: ONE, rev: 5 },
  lines: ['Added page 2 (logo, 1024 x 1024).'],
  pages: [
    {
      place: 1,
      id: 'page-1',
      name: 'Cover',
      kind: 'logo',
      size: 'logo',
      orientation: null,
      rect: { x: -960, y: -540, width: 1920, height: 1080 },
      background: null,
      locked: false,
      elements: 3,
    },
  ],
  changesetId: null,
};

const PAGES_TAB = {
  id: ONE,
  rev: 4,
  elements: [],
  pages: [{ id: 'a1', orientation: 'portrait', kind: 'logo', size: 'logo' }],
};

function setUp(
  tabs: Record<string, unknown> = { [TWO]: { id: TWO, elements: [] }, [ONE]: PAGES_TAB },
  answer: (r: Request) => Response | Promise<Response> = () => Response.json(ANSWER),
  input = '',
) {
  const sent: unknown[] = [];
  const routes: Record<string, unknown> = { ...library, ...tabsOfA };
  for (const [id, tab] of Object.entries(tabs)) routes[tabPath(id)] = { tab };
  routes[`${tabPath(ONE)}/pages`] = async (r: Request) => {
    sent.push(await r.clone().json());
    return answer(r);
  };
  routes[`${tabPath(TWO)}/pages`] = routes[`${tabPath(ONE)}/pages`];
  routes[`${tabPath(ONE)}?view=pages&door=cli`] = { text: 'tab one · pages' };
  routes[`${tabPath(ONE)}?view=pages&door=cli&budget=50`] = { text: 'tab one · fitted' };
  const api = fakeApi(routes);
  return { api, sent, ctx: contextOf(api, [], [], { readInput: async () => input }) };
}

describe('which tab', () => {
  it('is the one named, else the first', async () => {
    const { api } = setUp();
    expect(await pagesTabOf(api, DOC_A, TWO)).toMatchObject({ tabId: TWO });
    expect(await pagesTabOf(api, DOC_A, undefined)).toMatchObject({ tabId: ONE });
  });

  it('turns a missing design into the api’s refusal', async () => {
    const { api } = setUp();
    expect(await pagesTabOf(api, 'nope', undefined)).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });
});

describe('the calls', () => {
  it('sends page changes and answers what the api did', async () => {
    const { api, sent } = setUp();
    const done = await changePages(api, DOC_A, { changes: [{ op: 'add', kind: 'logo' }] }, 'mcp');
    expect(done).toMatchObject({ ok: true, designId: DOC_A, tabId: ONE, tab: { rev: 5 } });
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
  });

  it('passes the api’s refusal through with its change', async () => {
    const { api } = setUp(undefined, () =>
      Response.json({ error: 'page_unknown', message: 'No page "9".', change: 0 }, { status: 400 }),
    );
    expect(
      await changePages(api, DOC_A, { tabId: ONE, changes: [{ op: 'delete', page: 9 }] }, 'mcp'),
    ).toEqual({ ok: false, code: 'page_unknown', message: 'No page "9".', change: 0 });
  });

  it('reads a refusal without a message as the generic words, and lets a 5xx throw', async () => {
    const bare = setUp(undefined, () => new Response('nope', { status: 403 }));
    const add = { tabId: ONE, changes: [{ op: 'add', kind: 'logo' }] as PageChange[] };
    expect(await changePages(bare.api, DOC_A, add, 'mcp')).toMatchObject({
      ok: false,
      code: 'http_403',
    });
    const down = setUp(undefined, () => new Response('down', { status: 503 }));
    await expect(changePages(down.api, DOC_A, add, 'mcp')).rejects.toThrow();
  });
});

describe('the calls with no tab to act on', () => {
  it('answer the refusal rather than send anything', async () => {
    // Every tab of the design out of reach: no tab to fall back on.
    const doc = tabsOfA[`/designs/${DOC_A}`].design;
    const unreachable = fakeApi({
      ...library,
      [`/designs/${DOC_A}`]: {
        design: { ...doc, tabs: doc.tabs.map((t) => ({ ...t, outOfScope: true })) },
      },
    });
    expect(
      await changePages(unreachable, DOC_A, { changes: [{ op: 'add', kind: 'logo' }] }, 'mcp'),
    ).toMatchObject({
      code: 'tab_needed',
    });
    expect(unreachable.calls.filter((c) => c.endsWith('/pages'))).toEqual([]);
  });
});

describe('page ls and page set', () => {
  it('prints the pages view, fitted when asked', async () => {
    const { ctx } = setUp();
    const out = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A }));
    expect(pageLs.text!(out)).toEqual(['tab one · pages']);
    const fitted = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A, budget: 50 }));
    expect(fitted.text).toBe('tab one · fitted');
  });

  it('makes one change from the flags', async () => {
    const cases: [Record<string, unknown>, unknown][] = [
      [
        { add: 'logo', layout: 'logo-icon-above', name: 'Cover' },
        { op: 'add', kind: 'logo', name: 'Cover', layout: 'logo-icon-above' },
      ],
      [
        { page: '2', delete: true },
        { op: 'delete', page: 2 },
      ],
      [
        { page: 'Cover', duplicate: true },
        { op: 'duplicate', page: 'Cover' },
      ],
      [
        { page: '1', backgroundToAll: true },
        { op: 'apply_background_to_all', page: 1 },
      ],
      [
        { page: '2', move: 1 },
        { op: 'move', page: 2, to: 1 },
      ],
      [
        { page: '2', layout: 'quote' },
        { op: 'layout', page: 2, layout: 'quote' },
      ],
      [
        { page: '2', size: 'a3', orientation: 'landscape' },
        { op: 'set', page: 2, size: 'a3', orientation: 'landscape' },
      ],
    ];
    for (const [flags, change] of cases) {
      const { ctx, sent } = setUp();
      const out = await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, ...flags }));
      expect(sent).toEqual([{ pages: [change] }]);
      expect(pageSet.text!(out)).toEqual([
        '~ Added page 2 (logo, 1024 x 1024).',
        '1  logo  logo  -960,-540 1920x1080  Cover',
      ]);
      expect(pageSet.quiet!(out)).toEqual(['page-1']);
    }
  });

  it('adds a page with no layout, and lists an unnamed page without a name', async () => {
    const unnamed = { ...ANSWER, pages: [{ ...ANSWER.pages[0]!, name: null }] };
    const { ctx, sent } = setUp(undefined, () => Response.json(unnamed));
    const out = await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, add: 'logo' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
    expect(pageSet.text!(out)[1]).toBe('1  logo  logo  -960,-540 1920x1080');
  });

  it('takes a JSON list of changes, on the tab named', async () => {
    const { ctx, sent } = setUp(undefined, undefined, '[{"op":"add","kind":"logo"}]');
    await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, tab: 'Details', changes: 'c.json' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
    const one = setUp(undefined, undefined, '{"op":"add","kind":"logo"}');
    await pageSet.run!(one.ctx, pageSet.input.parse({ doc: DOC_A, changes: '-' }));
    expect(one.sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
  });

  it('refuses no change, bad JSON, too many changes and the api’s refusal', async () => {
    const run = async (flags: Record<string, unknown>, input = '') => {
      const { ctx } = setUp(
        undefined,
        () =>
          Response.json({ error: 'page_unknown', message: 'No page.', change: 0 }, { status: 400 }),
        input,
      );
      return pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, ...flags })).catch(
        (e: unknown) => e,
      );
    };
    expect(await run({})).toBeInstanceOf(VerbRefusal);
    expect(await run({ page: '2' })).toBeInstanceOf(VerbRefusal);
    expect(await run({ changes: 'c' }, 'not json')).toBeInstanceOf(VerbRefusal);
    expect(await run({ changes: 'c' }, '[]')).toBeInstanceOf(VerbRefusal);
    const refused = await run({ page: '9', delete: true });
    expect(refused).toBeInstanceOf(VerbRefusal);
    expect((refused as Error).message).toContain('change 1: No page.');
  });
});
