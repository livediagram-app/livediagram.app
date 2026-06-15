import type { Element, ShapeElement, Tab } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { buildSearchResults, matches } from './search';

const shape = (id: string, label?: string): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  ...(label ? { label } : {}),
});

const tab = (id: string, name: string, elements: Element[] = []): Tab => ({ id, name, elements });

describe('matches', () => {
  it('treats an empty query as a wildcard so the panel pre-opens with everything', () => {
    expect(matches('', 'anything')).toBe(true);
  });

  it('matches case-insensitively so "FLOW" hits "Flowchart"', () => {
    expect(matches('FLOW', 'Flowchart')).toBe(true);
  });

  it('substring matches in the middle of a name', () => {
    expect(matches('chart', 'Flowchart')).toBe(true);
  });

  it('returns false when the needle is not present', () => {
    expect(matches('zzz', 'Flowchart')).toBe(false);
  });
});

describe('buildSearchResults', () => {
  const diagrams = [
    { id: 'd1', name: 'Flowchart' },
    { id: 'd2', name: 'Mind map' },
    { id: 'd3', name: '' }, // untitled, falls back to "Untitled diagram"
  ];
  const folders = [
    { id: 'f1', name: 'Projects' },
    { id: 'f2', name: 'Personal' },
  ];

  it('orders groups: diagrams, folders, tabs, elements', () => {
    const out = buildSearchResults({
      query: '',
      diagrams,
      folders,
      tabs: [tab('t1', 'Tab one', [shape('e1', 'thing')])],
    });
    expect(out.map((g) => g.key)).toEqual(['diagrams', 'folders', 'tabs', 'elements']);
  });

  it('skips groups whose matches are empty rather than rendering empty section headers', () => {
    const out = buildSearchResults({
      query: 'thereisnomatchanywhere',
      diagrams,
      folders,
      tabs: [tab('t1', 'Tab one', [shape('e1', 'thing')])],
    });
    expect(out).toEqual([]);
  });

  it('falls back to "Untitled diagram" for diagrams with empty names', () => {
    const out = buildSearchResults({
      query: 'untitled',
      diagrams,
      folders: [],
    });
    const diagramGroup = out.find((g) => g.key === 'diagrams')!;
    expect(diagramGroup.items).toHaveLength(1);
    expect(diagramGroup.items[0]).toMatchObject({
      kind: 'diagram',
      id: 'd3',
      name: 'Untitled diagram',
    });
  });

  it('marks the current tab in the tabs section so the user knows where they are', () => {
    const out = buildSearchResults({
      query: '',
      diagrams: [],
      folders: [],
      tabs: [tab('t1', 'Tab one'), tab('t2', 'Tab two')],
      currentTabId: 't2',
    });
    const tabGroup = out.find((g) => g.key === 'tabs')!;
    expect(tabGroup.items).toEqual([
      { kind: 'tab', id: 't1', name: 'Tab one', isCurrent: false },
      { kind: 'tab', id: 't2', name: 'Tab two', isCurrent: true },
    ]);
  });

  it("caps diagram + folder + tab matches at 8 each so a giant library doesn't blow up the modal", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `d${i}`, name: `Diagram ${i}` }));
    const manyFolders = Array.from({ length: 25 }, (_, i) => ({
      id: `f${i}`,
      name: `Folder ${i}`,
    }));
    const manyTabs = Array.from({ length: 25 }, (_, i) => tab(`t${i}`, `Tab ${i}`));
    const out = buildSearchResults({
      query: '',
      diagrams: many,
      folders: manyFolders,
      tabs: manyTabs,
    });
    const counts = Object.fromEntries(out.map((g) => [g.key, g.items.length]));
    expect(counts.diagrams).toBe(8);
    expect(counts.folders).toBe(8);
    expect(counts.tabs).toBe(8);
  });

  it('caps element hits at 12 total across all tabs, not per-tab', () => {
    // Each of 4 tabs has 5 labelled shapes (20 candidates); the cap
    // should still land at exactly 12 element hits.
    const tabs = [0, 1, 2, 3].map((ti) =>
      tab(
        `t${ti}`,
        `Tab ${ti}`,
        [0, 1, 2, 3, 4].map((ei) => shape(`t${ti}-e${ei}`, `Label ${ti}-${ei}`)),
      ),
    );
    const out = buildSearchResults({ query: 'label', diagrams: [], folders: [], tabs });
    const elementGroup = out.find((g) => g.key === 'elements');
    expect(elementGroup?.items).toHaveLength(12);
  });

  it('drops elements whose label is empty or whitespace (no matchable content)', () => {
    const t = tab('t1', 'Tab', [shape('e1', ''), shape('e2', '   '), shape('e3', 'real label')]);
    const out = buildSearchResults({ query: '', diagrams: [], folders: [], tabs: [t] });
    const elementGroup = out.find((g) => g.key === 'elements')!;
    expect(elementGroup.items).toHaveLength(1);
    expect(elementGroup.items[0]).toMatchObject({ elementId: 'e3', label: 'real label' });
  });

  it('omits the tabs + elements scope entirely when no tabs are supplied (explorer dashboard case)', () => {
    const out = buildSearchResults({
      query: '',
      diagrams,
      folders,
      // tabs deliberately undefined
    });
    expect(out.map((g) => g.key)).toEqual(['diagrams', 'folders']);
  });

  it('reports the source tab name on element hits so users see "label on Tab name"', () => {
    const out = buildSearchResults({
      query: 'specific',
      diagrams: [],
      folders: [],
      tabs: [tab('t1', 'Architecture', [shape('e1', 'specific component')])],
    });
    const elementGroup = out.find((g) => g.key === 'elements')!;
    expect(elementGroup.items[0]).toMatchObject({
      kind: 'element',
      tabId: 't1',
      tabName: 'Architecture',
      elementId: 'e1',
      label: 'specific component',
      type: 'shape',
    });
  });
});

