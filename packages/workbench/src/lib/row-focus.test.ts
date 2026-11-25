// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOCUS_TRIES, focusWhenDrawn, neighbourId, rowFocus } from './row-focus';

// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md "Focus".

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function list(ids: string[]) {
  document.body.innerHTML = ids.map((id) => `<button data-row="${id}">${id}</button>`).join('');
}
const control = (id: string) => document.querySelector<HTMLElement>(`[data-row="${id}"]`);

describe('neighbourId', () => {
  it('is the next row, else the previous, skipping what goes with it', () => {
    expect(neighbourId(['a', 'b', 'c'], 'b')).toBe('c');
    expect(neighbourId(['a', 'b', 'c'], 'c')).toBe('b');
    expect(neighbourId(['a', 'b', 'c', 'd'], 'b', new Set(['b', 'c']))).toBe('d');
    expect(neighbourId(['a', 'b', 'c'], 'b', new Set(['b', 'c']))).toBe('a');
    expect(neighbourId(['a'], 'a')).toBeNull();
    expect(neighbourId(['a'], 'ghost')).toBeNull();
  });
});

describe('rowFocus', () => {
  it('focuses the neighbour once the row has gone, and the row once Undo brings it back', () => {
    vi.useFakeTimers();
    list(['a', 'b', 'c']);
    const focus = rowFocus({ ids: ['a', 'b', 'c'], id: 'b', control });
    control('b')!.remove();
    focus.removed();
    vi.runAllTimers();
    expect(document.activeElement).toBe(control('c'));
    focus.restored();
    // Drawn a turn later.
    vi.advanceTimersByTime(0);
    document.body.insertAdjacentHTML('afterbegin', '<button data-row="b">b</button>');
    vi.runAllTimers();
    expect(document.activeElement).toBe(control('b'));
  });

  it('falls back to the add button when no row is left', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button data-add>Add</button>';
    rowFocus({
      ids: ['a'],
      id: 'a',
      control,
      fallback: () => document.querySelector('[data-add]'),
    }).removed();
    vi.runAllTimers();
    expect(document.activeElement?.textContent).toBe('Add');
  });

  it('gives up after a bounded number of looks', () => {
    vi.useFakeTimers();
    const find = vi.fn(() => null);
    focusWhenDrawn(find);
    vi.runAllTimers();
    expect(find).toHaveBeenCalledTimes(FOCUS_TRIES);
  });
});
