// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeechBubble } from '../speech';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { AvatarSpeechLayer } from './AvatarSpeechLayer';

// docs/specs/008-canvas/blueprints/avatar-speech.md: the flight is one loop that writes styles, no work it can skip.
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const bubble: SpeechBubble = {
  id: 'b1',
  from: 'self',
  own: true,
  text: 'hello',
  tabId: 't1',
  x: 0,
  y: 0,
  bornAt: 0,
  flightMs: 4000,
};
const props = {
  bubbles: [bubble],
  activeTabId: 't1',
  zoom: 1,
  peers: [],
  composer: null,
  self: { name: 'Tom', colour: '#14b8a6' },
};

describe('the speech bubbles flight', () => {
  it('reads the reduced-motion setting once per flight, not every frame', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    render(<AvatarSpeechLayer {...props} />);
    vi.advanceTimersByTime(500);
    expect(vi.mocked(prefersReducedMotion)).toHaveBeenCalledTimes(1);
  });
});
