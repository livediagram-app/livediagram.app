// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';

// docs/specs/004-interface-design/fonts.md "On boards and cards": a card's title takes the tab's face, handed down
// as --plan-heading-font; everything else on the face stays in the board's UI face.
afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam Reed', color: '#2563eb' };
const ITEM: Item = {
  id: 'item-1',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: {
    title: 'Ship the release',
    priority: 'high',
    description: 'Two notes',
    labels: ['iOS'],
  },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};

const inHeading = (el: HTMLElement) => !!el.closest<HTMLElement>('[style*="--plan-heading-font"]');

describe('card lettering', () => {
  it.each([
    ['detailed', false],
    ['minimal', false],
    ['minimal', true],
  ] as const)(
    'letters a %s card’s title (stacked: %s) in the heading face, and only its title',
    (size, stacked) => {
      render(
        <PlanCardFace
          item={ITEM}
          palette={planPalette('light', {})}
          fields={['key', 'type', 'priority', 'labels', 'description']}
          size={size}
          stacked={stacked}
        />,
      );
      expect(inHeading(screen.getByText('Ship the release'))).toBe(true);
      // The one heading holds the title alone: the number, chips and fields stay in the UI face.
      const headings = document.querySelectorAll('[style*="--plan-heading-font"]');
      expect(headings).toHaveLength(1);
      expect(headings[0]!.textContent).toBe('Ship the release');
    },
  );
});
