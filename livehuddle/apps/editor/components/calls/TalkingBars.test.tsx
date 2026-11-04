// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  receiveCallOp,
  resetCallPeers,
  resetCallSelf,
  setCallSelf,
  VOICE_STALE_MS,
} from '@/lib/calls/calls-store';
import { barHeight, TalkingBars, type TalkingBarsPeer } from './TalkingBars';

const sam: TalkingBarsPeer = {
  id: 'p1',
  name: 'Sam',
  color: '#f00',
  at: { x: 2000, y: 0 },
  scale: 1,
  glideMs: 33,
  walking: true,
};
const kit: TalkingBarsPeer = { ...sam, id: 'p2', name: 'Kit' };

function talk(id: string, level: number) {
  act(() => {
    receiveCallOp(id, { kind: 'avatar-voice', tabId: 't1', level });
    vi.advanceTimersByTime(100);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  act(() => {
    resetCallPeers();
    resetCallSelf();
  });
  vi.useRealTimers();
});

// docs/specs/012-collaboration/proximity-audio.md "The talking equaliser".
describe('TalkingBars', () => {
  it('shows bars above a talking character only, faint when far, and walks over when pressed', () => {
    const onWalkTo = vi.fn();
    render(
      <TalkingBars
        peers={[sam, kit]}
        self={{ at: { x: 0, y: 0 }, scale: 1, color: '#00f' }}
        onWalkTo={onWalkTo}
      />,
    );
    talk('p1', 3);
    const bars = screen.getByRole('button', { name: 'Sam is talking, walk over' });
    expect(screen.queryByRole('button', { name: /Kit/ })).toBeNull();
    const placed = bars.closest('[data-talking-bars]') as HTMLElement;
    expect(Number(placed.style.opacity)).toBeCloseTo(0.3);
    fireEvent.click(bars);
    expect(onWalkTo).toHaveBeenCalledWith('p1', sam.at);
  });

  it('is only shown, not pressed, while you are not walking, and drops a stale level', () => {
    render(<TalkingBars peers={[sam]} self={null} />);
    talk('p1', 2);
    expect(screen.getByRole('img', { name: 'Sam is talking' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(VOICE_STALE_MS + 100);
    });
    expect(screen.queryByRole('img', { name: 'Sam is talking' })).toBeNull();
  });

  it('shows your own bars while you talk, never while muted, and hides others under Do Not Disturb', () => {
    const { container } = render(
      <TalkingBars
        peers={[sam]}
        self={{ at: { x: 0, y: 0 }, scale: 1, color: '#00f' }}
        hidePeers
      />,
    );
    talk('p1', 4);
    expect(container.querySelector('[data-talking-bars="p1"]')).toBeNull();
    act(() => setCallSelf({ level: 2 }));
    expect(container.querySelector('[data-talking-bars="self"]')).toBeTruthy();
    act(() => setCallSelf({ muted: true }));
    expect(container.querySelector('[data-talking-bars="self"]')).toBeNull();
  });

  it('sizes the bars by level', () => {
    expect(barHeight(1)).toBe(4);
    expect(barHeight(4)).toBe(12);
  });
});
