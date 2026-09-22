// @vitest-environment jsdom

// The Explorer's additions to a Timeline card (spec/138 §2.8, §2.9): a
// menu on every card (each can be removed from the feed), the full
// diagram menu for a diagram the Explorer has loaded, a rename input in
// the title slot while that diagram is being renamed, and the diagram's
// CURRENT name as the subject.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/ui';
import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { useTimelineCardSlots } from './useTimelineCardSlots';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function explorer(over: Partial<ExplorerStateValue> = {}): ExplorerStateValue {
  return {
    ownerId: 'me',
    diagrams: [
      { id: 'd1', name: 'Payments v2', folderId: null, savedAt: 1, shareCode: null, ownerId: 'me' },
    ],
    teamDiagrams: [],
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
    renamingDiagramId: null,
    setRenamingDiagramId: vi.fn(),
    renameDiagram: vi.fn(),
    deleteDiagram: vi.fn(),
    duplicateDiagram: vi.fn(),
    openMovePickerForDiagram: vi.fn(),
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
    sourceType: 'diagram',
    sourceId: 'd1',
    eventType: 'diagram_created',
    title: 'Diagram Created',
    description: null,
    occurredAt: 1,
    actorId: 'me',
    snapshot: { diagramId: 'd1', diagramName: 'Payments' },
    ...over,
  } as TimelineEvent;
}

function slotsFor(value: ExplorerStateValue, onDismiss = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
  return renderHook(() => useTimelineCardSlots({ onShowHistory: vi.fn(), onDismiss }), {
    wrapper,
  }).result.current;
}

describe('useTimelineCardSlots', () => {
  it('adds a menu and the current name for a diagram the Explorer knows', () => {
    const slots = slotsFor(explorer())(event({}));
    expect(slots?.menu).toBeTruthy();
    expect(slots?.subject).toBe('Payments v2');
    expect(slots?.onContextMenu).toBeTypeOf('function');
    expect(slots?.title).toBeUndefined();
  });

  // Every card can be removed from the feed (spec/138 §2.9), so every
  // card has a menu — but only a loaded diagram's card borrows the
  // Explorer's name for the subject; the rest keep the renderer's.
  it('gives a non-diagram event, a tombstone, and an unloaded diagram the one-verb menu', () => {
    const slots = slotsFor(explorer());
    for (const e of [
      event({ sourceType: 'team', snapshot: { teamId: 't1', teamName: 'Guild' } }),
      event({ snapshot: { diagramName: 'Gone' } }),
      event({ snapshot: { diagramId: 'unknown', diagramName: 'X' } }),
    ]) {
      const s = slots(e);
      expect(s?.menu).toBeTruthy();
      expect(s?.onContextMenu).toBeTypeOf('function');
      expect(s?.subject).toBeUndefined();
      expect(s?.title).toBeUndefined();
    }
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
    const menu = slots!.menu as { props: { folder?: unknown; diagram?: unknown } };
    expect(menu.props.folder).toBeUndefined();
    expect(menu.props.diagram).toBeUndefined();
  });

  it('resolves a shared-with-you diagram too', () => {
    const slots = slotsFor(explorer())(
      event({ snapshot: { diagramId: 's1', diagramName: 'Theirs' } }),
    );
    expect(slots?.menu).toBeTruthy();
    expect(slots?.subject).toBe('Theirs');
  });

  it('puts a rename input in the title slot while that diagram is being renamed', () => {
    const slots = slotsFor(explorer({ renamingDiagramId: 'd1' }))(event({}));
    expect(slots?.title).toBeTruthy();
    // Right-click is off while renaming: the card's own gesture would
    // fight the input's.
    expect(slots?.onContextMenu).toBeUndefined();
  });
});
