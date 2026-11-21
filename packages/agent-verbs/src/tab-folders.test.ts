import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { fakeApi, TEST_PRODUCT, WORDED_PRODUCT } from './testing/product';
import {
  changeTabFolders,
  fileNewTab,
  listedTabsOf,
  planTabFolders,
  TAB_FOLDER_CHANGES_MAX,
  TAB_FOLDER_NAME_MAX,
  tabFolderStopText,
  TabFolderStop,
  type FolderedTab,
} from './tab-folders';

// Each product's docs/specs/006-*/tab-folders.md "Agents": changes planned over the tabs in order, nothing else moved.

// Tabs given in order; a name with a slash is `folder/name`.
const tabsOf = (...names: string[]): FolderedTab[] =>
  names.map((n, i) => {
    const [folder, name = n] = n.includes('/') ? n.split('/') : [undefined];
    return { id: `t${i + 1}`, name, orderIndex: i, ...(folder ? { folder } : {}) };
  });

// The planned order as `folder/name` words.
const words = (planned: { id: string; folder: string | null }[], tabs: FolderedTab[]) =>
  planned.map((t) => {
    const name = tabs.find((x) => x.id === t.id)!.name;
    return t.folder ? `${t.folder}/${name}` : name;
  });

describe('listedTabsOf', () => {
  it('lists the tabs in order, the folder only when a tab has one', () => {
    const tabs = [
      { id: 'b', name: 'B', orderIndex: 1, folder: 'Plans' },
      { id: 'a', name: 'A', orderIndex: 0, folder: '  ' },
    ];
    expect(
      listedTabsOf([
        { id: 'x', name: 'X' },
        { id: 'y', name: 'Y' },
      ]),
    ).toEqual([
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' },
    ]);
    expect(listedTabsOf(tabs)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', folder: 'Plans' },
    ]);
  });
});

