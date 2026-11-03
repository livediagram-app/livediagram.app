// What each board widget is called and is for (docs/specs/026-plan/board-widgets.md "Widget kinds"): the names live
// in @liveplanner/items (board-widget-names.ts), shared with agent-verbs; the title with the card types it reads is
// drawn here.
import { fieldWidgetLabel, type BoardField, type FieldWidgetView } from '@liveplanner/items';
import { typeNamesText } from './field-widget-stats';

export { BOARD_WIDGET_INFO, FIELD_WIDGET_VIEW_INFO, fieldWidgetLabel } from '@liveplanner/items';

// Its name with the card types it reads, for its tooltip and accessible name ("Budget Sum, on Feature cards").
export const fieldWidgetTitle = (field: BoardField, view: FieldWidgetView): string =>
  `${fieldWidgetLabel(field, view)}, on ${typeNamesText(field.types.map((t) => t.label))} cards`;
