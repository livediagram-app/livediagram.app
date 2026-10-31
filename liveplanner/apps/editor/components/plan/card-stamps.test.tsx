// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  dayLabel,
  stampMomentLabel,
  type CardField,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { PlanCardFace } from './PlanCardFace';
import { StampBit } from './card-stamps';
import { planPalette } from './plan-palette';

// A card's stamps on the board (docs/specs/026-plan/items.md "Created and Last Edited", item-types.md "Card
// display"): the days as quiet pills with the moment in their spoken label, the people as their discs,
// nothing for a stamp the card does not hold.

afterEach(cleanup);

const SAM = { id: 'p-sam', name: 'Sam Reed', color: '#2563eb' };
const ALI = { id: 'p-ali', name: 'Ali Khan', color: '#dc2626' };
const LOST = { id: '', name: 'Someone', color: '#94a3b8' };
const MADE = new Date(2026, 9, 3, 14, 2).getTime();
const EDITED = new Date(2026, 9, 31, 9, 30).getTime();
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const STAMPS: CardField[] = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
const showing: ItemTypeDef = { ...task, display: { detailed: { foot: STAMPS } } };
const card = (extra: Partial<Item> = {}): Item => ({
  id: 'item-a',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'A card' },
  rev: 1,
  createdAt: MADE,
  updatedAt: EDITED,
  createdBy: SAM,
  updatedBy: ALI,
  ...extra,
});

function face(item: Item) {
  render(
    <PlanCardFace
      item={item}
      palette={planPalette('light', {})}
      fields={STAMPS}
      size="detailed"
      typeOverride={showing}
    />,
  );
}

describe('the stamps on a card', () => {
  it('draws the days it was made and last edited, the full moment spoken', () => {
    face(card());
    expect(screen.getByText(`Created ${dayLabel('2026-10-03')}`)).toBeTruthy();
    expect(screen.getByText(`Created ${stampMomentLabel(MADE)}`).className).toContain('sr-only');
    expect(screen.getByText(`Edited ${dayLabel('2026-10-31')}`)).toBeTruthy();
    expect(screen.getByText(`Last edited ${stampMomentLabel(EDITED)}`)).toBeTruthy();
  });

  it('draws who made it and who last edited it as their discs', () => {
    face(card());
    expect(screen.getByLabelText('Created by Sam Reed').textContent).toBe('SR');
    expect(screen.getByLabelText('Last edited by Ali Khan').textContent).toBe('AK');
  });

  it('draws nothing for a stamp the card does not hold, and no empty row', () => {
    face(card({ createdAt: 0, updatedAt: Number.NaN, createdBy: LOST, updatedBy: LOST }));
    expect(screen.queryByText(/^Created /)).toBeNull();
    expect(screen.queryByText(/^Edited /)).toBeNull();
    expect(screen.queryByLabelText(/Created by|Last edited by/)).toBeNull();
  });

  it('a stamp bit on its own draws nothing without its stamp', () => {
    const palette = planPalette('light', {});
    const bare = card({ createdAt: 0, createdBy: LOST });
    const { container } = render(
      <>
        <StampBit item={bare} field="createdAt" palette={palette} />
        <StampBit item={bare} field="createdBy" palette={palette} />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });
});
