import { describe, expect, it } from 'vitest';
import { buildEditorSearchResults, type EditorSearchConfig } from './build-search-results';

// The shared search every editor binds (each editor's lib/search.ts, whose own tests drive it with its nouns). These
// cases cover the shared rules: the matcher, the caps, the order and the label extraction.

type El = { id: string; type: string; label?: string; cells?: string[][] };
type T = { id: string; name: string; elements: El[] };

const CONFIG: EditorSearchConfig<'file', 'files'> = {
  library: { kind: 'file', key: 'files', label: 'Files', untitled: 'Untitled page' },
  tableCells: true,
};

const base = { library: [], folders: [] };

describe('buildEditorSearchResults', () => {
  it('returns nothing for empty inputs', () => {
    expect(buildEditorSearchResults({ ...base, query: '' }, CONFIG)).toEqual([]);
    expect(buildEditorSearchResults({ ...base, query: 'x', tabs: [] }, CONFIG)).toEqual([]);
  });

  it("lists the editor's own files under its key and label, blank names as its untitled name", () => {
    const groups = buildEditorSearchResults(
      {
        ...base,
        query: 'unt',
        library: [
          { id: 'a', name: '' },
          { id: 'b', name: 'Untold', localOnly: true },
          { id: 'c', name: 'Other' },
        ],
      },
      CONFIG,
    );
    expect(groups).toEqual([
      {
        key: 'files',
        label: 'Files',
        items: [
          { kind: 'file', id: 'a', name: 'Untitled page' },
          { kind: 'file', id: 'b', name: 'Untold', localOnly: true },
        ],
      },
    ]);
  });

  it('caps each list at eight', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, name: `Doc ${i}` }));
    const [own] = buildEditorSearchResults({ ...base, query: 'doc', library: many }, CONFIG);
    expect(own!.items).toHaveLength(8);
  });

  it('lists shared files, folders, then teams with their folders and files', () => {
    const groups = buildEditorSearchResults(
      {
        query: 'a',
        library: [],
        shared: [
          { id: 's1', name: '', shareCode: 'code' },
          { id: 's2', name: 'zzz', shareCode: 'nope' },
        ],
        folders: [{ id: 'f1', name: 'Alpha' }],
        teams: [{ id: 't1', name: 'Atlas' }],
        teamFolders: [
          { id: 'tf1', path: 'Root / Area', teamId: 't1', teamName: 'Atlas' },
          { id: 'tf2', path: 'zzz', teamId: 't2', teamName: 'Atlas' },
        ],
        teamLibrary: [
          { id: 'td1', name: '', teamId: 't1', teamName: 'zzz' },
          { id: 'td2', name: 'zzz', teamId: 't1', teamName: 'Atlas' },
        ],
      },
      CONFIG,
    );
    expect(groups.map((g) => g.key)).toEqual(['shared', 'folders', 'teams']);
    expect(groups[0]!.items).toEqual([
      { kind: 'shared', id: 's1', name: 'Untitled page', shareCode: 'code' },
    ]);
    expect(groups[1]!.items).toEqual([{ kind: 'folder', id: 'f1', name: 'Alpha' }]);
    expect(groups[2]!.items).toEqual([
      { kind: 'team', id: 't1', name: 'Atlas' },
      { kind: 'folder', id: 'tf1', name: 'Root / Area', team: { id: 't1', name: 'Atlas' } },
      { kind: 'folder', id: 'tf2', name: 'zzz', team: { id: 't2', name: 'Atlas' } },
      { kind: 'file', id: 'td1', name: 'Untitled page', team: { id: 't1', name: 'zzz' } },
      { kind: 'file', id: 'td2', name: 'zzz', team: { id: 't1', name: 'Atlas' } },
    ]);
  });

  it("lists every app's finds on a non-empty query only", () => {
    const workspaceItems = [
      { id: 'w1', title: '', app: 'liveplanner' as const, sharedVia: null },
      { id: 'w2', title: 'Roadmap', app: 'livediagram' as const, sharedVia: 'code' },
    ];
    expect(buildEditorSearchResults({ ...base, query: ' ', workspaceItems }, CONFIG)).toEqual([]);
    expect(buildEditorSearchResults({ ...base, query: 'r', workspaceItems: [] }, CONFIG)).toEqual(
      [],
    );
    expect(buildEditorSearchResults({ ...base, query: 'r', workspaceItems }, CONFIG)).toEqual([
      {
        key: 'workspace',
        label: 'Every App',
        items: [
          { kind: 'workspace', id: 'w1', name: 'Untitled', app: 'liveplanner', sharedVia: null },
          { kind: 'workspace', id: 'w2', name: 'Roadmap', app: 'livediagram', sharedVia: 'code' },
        ],
      },
    ]);
  });

  it("lists tabs, then the editor's own tab groups, then elements by label", () => {
    const tabs: T[] = [
      {
        id: 't1',
        name: 'Plan',
        elements: [
          { id: 'e1', type: 'shape', label: ' Plan box ' },
          { id: 'e2', type: 'shape', label: '   ' },
          { id: 'e3', type: 'text' },
          { id: 'e4', type: 'shape', label: 'Other' },
        ],
      },
      { id: 't2', name: 'Notes', elements: [] },
    ];
    const groups = buildEditorSearchResults(
      {
        ...base,
        query: 'plan',
        tabs,
        currentTabId: 't1',
        tabGroups: (q, ts) => [{ key: 'own', label: `${q}:${ts.length}`, items: [] }],
      },
      CONFIG,
    );
    expect(groups).toEqual([
      {
        key: 'tabs',
        label: 'Tabs',
        items: [{ kind: 'tab', id: 't1', name: 'Plan', isCurrent: true }],
      },
      { key: 'own', label: 'plan:2', items: [] },
      {
        key: 'elements',
        label: 'Elements',
        items: [
          {
            kind: 'element',
            tabId: 't1',
            tabName: 'Plan',
            elementId: 'e1',
            label: 'Plan box',
            type: 'shape',
          },
        ],
      },
    ]);
    // No match among the tabs: neither group, and the tab groups still asked.
    expect(buildEditorSearchResults({ ...base, query: 'zzz', tabs }, CONFIG)).toEqual([]);
    expect(
      buildEditorSearchResults({ ...base, query: 'notes', tabs }, CONFIG).map(
        (g) => g.items.length,
      ),
    ).toEqual([1]);
  });

  it("finds a table by its first matching cell where the editor asks, never where it doesn't", () => {
    const tabs: T[] = [
      {
        id: 't1',
        name: 'Data',
        elements: [
          { id: 'tb', type: 'table', cells: [['', ' Revenue '], ['Revenue 2']] },
          { id: 'tn', type: 'table', cells: [['cost']] },
          { id: 'tl', type: 'table', label: 'Revenue table', cells: [] },
        ],
      },
    ];
    const withCells = buildEditorSearchResults({ ...base, query: 'revenue', tabs }, CONFIG);
    expect(withCells[0]!.items.map((i) => ('label' in i ? i.label : ''))).toEqual([
      'Revenue',
      'Revenue table',
    ]);
    const without = buildEditorSearchResults(
      { ...base, query: 'revenue', tabs },
      { ...CONFIG, tableCells: false },
    );
    expect(without[0]!.items.map((i) => ('label' in i ? i.label : ''))).toEqual(['Revenue table']);
  });

  it('stops the element walk at twelve', () => {
    const tabs: T[] = [0, 1].map((t) => ({
      id: `t${t}`,
      name: `Tab ${t}`,
      elements: Array.from({ length: 10 }, (_, i) => ({
        id: `${t}-${i}`,
        type: 'shape',
        label: 'box',
      })),
    }));
    const [elements] = buildEditorSearchResults({ ...base, query: 'box', tabs }, CONFIG);
    expect(elements!.items).toHaveLength(12);
  });

  it('matches actions, settings and help on every word, on a non-empty query only', () => {
    const commandItems = [
      { id: 'c1', name: 'Export', keywords: 'png image' },
      { id: 'c2', name: 'Delete', keywords: 'remove' },
    ];
    const settingItems = [
      {
        id: 's1',
        title: 'Theme',
        keywords: 'dark light',
        categoryId: 'look',
        categoryLabel: 'Appearance',
        rowKey: 'theme',
      },
    ];
    const helpItems = [
      { id: 'h1', title: 'Export a picture', keywords: 'png', href: '/help/x', leaf: 'x' },
    ];
    const all = { ...base, commandItems, settingItems, helpItems };
    expect(buildEditorSearchResults({ ...all, query: '' }, CONFIG)).toEqual([]);
    expect(
      buildEditorSearchResults(
        { ...base, query: 'x', commandItems: [], settingItems: [], helpItems: [] },
        CONFIG,
      ),
    ).toEqual([]);
    expect(buildEditorSearchResults({ ...all, query: 'zzz' }, CONFIG)).toEqual([]);
    expect(buildEditorSearchResults({ ...all, query: 'export png' }, CONFIG)).toEqual([
      { key: 'commands', label: 'Actions', items: [{ kind: 'command', id: 'c1', name: 'Export' }] },
      {
        key: 'help',
        label: 'Help',
        items: [{ kind: 'help', id: 'h1', name: 'Export a picture', href: '/help/x', leaf: 'x' }],
      },
    ]);
    expect(buildEditorSearchResults({ ...all, query: 'dark' }, CONFIG)).toEqual([
      {
        key: 'settings',
        label: 'Settings',
        items: [
          {
            kind: 'setting',
            id: 's1',
            name: 'Theme',
            categoryId: 'look',
            categoryLabel: 'Appearance',
            rowKey: 'theme',
          },
        ],
      },
    ]);
  });

  it('ranks palette picks by the name, a word found across name and keywords last', () => {
    const paletteItems = [
      { id: 'entity', name: 'Entity', keywords: 'table database', add: 'entity' },
      { id: 'tablet', name: 'Tablet', keywords: '', add: 'tablet' },
      { id: 'table', name: 'Table', keywords: '', add: 'table' },
      { id: 'cloth', name: 'Tablecloth', keywords: '', add: 'cloth' },
      { id: 'cyl', name: 'Cylinder', keywords: 'database store', add: 'cyl' },
      { id: 'none', name: 'Circle', keywords: '', add: 'none' },
    ];
    expect(buildEditorSearchResults({ ...base, query: '', paletteItems }, CONFIG)).toEqual([]);
    expect(buildEditorSearchResults({ ...base, query: 'x', paletteItems: [] }, CONFIG)).toEqual([]);
    expect(buildEditorSearchResults({ ...base, query: 'zzz', paletteItems }, CONFIG)).toEqual([]);
    const [table] = buildEditorSearchResults({ ...base, query: 'table', paletteItems }, CONFIG);
    expect(table!.key).toBe('palette');
    expect(table!.label).toBe('Add to canvas');
    expect(table!.items.map((i) => ('id' in i ? i.id : ''))).toEqual([
      'table',
      'tablet',
      'cloth',
      'entity',
    ]);
    // Words split across the name and keywords: keyword-only rank.
    const [split] = buildEditorSearchResults(
      { ...base, query: 'cylinder store', paletteItems },
      CONFIG,
    );
    expect(split!.items).toEqual([{ kind: 'palette', id: 'cyl', name: 'Cylinder', add: 'cyl' }]);
  });
});
