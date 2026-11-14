// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callMaximised,
  resetCallMedia,
  resetCallSelf,
  setCallMaximised,
  setCallMedia,
  setCallSelf,
} from '@/lib/calls/calls-store';
import { AVATAR_HEAD_CHROME } from '@livehuddle/avatar/walk';
import { receiveCallOp, resetCallPeers } from '@/lib/calls/calls-store';
import { BUBBLE_GAP_PX } from '@/lib/calls/bubble-layout';
import { BUBBLE_LIFT_PX, CallBubbles, useCallBubbleRects } from './CallBubbles';
import { renderHook } from '@testing-library/react';
import type { BubbleRect } from '@/lib/calls/bubble-layout';
import { BUBBLE_WIDTH_PX, mediaTitle } from './MediaBubble';

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

const stream = (id: string) => ({ id }) as unknown as MediaStream;
const peer = (id: string, name: string, x: number) => ({
  id,
  name,
  color: '#0ea5e9',
  at: { x, y: 300 },
  scale: 1,
  glideMs: 100,
  walking: true,
});
const self = { at: { x: 0, y: 300 }, scale: 1, color: '#f97316' };

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  cleanup();
  act(() => {
    resetCallMedia();
    resetCallSelf();
    resetCallPeers();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// docs/specs/012-collaboration/video-and-screen-bubbles.md "The bubble" and "Maximised".
describe('CallBubbles', () => {
  it('draws nothing without a stream', () => {
    const { container } = render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
    expect(container.innerHTML).toBe('');
  });

  it('puts each person’s camera and screen above their head, and yours mirrored above yours', () => {
    const { container } = render(
      <CallBubbles peers={[peer('p1', 'Sam', 100), peer('p2', 'Kim', 400)]} self={self} />,
    );
    act(() => {
      setCallMedia('p1', 'video', stream('a'));
      setCallMedia('p1', 'screen', stream('b'));
      setCallMedia('self', 'video', stream('c'));
    });
    const sam = container.querySelector<HTMLElement>('[data-call-bubbles="p1"]')!;
    expect(sam.style.left).toBe('100px');
    expect(sam.querySelectorAll('[data-call-bubble]')).toHaveLength(2);
    expect(container.querySelector('[data-call-bubbles="p2"]')).toBeNull();
    expect(screen.getByRole('button', { name: "Maximise Sam's Camera" })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Maximise Sam's Screen" })).toBeTruthy();
    const mine = screen.getByRole('button', { name: 'Maximise Your Camera' });
    expect(mine.querySelector('video')!.className).toContain('-scale-x-100');
    // A video shows only once its first frame is in.
    const video = sam.querySelector('video')!;
    expect(video.className).toContain('opacity-0');
    fireEvent.loadedData(video);
    expect(video.className).toContain('opacity-100');
  });

  // video-and-screen-bubbles.md "Local preview".
  it('tags your own preview Only You, here and maximised, and drops the tag once the call sends it', () => {
    const { container } = render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
    act(() => {
      setCallMedia('self', 'video', stream('c'));
      setCallMedia('self', 'screen', stream('d'));
      setCallMedia('p1', 'video', stream('a'));
      setCallSelf({ previewCamera: 'on', previewScreen: 'on' });
    });
    const tags = () =>
      container.querySelectorAll('[data-call-bubbles="self"] [data-call-only-you]');
    expect(tags()).toHaveLength(2);
    expect(container.querySelector('[data-call-bubbles="p1"] [data-call-only-you]')).toBeNull();
    const mine = screen.getByRole('button', { name: 'Maximise Your Camera, Only You' });
    fireEvent.click(mine);
    const dialog = screen.getByRole('dialog', { name: 'Your Camera' });
    expect(dialog.querySelector('[data-call-only-you]')).not.toBeNull();
    act(() => setCallMaximised(null));
    // The call took the camera: its tag goes, the screen's stays.
    act(() => setCallSelf({ previewCamera: 'off', camera: 'on' }));
    expect(tags()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Maximise Your Camera' })).toBeTruthy();
  });

  it('slides with a walking character, and lands at once on a jump', () => {
    const { rerender, container } = render(
      <CallBubbles peers={[peer('p1', 'Sam', 100)]} self={null} />,
    );
    act(() => setCallMedia('p1', 'video', stream('a')));
    rerender(<CallBubbles peers={[peer('p1', 'Sam', 110)]} self={null} />);
    const group = container.querySelector<HTMLElement>('[data-call-bubbles="p1"]')!;
    expect(group.style.transition).toContain('left 100ms');
    rerender(<CallBubbles peers={[peer('p1', 'Sam', 3000)]} self={null} />);
    expect(group.style.transition).toBe('');
  });

  // "Close together" (#468).
  describe('close together', () => {
    const rowOf = (container: HTMLElement, id: string) =>
      container.querySelector<HTMLElement>(`[data-call-bubbles="${id}"] [data-call-bubbles-row]`)!;
    const nudge = (row: HTMLElement) =>
      Number(/translate\((-?[\d.]+)px[,)]/.exec(row.style.transform)![1]);

    it('slides two people side by side apart, tails still on their heads, and hands on where they went', () => {
      const rects = { current: [] as readonly BubbleRect[] };
      const { container, rerender, unmount } = render(
        <CallBubbles
          peers={[peer('p1', 'Sam', 100), peer('p2', 'Kim', 140)]}
          self={null}
          rectsRef={rects}
        />,
      );
      expect(rects.current).toEqual([]);
      act(() => {
        setCallMedia('p1', 'video', stream('a'));
        setCallMedia('p2', 'video', stream('b'));
      });
      const sam = nudge(rowOf(container, 'p1'));
      const kim = nudge(rowOf(container, 'p2'));
      expect(sam).toBeLessThan(0);
      expect(kim).toBeCloseTo(-sam);
      const tail = rowOf(container, 'p1').querySelector<HTMLElement>('[data-call-bubble-tail]')!;
      expect(tail.style.transform).toContain(`calc(-50% + ${-sam}px)`);
      expect(rects.current).toHaveLength(2);
      expect(rects.current[0]!.right).toBeLessThanOrEqual(rects.current[1]!.left);
      // Walking past each other, a little: no swap.
      rerender(
        <CallBubbles
          peers={[peer('p1', 'Sam', 150), peer('p2', 'Kim', 140)]}
          self={null}
          rectsRef={rects}
        />,
      );
      expect(nudge(rowOf(container, 'p1'))).toBeLessThan(0);
      // Well past: they swap.
      rerender(
        <CallBubbles
          peers={[peer('p1', 'Sam', 200), peer('p2', 'Kim', 140)]}
          self={null}
          rectsRef={rects}
        />,
      );
      expect(nudge(rowOf(container, 'p1'))).toBeGreaterThan(0);
      act(() => resetCallMedia());
      expect(rects.current).toEqual([]);
      unmount();
      expect(rects.current).toEqual([]);
    });

    it('moves your own camera with everyone else’s', () => {
      const { container } = render(<CallBubbles peers={[peer('p1', 'Sam', 20)]} self={self} />);
      act(() => {
        setCallMedia('p1', 'video', stream('a'));
        setCallMedia('self', 'video', stream('c'));
      });
      expect(nudge(rowOf(container, 'self'))).toBeLessThan(0);
      expect(nudge(rowOf(container, 'p1'))).toBeGreaterThan(0);
    });

    it('makes one rects ref per canvas', () => {
      const { result, rerender } = renderHook(() => useCallBubbleRects());
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);
      expect(first.current).toEqual([]);
    });
  });

  it('maximises on a press, counts it, and restores from the button, Escape and the backdrop', () => {
    render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
    act(() => setCallMedia('p1', 'screen', stream('a')));
    const bubble = screen.getByRole('button', { name: "Maximise Sam's Screen" });
    // A press on a bubble is not a press on the canvas under it.
    const down = new Event('pointerdown', { bubbles: true });
    const stop = vi.spyOn(down, 'stopPropagation');
    bubble.dispatchEvent(down);
    expect(stop).toHaveBeenCalled();
    fireEvent.click(bubble);
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'BubbleMaximise');
    const dialog = screen.getByRole('dialog', { name: "Sam's Screen" });
    expect(dialog.textContent).toContain("Sam's Screen");
    const restore = screen.getAllByRole('button', { name: 'Restore' });
    // Focus goes to the panel's Restore.
    expect(document.activeElement?.textContent).toContain('Restore');
    fireEvent.click(restore.at(-1)!);
    expect(callMaximised()).toBeNull();
    act(() => setCallMaximised({ id: 'p1', media: 'screen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(callMaximised()).toBeNull();
    act(() => setCallMaximised({ id: 'p1', media: 'screen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0]!);
    expect(callMaximised()).toBeNull();
  });

  it('shows no panel for a bubble that is gone or a person who left', () => {
    const { rerender } = render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
    act(() => {
      setCallMedia('p1', 'video', stream('a'));
      setCallMedia('self', 'video', stream('b'));
      setCallMaximised({ id: 'p1', media: 'screen' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => setCallMaximised({ id: 'self', media: 'video' }));
    expect(screen.getByRole('dialog', { name: 'Your Camera' })).toBeTruthy();
    act(() => setCallMaximised({ id: 'p1', media: 'video' }));
    rerender(<CallBubbles peers={[]} self={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Your own, once you stop walking, keeps a neutral colour.
    act(() => setCallMaximised({ id: 'self', media: 'video' }));
    expect(screen.getByRole('dialog', { name: 'Your Camera' })).toBeTruthy();
  });

  // video-and-screen-bubbles.md "Share roles" (#469): Stop Sharing on someone else's screen, an Editor's alone.
  describe('stop sharing', () => {
    const stops = () => screen.queryAllByRole('button', { name: /^Stop / });

    it("shows an Editor Stop Sharing on someone else's screen, not a camera or their own, and on the panel", () => {
      const onStopShare = vi.fn();
      render(
        <CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} onStopShare={onStopShare} />,
      );
      act(() => {
        setCallMedia('p1', 'video', stream('a'));
        setCallMedia('p1', 'screen', stream('b'));
        setCallMedia('self', 'screen', stream('c'));
      });
      expect(stops().map((b) => b.getAttribute('aria-label'))).toEqual(["Stop Sam's Screen"]);
      const down = new Event('pointerdown', { bubbles: true });
      const halt = vi.spyOn(down, 'stopPropagation');
      stops()[0]!.dispatchEvent(down);
      expect(halt).toHaveBeenCalled();
      fireEvent.click(stops()[0]!);
      expect(onStopShare).toHaveBeenCalledWith('p1');
      expect(callMaximised()).toBeNull();
      // The panel's bar: Stop Sharing beside Restore, and focus on the panel, never on Stop.
      act(() => setCallMaximised({ id: 'p1', media: 'screen' }));
      const dialog = screen.getByRole('dialog', { name: "Sam's Screen" });
      expect(document.activeElement).toBe(dialog);
      fireEvent.click(dialog.querySelector('[data-call-panel-stop]')!);
      expect(onStopShare).toHaveBeenCalledTimes(2);
      // Not on a camera, nor your own screen.
      act(() => setCallMaximised({ id: 'p1', media: 'video' }));
      expect(screen.getByRole('dialog').querySelector('[data-call-panel-stop]')).toBeNull();
      act(() => setCallMaximised({ id: 'self', media: 'screen' }));
      expect(screen.getByRole('dialog').querySelector('[data-call-panel-stop]')).toBeNull();
    });

    it('shows a Participant or a Viewer no Stop Sharing anywhere', () => {
      render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
      act(() => {
        setCallMedia('p1', 'screen', stream('b'));
        setCallMaximised({ id: 'p1', media: 'screen' });
      });
      expect(stops()).toEqual([]);
      expect(document.querySelector('[data-call-panel-stop]')).toBeNull();
    });
  });

  // "A row wider than the view wraps" (#487).
  it('lifts a wrapped bubble onto a row above and hides its tail', () => {
    const { container } = render(
      <CallBubbles
        peers={[peer('p1', 'Sam', 200), peer('p2', 'Kim', 230), peer('p3', 'Lee', 260)]}
        self={null}
        view={{ left: 0, width: 450 }}
      />,
    );
    act(() => {
      setCallMedia('p1', 'video', stream('a'));
      setCallMedia('p1', 'screen', stream('b'));
      setCallMedia('p2', 'video', stream('c'));
      setCallMedia('p3', 'video', stream('d'));
    });
    const row = (id: string) =>
      container.querySelector<HTMLElement>(`[data-call-bubbles="${id}"] [data-call-bubbles-row]`)!;
    const tail = (id: string) =>
      container.querySelector<HTMLElement>(`[data-call-bubbles="${id}"] [data-call-bubble-tail]`)!;
    // Not lifted: the style drops a 0 y.
    expect(row('p1').style.transform).toMatch(/^translate\(-?[\d.]+px\)$/);
    // Lifted a bubble's height (16:9 of its width) and a gap onto the row above.
    const lift = (BUBBLE_WIDTH_PX * 9) / 16 + BUBBLE_GAP_PX;
    expect(row('p3').style.transform.endsWith(`, -${lift}px)`)).toBe(true);
    expect(tail('p1').hidden).toBe(false);
    expect(tail('p3').hidden).toBe(true);
  });

  // Owner, 2026-11-07: "Make the bubble bigger", "bring it slightly closer to their body".
  it('is 180 px wide and sits just over the head chrome', () => {
    expect(BUBBLE_WIDTH_PX).toBe(180);
    expect(BUBBLE_LIFT_PX).toBe(AVATAR_HEAD_CHROME + 8);
  });

  // Someone wearing a bubble talks on it (TalkingBars' BubbleBars), not over their head.
  it('shows the talking equaliser on the bubble while its person talks, and yours while unmuted', () => {
    vi.useFakeTimers();
    const { container } = render(<CallBubbles peers={[peer('p1', 'Sam', 100)]} self={self} />);
    act(() => {
      setCallMedia('p1', 'video', stream('a'));
      setCallMedia('self', 'video', stream('c'));
    });
    const bars = (id: string) =>
      container.querySelector(`[data-call-bubbles="${id}"] [data-bubble-bars="${id}"]`);
    expect(bars('p1')).toBeNull();
    expect(bars('self')).toBeNull();
    act(() => {
      receiveCallOp('p1', { kind: 'avatar-voice', tabId: 't1', level: 3 });
      setCallSelf({ muted: false, level: 2 });
      // Peers' levels reach the screen on the store's short batch.
      vi.advanceTimersByTime(100);
    });
    expect(bars('p1')).not.toBeNull();
    expect(bars('self')).not.toBeNull();
    act(() => setCallSelf({ muted: true }));
    expect(bars('self')).toBeNull();
  });

  it('names a bubble for its person, or yours', () => {
    expect(mediaTitle('Sam', 'video')).toBe("Sam's Camera");
    expect(mediaTitle(null, 'screen')).toBe('Your Screen');
  });
});
