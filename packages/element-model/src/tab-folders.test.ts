import { describe, expect, it } from 'vitest';
import {
  folderColourIn,
  folderNamesInDocument,
  groupTabsIntoRuns,
  normalizeFolderOrder,
  tabFolderName,
  tabFolderSummaries,
  tabInFolder,
  withFolderColour,
  withFolderRenamed,
  withTabInFolder,
} from './tab-folders';

// A tab as these helpers see it.
type Tab = { id: string; name: string; elements: unknown[]; folder?: string; folderColor?: string };

// Minimal tab stand-ins; only id + folder matter to these helpers.
const tab = (id: string, folder?: string): Tab => ({ id, name: id, elements: [], folder });

const ids = (tabs: Pick<Tab, 'id'>[]) => tabs.map((t) => t.id);

describe('tabFolderName', () => {
  it('returns null for unset, empty, and whitespace-only names', () => {
    expect(tabFolderName(tab('a'))).toBeNull();
    expect(tabFolderName(tab('a', ''))).toBeNull();
    expect(tabFolderName(tab('a', '   '))).toBeNull();
  });

  it('trims the name', () => {
    expect(tabFolderName(tab('a', '  Org '))).toBe('Org');
  });
});

describe('normalizeFolderOrder', () => {
  it('groups a folder at the position of its first member, keeping intra-folder order', () => {
    // Intro(loose) Sales(Org) Notes(loose) Team(Org)
    const input = [tab('intro'), tab('sales', 'Org'), tab('notes'), tab('team', 'Org')];
    expect(ids(normalizeFolderOrder(input))).toEqual(['intro', 'sales', 'team', 'notes']);
  });

  it('interleaves multiple folders by their first-member anchor', () => {
    const input = [
      tab('a', 'Plans'),
      tab('b', 'Org'),
      tab('c', 'Plans'),
      tab('d'),
      tab('e', 'Org'),
    ];
    // Plans anchors at 0, Org at 1, loose d at 3.
    expect(ids(normalizeFolderOrder(input))).toEqual(['a', 'c', 'b', 'e', 'd']);
  });

  it('is a no-op (same array reference) when already normalized', () => {
    const input = [tab('a', 'Org'), tab('b', 'Org'), tab('c')];
    expect(normalizeFolderOrder(input)).toBe(input);
  });

  it('reuses the same tab objects on reorder (identity preserved)', () => {
    const sales = tab('sales', 'Org');
    const team = tab('team', 'Org');
    const input = [tab('intro'), sales, tab('notes'), team];
    const out = normalizeFolderOrder(input);
    expect(out).not.toBe(input);
    expect(out).toContain(sales);
    expect(out).toContain(team);
  });

  it('is idempotent', () => {
    const input = [tab('a', 'Plans'), tab('b', 'Org'), tab('c', 'Plans'), tab('d')];
    const once = normalizeFolderOrder(input);
    expect(normalizeFolderOrder(once)).toBe(once);
  });

  it('treats whitespace-only folder names as loose', () => {
    const input = [tab('a', 'Org'), tab('b', '  '), tab('c', 'Org')];
    // b is loose, anchored at index 1, so it stays between the Org run's members... but
    // the Org run anchors at 0, so both Org tabs sort before b's own index of 1? No:
    // a(anchor0,idx0) c(anchor0,idx2) b(anchor1,idx1) -> a, c, b
    expect(ids(normalizeFolderOrder(input))).toEqual(['a', 'c', 'b']);
  });

  it('handles a single-tab folder', () => {
    const input = [tab('a'), tab('b', 'Solo'), tab('c')];
    expect(normalizeFolderOrder(input)).toBe(input);
  });
});

describe('groupTabsIntoRuns', () => {
  it('coalesces adjacent same-folder tabs and leaves loose tabs as singletons', () => {
    const input = [tab('intro'), tab('sales', 'Org'), tab('team', 'Org'), tab('notes')];
    const runs = groupTabsIntoRuns(input);
    expect(runs).toHaveLength(3);
    expect(runs[0]).toEqual({ kind: 'loose', tab: input[0] });
    const folderRun = runs[1];
    expect(folderRun?.kind).toBe('folder');
    if (folderRun?.kind !== 'folder') throw new Error('expected folder run');
    expect(folderRun.name).toBe('Org');
    expect(ids(folderRun.tabs)).toEqual(['sales', 'team']);
    expect(runs[2]).toEqual({ kind: 'loose', tab: input[3] });
  });

  it('starts a new run when the same name reappears non-adjacently', () => {
    // Pre-normalization this can happen; grouping does not merge across a gap.
    const input = [tab('a', 'Org'), tab('b'), tab('c', 'Org')];
    const runs = groupTabsIntoRuns(input);
    expect(runs.map((r) => r.kind)).toEqual(['folder', 'loose', 'folder']);
  });
});

