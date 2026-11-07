// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  receiveCallOp,
  resetCallMedia,
  resetCallPeers,
  resetCallSelf,
  setCallMedia,
  setCallSelf,
  VOICE_STALE_MS,
} from '@/lib/calls/calls-store';
import { barHeight, BubbleBars, TalkingBars, type TalkingBarsPeer } from './TalkingBars';

const stream = { id: 's' } as unknown as MediaStream;

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
    resetCallMedia();
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

  // Someone wearing a camera or screen bubble talks on the bubble (BubbleBars), so not over their head as well.
  it('skips a talker, and you, while wearing a bubble', () => {
    const { container } = render(
      <TalkingBars peers={[sam, kit]} self={{ at: { x: 0, y: 0 }, scale: 1, color: '#00f' }} />,
    );
    talk('p1', 3);
    talk('p2', 3);
    act(() => setCallSelf({ muted: false, level: 2 }));
    expect(container.querySelector('[data-talking-bars="p1"]')).toBeTruthy();
    expect(container.querySelector('[data-talking-bars="self"]')).toBeTruthy();
    act(() => {
      setCallMedia('p1', 'video', stream);
      setCallMedia('self', 'screen', stream);
    });
    expect(container.querySelector('[data-talking-bars="p1"]')).toBeNull();
    expect(container.querySelector('[data-talking-bars="p2"]')).toBeTruthy();
    expect(container.querySelector('[data-talking-bars="self"]')).toBeNull();
    // Nobody left talking without a bubble: nothing at all.
    act(() => setCallMedia('p2', 'video', stream));
    expect(container.innerHTML).toBe('');
  });

  it('shows the bars on a bubble while its person talks, yours while unmuted, and drops a stale level', () => {
    const { container } = render(
      <>
        <BubbleBars id="p1" color="#f00" />
        <BubbleBars id="self" color="#00f" />
      </>,
    );
    const bars = (id: string) => container.querySelector(`[data-bubble-bars="${id}"]`);
    expect(bars('p1')).toBeNull();
    expect(bars('self')).toBeNull();
    talk('p1', 2);
    expect(bars('p1')).toBeTruthy();
    act(() => setCallSelf({ muted: false, level: 3 }));
    expect(bars('self')).toBeTruthy();
    act(() => setCallSelf({ muted: true }));
    expect(bars('self')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(VOICE_STALE_MS + 100);
    });
    expect(bars('p1')).toBeNull();
  });

  it('sizes the bars by level', () => {
    expect(barHeight(1)).toBe(4);
    expect(barHeight(4)).toBe(12);
  });
});
