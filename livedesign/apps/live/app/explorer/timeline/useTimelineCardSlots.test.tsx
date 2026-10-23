// @vitest-environment jsdom

// The Explorer's additions to a Timeline card (docs/specs/013-workspace/timeline.md §2.8, §2.9): a
// menu on every card (each can be removed from the feed), the full
// design menu for a design the Explorer has loaded, a rename input in
// the title slot while that design is being renamed, and the design's
// CURRENT name as the subject.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TimelineEvent } from '@livedesign/ui';
import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { useTimelineCardSlots } from './useTimelineCardSlots';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function explorer(over: Partial<ExplorerStateValue> = {}): ExplorerStateValue {
  return {
    ownerId: 'me',
    designs: [
      { id: 'd1', name: 'Payments v2', folderId: null, savedAt: 1, shareCode: null, ownerId: 'me' },
    ],
    teamDesigns: [],
    shared: [
      {
        id: 's1',
        name: 'Theirs',
        savedAt: 1,
        role: 'view',
        shareCode: 'abc',
        ownerName: 'Priya',
        ownerColor: null,
      },
    ],
    renamingDesignId: null,
    setRenamingDesignId: vi.fn(),
    renameDesign: vi.fn(),
    deleteDesign: vi.fn(),
    duplicateDesign: vi.fn(),
    openMovePickerForDesign: vi.fn(),
    dismissShared: vi.fn(),
    favouriteIds: new Set<string>(),
    toggleFavourite: vi.fn(),
    prefs: {},
    toggleRecentExclusion: vi.fn(),
    folderById: new Map([['f1', { id: 'f1', name: 'Q3 Plans', parentId: null }]]),
    folderActions: vi.fn(() => ({
      rename: vi.fn(),
      newSubfolder: vi.fn(),
      move: vi.fn(),
      delete: vi.fn(),
    })),
    renamingFolderId: null,
    setRenamingFolderId: vi.fn(),
    commitRenameFolder: vi.fn(),
    ...over,
  } as unknown as ExplorerStateValue;
}

function event(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'e',
    sourceType: 'design',
    sourceId: 'd1',
    eventType: 'design_created',
    title: 'Design Created',
    description: null,
    occurredAt: 1,
    actorId: 'me',
    snapshot: { designId: 'd1', designName: 'Payments' },
    ...over,
  };
}

function slotsFor(value: ExplorerStateValue, onDismiss = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
  return renderHook(
    () =>
      useTimelineCardSlots({
        onShowHistory: vi.fn(),
        onDismiss,
        entityMenu: (event) =>
          event.sourceType === 'team' ? { subject: 'Guild', items: [] } : null,
      }),
    { wrapper },
  ).result.current;
}

describe('useTimelineCardSlots', () => {
  it('adds a menu and the current name for a design the Explorer knows', () => {
    const slots = slotsFor(explorer())(event({}));
    expect(slots?.menu).toBeTruthy();
    expect(slots?.subject).toBe('Payments v2');
    expect(slots?.onContextMenu).toBeTypeOf('function');
    expect(slots?.title).toBeUndefined();
  });

  // Every card can be removed from the feed (docs/specs/013-workspace/timeline.md §2.9), so every
  // card has a menu — but only a loaded design's card borrows the
  // Explorer's name for the subject; the rest keep the renderer's.
  it('gives a tombstone and an unloaded design the entity menu, with no rename slot', () => {
    const slots = slotsFor(explorer());
    for (const e of [
      event({ snapshot: { designName: 'Gone' } }),
      event({ snapshot: { designId: 'unknown', designName: 'X' } }),
    ]) {
      const s = slots(e);
      expect(s?.menu).toBeTruthy();
      expect(s?.onContextMenu).toBeTypeOf('function');
      expect(s?.subject).toBeUndefined();
      expect(s?.title).toBeUndefined();
    }
  });

  it('takes the subject and verbs for other entities from the entity menu', () => {
    const s = slotsFor(explorer())(
      event({ sourceType: 'team', snapshot: { teamId: 't1', teamName: 'Old name' } }),
    );
    expect(s?.subject).toBe('Guild');
    expect((s!.menu as { props: { subject: string } }).props.subject).toBe('Guild');
  });

  // A folder card carries the folder's own Explorer menu (rename, new
  // subfolder, move, delete) plus the remove verb, and its current name.
  it('gives a folder the Explorer knows its folder menu and current name', () => {
    const value = explorer();
    const slots = slotsFor(value)(
      event({
        sourceType: 'account',
        eventType: 'folder_created',
        title: 'Folder Created',
        snapshot: { folderId: 'f1', folderName: 'Q3' },
      }),
    );
    expect(slots?.subject).toBe('Q3 Plans');
    expect(slots?.onContextMenu).toBeTypeOf('function');
    const menu = slots!.menu as { props: { folder?: { id: string } } };
    expect(menu.props.folder?.id).toBe('f1');
  });

  it('puts a rename input in the title slot while that folder is being renamed', () => {
    const slots = slotsFor(explorer({ renamingFolderId: 'f1' }))(
      event({
        sourceType: 'account',
        eventType: 'folder_created',
        snapshot: { folderId: 'f1', folderName: 'Q3' },
      }),
    );
    expect(slots?.title).toBeTruthy();
    expect(slots?.onContextMenu).toBeUndefined();
  });

  it('falls back to the one-verb menu for a folder tombstone', () => {
    const slots = slotsFor(explorer())(
      event({
        sourceType: 'account',
        eventType: 'folder_deleted',
        snapshot: { folderName: 'Gone' },
      }),
    );
    expect(slots?.menu).toBeTruthy();
    const menu = slots!.menu as { props: { folder?: unknown; design?: unknown } };
    expect(menu.props.folder).toBeUndefined();
    expect(menu.props.design).toBeUndefined();
  });

  it('resolves a shared-with-you design too', () => {
    const slots = slotsFor(explorer())(
      event({ snapshot: { designId: 's1', designName: 'Theirs' } }),
    );
    expect(slots?.menu).toBeTruthy();
    expect(slots?.subject).toBe('Theirs');
  });

  it('puts a rename input in the title slot while that design is being renamed', () => {
    const slots = slotsFor(explorer({ renamingDesignId: 'd1' }))(event({}));
    expect(slots?.title).toBeTruthy();
    // Right-click is off while renaming: the card's own gesture would
    // fight the input's.
    expect(slots?.onContextMenu).toBeUndefined();
  });
});
