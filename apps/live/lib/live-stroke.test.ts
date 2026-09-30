// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { STROKE_SMOOTHING } from '@livediagram/document';
import { coalescedSamples, createLiveStroke, eventTime } from './live-stroke';

// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Live stroke pipeline").

const pointerEvent = (init: { clientX: number; clientY: number }, extra: object = {}) =>
  Object.assign(new MouseEvent('pointermove', init), extra) as unknown as PointerEvent;

describe('createLiveStroke', () => {
  it('picks the settings of its pointer kind, a mouse by default', () => {
    expect(createLiveStroke('pen', 3, 1).pointer).toBe('pen');
    expect(createLiveStroke('touch', 3, 1).pointer).toBe('touch');
    expect(createLiveStroke(undefined, undefined, 1).pointer).toBe('mouse');
  });

  it('remembers the pointer that started it', () => {
    expect(createLiveStroke('pen', 7, 1).pointerId).toBe(7);
  });

  it('measures its settings on screen: zoomed in, a smaller canvas step is a sample', () => {
    const step = STROKE_SMOOTHING.mouse.minSamplePx * 0.6;
    const flat = createLiveStroke('mouse', 1, 1);
    flat.smoother.push(0, 0, 0);
    expect(flat.smoother.push(step, 0, 8)).toBe(false);
    const zoomed = createLiveStroke('mouse', 1, 4);
    zoomed.smoother.push(0, 0, 0);
    expect(zoomed.smoother.push(step, 0, 8)).toBe(true);
  });

  it('tells each subscriber on notify, until it unsubscribes', () => {
    const stroke = createLiveStroke('mouse', 1, 1);
    const a = vi.fn();
    const b = vi.fn();
    const offA = stroke.subscribe(a);
    stroke.subscribe(b);
    stroke.notify();
    offA();
    stroke.notify();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe('coalescedSamples', () => {
  it('uses every sample the browser gathered since the last event', () => {
    const inner = [
      pointerEvent({ clientX: 1, clientY: 1 }),
      pointerEvent({ clientX: 2, clientY: 2 }),
    ];
    const e = pointerEvent({ clientX: 2, clientY: 2 }, { getCoalescedEvents: () => inner });
    expect(coalescedSamples(e)).toBe(inner);
  });

  it('falls back to the event itself without coalesced events, or with none', () => {
    const bare = pointerEvent({ clientX: 1, clientY: 1 });
    expect(coalescedSamples(bare)).toEqual([bare]);
    const empty = pointerEvent({ clientX: 1, clientY: 1 }, { getCoalescedEvents: () => [] });
    expect(coalescedSamples(empty)).toEqual([empty]);
  });
});

describe('eventTime', () => {
  it('reads the event time, or now when an event carries none', () => {
    expect(eventTime({ timeStamp: 1234.5 })).toBe(1234.5);
    vi.spyOn(performance, 'now').mockReturnValue(42);
    expect(eventTime({})).toBe(42);
    vi.restoreAllMocks();
  });
});
