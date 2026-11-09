// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addOwnBubble, receivePeerSay, resetSpeechBubbles, useSpeechBubbles } from './speech-store';
import { SPEECH_OVERFLOW_FADE_MS, flightMs } from './speech';

// docs/specs/008-canvas/blueprints/avatar-speech.md: the store holds the bubbles on screen, drops what is
// malformed or seen, and removes every bubble itself when its flight ends.

const own = (id: string, text = 'hi') => ({ id, tabId: 't1', text, x: 10, y: 20 });
const peerOp = (id: string, text = 'hello') => ({
  kind: 'avatar-say',
  tabId: 't1',
  id,
  text,
  x: 1,
  y: 2,
});
const live = () => renderHook(() => useSpeechBubbles());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  resetSpeechBubbles();
});
afterEach(() => {
  resetSpeechBubbles();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the speech store', () => {
  it('shows your own bubble, then removes it when its flight ends', () => {
    const { result } = live();
    act(() => addOwnBubble(own('a')));
    expect(result.current.map((b) => b.id)).toEqual(['a']);
    expect(result.current[0]).toMatchObject({ from: 'self', own: true, flightMs: flightMs('hi') });
    act(() => {
      vi.advanceTimersByTime(flightMs('hi') - 1);
    });
    expect(result.current).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current).toEqual([]);
  });

  it('hurries the oldest of a fourth bubble from one speaker off early and re-arms its timer', () => {
    const { result } = live();
    act(() => {
      for (const id of ['a', 'b', 'c']) addOwnBubble(own(id));
    });
    act(() => addOwnBubble(own('d')));
    expect(result.current.find((b) => b.id === 'a')?.leavingAt).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(SPEECH_OVERFLOW_FADE_MS + 1);
    });
    expect(result.current.map((b) => b.id)).toEqual(['b', 'c', 'd']);
  });

  it('keeps every bubble when a timer fires before its end (nothing to prune, no notification)', () => {
    const { result } = live();
    const at = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => at);
    act(() => addOwnBubble(own('a')));
    const before = result.current;
    act(() => {
      vi.advanceTimersByTime(flightMs('hi') + 10);
    });
    expect(result.current).toBe(before);
  });

  it("draws a peer's message once and drops a repeat, a malformed op and your own repeated id", () => {
    const { result } = live();
    act(() => receivePeerSay('p1', peerOp('x')));
    act(() => receivePeerSay('p1', peerOp('x')));
    act(() => receivePeerSay('p1', { kind: 'avatar-say' }));
    act(() => receivePeerSay('p1', 'nonsense'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ from: 'p1', own: false, text: 'hello' });
    act(() => addOwnBubble(own('y')));
    act(() => receivePeerSay('p1', peerOp('y')));
    expect(result.current).toHaveLength(2);
  });

  it('empties on reset, clears its timers and forgets what it has seen', () => {
    const { result } = live();
    act(() => receivePeerSay('p1', peerOp('x')));
    act(() => resetSpeechBubbles());
    expect(result.current).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    act(() => receivePeerSay('p1', peerOp('x')));
    expect(result.current).toHaveLength(1);
  });

  it('renders no bubbles on the server', () => {
    function Probe() {
      return <span>{useSpeechBubbles().length}</span>;
    }
    expect(renderToString(<Probe />)).toContain('>0<');
  });
});