describe('buildSearchResults — table cells (spec/09 Search panel)', () => {
  const table = (id: string, cells: string[][]): Element =>
    ({ id, type: 'table', x: 0, y: 0, width: 200, height: 100, cells }) as Element;

  it('matches a table by its cell text and surfaces the matching cell as the label', () => {
    const t = tab('t1', 'Tab', [
      table('tbl', [
        ['Owner', 'Status'],
        ['Sasha', 'Blocked on review'],
      ]),
    ]);
    const out = buildSearchResults({ query: 'blocked', diagrams: [], folders: [], tabs: [t] });
    const elementGroup = out.find((g) => g.key === 'elements')!;
    expect(elementGroup.items[0]).toMatchObject({
      kind: 'element',
      elementId: 'tbl',
      label: 'Blocked on review',
      type: 'table',
    });
  });

  it('skips tables whose cells are all empty (nothing matchable)', () => {
    const t = tab('t1', 'Tab', [
      table('tbl', [
        ['', ' '],
        ['', ''],
      ]),
    ]);
    const out = buildSearchResults({ query: '', diagrams: [], folders: [], tabs: [t] });
    expect(out.find((g) => g.key === 'elements')).toBeUndefined();
  });

  it('surfaces a table on the empty query via its first non-empty cell, like labelled elements', () => {
    const t = tab('t1', 'Tab', [table('tbl', [['', 'First cell with text']])]);
    const out = buildSearchResults({ query: '', diagrams: [], folders: [], tabs: [t] });
    const elementGroup = out.find((g) => g.key === 'elements')!;
    expect(elementGroup.items[0]).toMatchObject({
      elementId: 'tbl',
      label: 'First cell with text',
    });
  });
});

