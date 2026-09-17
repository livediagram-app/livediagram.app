// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ES_LANE_HEIGHT, laneTop, type EsTimeline } from '@livediagram/diagram';
import { setLanePreview } from '@/lib/lane-preview';
import { TimelineLanesOverlay } from './TimelineLanesOverlay';

// The lit lane (spec/139 Phase 6). What matters here is that it draws NOTHING
// until a drag has claimed a lane, and that what it draws lands where the drop
// will — canvas coords through the wrapper rect + zoom, the one inversion the
// rest of the canvas chrome uses.

const TIMELINE: EsTimeline = { originY: 0 };

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
    setLanePreview({ laneIndex: 1 });
    expect(draw({ timeline: null }).querySelector('svg')).toBeNull();
  });

  it('lights the lane plus its two neighbours', () => {
    setLanePreview({ laneIndex: 1 });
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

  it('draws nothing when no lane claimed the note — x is not its business', () => {
    // Lanes are ROWS. The column tick that used to live here described a
    // lattice the board no longer has; x is answered by the neighbours, and
    // the alignment guides already draw that.
    setLanePreview({ laneIndex: null });
    const c = draw();
    expect(bands(c)).toHaveLength(0);
    expect(c.querySelectorAll('line')).toHaveLength(0);
  });

  it('draws the slot the note will land in, before it lands', () => {
    setLanePreview({ laneIndex: 1, ghost: { x: 272, y: 240, width: 200, height: 200 } });
    const ghost = draw().querySelector('[data-testid="timeline-lane-ghost"]')!;
    expect(ghost).toBeTruthy();
    expect(Number(ghost.getAttribute('x'))).toBe(272);
    expect(Number(ghost.getAttribute('y'))).toBe(240);
    expect(Number(ghost.getAttribute('width'))).toBe(200);
    // Dashed, so it reads as an offer rather than as a note already there.
    expect(ghost.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('draws no slot while x is still the hand own', () => {
    setLanePreview({ laneIndex: 1 });
    expect(draw().querySelector('[data-testid="timeline-lane-ghost"]')).toBeNull();
  });

  it('scales the slot into client space at any zoom', () => {
    setLanePreview({ laneIndex: 1, ghost: { x: 272, y: 240, width: 200, height: 200 } });
    const ghost = draw({ zoom: 2 }).querySelector('[data-testid="timeline-lane-ghost"]')!;
    expect(Number(ghost.getAttribute('x'))).toBe(544);
    expect(Number(ghost.getAttribute('width'))).toBe(400);
  });

  it('scales into client space at any zoom', () => {
    setLanePreview({ laneIndex: 1 });
    for (const zoom of [0.5, 2]) {
      cleanup();
      const c = draw({ zoom });
      const lit = bands(c)[1]!;
      expect(Number(lit.getAttribute('y'))).toBe(laneTop(1, TIMELINE) * zoom);
      expect(Number(lit.getAttribute('height'))).toBe(ES_LANE_HEIGHT * zoom);
    }
  });

  it('never takes a pointer event away from the drag it describes', () => {
    setLanePreview({ laneIndex: 0 });
    expect(draw().querySelector('svg')!.className.baseVal).toContain('pointer-events-none');
  });
});
