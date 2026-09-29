// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyHandoffKey,
  beginMindHandoff,
  claimMindHandoff,
  MIND_HANDOFF_TIMEOUT_MS,
  resetMindHandoff,
  type HandoffActions,
  type HandoffSegment,
} from './mind-handoff';

// docs/specs/009-elements/mind-node.md "Typing ahead".

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    key: k,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    ...mods,
  }) as KeyboardEvent;

const press = (k: string, mods: Partial<KeyboardEventInit> = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, cancelable: true, ...mods });
  window.dispatchEvent(e);
  return e;
};
const type = (text: string) => [...text].forEach((c) => press(c));

const actions = (): HandoffActions & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    settle: (id, text) => calls.push(`settle ${id} ${text}`),
    grow: (id, kind, label) => calls.push(`grow ${id} ${kind} ${label}`),
    abandon: (id) => calls.push(`abandon ${id}`),
  };
};

afterEach(() => {
  resetMindHandoff();
  vi.useRealTimers();
});

describe('applyHandoffKey', () => {
  const seg = (): HandoffSegment[] => [{ text: '' }];

  it('collects characters and honours Backspace', () => {
    const s = seg();
    for (const c of 'Abcx') applyHandoffKey(s, key(c));
    applyHandoffKey(s, key('Backspace'));
    expect(s).toEqual([{ text: 'Abc' }]);
  });

  it('ends a segment on Tab (child) and Enter (sibling)', () => {
    const s = seg();
    applyHandoffKey(s, key('A'));
    applyHandoffKey(s, key('Tab'));
    applyHandoffKey(s, key('B'));
    applyHandoffKey(s, key('Enter'));
    expect(s).toEqual([{ text: 'A', end: 'child' }, { text: 'B', end: 'sibling' }, { text: '' }]);
  });

  it('makes Shift+Enter a newline, not a sibling', () => {
    const s = seg();
    applyHandoffKey(s, key('Enter', { shiftKey: true }));
    expect(s).toEqual([{ text: '\n' }]);
  });

  it('lets modified keys through, so undo still works mid-burst', () => {
    expect(applyHandoffKey(seg(), key('z', { metaKey: true }))).toBe(false);
    expect(applyHandoffKey(seg(), key('z', { ctrlKey: true }))).toBe(false);
  });

  it('stops taking keys after Escape', () => {
    const s = seg();
    applyHandoffKey(s, key('Escape'));
    expect(applyHandoffKey(s, key('x'))).toBe(false);
  });
});

describe('beginMindHandoff / claimMindHandoff', () => {
  it('holds keys typed before the editor opens and hands them to it', () => {
    beginMindHandoff('n1', actions());
    const e = press('H');
    type('i');
    expect(e.defaultPrevented).toBe(true);
    expect(claimMindHandoff('n1')).toEqual({ type: 'text', text: 'Hi' });
    // Released: later keys reach the editor itself.
    expect(press('x').defaultPrevented).toBe(false);
  });

  it('returns nothing for a node no handoff is waiting on', () => {
    beginMindHandoff('n1', actions());
    expect(claimMindHandoff('other')).toBeNull();
  });

  it('finishes an ended node itself and carries the rest of the burst to the next', async () => {
    vi.useFakeTimers();
    const a = actions();
    beginMindHandoff('n1', a);
    type('Two');
    press('Tab');
    type('Thr');
    expect(claimMindHandoff('n1')).toEqual({ type: 'finished' });
    // Still capturing while the growth is on its way.
    type('ee');
    vi.advanceTimersByTime(0);
    expect(a.calls).toEqual(['grow n1 child Two']);
    // The growth opens the next handoff, which inherits what was typed.
    beginMindHandoff('n2', a);
    expect(claimMindHandoff('n2')).toEqual({ type: 'text', text: 'Three' });
  });

  it('keeps a node typed and left with Escape, and drops an empty one', () => {
    vi.useFakeTimers();
    const a = actions();
    beginMindHandoff('n1', a);
    type('Done');
    press('Escape');
    expect(claimMindHandoff('n1')).toEqual({ type: 'finished' });
    beginMindHandoff('n2', a);
    press('Escape');
    expect(claimMindHandoff('n2')).toEqual({ type: 'finished' });
    vi.advanceTimersByTime(0);
    expect(a.calls).toEqual(['settle n1 Done', 'abandon n2']);
  });

  it('writes typed text to the label if the editor never claims it', () => {
    vi.useFakeTimers();
    const a = actions();
    beginMindHandoff('n1', a);
    type('Lost?');
    vi.advanceTimersByTime(MIND_HANDOFF_TIMEOUT_MS);
    expect(a.calls).toEqual(['settle n1 Lost?']);
    expect(press('x').defaultPrevented).toBe(false);
  });

  it('settles an unclaimed node when another growth starts first', () => {
    const a = actions();
    beginMindHandoff('n1', a);
    type('Kept');
    beginMindHandoff('n2', a);
    expect(a.calls).toEqual(['settle n1 Kept']);
    expect(claimMindHandoff('n2')).toEqual({ type: 'text', text: '' });
  });
});
