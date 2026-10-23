import { describe, expect, it } from 'vitest';
import type { ChangesetSummary } from '@liveplanner/api-schema';
import { contextOf, DOC_A, DOC_C, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { changesetLs, changesetRevert, changesetShow } from './changeset';
import { projectLs, projectView } from './project';
import { columns } from './shared';
import { tabLs, tabView } from './tab';

const tabPath = `/projects/${DOC_A}/tabs/tab-one-0000`;

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

describe('project ls', () => {
  it('lists newest first with refs, and narrows by a query', async () => {
    const ctx = contextOf(fakeApi(library));
    const all = await projectLs.run!(ctx, projectLs.input.parse({}));
    expect(all.projects.map((d) => [d.ref, d.name, d.updated])).toEqual([
      ['aaaa2', 'Auth flow v2', '2026-10-03'],
      ['bbbb', 'Shop', '2026-10-02'],
      ['aaaa1', 'Auth flow', '2026-10-01'],
    ]);
    expect(projectLs.text!(all)).toEqual([
      'aaaa2  "Auth flow v2"  personal  2026-10-03',
      'bbbb   "Shop"          personal  2026-10-02',
      'aaaa1  "Auth flow"     personal  2026-10-01',
    ]);
    expect(projectLs.quiet!(all)).toEqual(['aaaa2', 'bbbb', 'aaaa1']);
    const some = await projectLs.run!(ctx, projectLs.input.parse({ query: 'AUTH', limit: '1' }));
    expect(some).toMatchObject({ more: 1, query: 'AUTH' });
    expect(projectLs.text!(some).at(-1)).toBe('… 1 more; --limit 2, or narrow with a query');
  });

  it('says when nothing is there, or nothing matches', async () => {
    const ctx = contextOf(fakeApi({ '/projects': { projects: [] }, '/teams': { teams: [] } }));
    expect(projectLs.text!(await projectLs.run!(ctx, projectLs.input.parse({})))).toEqual([
      'no plans',
    ]);
    expect(
      projectLs.text!(await projectLs.run!(ctx, projectLs.input.parse({ query: 'x' }))),
    ).toEqual(['no plans match "x"']);
  });

  it('refuses a limit out of range', () => {
    expect(projectLs.input.safeParse({ limit: '0' }).success).toBe(false);
    expect(projectLs.input.safeParse({ limit: '201' }).success).toBe(false);
  });
});

describe('project view', () => {
  it('prints the overview view the api renders', async () => {
    const api = fakeApi({
      ...library,
      [`/projects/${DOC_C}`]: { project: { id: DOC_C, name: 'Shop', tabs: [] } },
      [`/projects/${DOC_C}?view=overview`]: { text: 'project Shop · 1 tab' },
    });
    const out = await projectView.run!(contextOf(api), { project: 'shop' });
    expect(projectView.text!(out)).toEqual(['project Shop · 1 tab']);
  });

  it("sends a share link's code with the requests after it", async () => {
    const codes: string[] = [];
    const api = fakeApi({
      '/share/abc123': { project: { id: DOC_C, name: 'Shop' } },
      [`/projects/${DOC_C}`]: { project: { id: DOC_C, name: 'Shop', tabs: [] } },
      [`/projects/${DOC_C}?view=overview`]: { text: 'project Shop' },
    });
    await projectView.run!(contextOf(api, codes), {
      project: 'https://liveplanner.app/project/shared?s=abc123',
    });
    expect(codes).toEqual(['abc123']);
  });
});

describe('tab ls', () => {
  it('lists the tabs in order with refs', async () => {
    const out = await tabLs.run!(contextOf(fakeApi({ ...library, ...tabsOfA })), {
      project: 'Auth flow',
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
        project: 'Auth flow',
        view: 'find',
        text: 'sign in',
        budget: '300',
        style: false,
      }),
    );
    expect(tabView.text!(out)).toEqual(['tab "Overview"']);
    expect(tabView.json!(out)).toEqual({ text: 'tab "Overview"' });
    expect(api.calls.at(-1)).toBe(`${tabPath}?view=find&q=sign%20in&budget=300`);
  });

  it('asks for JSON with --json, and prints that JSON as itself', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/projects/${DOC_A}/tabs/tab-two-0000`]: { nodes: [] },
    });
    const out = await tabView.run!(
      contextOf(api),
      tabView.input.parse({ project: 'Auth flow', tab: 'details', json: true }),
    );
    expect(tabView.json!(out)).toEqual({ nodes: [] });
    expect(tabView.text!(out)).toEqual(['{"nodes":[]}']);
    expect(api.calls.at(-1)).toBe(`/projects/${DOC_A}/tabs/tab-two-0000?view=outline&json=1`);
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
  it('lists the changesets of a project, or of one tab', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/projects/${DOC_A}/changesets?limit=20`]: {
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
      [`/projects/${DOC_A}/changesets?limit=5&tab=tab-two-0000`]: { changesets: [] },
    });
    const out = await changesetLs.run!(
      contextOf(api),
      changesetLs.input.parse({ project: 'Auth flow' }),
    );
    expect(changesetLs.text!(out)).toEqual([
      'cs_8k2m4q7d1x  rev 4  "Overview"  Claude (agent)  "Add sign in"  +2 ~1 -0  2026-10-05 07:30',
      'cs_2  rev 4  "gone"  Webber  reverts cs_1  +2 ~1 -0  2026-10-05 07:30',
    ]);
    expect(changesetLs.quiet!(out)).toEqual(['cs_8k2m4q7d1x', 'cs_2']);
    const none = await changesetLs.run!(
      contextOf(api),
      changesetLs.input.parse({ project: 'Auth flow', tab: 'Details', limit: 5 }),
    );
    expect(changesetLs.text!(none)).toEqual(['no changesets']);
  });
});

