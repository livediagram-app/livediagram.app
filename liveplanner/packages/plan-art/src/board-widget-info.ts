// What each board widget is called and is for (docs/specs/026-plan/board-widgets.md "Widget kinds"):
// the palette tile's caption and hover card, and the widget's accessible name on the board.
import type { BoardField, BoardWidgetKind, FieldWidgetView } from '@liveplanner/items';
import { typeNamesText } from './field-widget-stats';

export const BOARD_WIDGET_INFO: Record<BoardWidgetKind, { label: string; description: string }> = {
  count: { label: 'Item Count', description: 'How many items the board shows.' },
  progress: {
    label: 'Completion',
    description: 'A bar and the percent of the board’s items in its done column.',
  },
  filter: {
    label: 'Filter',
    description: 'A search box that narrows the cards to those that match.',
  },
  mine: { label: 'Only Mine', description: 'Shows only the cards that are yours.' },
  people: { label: 'People', description: 'Who has cards on the board, by avatar.' },
  unplaced: {
    label: 'Not on Board',
    description: 'Items whose status no column shows, to move onto the board.',
  },
  types: { label: 'Card Types', description: 'How many cards of each type the board holds.' },
  wip: { label: 'WIP Alerts', description: 'How many columns are over their WIP limit.' },
  due: { label: 'Due Soon', description: 'Cards overdue, and cards due in the next 7 days.' },
  points: {
    label: 'Points',
    description: 'Estimate points done out of all on the board: a sprint’s burn-up at a glance.',
  },
  time: {
    label: 'Time',
    description: 'Hours on the board’s cards, and the timers running now.',
  },
  priorities: {
    label: 'Priorities',
    description: 'How many cards are urgent, high, medium and low; press one to see those.',
  },
  unassigned: {
    label: 'Unassigned',
    description: 'Cards nobody has picked up yet; press it to see them.',
  },
  'top-voted': {
    label: 'Top Voted',
    description: 'The card with the most votes, for a retro’s first action; press it to open.',
  },
  stale: {
    label: 'Stale Cards',
    description: 'Cards not done that nobody has changed in two weeks.',
  },
};

// What each field widget view is called and reads (docs/specs/026-plan/board-widgets.md "What each view reads"): the
// widget's name after its field's ("Budget Sum") and the gallery tile's line.
export const FIELD_WIDGET_VIEW_INFO: Record<
  FieldWidgetView,
  { label: string; description: string }
> = {
  sum: { label: 'Sum', description: 'Every card’s value added up.' },
  average: { label: 'Average', description: 'The mean of the cards that have a value.' },
  range: { label: 'Range', description: 'The lowest value to the highest.' },
  spread: {
    label: 'Spread',
    description: 'How the values are spread, low to high, in eight bars.',
  },
  stars: { label: 'Average Stars', description: 'The average rating, in stars.' },
  breakdown: { label: 'Breakdown', description: 'One bar split by value, the commonest named.' },
  donut: { label: 'Donut', description: 'A ring split by value, and the commonest share.' },
  ticked: { label: 'Ticked', description: 'How much is ticked, of all there is to tick.' },
  upcoming: { label: 'Upcoming', description: 'Cards overdue, and due in the next 7 days.' },
  timeline: { label: 'Timeline', description: 'When cards fall due over the next four weeks.' },
};

// A field widget's name: its field's and its view's ("Budget Sum").
export const fieldWidgetLabel = (field: Pick<BoardField, 'def'>, view: FieldWidgetView): string =>
  `${field.def.label} ${FIELD_WIDGET_VIEW_INFO[view].label}`;

// Its name with the card types it reads, for its tooltip and accessible name ("Budget Sum, on Feature cards").
export const fieldWidgetTitle = (field: BoardField, view: FieldWidgetView): string =>
  `${fieldWidgetLabel(field, view)}, on ${typeNamesText(field.types.map((t) => t.label))} cards`;
