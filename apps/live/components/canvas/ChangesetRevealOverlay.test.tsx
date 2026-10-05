// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { CHANGESET_REVEAL_MS } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { createRevealStore } from '@/lib/changeset-reveals';
import { ChangesetRevealContext, ChangesetRevealOverlay } from './ChangesetRevealOverlay';

const box = (id: string, x: number): Element =>
  ({ id, type: 'shape', shape: 'square', x, y: 10, width: 100, height: 50 }) as Element;

describe('ChangesetRevealOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function setUp() {
    const store = createRevealStore();
    const view = render(
      <ChangesetRevealContext.Provider value={store}>
        <ChangesetRevealOverlay elements={[box('a', 0), box('b', 200)]} tabId="t1" />
      </ChangesetRevealContext.Provider>,
    );
    return { store, view };
  }

  it("outlines each touched element on the tab 4 px outside, in the author's colour, for the reveal time", () => {
    const { store, view } = setUp();
    act(() =>
      store.add({
        changesetId: 'cs_1',
        tabId: 't1',
        color: 'rgb(255, 0, 0)',
        ids: ['a', 'gone'],
        until: Date.now() + CHANGESET_REVEAL_MS,
      }),
    );
    const outlines = view.container.querySelectorAll<HTMLElement>('[data-reveal-id]');
    expect([...outlines].map((o) => o.dataset.revealId)).toEqual(['a']);
    expect(outlines[0]!.style).toMatchObject({
      left: '-4px',
      top: '6px',
      width: '108px',
      height: '58px',
    });
    expect(outlines[0]!.style.border).toBe('2px solid rgb(255, 0, 0)');
    expect(
      view.container.querySelector('[data-changeset-reveal]')!.getAttribute('aria-hidden'),
    ).toBe('true');
    act(() => vi.advanceTimersByTime(CHANGESET_REVEAL_MS));
    expect(view.container.querySelector('[data-reveal-id]')).toBeNull();
  });

  it('draws nothing for another tab, or without a feed', () => {
    const { store, view } = setUp();
    act(() =>
      store.add({
        changesetId: 'cs_1',
        tabId: 't2',
        color: '#f00',
        ids: ['a'],
        until: Date.now() + 2000,
      }),
    );
    expect(view.container.querySelector('[data-reveal-id]')).toBeNull();
    cleanup();
    const bare = render(<ChangesetRevealOverlay elements={[box('a', 0)]} tabId="t1" />);
    expect(bare.container.innerHTML).toBe('');
  });
});
