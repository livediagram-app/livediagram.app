// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  selectedCardIds,
  tabHasHideable,
  useWalkthroughHideable,
  WALKTHROUGH_HIDE_MARKS,
  type HideableTab,
} from './walkthrough-hideable';

const dashboard = (filled: boolean): HideableTab => ({
  kind: 'dashboard',
  elements: [],
  dashboard: {
    rows: [
      {
        id: 'r1',
        height: 1,
        slots: [
          { id: 's1', span: 6 },
          filled
            ? { id: 's2', span: 6, content: { kind: 'note' } as never }
            : { id: 's2', span: 6 },
        ],
      },
    ],
  },
});

describe('what a walkthrough can hide on each tab', () => {
  it('is any element on a canvas tab, and nothing on an empty one', () => {
    expect(tabHasHideable({ elements: [{}] }, 0)).toBe(true);
    expect(tabHasHideable({ kind: 'diagram', elements: [] }, 5)).toBe(false);
  });

  it('is the cards on a Board tab', () => {
    expect(tabHasHideable({ kind: 'board', elements: [{}] }, 3)).toBe(true);
    expect(tabHasHideable({ kind: 'board', elements: [{}] }, 0)).toBe(false);
  });

  it('is the filled slots on a Dashboard tab', () => {
    expect(tabHasHideable(dashboard(true), 0)).toBe(true);
    expect(tabHasHideable(dashboard(false), 0)).toBe(false);
    expect(tabHasHideable({ kind: 'dashboard', elements: [] }, 0)).toBe(false);
  });

  it('is nothing on a Sheet or a Form tab', () => {
    expect(tabHasHideable({ kind: 'sheet', elements: [{}] }, 9)).toBe(false);
    expect(tabHasHideable({ kind: 'form', elements: [{}] }, 9)).toBe(false);
  });
});

describe('the host hand-off', () => {
  it('reads the selected cards, once each', () => {
    document.body.innerHTML =
      '<div data-plan-card="a" data-selected="true"></div><div data-plan-card="b"></div>' +
      '<div data-plan-card="a" data-selected="true"></div><div data-plan-card="" data-selected="true"></div>';
    expect(selectedCardIds()).toEqual(['a']);
    document.body.innerHTML = '';
  });

  it('names the card and slot marks, and answers for the tab showing', () => {
    const sheet: HideableTab = { kind: 'sheet', elements: [] };
    const { result, rerender } = renderHook(
      ({ tab }: { tab: HideableTab }) => useWalkthroughHideable(tab, 2),
      { initialProps: { tab: sheet } },
    );
    expect(result.current.marks).toBe(WALKTHROUGH_HIDE_MARKS);
    expect(result.current.canHide()).toBe(false);
    expect(result.current.selection?.()).toEqual([]);
    rerender({ tab: { kind: 'board', elements: [] } });
    expect(result.current.canHide()).toBe(true);
  });
});