describe('planTabFolders', () => {
  it('starts a new folder where the tab stands, and moves nothing else', () => {
    const tabs = tabsOf('A', 'B', 'C');
    const plan = planTabFolders(tabs, [{ op: 'move', tab: 'B', folder: ' Plans ' }]);
    expect(words(plan.tabs, tabs)).toEqual(['A', 'Plans/B', 'C']);
    expect(plan.lines).toEqual(['~ tab "B" into new folder "Plans"']);
    expect(plan.changed).toBe(true);
  });

  it('joins an existing folder as its last tab, from before or after it, the folder keeping its place', () => {
    const tabs = tabsOf('A', 'P/B', 'P/C', 'D');
    const fromAfter = planTabFolders(tabs, [{ op: 'move', tab: 't4', folder: 'P' }]);
    expect(words(fromAfter.tabs, tabs)).toEqual(['A', 'P/B', 'P/C', 'P/D']);
    const fromBefore = planTabFolders(tabs, [{ op: 'move', tab: 'a', folder: 'P' }]);
    expect(words(fromBefore.tabs, tabs)).toEqual(['P/B', 'P/C', 'P/A', 'D']);
    expect(fromBefore.lines).toEqual(['~ tab "A" into folder "P"']);
  });

  it('takes a tab out of its folder, landing just outside it: before it from its head, else after it', () => {
    const tabs = tabsOf('P/A', 'P/B', 'P/C', 'D');
    const head = planTabFolders(tabs, [{ op: 'move', tab: 'A', folder: null }]);
    expect(words(head.tabs, tabs)).toEqual(['A', 'P/B', 'P/C', 'D']);
    expect(head.lines).toEqual(['~ tab "A" out of its folder']);
    const middle = planTabFolders(tabs, [{ op: 'move', tab: 'B', folder: null }]);
    expect(words(middle.tabs, tabs)).toEqual(['P/A', 'P/C', 'B', 'D']);
  });

  it('moves a tab from one folder to another', () => {
    const tabs = tabsOf('P/A', 'P/B', 'Q/C');
    const plan = planTabFolders(tabs, [{ op: 'move', tab: 'A', folder: 'Q' }]);
    expect(words(plan.tabs, tabs)).toEqual(['P/B', 'Q/C', 'Q/A']);
  });

  it('says so, and writes nothing, when a tab is where it is asked to go already', () => {
    const tabs = tabsOf('P/A', 'B');
    const plan = planTabFolders(tabs, [
      { op: 'move', tab: 'A', folder: 'P' },
      { op: 'move', tab: 'B', folder: null },
    ]);
    expect(plan.changed).toBe(false);
    expect(plan.lines).toEqual([
      '= tab "A" is in "P" already',
      '= tab "B" is in no folder already',
    ]);
  });

  it('renames a folder, every member, and merges into a folder of the new name', () => {
    const tabs = tabsOf('P/A', 'P/B', 'C', 'Q/D');
    const renamed = planTabFolders(tabs, [{ op: 'rename_folder', folder: 'P', to: 'Plans' }]);
    expect(words(renamed.tabs, tabs)).toEqual(['Plans/A', 'Plans/B', 'C', 'Q/D']);
    expect(renamed.lines).toEqual(['~ folder "P" renamed "Plans"']);
    const merged = planTabFolders(tabs, [{ op: 'rename_folder', folder: 'Q', to: 'P' }]);
    expect(words(merged.tabs, tabs)).toEqual(['P/A', 'P/B', 'P/D', 'C']);
    expect(merged.lines).toEqual(['~ folder "Q" renamed "P", joining the folder of that name']);
    const same = planTabFolders(tabs, [{ op: 'rename_folder', folder: 'P', to: 'P' }]);
    expect(same).toMatchObject({ changed: false, lines: ['= folder "P" is named that already'] });
  });

  it('ungroups a folder, every member loose where it stands', () => {
    const tabs = tabsOf('A', 'P/B', 'P/C', 'Q/D');
    const plan = planTabFolders(tabs, [
      { op: 'ungroup', folder: 'P' },
      { op: 'ungroup', folder: 'Q' },
    ]);
    expect(words(plan.tabs, tabs)).toEqual(['A', 'B', 'C', 'D']);
    expect(plan.lines).toEqual([
      '~ folder "P" ungrouped: 2 tabs out',
      '~ folder "Q" ungrouped: 1 tab out',
    ]);
  });

  it('applies the changes in order, each seeing the ones before it', () => {
    const tabs = tabsOf('A', 'B');
    const plan = planTabFolders(tabs, [
      { op: 'move', tab: 'A', folder: 'New' },
      { op: 'move', tab: 'B', folder: 'New' },
      { op: 'rename_folder', folder: 'New', to: 'Done' },
    ]);
    expect(words(plan.tabs, tabs)).toEqual(['Done/A', 'Done/B']);
  });

  it('refuses an unknown or ambiguous tab, naming the tabs', () => {
    const tabs = tabsOf('A', 'B', 'B');
    expect(() => planTabFolders(tabs, [{ op: 'move', tab: 'Z', folder: 'P' }])).toThrow(
      'No tab "Z". Tabs: A (t1), B (t2), B (t3).',
    );
    expect(() => planTabFolders(tabs, [{ op: 'move', tab: 'b', folder: 'P' }])).toThrow(
      '2 tabs are named "b": name it by its id.',
    );
  });

  it('refuses an unknown folder, naming the folders, or saying there are none', () => {
    expect(() => planTabFolders(tabsOf('P/A', 'Q/B'), [{ op: 'ungroup', folder: 'Z' }])).toThrow(
      'No folder "Z". Folders: "P", "Q".',
    );
    expect(() =>
      planTabFolders(tabsOf('A'), [{ op: 'rename_folder', folder: 'Z', to: 'Y' }]),
    ).toThrow('No folder "Z". No tab is in a folder.');
  });

  it('refuses an empty or overlong folder name', () => {
    const tabs = tabsOf('P/A');
    expect(() => planTabFolders(tabs, [{ op: 'move', tab: 'A', folder: '  ' }])).toThrow(
      'The folder is empty',
    );
    expect(() =>
      planTabFolders(tabs, [
        { op: 'rename_folder', folder: 'P', to: 'x'.repeat(TAB_FOLDER_NAME_MAX + 1) },
      ]),
    ).toThrow(`longer than ${TAB_FOLDER_NAME_MAX} characters`);
  });
});