describe('buildSearchResults — shared diagrams + teams (spec/09 Search panel)', () => {
  it('matches "Shared with you" rows by name and carries the share code for navigation', () => {
    const out = buildSearchResults({
      query: 'road',
      diagrams: [],
      folders: [],
      shared: [
        { id: 'd1', name: 'Roadmap 2026', shareCode: 'CODE1' },
        { id: 'd2', name: 'Other', shareCode: 'CODE2' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe('shared');
    expect(out[0]!.items[0]).toMatchObject({
      kind: 'shared',
      id: 'd1',
      name: 'Roadmap 2026',
      shareCode: 'CODE1',
    });
  });

  it('matches teams by name', () => {
    const out = buildSearchResults({
      query: 'platform',
      diagrams: [],
      folders: [],
      teams: [
        { id: 'team1', name: 'Platform' },
        { id: 'team2', name: 'Design' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe('teams');
    expect(out[0]!.items[0]).toMatchObject({ kind: 'team', id: 'team1', name: 'Platform' });
  });

  it('keeps the section order: diagrams, shared, folders, teams, tabs, elements', () => {
    const out = buildSearchResults({
      query: '',
      diagrams: [{ id: 'd1', name: 'A' }],
      folders: [{ id: 'f1', name: 'B' }],
      shared: [{ id: 's1', name: 'C', shareCode: 'X' }],
      teams: [{ id: 't1', name: 'D' }],
      tabs: [tab('tab1', 'E', [shape('e1', 'F')])],
    });
    expect(out.map((g) => g.key)).toEqual([
      'diagrams',
      'shared',
      'folders',
      'teams',
      'tabs',
      'elements',
    ]);
  });

  it('omits shared + teams groups entirely when the inputs are absent (guest case)', () => {
    const out = buildSearchResults({ query: '', diagrams: [], folders: [{ id: 'f1', name: 'F' }] });
    expect(out.map((g) => g.key)).toEqual(['folders']);
  });
});

describe('buildSearchResults — team library (spec/35)', () => {
  it('keeps personal folders in "My Work" and team folders/diagrams in "Teams"', () => {
    const out = buildSearchResults({
      query: 'q3',
      diagrams: [],
      folders: [{ id: 'pf', name: 'Q3 planning' }],
      teamFolders: [
        { id: 'tf', path: 'Marketing / Q3', teamId: 'team1', teamName: 'Platform' },
        { id: 'tf2', path: 'Hiring', teamId: 'team1', teamName: 'Platform' },
      ],
      teamDiagrams: [{ id: 'td', name: 'Q3 roadmap', teamId: 'team1', teamName: 'Platform' }],
    });
    // My Work (personal folder) + Teams (team folder + team diagram).
    expect(out.map((g) => g.key)).toEqual(['folders', 'teams']);
    const myWork = out.find((g) => g.key === 'folders')!;
    expect(myWork.label).toBe('My Work');
    expect(myWork.items).toEqual([{ kind: 'folder', id: 'pf', name: 'Q3 planning' }]);
    const teamsGroup = out.find((g) => g.key === 'teams')!;
    expect(teamsGroup.items).toEqual([
      { kind: 'folder', id: 'tf', name: 'Marketing / Q3', team: { id: 'team1', name: 'Platform' } },
      { kind: 'diagram', id: 'td', name: 'Q3 roadmap', team: { id: 'team1', name: 'Platform' } },
    ]);
  });

  it('matches team folders + diagrams by team name too, so "platform" finds the library', () => {
    const out = buildSearchResults({
      query: 'platform',
      diagrams: [],
      folders: [],
      teamFolders: [{ id: 'tf', path: 'Hiring', teamId: 'team1', teamName: 'Platform' }],
      teamDiagrams: [{ id: 'td', name: 'Roadmap', teamId: 'team1', teamName: 'Platform' }],
    });
    const teamsGroup = out.find((g) => g.key === 'teams')!;
    expect(teamsGroup.items).toEqual([
      { kind: 'folder', id: 'tf', name: 'Hiring', team: { id: 'team1', name: 'Platform' } },
      { kind: 'diagram', id: 'td', name: 'Roadmap', team: { id: 'team1', name: 'Platform' } },
    ]);
  });

  it('surfaces palette items as an "Add to canvas" group, matched on name + keywords', () => {
    const paletteItems = [
      {
        id: 'shape:cylinder',
        name: 'Cylinder',
        keywords: 'shape database storage',
        add: { type: 'shape' as const, shapeKind: 'cylinder' as const },
      },
      {
        id: 'tech:aws-s3',
        name: 'S3',
        keywords: 'technology amazon storage bucket',
        add: { type: 'tech' as const, iconId: 'aws-s3' },
      },
    ];
    const out = buildSearchResults({ query: 'storage', diagrams: [], folders: [], paletteItems });
    const palette = out.find((g) => g.key === 'palette')!;
    expect(palette.items.map((i) => (i.kind === 'palette' ? i.id : null))).toEqual([
      'shape:cylinder',
      'tech:aws-s3',
    ]);
  });

  it('does not surface palette items on an empty query (no catalogue dump)', () => {
    const paletteItems = [
      {
        id: 'shape:square',
        name: 'Rectangle',
        keywords: 'shape box',
        add: { type: 'shape' as const, shapeKind: 'square' as const },
      },
    ];
    const out = buildSearchResults({ query: '', diagrams: [], folders: [], paletteItems });
    expect(out.find((g) => g.key === 'palette')).toBeUndefined();
  });
});

describe('buildSearchResults — create-tab action', () => {
  const inDiagram = (query: string) =>
    buildSearchResults({ query, diagrams: [], folders: [], tabs: [tab('t1', 'Overview')] });

  it('surfaces a "Create new tab" action when the query looks like "tab"', () => {
    const out = inDiagram('tab');
    const actions = out.find((g) => g.key === 'actions')!;
    expect(actions.items).toEqual([
      { kind: 'action', id: 'create-tab', name: 'Create new tab', action: 'create-tab' },
    ]);
  });

  it('also matches the "new" keyword', () => {
    expect(inDiagram('new').find((g) => g.key === 'actions')).toBeDefined();
  });

  it('does not surface the action for unrelated queries', () => {
    expect(inDiagram('database').find((g) => g.key === 'actions')).toBeUndefined();
  });

  it('does not surface the action on an empty query', () => {
    expect(inDiagram('').find((g) => g.key === 'actions')).toBeUndefined();
  });

  it('is not offered outside a diagram (no tabs scope)', () => {
    const out = buildSearchResults({ query: 'tab', diagrams: [], folders: [] });
    expect(out.find((g) => g.key === 'actions')).toBeUndefined();
  });

  it('ranks below an existing tab match so navigation keeps the default Enter', () => {
    const out = buildSearchResults({
      query: 'tab',
      diagrams: [],
      folders: [],
      tabs: [tab('t1', 'Tab notes')],
    });
    const keys = out.map((g) => g.key);
    expect(keys.indexOf('tabs')).toBeLessThan(keys.indexOf('actions'));
  });
});
