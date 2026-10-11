import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_CONDENSE_PX,
  PHONE_CARD_MIN_PX,
  PHONE_FIGURE_PX,
  PHONE_WORK_MIN_PX,
  isCondensed,
  phoneSlotSize,
  phoneSlotStyle,
} from './condense';

// docs/specs/026-plan/plan-tabs.md "On a phone": every slot full width, stacked, sized for what it holds.
describe('a Dashboard on a phone', () => {
  it('stacks only below its width, and not before it is measured', () => {
    expect(isCondensed(390)).toBe(true);
    expect(isCondensed(DASHBOARD_CONDENSE_PX)).toBe(false);
    expect(isCondensed(undefined)).toBe(false);
  });

  it('sizes each slot for what it holds', () => {
    expect(phoneSlotSize(undefined)).toBe('empty');
    expect(phoneSlotSize({ type: 'title', title: 'Q3', text: '' })).toBe('title');
    expect(phoneSlotSize({ type: 'note', title: 'Note', text: '' })).toBe('card');
    expect(phoneSlotSize({ type: 'links', title: 'Links', links: [] })).toBe('card');
    expect(phoneSlotSize({ type: 'sheet-metric', metric: 'cell', sheetId: '' } as never)).toBe(
      'figure',
    );
    expect(phoneSlotSize({ type: 'tab', tabId: 't', of: 'diagram' })).toBe('work');
    const el = { type: 'element' as const, elementId: 'e' };
    expect(phoneSlotSize(el, { shape: 'plan-view', planView: { view: 'metric:count' } })).toBe(
      'figure',
    );
    expect(phoneSlotSize(el, { shape: 'plan-view', planView: { view: 'gantt' } })).toBe('work');
    expect(phoneSlotSize(el, { shape: 'plan-board' })).toBe('work');
    expect(phoneSlotSize(el, undefined)).toBe('work');
  });

  it('gives a Title its text’s height, a card at least a small card’s, a figure a tile, work most of the screen', () => {
    expect(phoneSlotStyle('title')).not.toHaveProperty('height');
    expect(phoneSlotStyle('title')).not.toHaveProperty('minHeight');
    expect(phoneSlotStyle('card')).toMatchObject({ minHeight: PHONE_CARD_MIN_PX });
    expect(phoneSlotStyle('card')).not.toHaveProperty('height');
    expect(phoneSlotStyle('figure')).toMatchObject({ height: PHONE_FIGURE_PX });
    expect(phoneSlotStyle('work')).toMatchObject({ height: '66svh', minHeight: PHONE_WORK_MIN_PX });
    // One full-width cell whose card stretches to fill it.
    for (const size of ['title', 'card', 'figure', 'work', 'empty'] as const)
      expect(phoneSlotStyle(size)).toMatchObject({
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
      });
  });
});
