// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { useTimelineLanes } from './useTimelineLanes';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The timeline-lanes switch (spec/139 Phase 6). The geometry is pinned in
// @livediagram/diagram; what is tested here is the SWITCH: what it writes, what
// it remembers, what it refuses, and that the telemetry leaves before the flip.

function note(id: string, x: number, y: number): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200 } as StickyElement;
}

function harness(
  opts: {
    esTimeline?: Tab['esTimeline'];
    esBoard?: boolean;
    editsBlocked?: boolean;
    elements?: Element[];
    inertIds?: Set<string>;
  } = {},
) {
  let tabs: Tab[] = [
    {
      id: 't1',
      name: 'Board',
      kind: 'event-storming',
      elements: opts.elements ?? [note('a', 500, 300), note('b', 120, 80)],
      ...(opts.esTimeline ? { esTimeline: opts.esTimeline } : {}),
    } as Tab,
    { id: 't2', name: 'Other', elements: [] } as Tab,
  ];
  const meta: { tabId: string; summary: string }[] = [];
  const view = renderHook(() =>
    useTimelineLanes({
      activeId: 't1',
      activeTab: tabs[0]!,
      esBoard: opts.esBoard ?? true,
      editsBlocked: opts.editsBlocked ?? false,
      layerInertIds: opts.inertIds ?? new Set<string>(),
      commitTabs: (map) => {
        tabs = map(tabs);
        return 1;
      },
      emitTabMeta: (tabId, summary) => meta.push({ tabId, summary }),
    }),
  );
  return {
    api: () => view.result.current,
    tab: () => tabs[0]!,
    otherTab: () => tabs[1]!,
    meta,
    rerender: () => view.rerender(),
  };
}

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe('useTimelineLanes', () => {
  it('is off, and available, on a fresh event-storming board', () => {
    const h = harness();
    expect(h.api().lanesOn).toBe(false);
    expect(h.api().lanesAvailable).toBe(true);
    expect(h.api().lanesDisabled).toBe(false);
  });

  it('anchors the stack on the top-most note when lanes come on', () => {
    const h = harness();
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toEqual({ originX: 120, originY: 80, enabled: true });
  });

  it('anchors at the canvas origin on an empty board', () => {
    const h = harness({ elements: [] });
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toEqual({ originX: 0, originY: 0, enabled: true });
  });

  it('cannot be anchored by a note on a hidden layer', () => {
    const h = harness({
      elements: [note('hidden', 0, -400), note('b', 120, 80)],
      inertIds: new Set(['hidden']),
    });
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toMatchObject({ originX: 120, originY: 80 });
  });

  it('moves NOT ONE note when lanes come on', () => {
    const before = [note('a', 500, 300), note('b', 120, 80)];
    const h = harness({ elements: before });
    h.api().toggleLanes();
    expect(h.tab().elements).toEqual(before);
  });

  it('switches off without forgetting where the lanes were', () => {
    const h = harness({ esTimeline: { originX: 120, originY: 80, enabled: true } });
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toEqual({ originX: 120, originY: 80, enabled: false });
  });

  it('re-uses the STORED origin when lanes come back on', () => {
    // The board has moved on since: the top-left note is somewhere else now.
    const h = harness({
      esTimeline: { originX: 120, originY: 80, enabled: false },
      elements: [note('later', -900, -900)],
    });
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toEqual({ originX: 120, originY: 80, enabled: true });
  });

  it('touches no other tab', () => {
    const h = harness();
    h.api().toggleLanes();
    expect(h.otherTab().esTimeline).toBeUndefined();
  });

  it('names the act in the activity log', () => {
    const h = harness();
    h.api().toggleLanes();
    expect(h.meta).toEqual([{ tabId: 't1', summary: 'Turned timeline lanes on' }]);
  });

  it('reports the flip BEFORE it lands, so an off still reaches the wire', () => {
    const h = harness({ esTimeline: { originX: 0, originY: 0, enabled: true } });
    h.api().toggleLanes();
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'TimelineLanesOff');
    const h2 = harness();
    h2.api().toggleLanes();
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'TimelineLanesOn');
  });

  it('is not offered on an ordinary board', () => {
    const h = harness({ esBoard: false, esTimeline: { originX: 0, originY: 0, enabled: true } });
    expect(h.api().lanesAvailable).toBe(false);
    // Even a board carrying the field reads as lanes-off when it is not one.
    expect(h.api().lanesOn).toBe(false);
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toEqual({ originX: 0, originY: 0, enabled: true });
  });

  it('refuses to flip in a read-only / locked session, and says so', () => {
    const h = harness({ editsBlocked: true });
    expect(h.api().lanesDisabled).toBe(true);
    h.api().toggleLanes();
    expect(h.tab().esTimeline).toBeUndefined();
    expect(h.meta).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });
});
