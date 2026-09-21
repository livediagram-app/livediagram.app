// @vitest-environment jsdom

// The Explorer's additions to a Timeline card (spec/138 §2.8): a menu
// only for a diagram the Explorer has loaded, a rename input in the
// title slot while that diagram is being renamed, and the diagram's
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

function slotsFor(value: ExplorerStateValue) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
  return renderHook(() => useTimelineCardSlots({ onShowHistory: vi.fn() }), { wrapper }).result
    .current;
}

describe('useTimelineCardSlots', () => {
  it('adds a menu and the current name for a diagram the Explorer knows', () => {
    const slots = slotsFor(explorer())(event({}));
    expect(slots?.menu).toBeTruthy();
    expect(slots?.subject).toBe('Payments v2');
    expect(slots?.onContextMenu).toBeTypeOf('function');
    expect(slots?.title).toBeUndefined();
  });

  it('adds nothing for a non-diagram event, a tombstone, or a diagram it has not loaded', () => {
    const slots = slotsFor(explorer());
    expect(slots(event({ sourceType: 'team', snapshot: { teamId: 't1' } }))).toBeUndefined();
    expect(slots(event({ snapshot: { diagramName: 'Gone' } }))).toBeUndefined();
    expect(slots(event({ snapshot: { diagramId: 'unknown', diagramName: 'X' } }))).toBeUndefined();
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
