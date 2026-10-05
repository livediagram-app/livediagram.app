// What each board widget is called and is for (docs/specs/025-plan/board-widgets.md "Widget kinds"):
// the palette tile's caption and hover card, and the widget's accessible name on the board.
import type { BoardWidgetKind } from '@livediagram/items';

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
  mine: { label: 'Only Mine', description: 'Shows only the cards assigned to you.' },
  people: { label: 'People', description: 'Who has cards on the board, by avatar.' },
  unplaced: {
    label: 'Not on Board',
    description: 'Items whose status no column shows, to move onto the board.',
  },
  types: { label: 'Card Types', description: 'How many cards of each type the board holds.' },
  wip: { label: 'WIP Alerts', description: 'How many columns are over their WIP limit.' },
  due: { label: 'Due Soon', description: 'Cards overdue, and cards due in the next 7 days.' },
  votes: { label: 'Votes Left', description: 'Your votes left, on a board with voting on.' },
};

// The drag type a widget tile carries, so only a board's header takes it.
export const PLAN_WIDGET_MIME = 'application/x-livediagram-plan-widget';