describe('folderNamesInDocument', () => {
  it('lists distinct folder names in first-appearance order', () => {
    const input = [tab('a', 'Org'), tab('b', 'Plans'), tab('c', 'Org'), tab('d')];
    expect(folderNamesInDocument(input)).toEqual(['Org', 'Plans']);
  });

  it('ignores loose and whitespace-only tabs', () => {
    expect(folderNamesInDocument([tab('a'), tab('b', '  ')])).toEqual([]);
  });
});

describe('folder colours', () => {
  const coloured = (id: string, folder?: string, folderColor?: string): Tab => ({
    ...tab(id, folder),
    folderColor,
  });
  const colours = (tabs: Tab[]) => tabs.map((t) => [t.id, t.folder, t.folderColor]);

  it("reads a folder's colour from its first member that has one", () => {
    const tabs = [coloured('a', 'F'), coloured('b', 'F', 'rose'), coloured('c', 'F', 'cyan')];
    expect(folderColourIn(tabs, 'F')).toBe('rose');
    expect(folderColourIn(tabs, 'F', tabs[1])).toBe('cyan');
    expect(folderColourIn(tabs, 'G')).toBeNull();
  });

  it('summarises every folder with its count and colour, in bar order', () => {
    const tabs = [
      coloured('a', 'Plans'),
      coloured('b', 'Plans', 'amber'),
      coloured('e', 'Plans', 'rose'),
      coloured('c'),
      coloured('d', 'Org', 'blue'),
    ];
    expect(tabFolderSummaries(tabs)).toEqual([
      { name: 'Plans', count: 3, colour: 'amber' },
      { name: 'Org', count: 1, colour: 'blue' },
    ]);
  });

  it('gives a tab the colour of the folder it joins, and none when loose', () => {
    const tabs = [coloured('a', 'F', 'rose'), coloured('b')];
    expect(tabInFolder(tabs[1]!, 'F', tabs).folderColor).toBe('rose');
    expect(tabInFolder(tabs[0]!, null, tabs)).toMatchObject({
      folder: undefined,
      folderColor: undefined,
    });
    expect(tabInFolder(tabs[0]!, 'F', tabs)).toBe(tabs[0]);
    expect(tabInFolder(tabs[1]!, 'New', tabs).folderColor).toBeUndefined();
  });

  it('stores a chosen colour for a new folder only', () => {
    const tabs = [coloured('a', 'F', 'rose'), coloured('b'), coloured('c')];
    expect(colours(withTabInFolder(tabs, 'b', 'New', 'cyan'))).toContainEqual(['b', 'New', 'cyan']);
    expect(colours(withTabInFolder(tabs, 'b', 'New'))).toContainEqual(['b', 'New', undefined]);
    // An existing folder keeps its own colour, whatever was chosen.
    expect(colours(withTabInFolder(tabs, 'c', 'F', 'cyan'))).toContainEqual(['c', 'F', 'rose']);
    // Already there: nothing changes.
    expect(withTabInFolder(tabs, 'a', 'F', 'cyan')).toBe(tabs);
  });

  it('keeps the colour on a rename, and takes the target folder colour on a merge', () => {
    const tabs = [
      coloured('a', 'F', 'rose'),
      coloured('b', 'F', 'rose'),
      coloured('c', 'G', 'cyan'),
    ];
    expect(colours(withFolderRenamed(tabs, 'F', 'Renamed'))).toEqual([
      ['a', 'Renamed', 'rose'],
      ['b', 'Renamed', 'rose'],
      ['c', 'G', 'cyan'],
    ]);
    expect(colours(withFolderRenamed(tabs, 'F', 'G'))).toEqual([
      ['a', 'G', 'cyan'],
      ['b', 'G', 'cyan'],
      ['c', 'G', 'cyan'],
    ]);
    const automatic = [coloured('a', 'F'), coloured('b', 'G')];
    expect(colours(withFolderRenamed(automatic, 'F', 'G'))).toEqual([
      ['a', 'G', undefined],
      ['b', 'G', undefined],
    ]);
  });

  it("sets a folder's colour on every member, back to Automatic with null", () => {
    const tabs = [coloured('a', 'F'), coloured('b', 'F', 'amber'), coloured('c')];
    const set = withFolderColour(tabs, 'F', 'amber');
    expect(colours(set)).toEqual([
      ['a', 'F', 'amber'],
      ['b', 'F', 'amber'],
      ['c', undefined, undefined],
    ]);
    expect(set[1]).toBe(tabs[1]);
    expect(set[2]).toBe(tabs[2]);
    expect(colours(withFolderColour(set, 'F', null))).toEqual([
      ['a', 'F', undefined],
      ['b', 'F', undefined],
      ['c', undefined, undefined],
    ]);
  });
});
