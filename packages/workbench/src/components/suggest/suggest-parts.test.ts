// @vitest-environment jsdom
// Suggestions' parts (liveworkspace/docs/specs/016-notifications/suggestions.md): what this browser remembers, whether
// the person is mid-gesture, and the notice slot's holders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { holdNoticeSlot, noticeSlotHeld, onNoticeSlot } from '../../lib/notice-slot';
import { busyNow, resetActivityForTests, watchActivity } from './suggest-activity';
import {
  decideSuggestion,
  maySuggest,
  resetSuggestionMemoryForTests,
  turnOffSuggestion,
} from './suggest-memory';
import { maySuggestTo } from './suggest-gate';
import { SUGGEST_DECIDED_MAX, SUGGEST_IDLE_MS } from './suggestions';

beforeEach(() => {
  resetSuggestionMemoryForTests();
  resetActivityForTests();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('suggestion memory', () => {
  it('suggests until taken or dismissed for the item, then never for it again', () => {
    expect(maySuggest('make-plan', 'A')).toBe(true);
    decideSuggestion('make-plan', 'A');
    expect(maySuggest('make-plan', 'A')).toBe(false);
    expect(maySuggest('make-plan', 'B')).toBe(true);
    expect(maySuggest('write-up', 'A')).toBe(true);
  });

  it("Don't Suggest This Again turns one off for every item", () => {
    turnOffSuggestion('write-up');
    turnOffSuggestion('write-up');
    expect(maySuggest('write-up', 'X')).toBe(false);
    expect(maySuggest('make-plan', 'X')).toBe(true);
  });

  it('keeps the newest decisions, at most SUGGEST_DECIDED_MAX', () => {
    for (let i = 0; i <= SUGGEST_DECIDED_MAX; i++) decideSuggestion('bring-in', `kb${i}`);
    decideSuggestion('bring-in', `kb${SUGGEST_DECIDED_MAX}`);
    expect(maySuggest('bring-in', 'kb0')).toBe(true);
    expect(maySuggest('bring-in', 'kb1')).toBe(false);
  });

  it('reads broken or blocked storage as nothing remembered', () => {
    localStorage.setItem('liveworkspace:suggestions', '{nope');
    expect(maySuggest('make-plan', 'A')).toBe(true);
    localStorage.setItem('liveworkspace:suggestions', JSON.stringify({ off: 'x', decided: 3 }));
    expect(maySuggest('make-plan', 'A')).toBe(true);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(maySuggest('make-plan', 'A')).toBe(true);
    expect(() => decideSuggestion('make-plan', 'A')).not.toThrow();
    expect(() => resetSuggestionMemoryForTests()).not.toThrow();
    get.mockRestore();
    set.mockRestore();
    remove.mockRestore();
  });
});

describe('mid-gesture', () => {
  it('is busy while a pointer is held and for the quiet after a key or a release', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    watchActivity();
    watchActivity();
    expect(busyNow()).toBe(false);
    window.dispatchEvent(new Event('pointerdown'));
    vi.setSystemTime(200_000);
    expect(busyNow()).toBe(true);
    window.dispatchEvent(new Event('pointerup'));
    expect(busyNow()).toBe(true);
    vi.setSystemTime(200_000 + SUGGEST_IDLE_MS);
    expect(busyNow()).toBe(false);
    window.dispatchEvent(new Event('keydown'));
    expect(busyNow()).toBe(true);
    vi.setSystemTime(300_000);
    window.dispatchEvent(new Event('pointercancel'));
    expect(busyNow(300_000 + SUGGEST_IDLE_MS)).toBe(false);
  });

  it('is busy while a field or editable text has the focus, not a button or a checkbox', () => {
    document.body.innerHTML =
      '<input id="t" /><input id="c" type="checkbox" /><textarea id="a"></textarea><div id="e" contenteditable="true" tabindex="0"></div><button id="b">B</button>';
    const at = (id: string) => {
      (document.getElementById(id) as HTMLElement).focus();
      return busyNow(Number.MAX_SAFE_INTEGER);
    };
    expect(at('t')).toBe(true);
    expect(at('c')).toBe(false);
    expect(at('a')).toBe(true);
    const editable = document.getElementById('e') as HTMLElement;
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(at('e')).toBe(true);
    expect(at('b')).toBe(false);
  });

  it('costs next to nothing a keystroke (measured)', () => {
    watchActivity();
    const key = new Event('keydown');
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i++) window.dispatchEvent(key);
    });
    // 10,000 dispatches, each through jsdom's whole event path; the listener itself only stores a time.
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});

describe('the notice slot', () => {
  it('is held while any notice shows, and tells who listens', () => {
    const heard = vi.fn();
    const off = onNoticeSlot(heard);
    expect(noticeSlotHeld()).toBe(false);
    const a = holdNoticeSlot();
    const b = holdNoticeSlot();
    a();
    a();
    expect(noticeSlotHeld()).toBe(true);
    b();
    expect(noticeSlotHeld()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(4);
    off();
    holdNoticeSlot()();
    expect(heard).toHaveBeenCalledTimes(4);
  });
});

describe('who is offered a suggestion', () => {
  const base = { readOnly: false, signedIn: true };
  it('is an Editor, signed in, in a session that may act', () => {
    expect(maySuggestTo({ ...base, level: 'edit' })).toBe(true);
  });

  it('is never a Participant, a Viewer, a guest, read-only, Offline, an embed or Community', () => {
    expect(maySuggestTo({ ...base, level: 'participate' })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'view' })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'edit', signedIn: false })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'edit', readOnly: true })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'edit', offline: true })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'edit', embed: true })).toBe(false);
    expect(maySuggestTo({ ...base, level: 'edit', community: true })).toBe(false);
  });
});
