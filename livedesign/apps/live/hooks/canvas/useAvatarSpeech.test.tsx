// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSpeechBubbles, receivePeerSay, useSpeechBubbles } from '@/lib/avatar-speech-store';
import { SPEECH_COOLDOWN_MS } from '@/lib/avatar-speech';
import { useAvatarSpeech } from './useAvatarSpeech';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

type Args = Parameters<typeof useAvatarSpeech>[0];
const base: Args = {
  active: true,
  canSpeak: true,
  feet: { x: 100, y: 200 },
  scale: 1,
  tabId: 't1',
};

function setup(over: Partial<Args> = {}) {
  const onSay = vi.fn();
  const hook = renderHook(
    (args: Args) => ({ s: useAvatarSpeech(args), bubbles: useSpeechBubbles() }),
    {
      initialProps: { ...base, onSay, ...over },
    },
  );
  return { ...hook, onSay };
}

const enter = (init: KeyboardEventInit = {}, target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
};

beforeEach(() => {
  vi.useFakeTimers();
  track.mockClear();
});
afterEach(() => {
  resetSpeechBubbles();
  vi.useRealTimers();
});

describe('useAvatarSpeech (docs/specs/008-canvas/avatar-mode.md "Speech bubbles")', () => {
  it('Enter opens the composer, and claims the key', () => {
    const { result } = setup();
    const e = enter();
    expect(result.current.s.composerOpen).toBe(true);
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores Enter with a modifier, or while typing somewhere else', () => {
    const { result } = setup();
    enter({ shiftKey: true });
    const input = document.createElement('input');
    document.body.append(input);
    enter({}, input);
    input.remove();
    expect(result.current.s.composerOpen).toBe(false);
  });

  it('leaves Enter to a focused button, menu row or the tour card, which act on it themselves', () => {
    const { result } = setup();
    const button = document.createElement('button');
    const row = document.createElement('div');
    row.setAttribute('role', 'menuitem');
    const tour = document.createElement('div');
    tour.setAttribute('data-tour-popover', '');
    const inTour = document.createElement('span');
    tour.append(inTour);
    for (const target of [button, row, inTour]) {
      document.body.append(target.parentElement === tour ? tour : target);
      const e = enter({}, target);
      expect(e.defaultPrevented).toBe(false);
    }
    button.remove();
    row.remove();
    tour.remove();
    expect(result.current.s.composerOpen).toBe(false);
  });

  it('a Viewer cannot speak: Enter does nothing and nothing sends', () => {
    const { result, onSay } = setup({ canSpeak: false });
    enter();
    expect(result.current.s.composerOpen).toBe(false);
    act(() => {
      expect(result.current.s.send('hello', 'panel')).toBe(false);
    });
    expect(onSay).not.toHaveBeenCalled();
    expect(result.current.s.speaking).toBe(false);
  });

  it('sending adds your bubble above your head, tells the room, and closes the composer', () => {
    const { result, onSay } = setup();
    enter();
    act(() => {
      result.current.s.send('  hello there  ', 'composer');
    });
    expect(result.current.s.composerOpen).toBe(false);
    const [b] = result.current.bubbles;
    expect(b).toMatchObject({ own: true, text: 'hello there', tabId: 't1', x: 100, y: 136 });
    expect(onSay).toHaveBeenCalledWith({ id: b!.id, text: 'hello there', x: 100, y: 136 });
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AvatarMessage');
  });

  it('the panel sends under its own telemetry token', () => {
    const { result } = setup();
    act(() => {
      result.current.s.send('hi', 'panel');
    });
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AvatarMessagePanel');
  });

  it('a blank message just closes the composer', () => {
    const { result, onSay } = setup();
    enter();
    act(() => {
      result.current.s.send('   ', 'composer');
    });
    expect(result.current.s.composerOpen).toBe(false);
    expect(onSay).not.toHaveBeenCalled();
  });

  it('holds a second message until the cooldown passes', () => {
    const { result, onSay } = setup();
    act(() => {
      result.current.s.send('one', 'panel');
    });
    expect(result.current.s.coolingDown).toBe(true);
    act(() => {
      expect(result.current.s.send('two', 'panel')).toBe(false);
    });
    act(() => {
      vi.advanceTimersByTime(SPEECH_COOLDOWN_MS);
    });
    expect(result.current.s.coolingDown).toBe(false);
    act(() => {
      expect(result.current.s.send('two', 'panel')).toBe(true);
    });
    expect(onSay).toHaveBeenCalledTimes(2);
  });

  it('closes the composer on leaving the mode or the tab', () => {
    const { result, rerender, onSay } = setup();
    enter();
    rerender({ ...base, onSay, tabId: 't2' });
    expect(result.current.s.composerOpen).toBe(false);
    enter();
    rerender({ ...base, onSay, tabId: 't2', active: false });
    expect(result.current.s.composerOpen).toBe(false);
  });

  it('a bubble is gone when its flight ends', () => {
    const { result } = setup();
    act(() => {
      result.current.s.send('hi', 'panel');
    });
    expect(result.current.bubbles).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(result.current.bubbles).toHaveLength(0);
  });
});

describe('receivePeerSay', () => {
  it('draws a well-formed op once, and drops a repeat or a malformed one', () => {
    const { result } = setup();
    const op = { kind: 'avatar-say', tabId: 't1', id: 'p-1', text: 'hey', x: 5, y: 6 };
    act(() => {
      receivePeerSay('peer', op);
      receivePeerSay('peer', op);
      receivePeerSay('peer', { ...op, id: 'p-2', text: 7 });
    });
    expect(result.current.bubbles).toEqual([
      expect.objectContaining({ id: 'p-1', from: 'peer', own: false, text: 'hey' }),
    ]);
  });

  it('keeps at most three of one person on screen, hurrying the oldest', () => {
    const { result } = setup();
    act(() => {
      for (let i = 0; i < 4; i += 1)
        receivePeerSay('peer', {
          kind: 'avatar-say',
          tabId: 't1',
          id: `b${i}`,
          text: 'x',
          x: 0,
          y: 0,
        });
    });
    expect(result.current.bubbles[0]?.leavingAt).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.bubbles.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });
});
