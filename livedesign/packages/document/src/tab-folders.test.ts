import { describe, expect, it } from 'vitest';
import {
  folderNamesInDocument,
  groupTabsIntoRuns,
  normalizeFolderOrder,
  tabFolderName,
  type Tab,
} from './index';

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
