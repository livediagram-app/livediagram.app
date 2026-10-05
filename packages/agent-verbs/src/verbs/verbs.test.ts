import { describe, expect, it } from 'vitest';
import type { ChangesetSummary, LintReport } from '@livediagram/api-schema';
import { contextOf, DOC_A, DOC_C, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { changesetLs, changesetRevert, changesetShow } from './changeset';
import { documentLs, documentView } from './document';
import { columns } from './shared';
import { tabLint, tabLs, tabView } from './tab';

const tabPath = `/documents/${DOC_A}/tabs/tab-one-0000`;

describe('columns', () => {
  it('pads every column but the last to its widest cell', () => {
    expect(
      columns([
        ['a', 'bbb', 'c'],
        ['dddd', 'e', 'f'],
      ]),
    ).toEqual(['a     bbb  c', 'dddd  e    f']);
  });
});

describe('document ls', () => {
  it('lists newest first with refs, and narrows by a query', async () => {
    const ctx = contextOf(fakeApi(library));
    const all = await documentLs.run!(ctx, documentLs.input.parse({}));
    expect(all.documents.map((d) => [d.ref, d.name, d.updated])).toEqual([
      ['aaaa2', 'Auth flow v2', '2026-10-03'],
      ['bbbb', 'Shop', '2026-10-02'],
      ['aaaa1', 'Auth flow', '2026-10-01'],
    ]);
    expect(documentLs.text!(all)).toEqual([
      'aaaa2  "Auth flow v2"  personal  2026-10-03',
      'bbbb   "Shop"          personal  2026-10-02',
      'aaaa1  "Auth flow"     personal  2026-10-01',
    ]);
    expect(documentLs.quiet!(all)).toEqual(['aaaa2', 'bbbb', 'aaaa1']);
    const some = await documentLs.run!(ctx, documentLs.input.parse({ query: 'AUTH', limit: '1' }));
    expect(some).toMatchObject({ more: 1, query: 'AUTH' });
    expect(documentLs.text!(some).at(-1)).toBe('… 1 more; --limit 2, or narrow with a query');
  });

  it('says when nothing is there, or nothing matches', async () => {
    const ctx = contextOf(fakeApi({ '/documents': { documents: [] }, '/teams': { teams: [] } }));
    expect(documentLs.text!(await documentLs.run!(ctx, documentLs.input.parse({})))).toEqual([
      'no documents',
    ]);
    expect(
      documentLs.text!(await documentLs.run!(ctx, documentLs.input.parse({ query: 'x' }))),
    ).toEqual(['no documents match "x"']);
  });

  it('refuses a limit out of range', () => {
    expect(documentLs.input.safeParse({ limit: '0' }).success).toBe(false);
    expect(documentLs.input.safeParse({ limit: '201' }).success).toBe(false);
  });
});

describe('document view', () => {
  it('prints the overview view the api renders', async () => {
    const api = fakeApi({
      ...library,
      [`/documents/${DOC_C}`]: { document: { id: DOC_C, name: 'Shop', tabs: [] } },
      [`/documents/${DOC_C}?view=overview`]: { text: 'document Shop · 1 tab' },
    });
    const out = await documentView.run!(contextOf(api), { doc: 'shop' });
    expect(documentView.text!(out)).toEqual(['document Shop · 1 tab']);
  });

  it("sends a share link's code with the requests after it", async () => {
    const codes: string[] = [];
    const api = fakeApi({
      '/share/abc123': { document: { id: DOC_C, name: 'Shop' } },
      [`/documents/${DOC_C}`]: { document: { id: DOC_C, name: 'Shop', tabs: [] } },
      [`/documents/${DOC_C}?view=overview`]: { text: 'document Shop' },
    });
    await documentView.run!(contextOf(api, codes), {
      doc: 'https://livediagram.app/document/shared?s=abc123',
    });
    expect(codes).toEqual(['abc123']);
  });
});

describe('tab ls', () => {
  it('lists the tabs in order with refs', async () => {
    const out = await tabLs.run!(contextOf(fakeApi({ ...library, ...tabsOfA })), {
      doc: 'Auth flow',
    });
    expect(tabLs.text!(out)).toEqual(['1  tab-o  "Overview"', '2  tab-t  "Details"']);
    expect(tabLs.quiet!(out)).toEqual(['tab-o', 'tab-t']);
    expect(tabLs.text!({ tabs: [] })).toEqual(['no tabs']);
  });
});

describe('tab view', () => {
  it('asks for the view with its options, as text', async () => {
    const api = fakeApi({ ...library, ...tabsOfA, [tabPath]: { text: 'tab "Overview"' } });
    const out = await tabView.run!(
      contextOf(api),
      tabView.input.parse({
        doc: 'Auth flow',
        view: 'find',
        text: 'sign in',
        budget: '300',
        coarse: true,
        style: false,
      }),
    );
    expect(tabView.text!(out)).toEqual(['tab "Overview"']);
    expect(tabView.json!(out)).toEqual({ text: 'tab "Overview"' });
    expect(api.calls.at(-1)).toBe(`${tabPath}?view=find&q=sign%20in&budget=300&coarse=1`);
  });

  it('asks for JSON with --json, and prints that JSON as itself', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/tab-two-0000`]: { nodes: [] },
    });
    const out = await tabView.run!(
      contextOf(api),
      tabView.input.parse({ doc: 'Auth flow', tab: 'details', json: true }),
    );
    expect(tabView.json!(out)).toEqual({ nodes: [] });
    expect(tabView.text!(out)).toEqual(['']);
    expect(api.calls.at(-1)).toBe(`/documents/${DOC_A}/tabs/tab-two-0000?view=outline&json=1`);
  });
});

const report = (errors: number): LintReport => ({
  measures: {
    crossings: 0,
    behind: 0,
    overlaps: errors,
    extent: { width: 400, height: 200 },
    arrows: 1,
    boxes: 2,
  },
  findings: errors
    ? [
        {
          code: 'box-overlap',
          severity: 'error',
          refs: ['n1', 'n2'],
          message: 'n1 overlaps n2',
          fix: 'move n2 right-of:n1',
        },
      ]
    : [],
  counts: { error: errors, warning: 0, info: 0 },
  skipped: { crossings: false },
});

describe('tab lint', () => {
  it('prints the report and exits 1 on an error finding', async () => {
    const api = fakeApi({ ...library, ...tabsOfA, [`${tabPath}?view=lint&json=1`]: report(1) });
    const out = await tabLint.run!(contextOf(api), { doc: 'Auth flow' });
    expect(out.errors).toBe(1);
    expect(tabLint.text!(out)[0]).toContain('n1 overlaps n2');
    expect(tabLint.exitCode!(out)).toBe(1);
    expect(tabLint.exitCode!({ ...out, errors: 0 })).toBe(0);
  });
});

const changeset = (over: Partial<ChangesetSummary>): ChangesetSummary => ({
  id: 'cs_8k2m4q7d1x',
  tabId: 'tab-one-0000',
  rev: 4,
  author: { name: 'Claude', color: '#000' },
  agent: true,
  summary: 'Add sign in',
  counts: { added: 2, changed: 1, removed: 0 },
  revertOf: null,
  createdAt: Date.UTC(2026, 9, 5, 7, 30),
  ...over,
});

describe('changeset ls', () => {
  it('lists the changesets of a document, or of one tab', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/documents/${DOC_A}/changesets?limit=20`]: {
        changesets: [
          changeset({}),
          changeset({
            id: 'cs_2',
            tabId: 'gone',
            agent: false,
            summary: null,
            revertOf: 'cs_1',
            author: { name: 'Webber', color: '#fff' },
          }),
        ],
      },
      [`/documents/${DOC_A}/changesets?limit=5&tab=tab-two-0000`]: { changesets: [] },
    });
    const out = await changesetLs.run!(
      contextOf(api),
      changesetLs.input.parse({ doc: 'Auth flow' }),
    );
    expect(changesetLs.text!(out)).toEqual([
      'cs_8k2m4q7d1x  rev 4  "Overview"  Claude (agent)  "Add sign in"  +2 ~1 -0  2026-10-05 07:30',
      'cs_2  rev 4  "gone"  Webber  reverts cs_1  +2 ~1 -0  2026-10-05 07:30',
    ]);
    expect(changesetLs.quiet!(out)).toEqual(['cs_8k2m4q7d1x', 'cs_2']);
    const none = await changesetLs.run!(
      contextOf(api),
      changesetLs.input.parse({ doc: 'Auth flow', tab: 'Details', limit: 5 }),
    );
    expect(changesetLs.text!(none)).toEqual(['no changesets']);
  });
});