describe('planTabFolders at size', () => {
  it('plans the most changes a call takes over a thousand tabs within its budget', () => {
    // Measured about 8 ms locally (under 1 ms at 20 tabs); a quadratic slip would be far past this.
    const tabs = Array.from({ length: 1000 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      orderIndex: i,
      ...(i % 3 === 0 ? { folder: `F${i % 30}` } : {}),
    }));
    const changes = Array.from({ length: TAB_FOLDER_CHANGES_MAX }, (_, i) => ({
      op: 'move' as const,
      tab: `Tab ${(i * 7) % 1000}`,
      folder: `F${i % 30}`,
    }));
    planTabFolders(tabs, changes);
    expect(cpuMsOf(() => planTabFolders(tabs, changes))).toBeLessThan(cpuBudgetMs(60));
  });
});

const PATH = '/sketches/s1';

describe('changeTabFolders', () => {
  it('reads the tabs, writes the whole order once, and answers the tabs as written', async () => {
    const puts: unknown[] = [];
    const api = fakeApi({
      [PATH]: (request: Request) => {
        if (request.method === 'GET') return Response.json({ sketch: { tabs: tabsOf('A', 'B') } });
        return request.json().then((body: unknown) => {
          puts.push(body);
          return Response.json({ sketch: { tabs: tabsOf('A', 'P/B') } });
        });
      },
    });
    const answer = await changeTabFolders(api, TEST_PRODUCT, 's1', [
      { op: 'move', tab: 'B', folder: 'P' },
    ]);
    expect(answer).toEqual({
      applied: ['~ tab "B" into new folder "P"'],
      tabs: [
        { id: 't1', name: 'A' },
        { id: 't2', name: 'B', folder: 'P' },
      ],
    });
    expect(puts.at(-1)).toEqual({
      tabs: [
        { id: 't1', folder: null },
        { id: 't2', folder: 'P' },
      ],
    });
  });

  it('writes nothing when nothing changes, and takes the tabs the caller read', async () => {
    const api = fakeApi({});
    const answer = await changeTabFolders(
      api,
      TEST_PRODUCT,
      's1',
      [{ op: 'move', tab: 'A', folder: null }],
      tabsOf('A'),
    );
    expect(answer.tabs).toEqual([{ id: 't1', name: 'A' }]);
    expect(api.calls).toEqual([]);
  });

  it('words a Viewer’s or Participant’s refusal, in the product’s words, and throws any other', async () => {
    const refusing = (status: number) =>
      fakeApi({
        [PATH]: (request: Request) =>
          request.method === 'GET'
            ? Response.json({ sketch: { tabs: tabsOf('A') } })
            : Response.json({ error: 'forbidden' }, { status }),
      });
    const change = [{ op: 'move', tab: 'A', folder: 'P' }] as const;
    await expect(changeTabFolders(refusing(403), WORDED_PRODUCT, 's1', change)).rejects.toThrow(
      'Only an Editor can change tab folders, and you can only view or participate in this drawing.',
    );
    await expect(changeTabFolders(refusing(403), TEST_PRODUCT, 's1', change)).rejects.toThrow(
      'in this sketch.',
    );
    await expect(changeTabFolders(refusing(500), TEST_PRODUCT, 's1', change)).rejects.toThrow(
      'api 500',
    );
  });
});

describe('fileNewTab', () => {
  it('puts the new tab in an existing folder as its last tab', async () => {
    let put: unknown;
    const api = fakeApi({
      [PATH]: async (request: Request) => {
        if (request.method === 'GET')
          return Response.json({ sketch: { tabs: tabsOf('P/A', 'B', 'New') } });
        put = await request.json();
        return Response.json({ sketch: { tabs: [] } });
      },
    });
    expect(await fileNewTab(api, TEST_PRODUCT, 's1', 't3', ' P ')).toBe('P');
    expect(put).toEqual({
      tabs: [
        { id: 't1', folder: 'P' },
        { id: 't3', folder: 'P' },
        { id: 't2', folder: null },
      ],
    });
  });

  it('writes nothing when the tab is in that folder already', async () => {
    const api = fakeApi({ [PATH]: { sketch: { tabs: tabsOf('P/A') } } });
    expect(await fileNewTab(api, TEST_PRODUCT, 's1', 't1', 'P')).toBe('P');
    expect(api.calls).toEqual([PATH]);
  });
});

describe('tabFolderStopText', () => {
  it('words only its own stops', () => {
    expect(tabFolderStopText(new TabFolderStop('No tab "Z".'))).toBe('No tab "Z".');
    expect(tabFolderStopText(new Error('boom'))).toBeUndefined();
  });
});