describe('changeset show', () => {
  it('prints the summary line, then the result lines', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/projects/${DOC_A}/changesets/cs_8k2m4q7d1x`]: {
        changeset: changeset({}),
        results: [],
        text: '+ n3 square "Sign in"',
      },
      [`/projects/${DOC_A}/changesets/cs_9`]: {
        changeset: changeset({ tabId: 'gone' }),
        results: [],
        text: '',
      },
    });
    const out = await changesetShow.run!(contextOf(api), {
      project: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetShow.text!(out)).toEqual([
      'cs_8k2m4q7d1x  rev 4  "Overview"  Claude (agent)  "Add sign in"  +2 ~1 -0  2026-10-05 07:30',
      '+ n3 square "Sign in"',
    ]);
    expect(
      (await changesetShow.run!(contextOf(api), { project: 'Auth flow', changeset: 'cs_9' })).line,
    ).toContain('"gone"');
  });
});

describe('changeset revert', () => {
  const path = `/projects/${DOC_A}/changesets/cs_8k2m4q7d1x/revert`;

  it('reverts one changeset as a new one, naming what it kept', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [path]: {
        changeset: { id: 'cs_9', tabId: 'tab-one-0000', rev: 6, previousRev: 5, rebasedOver: 0 },
        reverted: 2,
        kept: [{ id: 'n3', reason: 'changed' }],
      },
    });
    const out = await changesetRevert.run!(contextOf(api), {
      project: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetRevert.text!(out)).toEqual([
      'reverted 2 · rev 5→6 · cs_9',
      'kept n3 (changed)',
    ]);
    expect(changesetRevert.quiet!(out)).toEqual(['cs_9']);
  });

  it('says when there was nothing left to revert', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [path]: { changeset: null, reverted: 0, kept: [{ id: 'n1', reason: 'gone' }] },
    });
    const out = await changesetRevert.run!(contextOf(api), {
      project: 'Auth flow',
      changeset: 'cs_8k2m4q7d1x',
    });
    expect(changesetRevert.text!(out)).toEqual(['nothing to revert', 'kept n1 (gone)']);
    expect(changesetRevert.quiet!(out)).toEqual([]);
  });
});
