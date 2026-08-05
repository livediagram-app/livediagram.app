// Tab-folder membership reporting (spec/30 + spec/22).
//
// These assertions are about the exact (category, action, type) triple, which
// is not a stylistic detail: a dashboard metric card selects rows by an exact
// `type` match where `null` is a value, so an untyped `Tab·Created` from a
// folder operation lands in the headline "Tabs Created" card and inflates a
// count of tabs with a count of folders. Pinning the triple is the only thing
// standing between that and a public number nobody can reconcile.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));

import { tabFolderTransitionSummary, trackTabFolderTransition } from './tab-folder-reporting';
import { useTabFolders } from './useTabFolders';

beforeEach(() => track.mockReset());

describe('trackTabFolderTransition', () => {
  it('reports joining a folder as a tab move, typed Folder', () => {
    trackTabFolderTransition(null, 'Research');
    expect(track).toHaveBeenCalledWith('Tab', 'Moved', 'Folder');
  });

  it('reports leaving a folder as a tab removal, typed Folder', () => {
    trackTabFolderTransition('Research', null);
    expect(track).toHaveBeenCalledWith('Tab', 'Removed', 'Folder');
  });

  it('reports folder-to-folder as a move (it landed somewhere)', () => {
    trackTabFolderTransition('Research', 'Archive');
    expect(track).toHaveBeenCalledWith('Tab', 'Moved', 'Folder');
  });

  it('never emits the untyped Tab events the metric cards count', () => {
    trackTabFolderTransition(null, 'Research');
    trackTabFolderTransition('Research', null);
    for (const call of track.mock.calls) expect(call[2]).toBe('Folder');
  });

  it('emits nothing when the membership did not actually change', () => {
    trackTabFolderTransition('Research', 'Research');
    trackTabFolderTransition(null, null);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('tabFolderTransitionSummary', () => {
  it('names the destination when the tab landed in a folder', () => {
    expect(tabFolderTransitionSummary(null, 'Research')).toBe("Moved tab to folder 'Research'");
  });

  it('names the folder left behind when the tab became loose', () => {
    expect(tabFolderTransitionSummary('Research', null)).toBe("Removed tab from folder 'Research'");
  });
});

// useTabFolders holds no React state of its own (it returns closures over the
// deps object), so the folder-lifecycle events can be driven directly without a
// renderer. Only the telemetry triples are asserted here — the membership
// mutation itself belongs to normalizeFolderOrder, tested in the diagram package.
describe('useTabFolders folder lifecycle', () => {
  const tabs = [
    { id: 't1', name: 'One', elements: [] },
    { id: 't2', name: 'Two', elements: [], folder: 'Research' },
  ] as unknown as Parameters<typeof useTabFolders>[0]['tabs'];

  // Named as a hook so react-hooks/rules-of-hooks accepts the call site; it is
  // one, it just happens to be exercised without a renderer.
  const useFolderActions = () =>
    useTabFolders({ tabs, activeId: 't1', commitTabs: () => {}, emitTabMeta: () => {} });

  it('a brand-new folder name emits the folder creation AND the tab move', () => {
    useFolderActions().moveTabToFolder('t1', 'Archive');
    expect(track.mock.calls).toEqual([
      ['Folder', 'Created', 'Tab'],
      ['Tab', 'Moved', 'Folder'],
    ]);
  });

  it('an existing folder name emits only the tab move', () => {
    useFolderActions().moveTabToFolder('t1', 'Research');
    expect(track.mock.calls).toEqual([['Tab', 'Moved', 'Folder']]);
  });

  it('renaming a folder is a Folder event, not a Tab one', () => {
    useFolderActions().renameFolder('Research', 'Archive');
    expect(track.mock.calls).toEqual([['Folder', 'Renamed', 'Tab']]);
  });

  it('taking a tab out of its folder is a typed Tab removal', () => {
    useFolderActions().removeTabFromFolder('t2');
    expect(track.mock.calls).toEqual([['Tab', 'Removed', 'Folder']]);
  });

  it('a no-op (already in that folder) emits nothing', () => {
    useFolderActions().moveTabToFolder('t2', 'Research');
    useFolderActions().moveTabToFolder('t1', '   ');
    expect(track).not.toHaveBeenCalled();
  });
});
