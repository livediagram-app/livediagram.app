// The timeline (walkthroughs.md "Playing"): views fitted to another screen, where everything stands at a moment, the
// marks, edits since recording and the clock; and the event log that writes a recording down.
import type { WalkthroughEvents } from '@liveworkspace/media/walkthrough';
import { WALKTHROUGH_EVENTS_MAX } from '@liveworkspace/media/walkthrough';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { createEventLog, SAMPLE_MS } from './event-log';
import {
  buildTimeline,
  editedSince,
  fingerprintOf,
  fitView,
  formatClock,
  POINT_RING_MS,
  recordView,
} from './timeline';

const recording = (events: WalkthroughEvents['events'], over: Partial<WalkthroughEvents> = {}) =>
  ({
    v: 1,
    durationMs: 10_000,
    camera: false,
    corner: 'bottom-left',
    startTab: 'a',
    hidden: [],
    fingerprints: {},
    events,
    ...over,
  }) as WalkthroughEvents;

describe('views', () => {
  it('records the centre point, whatever the zoom, and fits it to another screen', () => {
    const rec = recordView({ zoom: 2, offset: { x: 100, y: -50 } }, 1000, 800);
    expect(rec).toEqual({ cx: 400, cy: 450, zoom: 2, w: 1000, h: 800 });
    // The same screen gives the same view back.
    expect(fitView(rec, 1000, 800)).toEqual({ zoom: 2, offset: { x: 100, y: -50 } });
    // Half as wide: half the zoom, the same point at the centre.
    const half = fitView(rec, 500, 800);
    expect(half.zoom).toBe(1);
    expect(500 / 2 - half.offset.x).toBe(400);
  });
});

