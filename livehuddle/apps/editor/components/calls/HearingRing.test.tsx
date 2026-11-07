// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCallSelf, setCallSelf } from '@/lib/calls/calls-store';
import { callStages } from '@/lib/calls/stage';
import { roomZones } from '@/lib/calls/zones';
import { HEARING_RING_FADE_MS, HearingRing } from './HearingRing';

// docs/specs/012-collaboration/proximity-audio.md "Your hearing ring".
const zones = roomZones([
  { id: 'hall', type: 'shape', shape: 'room', x: 0, y: 0, width: 1200, height: 800 },
]);
const stages = callStages(
  [
    {
      id: 'stage',
      type: 'shape',
      shape: 'stage',
      x: 420,
      y: 40,
      width: 360,
      height: 140,
      stageSpeakers: 'take-part',
    },
  ],
  zones,
);

function ring(at = { x: 2000, y: 2000 }, level: 'edit' | 'participate' | 'view' = 'participate') {
  return <HearingRing self={{ at, color: '#0af' }} zones={zones} stages={stages} level={level} />;
}
const svg = (c: HTMLElement) => c.querySelector<SVGSVGElement>('[data-hearing-ring]');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  act(() => resetCallSelf());
  vi.useRealTimers();
});

describe('HearingRing', () => {
  it('shows only while you talk, unmuted, then fades and goes', () => {
    const { container } = render(ring());
    expect(svg(container)).toBeNull();
    act(() => setCallSelf({ level: 2 }));
    const shown = svg(container)!;
    expect(shown.style.opacity).toBe('1');
    expect(shown.querySelector('.animate-hearing-ripple')).not.toBeNull();
    // Centred on your feet, the hearing radius round them, with no mask on the open floor.
    const edge = shown.querySelector('circle')!;
    expect(edge.getAttribute('cx')).toBe('2000');
    expect(edge.getAttribute('r')).toBe('260');
    expect(shown.querySelector('mask')).toBeNull();
    act(() => setCallSelf({ level: 0 }));
    expect(svg(container)!.style.opacity).toBe('0');
    expect(svg(container)!.querySelector('.animate-hearing-ripple')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HEARING_RING_FADE_MS);
    });
    expect(svg(container)).toBeNull();
  });

  it('never shows while muted', () => {
    const { container } = render(ring());
    act(() => setCallSelf({ level: 3, muted: true }));
    expect(svg(container)).toBeNull();
  });

  it('is masked to your room inside one', () => {
    const { container } = render(ring({ x: 300, y: 500 }));
    act(() => setCallSelf({ level: 1 }));
    const mask = svg(container)!.querySelector('mask')!;
    expect(mask.querySelector('polygon[fill="white"]')).not.toBeNull();
    expect(svg(container)!.querySelector('g')!.getAttribute('mask')).toBe(`url(#${mask.id})`);
  });

  it('cuts out the room beside you on the open floor', () => {
    const { container } = render(ring({ x: 1300, y: 400 }));
    act(() => setCallSelf({ level: 1 }));
    const mask = svg(container)!.querySelector('mask')!;
    expect(mask.querySelector('rect[fill="white"]')).not.toBeNull();
    expect(mask.querySelectorAll('polygon[fill="black"]')).toHaveLength(1);
  });

  it('does not show on a stage you speak from, nor without a character', () => {
    const { container } = render(ring({ x: 600, y: 120 }));
    act(() => setCallSelf({ level: 2 }));
    expect(svg(container)).toBeNull();
    const none = render(<HearingRing self={null} zones={zones} stages={stages} level="edit" />);
    expect(svg(none.container)).toBeNull();
    // Called up as a speaker by the call itself (a raised hand let speak): no ring either.
    act(() => setCallSelf({ stage: 'speaker' }));
    const far = render(ring());
    expect(svg(far.container)).toBeNull();
  });
});
