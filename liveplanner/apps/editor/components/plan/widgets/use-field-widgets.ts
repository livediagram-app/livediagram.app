'use client';

// What a board header needs for its field widgets (docs/specs/026-plan/board-widgets.md "Field widgets"): the fields
// its widgets can read (memoised on the types the board takes, so adding a widget never makes them anew), a Calculated
// field reader (only when one of them is calculated), each widget's name, and For You, worked out only when the
// gallery opens.
import { useCallback, useMemo } from 'react';
import {
  boardFields,
  calculatedReaderOf,
  donePhase,
  fieldWidgetState,
  isBoardWidgetKind,
  isFieldWidgetKey,
  parseFieldWidget,
  type BoardWidgetId,
  type CalculatedRead,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import {
  BOARD_WIDGET_INFO,
  FIELD_WIDGET_VIEW_INFO,
  fieldWidgetLabel,
  suggestWidgets,
  type WidgetSuggestion,
} from '@liveplanner/plan-art';
import { usePlan } from '../PlanContext';

export function useFieldWidgets({
  setup,
  items,
  types,
  widgets,
  now,
}: {
  setup: PlanBoardSetup;
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  widgets: readonly BoardWidgetId[];
  now: Date;
}) {
  const addTypes = setup.addTypes;
  const fields = useMemo(() => boardFields({ addTypes }, types), [addTypes, types]);
  const plan = usePlan();
  const calculated = fields.some((f) => f.def.kind === 'calculated');
  const planItems = plan?.items;
  const planTypes = plan?.types;
  const phases = plan?.statusPhases;
  const read = useMemo<CalculatedRead | undefined>(
    () =>
      calculated && planItems && planTypes && phases
        ? calculatedReaderOf(planItems, planTypes, donePhase(phases))
        : undefined,
    [calculated, planItems, planTypes, phases],
  );
  const labelOf = useCallback(
    (id: BoardWidgetId): string => {
      if (isBoardWidgetKind(id)) return BOARD_WIDGET_INFO[id].label;
      const state = isFieldWidgetKey(id) ? fieldWidgetState(id, fields) : null;
      if (state && state.state !== 'removed')
        return fieldWidgetLabel(state.field, parseFieldWidget(id)!.view);
      const view = parseFieldWidget(id)?.view;
      return view ? `Removed field ${FIELD_WIDGET_VIEW_INFO[view].label}` : 'Widget';
    },
    [fields],
  );
  const suggest = useCallback(
    (): WidgetSuggestion[] => suggestWidgets({ setup, items, types, fields, widgets, now, read }),
    [setup, items, types, fields, widgets, now, read],
  );
  return { fields, read, labelOf, suggest };
}
