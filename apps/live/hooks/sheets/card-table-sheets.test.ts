// @vitest-environment jsdom
// docs/specs/026-plan/items.md "The Plan strip": the strip shows while the tab has a board, a view, or a Sheet holding
// a card table; never on an empty tab or one of plain Sheets and diagrams.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import {
  forgetCardTableSheets,
  markCardTableSheet,
  showsCards,
  useTabShowsCards,
} from './card-table-sheets';

afterEach(() => forgetCardTableSheets());

const shape = (kind: Parameters<typeof createShape>[0], extra: object = {}): Element =>
  ({ ...createShape(kind, 0, 0), ...extra }) as Element;

describe('showsCards', () => {
  const none = new Set<string>();

  it('is false for an empty tab and one of diagrams and plain Sheets', () => {
    expect(showsCards([], none)).toBe(false);
    const sheet = shape('plan-sheet', { planSheet: { sheetId: 's1' } });
    expect(showsCards([shape('square'), sheet], none)).toBe(false);
  });

  it('is true for a board or a view', () => {
    expect(showsCards([shape('plan-board')], none)).toBe(true);
    expect(showsCards([shape('plan-view')], none)).toBe(true);
  });

  it('is true for a Sheet holding a card table', () => {
    const sheet = shape('plan-sheet', { planSheet: { sheetId: 's1' } });
    expect(showsCards([sheet], new Set(['s1']))).toBe(true);
    expect(showsCards([sheet], new Set(['s2']))).toBe(false);
  });
});

describe('useTabShowsCards', () => {
  it('shows the strip the moment a Sheet on the tab gains a card table, and hides it when it loses it', () => {
    const elements = [shape('plan-sheet', { planSheet: { sheetId: 's1' } })];
    const { result } = renderHook(() => useTabShowsCards(elements));
    expect(result.current).toBe(false);
    act(() => markCardTableSheet('s1', true));
    expect(result.current).toBe(true);
    act(() => markCardTableSheet('s1', false));
    expect(result.current).toBe(false);
  });

  it('re-renders nothing for a mark that changes nothing', () => {
    let renders = 0;
    const elements = [shape('plan-board')];
    renderHook(() => {
      renders++;
      return useTabShowsCards(elements);
    });
    act(() => markCardTableSheet('s1', false));
    expect(renders).toBe(1);
  });
});