describe('changeset show', () => {
  it('prints the summary line, then the result lines', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/documents/${DOC_A}/changesets/cs_8k2m4q7d1x`]: {
        changeset: changeset({}),
        results: [],
        text: '+ n3 square "Sign in"',
      },
      [`/documents/${DOC_A}/changesets/cs_9`]: {
        changeset: changeset({ tabId: 'gone' }),
        results: [],
        text: '',
      },
    });
    const out = await changesetShow.run!(contextOf(api), {
      doc: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetShow.text!(out)).toEqual([
      'cs_8k2m4q7d1x  rev 4  "Overview"  Claude (agent)  "Add sign in"  +2 ~1 -0  2026-10-05 07:30',
      '+ n3 square "Sign in"',
    ]);
    expect(
      (await changesetShow.run!(contextOf(api), { doc: 'Auth flow', changeset: 'cs_9' })).line,
    ).toContain('"gone"');
  });
});

describe('changeset revert', () => {
  const lint = report(0);
  const path = `/documents/${DOC_A}/changesets/cs_8k2m4q7d1x/revert`;

  it('reverts one changeset as a new one, naming what it kept', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [path]: {
        changeset: { id: 'cs_9', tabId: 'tab-one-0000', rev: 6, previousRev: 5, rebasedOver: 0 },
        reverted: 2,
        kept: [{ id: 'n3', reason: 'changed' }],
        lint,
      },
    });
    const out = await changesetRevert.run!(contextOf(api), {
      doc: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetRevert.text!(out)).toEqual([
      'reverted 2 · rev 5→6 · cs_9 · lint clean',
      'kept n3 (changed)',
    ]);
    expect(changesetRevert.quiet!(out)).toEqual(['cs_9']);
  });

  it('says when there was nothing left to revert', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [path]: { changeset: null, reverted: 0, kept: [{ id: 'n1', reason: 'gone' }], lint: null },
    });
    const out = await changesetRevert.run!(contextOf(api), {
      doc: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetRevert.text!(out)).toEqual(['nothing to revert', 'kept n1 (gone)']);
    expect(changesetRevert.quiet!(out)).toEqual([]);
  });
});
