// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { AudioWake, isHeld } from './audio-wake';

// docs/specs/012-collaboration/proximity-audio.md "Someone who arrives later": a call joined before any press, or sound
// the browser suspended later, played nothing from a later arrival until a reload and a click.

function fakeContext(state: string) {
  const target = new EventTarget();
  const context = {
    state,
    resume: vi.fn(async () => {}),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    // The browser moves the state and says so.
    to(next: string) {
      context.state = next;
      target.dispatchEvent(new Event('statechange'));
    },
  };
  return context;
}

function targets() {
  const win = new EventTarget();
  const visibilityState: DocumentVisibilityState = 'visible';
  const doc: EventTarget & { visibilityState: DocumentVisibilityState } = Object.assign(
    new EventTarget(),
    { visibilityState },
  );
  return { window: win, document: doc };
}

const make = (state: string) => {
  const context = fakeContext(state);
  const where = targets();
  const held = vi.fn();
  const wake = new AudioWake(context as unknown as AudioContext, held, where);
  return { context, where, held, wake };
};

describe('isHeld', () => {
  it('holds suspended and interrupted sound, never running or closed', () => {
    expect(isHeld({ state: 'suspended' })).toBe(true);
    expect(isHeld({ state: 'interrupted' })).toBe(true);
    expect(isHeld({ state: 'running' })).toBe(false);
    expect(isHeld({ state: 'closed' })).toBe(false);
  });
});

describe('AudioWake', () => {
  it('reports a context made held at once, and running once it starts', () => {
    const { context, held } = make('suspended');
    expect(held).toHaveBeenLastCalledWith(true);
    context.to('running');
    expect(held).toHaveBeenLastCalledWith(false);
    expect(held).toHaveBeenCalledTimes(2);
  });

  it('says nothing for a context that runs, and adds no listener to any press', () => {
    const { where, held, context } = make('running');
    const add = vi.spyOn(where.window, 'addEventListener');
    expect(held).not.toHaveBeenCalled();
    where.window.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('tries to resume on a voice, a press, a key, focus, pageshow and the tab showing', () => {
    const { context, where, wake } = make('suspended');
    wake.nudge();
    for (const name of ['pointerdown', 'keydown', 'touchend', 'focus', 'pageshow']) {
      where.window.dispatchEvent(new Event(name));
    }
    where.document.dispatchEvent(new Event('visibilitychange'));
    expect(context.resume).toHaveBeenCalledTimes(7);
    // A tab that hid is no chance.
    where.document.visibilityState = 'hidden';
    where.document.dispatchEvent(new Event('visibilitychange'));
    expect(context.resume).toHaveBeenCalledTimes(7);
  });

  it('wakes sound the browser suspended later, long after the call started', () => {
    const { context, where, held } = make('running');
    context.to('interrupted');
    expect(held).toHaveBeenLastCalledWith(true);
    where.window.dispatchEvent(new Event('focus'));
    expect(context.resume).toHaveBeenCalledTimes(1);
    context.to('running');
    where.window.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when a resume is refused, until the context runs', () => {
    const { context, where } = make('suspended');
    context.resume.mockRejectedValueOnce(new Error('not allowed'));
    where.window.dispatchEvent(new Event('focus'));
    where.window.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('stops listening and reporting once disposed', () => {
    const { context, where, held, wake } = make('suspended');
    wake.dispose();
    wake.dispose();
    where.window.dispatchEvent(new Event('pointerdown'));
    wake.nudge();
    context.to('running');
    expect(context.resume).not.toHaveBeenCalled();
    expect(held).toHaveBeenCalledTimes(1);
  });

  it('reads a stand-in context without events once, as running', () => {
    const held = vi.fn();
    const wake = new AudioWake({ resume: vi.fn() } as unknown as AudioContext, held, targets());
    wake.nudge();
    wake.dispose();
    expect(held).not.toHaveBeenCalled();
  });

  it('defaults to the page’s window and document', () => {
    const context = fakeContext('suspended');
    const wake = new AudioWake(context as unknown as AudioContext, vi.fn());
    window.dispatchEvent(new Event('keydown'));
    expect(context.resume).toHaveBeenCalledTimes(1);
    wake.dispose();
  });

  // A running call's presses cost nothing; a held one's cost one resume each. Budgeted in CPU time.
  it('handles 10,000 presses on a running call within budget', () => {
    const { where } = make('running');
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i++) where.window.dispatchEvent(new Event('pointerdown'));
    });
    expect(ms).toBeLessThan(500);
  });
});
