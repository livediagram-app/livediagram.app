import { describe, expect, it } from 'vitest';
import { BOARD_WIDGET_KINDS } from './board-widgets';
import { BOARD_WIDGET_INFO, FIELD_WIDGET_VIEW_INFO, fieldWidgetLabel } from './board-widget-names';
import { FIELD_WIDGET_VIEWS } from './field-widgets';

// docs/specs/026-plan/board-widgets.md: every kind and view has a name, and a field widget is its field's and view's.
describe('board widget names', () => {
  it('names every kind and every view', () => {
    for (const k of BOARD_WIDGET_KINDS) expect(BOARD_WIDGET_INFO[k].label).toBeTruthy();
    for (const v of FIELD_WIDGET_VIEWS) expect(FIELD_WIDGET_VIEW_INFO[v].label).toBeTruthy();
  });

  it('names a field widget by its field and view', () => {
    const def = { id: 'f-budget', label: 'Budget', kind: 'currency' as const };
    expect(fieldWidgetLabel({ def }, 'sum')).toBe('Budget Sum');
    expect(fieldWidgetLabel({ def }, 'stars')).toBe('Budget Average Stars');
  });
});