describe('the timeline', () => {
  const tl = buildTimeline(
    recording([
      { t: 0, k: 'view', cx: 0, cy: 0, zoom: 1, w: 100, h: 100 },
      { t: 100, k: 'view', cx: 100, cy: 50, zoom: 2, w: 100, h: 100 },
      { t: 1000, k: 'view', cx: 500, cy: 500, zoom: 1, w: 100, h: 100 },
      { t: 1100, k: 'view', cx: 0, cy: 0, zoom: 1, w: 200, h: 100 },
      { t: 50, k: 'cursor', x: 10, y: 10 },
      { t: 150, k: 'cursor', x: 20, y: 30 },
      { t: 250, k: 'cursor-out' },
      { t: 300, k: 'point', id: 'e1' },
      { t: 400, k: 'point', id: 'e2' },
      { t: 2000, k: 'slide', slide: 's1', label: 'Intro' },
      { t: 2500, k: 'slide', slide: 's2' },
      { t: 3000, k: 'slide', slide: null },
      { t: 4000, k: 'tab', tab: 'b' },
    ]),
    (tab) => `Tab ${tab}`,
  );

  it('stands still before anything happens', () => {
    const empty = buildTimeline(recording([]));
    expect(empty.at(500)).toEqual({ view: null, cursor: null, tab: 'a', slide: null, points: [] });
  });

  it('glides between close samples and jumps across far ones', () => {
    expect(tl.at(50).view).toEqual({ cx: 50, cy: 25, zoom: 1.5, w: 100, h: 100 });
    expect(tl.at(500).view?.cx).toBe(100);
    // A resize between samples is a jump.
    expect(tl.at(1050).view?.cx).toBe(500);
    expect(tl.at(5000).view?.w).toBe(200);
  });

  it('follows the pointer, and loses it off the canvas', () => {
    expect(tl.at(100).cursor).toEqual({ x: 15, y: 20 });
    expect(tl.at(200).cursor).toEqual({ x: 20, y: 30 });
    expect(tl.at(260).cursor).toBeNull();
  });

  it('rings each press for a moment', () => {
    expect(tl.at(450).points.map((p) => p.id)).toEqual(['e2', 'e1']);
    expect(tl.at(300 + POINT_RING_MS + 1).points.map((p) => p.id)).toEqual(['e2']);
    expect(tl.at(450).points[0]!.progress).toBeCloseTo(50 / POINT_RING_MS);
  });

  it('knows the slide and the tab, and marks them', () => {
    expect(tl.at(2100).slide).toEqual({ slide: 's1', label: 'Intro' });
    expect(tl.at(2600).slide).toEqual({ slide: 's2', label: null });
    expect(tl.at(3100).slide).toBeNull();
    expect(tl.at(3900).tab).toBe('a');
    expect(tl.at(4000).tab).toBe('b');
    expect(tl.marks).toEqual([
      { t: 2000, kind: 'slide', label: 'Intro' },
      { t: 2500, kind: 'slide', label: 'Slide' },
      { t: 4000, kind: 'tab', label: 'Tab b' },
    ]);
    expect(buildTimeline(recording([{ t: 1, k: 'tab', tab: 'z' }])).marks[0]!.label).toBe('z');
  });

  it('reads a full recording quickly', () => {
    const many = Array.from({ length: WALKTHROUGH_EVENTS_MAX }, (_, i) => ({
      t: i * 30,
      k: 'cursor' as const,
      x: i,
      y: i,
    }));
    const big = buildTimeline(recording(many, { durationMs: 600_000 }));
    // A minute of frames at 60 a second: each read is a binary search.
    expect(
      cpuMsOf(() => {
        for (let f = 0; f < 3600; f++) big.at(f * 166);
      }),
    ).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('edits and the clock', () => {
  it('names the tabs changed or gone since recording', () => {
    const now: Record<string, string> = { a: 'x', b: 'changed' };
    expect(editedSince({ a: 'x', b: 'y', c: 'z' }, (t) => now[t] ?? null)).toEqual(['b', 'c']);
  });

  it('fingerprints content and tells it apart', () => {
    expect(fingerprintOf([{ id: 1 }])).toBe(fingerprintOf([{ id: 1 }]));
    expect(fingerprintOf([{ id: 1 }])).not.toBe(fingerprintOf([{ id: 2 }]));
    expect(fingerprintOf(undefined)).toBe('811c9dc5-0');
  });

  it('shows m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(84_900)).toBe('1:24');
    expect(formatClock(600_000)).toBe('10:00');
  });
});

describe('the event log', () => {
  const view = (cx: number) => ({ cx, cy: 0, zoom: 1, w: 10, h: 10 });

  it('samples the view and the pointer at most every SAMPLE_MS, keeping the last', () => {
    const log = createEventLog(1000, () => new Set());
    log.view(1000, view(1));
    log.view(1020, view(2));
    log.view(1040, view(3));
    // The same as the last written: nothing.
    log.view(1050, view(1));
    log.view(1060, view(4));
    log.tick(1080);
    log.tick(1000 + SAMPLE_MS + 10);
    log.cursor(1000, { x: 1.4, y: 2.6 });
    log.cursor(1010, { x: 5, y: 5 });
    log.cursor(1020, null);
    log.cursor(1030, null);
    log.cursor(1040, { x: 7, y: 7 });
    log.tick(1050);
    log.tick(1130);
    log.cursor(1160, null);
    expect(log.finish()).toEqual([
      { t: 0, k: 'view', cx: 1, cy: 0, zoom: 1, w: 10, h: 10 },
      { t: 0, k: 'cursor', x: 1, y: 3 },
      { t: 20, k: 'cursor-out' },
      { t: 40, k: 'cursor', x: 7, y: 7 },
      { t: 60, k: 'view', cx: 4, cy: 0, zoom: 1, w: 10, h: 10 },
      { t: 160, k: 'cursor-out' },
    ]);
  });

  it('writes a waiting sample before a press, a tab or a slide', () => {
    const log = createEventLog(0, () => new Set(['secret']));
    log.cursor(0, { x: 0, y: 0 });
    log.cursor(10, { x: 9, y: 9 });
    log.point(20, 'shown');
    log.point(25, 'secret');
    log.tab(30, 'b');
    log.slide(40, 's1', 'Intro');
    log.slide(50, null);
    expect(log.finish()).toEqual([
      { t: 0, k: 'cursor', x: 0, y: 0 },
      { t: 10, k: 'cursor', x: 9, y: 9 },
      { t: 20, k: 'point', id: 'shown' },
      { t: 30, k: 'tab', tab: 'b' },
      { t: 40, k: 'slide', slide: 's1', label: 'Intro' },
      { t: 50, k: 'slide', slide: null },
    ]);
  });

  it('stops writing at its most events', () => {
    const log = createEventLog(0, () => new Set());
    for (let i = 0; i < WALKTHROUGH_EVENTS_MAX; i++) log.tab(i, `t${i % 2}`);
    expect(log.full()).toBe(true);
    log.tab(1e9, 'late');
    expect(log.finish()).toHaveLength(WALKTHROUGH_EVENTS_MAX);
  });
});
