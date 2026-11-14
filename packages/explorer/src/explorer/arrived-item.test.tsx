import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ARRIVED_WAIT_MS, arrivedSelector, useArrivedItem } from './arrived-item';

const root = () => {
  const el = document.createElement('div');
  el.setAttribute('data-explorer', '');
  document.body.append(el);
  return el;
};
const row = (attr: string, id: string) => {
  const el = document.createElement('li');
  el.setAttribute(attr, id);
  el.scrollIntoView = vi.fn();
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('arrivedSelector', () => {
  it("matches an index item's row or card and This Browser's row, escaping the id", () => {
    expect(arrivedSelector('a"b')).toBe(
      '[data-item-row="a\\"b"],[data-item-card="a\\"b"],[data-this-browser-row="a\\"b"]',
    );
  });
});

describe('useArrivedItem', () => {
  it('marks and scrolls to a row already drawn', () => {
    const r = row('data-item-row', 'd1');
    root().append(r);
    renderHook(() => useArrivedItem('d1'));
    expect(r.hasAttribute('data-arrived')).toBe(true);
    expect(r.getAttribute('aria-current')).toBe('true');
    expect(r.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('marks a card drawn after the page, and again when the window draws it anew', async () => {
    const host = root();
    const { unmount } = renderHook(() => useArrivedItem('d2'));
    const card = row('data-item-card', 'd2');
    await act(async () => {
      host.append(card);
      await Promise.resolve();
    });
    expect(card.hasAttribute('data-arrived')).toBe(true);
    // The window dropped it and drew it again: the new card is marked and centred too.
    card.remove();
    const again = row('data-item-card', 'd2');
    await act(async () => {
      host.append(again);
      await Promise.resolve();
    });
    expect(again.hasAttribute('data-arrived')).toBe(true);
    expect(again.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    unmount();
  });

  it('stops moving the page once settled, by time or by the person, but keeps the ring', async () => {
    vi.useFakeTimers();
    const host = root();
    renderHook(() => useArrivedItem('d3'));
    act(() => {
      vi.advanceTimersByTime(ARRIVED_WAIT_MS);
    });
    const late = row('data-item-row', 'd3');
    await act(async () => {
      host.append(late);
      await Promise.resolve();
    });
    expect(late.hasAttribute('data-arrived')).toBe(true);
    expect(late.scrollIntoView).not.toHaveBeenCalled();
  });

  it('stops moving the page when the person scrolls', async () => {
    const host = root();
    renderHook(() => useArrivedItem('d5'));
    act(() => {
      window.dispatchEvent(new Event('wheel'));
    });
    const late = row('data-item-row', 'd5');
    await act(async () => {
      host.append(late);
      await Promise.resolve();
    });
    expect(late.hasAttribute('data-arrived')).toBe(true);
    expect(late.scrollIntoView).not.toHaveBeenCalled();
  });

  it('marks nothing outside the Explorer, and nothing for no item', () => {
    const outside = row('data-item-row', 'd4');
    document.body.append(outside);
    renderHook(() => useArrivedItem('d4'));
    renderHook(() => useArrivedItem(null));
    expect(outside.hasAttribute('data-arrived')).toBe(false);
  });
});
