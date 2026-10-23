// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// A design's Explorer menu for a surface that names designs by id (Home's Jump Back In, the Timeline's cards):
// the id resolves against the Explorer's loaded lists (personal, team, shared with you), the Explorer's actions bind
// to it, and a design that leaves the lists reads as gone (docs/specs/013-workspace/explorer-home.md).

vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineIdSync: (id: string) => id.startsWith('off-'),
}));

import { ExplorerProvider } from './ExplorerContext';
import type { ExplorerStateValue } from './useExplorerState';
import { useDesignEntryFor, useExplorerDesignsById } from './useDesignEntryFor';

const doc = (id: string, name = id) => ({ id, name, ownerId: 'me', savedAt: 1 });

function explorer(over: Partial<Record<string, unknown>> = {}) {
  return {
    ownerId: 'me',
    designs: [doc('mine', 'Mine'), doc('off-1', 'Local')],
    teamDesigns: [doc('team', 'Team doc')],
    shared: [
      {
        id: 'theirs',
        name: 'Theirs',
        ownerName: 'Ann',
        role: 'editor',
        shareCode: 'S',
        savedAt: 1,
      },
    ],
    renamingDesignId: null,
    setRenamingDesignId: vi.fn(),
    renameDesign: vi.fn(),
    deleteDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    openMovePickerForDesign: vi.fn(),
    dismissShared: vi.fn(),
    favouriteIds: new Set(['mine']),
    toggleFavourite: vi.fn(),
    prefs: { recentExcludedIds: ['team'] },
    toggleRecentExclusion: vi.fn(),
    ...over,
  };
}

function setup(value: ReturnType<typeof explorer>, onShowHistory = vi.fn()) {
  const holder = { value };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={holder.value as unknown as ExplorerStateValue}>
      {children}
    </ExplorerProvider>
  );
  const hook = renderHook(() => useDesignEntryFor({ onShowHistory }), { wrapper });
  return {
    hook,
    rerenderWith: (next: ReturnType<typeof explorer>) => {
      holder.value = next;
      hook.rerender();
    },
  };
}

describe('useExplorerDesignsById', () => {
  it('holds personal, team and shared-with-you designs by id', () => {
    const value = explorer();
    const { result } = renderHook(() => useExplorerDesignsById(), {
      wrapper: ({ children }) => (
        <ExplorerProvider value={value as unknown as ExplorerStateValue}>
          {children}
        </ExplorerProvider>
      ),
    });
    expect([...result.current.keys()]).toEqual(['mine', 'off-1', 'team', 'theirs']);
    expect(result.current.get('theirs')?.shared?.shareCode).toBe('S');
  });
});

describe('useDesignEntryFor', () => {
  it('resolves a loaded design and binds the Explorer actions to it', () => {
    const value = explorer();
    const { hook } = setup(value);
    const e = hook.result.current.entryFor('mine')!;
    expect(e.design.name).toBe('Mine');
    expect(e.favourite).toBe(true);
    expect(e.recentExcluded).toBe(false);
    e.onStartRename();
    e.onCommitRename('New');
    e.onCancelRename();
    e.onDuplicate();
    e.onDelete();
    e.onMove(null);
    e.onToggleFavourite?.();
    e.onToggleRecentExclusion?.();
    expect(value.setRenamingDesignId).toHaveBeenNthCalledWith(1, 'mine');
    expect(value.setRenamingDesignId).toHaveBeenNthCalledWith(2, null);
    expect(value.renameDesign).toHaveBeenCalledWith('mine', 'New');
    expect(value.duplicateDesign).toHaveBeenCalledWith('mine');
    expect(value.deleteDesign).toHaveBeenCalledWith('mine');
    expect(value.openMovePickerForDesign).toHaveBeenCalledWith('mine', null);
    expect(value.toggleFavourite).toHaveBeenCalledWith('mine');
    expect(value.toggleRecentExclusion).toHaveBeenCalledWith('mine');
    expect(e.onDismiss).toBeUndefined();
  });

  it('marks the design being renamed and the ones hidden from Recent', () => {
    const { hook } = setup(explorer({ renamingDesignId: 'team' }));
    expect(hook.result.current.entryFor('team')!.renaming).toBe(true);
    expect(hook.result.current.entryFor('team')!.recentExcluded).toBe(true);
    expect(hook.result.current.entryFor('mine')!.renaming).toBe(false);
  });

  it('gives a design shared with you its dismiss', () => {
    const value = explorer();
    const { hook } = setup(value);
    hook.result.current.entryFor('theirs')!.onDismiss!();
    expect(value.dismissShared).toHaveBeenCalledWith('theirs');
  });

  it('offers History for a server design, not for one stored only in this browser', () => {
    const onShowHistory = vi.fn();
    const { hook } = setup(explorer(), onShowHistory);
    hook.result.current.entryFor('mine')!.onShowHistory!();
    expect(onShowHistory).toHaveBeenCalledWith('mine', 'Mine');
    expect(hook.result.current.entryFor('off-1')!.onShowHistory).toBeUndefined();
  });

  it('resolves nothing for a design the Explorer has not loaded', () => {
    const { hook } = setup(explorer());
    expect(hook.result.current.entryFor('elsewhere')).toBeNull();
    expect(hook.result.current.isGone('elsewhere')).toBe(false);
  });

  it('reads a design that left the lists as gone, and not once it comes back', () => {
    const { hook, rerenderWith } = setup(explorer());
    expect(hook.result.current.isGone('mine')).toBe(false);
    rerenderWith(explorer({ designs: [doc('off-1', 'Local')] }));
    expect(hook.result.current.isGone('mine')).toBe(true);
    expect(hook.result.current.entryFor('mine')).toBeNull();
    rerenderWith(explorer());
    expect(hook.result.current.isGone('mine')).toBe(false);
  });
});
