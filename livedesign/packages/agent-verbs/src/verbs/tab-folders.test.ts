import { describe, expect, it } from 'vitest';
import { contextOf, DOC_A, fakeApi, library } from '../testing/fake-api';
import { changeTabs, fileTabIn, listedTabsOf, tabFolderStopText } from '../mcp/tab-folder-tools';
import { tabAdd } from './lifecycle';
import { tabLs } from './tab';
import { tabFolder } from './tab-folder';

// docs/specs/006-design/tab-folders.md "Agents": tab ls shows each tab's folder, tab add --folder files the new tab, tab
// folder moves, renames and ungroups, all through the one tab-order write.

const FILE = `/designs/${DOC_A}`;

type Tab = { id: string; name: string; orderIndex: number; folder?: string };

// The file's tabs, answering a read and recording each tab-order write (applied, as the api would).
function fileWith(tabs: Tab[], status = 200) {
  const writes: unknown[] = [];
  let current = tabs;
  const route = async (request: Request) => {
    if (request.method === 'PUT') {
      const body = (await request.json()) as { tabs: { id: string; folder: string | null }[] };
      writes.push(body);
      if (status !== 200) return Response.json({ error: 'forbidden' }, { status });
      current = body.tabs.map((t, i) => {
        const name = current.find((c) => c.id === t.id)!.name;
        return t.folder
          ? { id: t.id, name, orderIndex: i, folder: t.folder }
          : { id: t.id, name, orderIndex: i };
      });
    }
    return Response.json({ design: { id: DOC_A, name: 'Auth flow', tabs: current } });
  };
  return { writes, route };
}

const TABS: Tab[] = [
  { id: 'tab-one-0000', name: 'Overview', orderIndex: 0, folder: 'Plans' },
  { id: 'tab-two-0000', name: 'Details', orderIndex: 1 },
];

describe('tab ls', () => {
  it('prints the tab folder of a tab in one', async () => {
    const { route } = fileWith(TABS);
    const out = await tabLs.run!(
      contextOf(fakeApi({ ...library, [FILE]: route })),
      tabLs.input.parse({ doc: 'Auth flow' }),
    );
    expect(out.tabs.map((t) => t.folder)).toEqual(['Plans', undefined]);
    expect(tabLs.text!(out)).toEqual(['1  tab-o  "Overview"  in "Plans"', '2  tab-t  "Details"']);
  });
});

describe('tab add --folder', () => {
  const changesets = (dryRun: boolean) => () =>
    Response.json({
      dryRun,
      changeset: dryRun
        ? null
        : { id: 'cs_1', tabId: 'new-1', rev: 1, previousRev: 0, rebasedOver: 0 },
      results: [],
      text: 'rev 0→1 · cs_1 · lint clean',
      warnings: [],
      lint: null,
    });

  it('files the new tab in the folder named, as its last tab', async () => {
    const { writes, route } = fileWith([...TABS, { id: 'new-1', name: 'Board', orderIndex: 2 }]);
    const api = fakeApi({
      ...library,
      [FILE]: route,
      [`${FILE}/tabs/new-1/changesets`]: changesets(false),
    });
    const out = await tabAdd.run!(
      contextOf(api),
      tabAdd.input.parse({ doc: 'Auth flow', name: 'Board', folder: ' Plans ' }),
    );
    expect(writes).toEqual([
      {
        tabs: [
          { id: 'tab-one-0000', folder: 'Plans' },
          { id: 'new-1', folder: 'Plans' },
          { id: 'tab-two-0000', folder: null },
        ],
      },
    ]);
    expect(out.text.split('\n')[0]).toBe('+ tab new-1 "Board" in "Plans"');
  });

  it('files nothing on a dry run', async () => {
    const { writes, route } = fileWith(TABS);
    const api = fakeApi({
      ...library,
      [FILE]: route,
      [`${FILE}/tabs/new-1/changesets`]: changesets(true),
    });
    const out = await tabAdd.run!(
      contextOf(api),
      tabAdd.input.parse({ doc: 'Auth flow', name: 'Board', folder: 'Plans' }),
    );
    expect(writes).toEqual([]);
    expect(out.text.split('\n')[0]).toBe('+ tab new-1 "Board"');
  });
});

describe('tab folder', () => {
  it('moves a tab into a folder, by the product’s positional', async () => {
    const { writes, route } = fileWith(TABS);
    const out = await tabFolder.run!(
      contextOf(fakeApi({ ...library, [FILE]: route })),
      tabFolder.input.parse({ doc: 'Auth flow', tab: 'Details', folder: 'Plans' }),
    );
    expect(out.applied).toEqual(['~ tab "Details" into folder "Plans"']);
    expect(writes).toHaveLength(1);
    expect(tabFolder.cli!.positionals).toEqual(['doc']);
  });
});

describe('the MCP’s runs', () => {
  it('changes the tabs and files a new one over this product’s api', async () => {
    const { route } = fileWith(TABS);
    const api = fakeApi({ [FILE]: route });
    const changed = await changeTabs(api, DOC_A, [{ op: 'ungroup', folder: 'Plans' }]);
    expect(changed.tabs).toEqual([
      { id: 'tab-one-0000', name: 'Overview' },
      { id: 'tab-two-0000', name: 'Details' },
    ]);
    expect(await fileTabIn(api, DOC_A, 'tab-two-0000', 'Next')).toBe('Next');
    expect(listedTabsOf(TABS)[0]).toEqual({
      id: 'tab-one-0000',
      name: 'Overview',
      folder: 'Plans',
    });
  });

  it('words a Viewer’s refusal', async () => {
    const { route } = fileWith(TABS, 403);
    const refused = await changeTabs(fakeApi({ [FILE]: route }), DOC_A, [
      { op: 'ungroup', folder: 'Plans' },
    ]).catch((err: unknown) => err);
    expect(tabFolderStopText(refused)).toMatch(/^Only an Editor can change tab folders/);
  });
});
