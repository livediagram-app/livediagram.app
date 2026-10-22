// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { planPalette } from '@livedesign/document';
import { dashboardTabTiles } from '@/components/palette/palette-dashboard-tiles';
import { slotFillSections } from './SlotFillPicker';
import { SLOT_CATEGORIES, SlotCategoryCard } from './slot-fill-categories';

afterEach(() => cleanup());

// docs/specs/026-plan/plan-tabs.md "Filling a slot": each category is a card with a picture of what it holds, its
// glyph, its name and a line on what is in it. Card Metrics showed none of them: its art was filed under another name.
describe('Add to Slot category cards', () => {
  it('draws a picture, a glyph and a description for every category', () => {
    for (const title of SLOT_CATEGORIES) {
      const { container, unmount } = render(
        <SlotCategoryCard
          title={title}
          count={1}
          palette={planPalette('light', {})}
          index={0}
          cascade={false}
          onOpen={() => {}}
        />,
      );
      const button = container.querySelector('button')!;
      expect(button.querySelectorAll('svg').length, title).toBeGreaterThanOrEqual(1);
      // The name, the count and a line of description after it.
      expect((button.textContent ?? '').length, title).toBeGreaterThan(title.length + 12);
      unmount();
    }
  });

  it('names every section the picker can show', () => {
    const { sections } = slotFillSections(
      dashboardTabTiles([{ id: 't', name: 'Launch', of: 'board' }]),
      null,
      true,
    );
    for (const s of sections) expect(SLOT_CATEGORIES).toContain(s.title);
  });
});
