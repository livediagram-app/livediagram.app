// @vitest-environment jsdom

// The Explorer's menu on a collapsed stack (docs/specs/013-workspace/timeline.md §2.9): one verb
// that removes every member at once.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent, TimelineStack } from '@livediagram/ui';
import { useTimelineStackSlots } from './useTimelineStackSlots';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function event(id: string): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: id,
    eventType: 'diagram_renamed',
    title: 'Diagram Renamed',
    description: null,
    occurredAt: 1,
    actorId: 'me',
    snapshot: { diagramId: id, diagramName: id },
  } as TimelineEvent;
}

const stack: TimelineStack = {
  key: 'a',
  bucket: 'diagram::diagram_renamed',
  events: [event('a'), event('b'), event('c')],
};

describe('useTimelineStackSlots', () => {
  it('gives a stack a menu and a right-click, and dismisses every member', () => {
    const onDismiss = vi.fn();
    const slots = renderHook(() => useTimelineStackSlots({ onDismiss })).result.current(stack);
    expect(slots?.menu).toBeTruthy();
    expect(slots?.onContextMenu).toBeTypeOf('function');
    // The menu's remove handler is wired to the whole run. Reach it
    // through the element's props rather than a full render: the menu
    // itself is the single-card component, tested on its own.
    const props = (slots!.menu as { props: { onRemove: () => void; subject: string } }).props;
    expect(props.subject).toBe('Diagrams Renamed · 3 events');
    props.onRemove();
    expect(onDismiss).toHaveBeenCalledWith(['a', 'b', 'c']);
  });
});
