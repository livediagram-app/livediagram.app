// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ES_GRID_CELL, ES_LANE_HEIGHT, laneTop, type EsTimeline } from '@livediagram/diagram';
import { setLanePreview } from '@/lib/lane-preview';
import { TimelineLanesOverlay } from './TimelineLanesOverlay';

// The lit lane (spec/139 Phase 6). What matters here is that it draws NOTHING
// until a drag has claimed a lane, and that what it draws lands where the drop
// will — canvas coords through the wrapper rect + zoom, the one inversion the
// rest of the canvas chrome uses.

const TIMELINE: EsTimeline = { originX: 0, originY: 0, enabled: true };

function wrapper(left = 0, top = 0) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left, top, width: 1000, height: 1000 }) as DOMRect;
  return { current: el };
}

function draw(opts: { zoom?: number; timeline?: EsTimeline | null } = {}) {
  const { container } = render(
    <TimelineLanesOverlay
      timeline={opts.timeline === undefined ? TIMELINE : opts.timeline}
      tabThemeId="brand"
      viewportZoom={opts.zoom ?? 1}
      wrapperRef={wrapper()}
    />,
  );
  return container;
}

const bands = (c: HTMLElement) => [...c.querySelectorAll('rect')];

afterEach(() => {
  cleanup();
  setLanePreview(null);
});

describe('TimelineLanesOverlay', () => {
  it('draws nothing while no drag has claimed a lane', () => {
    setLanePreview(null);
    expect(draw().querySelector('svg')).toBeNull();
  });

  it('draws nothing on a board whose lanes are off', () => {
    setLanePreview({ laneIndex: 1, cellIndex: 3 });
    expect(draw({ timeline: null }).querySelector('svg')).toBeNull();
  });

  it('lights the lane plus its two neighbours', () => {
    setLanePreview({ laneIndex: 1, cellIndex: 3 });
    const c = draw();
    expect(bands(c)).toHaveLength(3);
    expect(bands(c).map((r) => Number(r.getAttribute('y')))).toEqual([
      laneTop(0, TIMELINE),
      laneTop(1, TIMELINE),
      laneTop(2, TIMELINE),
    ]);
    // The lane the note is joining reads stronger than its neighbours.
    const opacities = bands(c).map((r) => Number(r.getAttribute('fill-opacity')));
    expect(opacities[1]).toBeGreaterThan(opacities[0]!);
    expect(opacities[1]).toBeGreaterThan(opacities[2]!);
  });

  it('marks the column the left edge is landing on', () => {
    setLanePreview({ laneIndex: 1, cellIndex: 3 });
    const ticks = [...draw().querySelectorAll('line')].filter(
      (l) => l.getAttribute('x1') === l.getAttribute('x2'),
    );
    expect(ticks.map((l) => Number(l.getAttribute('x1')))).toEqual([
      3 * ES_GRID_CELL,
      4 * ES_GRID_CELL,
    ]);
  });

  it('draws the column even when no lane claimed the note', () => {
    setLanePreview({ laneIndex: null, cellIndex: 2 });
    const c = draw();
    expect(bands(c)).toHaveLength(0);
    const ticks = [...c.querySelectorAll('line')].filter(
      (l) => l.getAttribute('x1') === l.getAttribute('x2'),
    );
    expect(ticks).toHaveLength(2);
  });

  it('scales into client space at any zoom', () => {
    setLanePreview({ laneIndex: 1, cellIndex: 3 });
    for (const zoom of [0.5, 2]) {
      cleanup();
      const c = draw({ zoom });
      const lit = bands(c)[1]!;
      expect(Number(lit.getAttribute('y'))).toBe(laneTop(1, TIMELINE) * zoom);
      expect(Number(lit.getAttribute('height'))).toBe(ES_LANE_HEIGHT * zoom);
    }
  });

  it('never takes a pointer event away from the drag it describes', () => {
    setLanePreview({ laneIndex: 0, cellIndex: 0 });
    expect(draw().querySelector('svg')!.className.baseVal).toContain('pointer-events-none');
  });
});
