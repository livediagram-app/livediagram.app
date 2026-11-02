// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { timeOfDayText, type Item } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { CalendarEntryFace } from './calendar-day';

// The face each entry draws, by the size it is asked for.
vi.mock('../PlanCardFace', () => ({
  PlanCardFace: ({ size }: { size: string }) => <span data-testid="face" data-size={size} />,
}));

afterEach(cleanup);

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const CARD: Item = {
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'r1',
  fields: { title: 'Ship it', due: '2026-10-14' },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
};
const PALETTE = { text: '#000', muted: '#666', surface: '#fff' } as unknown as PlanPalette;

// docs/specs/026-plan/plan-views.md "Due Calendar": a day with room draws its cards at Minimal size, never
// Detailed; a small day draws a dot and the title.
describe('CalendarEntryFace', () => {
  it('draws a card at Minimal size where the day has room for cards', () => {
    render(<CalendarEntryFace item={CARD} done={false} asCards palette={PALETTE} colour="#f00" />);
    expect(screen.getByTestId('face').dataset.size).toBe('minimal');
  });

  it('draws a dot and the title, with no card face, where it does not', () => {
    render(
      <CalendarEntryFace
        item={CARD}
        done={false}
        asCards={false}
        palette={PALETTE}
        colour="#f00"
      />,
    );
    expect(screen.queryByTestId('face')).toBeNull();
    expect(screen.getByText('Ship it')).toBeTruthy();
  });
});

// plan-views.md "Times and ranges": a timed date's card shows its time of day, in the viewer's zone.
describe('a timed entry', () => {
  const at = new Date(2026, 9, 14, 17, 30).getTime();

  it('shows its time before the title in a line, and over the card as a card', () => {
    render(
      <CalendarEntryFace
        item={CARD}
        done={false}
        at={at}
        asCards={false}
        palette={PALETTE}
        colour="#f00"
      />,
    );
    expect(screen.getByText(timeOfDayText(at))).toBeTruthy();
    cleanup();
    render(
      <CalendarEntryFace
        item={CARD}
        done={false}
        at={at}
        asCards
        palette={PALETTE}
        colour="#f00"
      />,
    );
    expect(screen.getByTestId('face')).toBeTruthy();
    expect(screen.getByText(timeOfDayText(at))).toBeTruthy();
  });

  it('shows no time for an untimed one', () => {
    render(
      <CalendarEntryFace
        item={CARD}
        done={false}
        asCards={false}
        palette={PALETTE}
        colour="#f00"
      />,
    );
    expect(screen.queryByText(timeOfDayText(at))).toBeNull();
  });
});
