// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { FurnitureView, isFurnitureViewShape } from './FurnitureView';
import { hasSocialArt } from './SocialArt';
import { seatPillBottom } from '@livehuddle/avatar/chair-sitters';
import { BEAN_BAG_SEATS, READING_NOOK_SEATS } from '@livehuddle/avatar/seats';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';

afterEach(cleanup);

const shape = (kind: Parameters<typeof createShape>[0]) =>
  ({ ...createShape(kind, 0, 0), id: kind }) as ShapeElement;
const sitter = (name: string) => ({ name, color: '#0ea5e9' });

const view = (
  kind: Parameters<typeof createShape>[0],
  {
    surface = 'light',
    sitters = [],
  }: { surface?: 'light' | 'dark'; sitters?: ReturnType<typeof sitter>[] } = {},
) =>
  render(
    <CanvasSurfaceProvider surface={surface}>
      <FurnitureView element={shape(kind)} stroke="#94a3b8" sitters={sitters} />
    </CanvasSurfaceProvider>,
  );

// docs/specs/009-elements/social-pieces.md "Pool Table, Foosball Table, Dartboard", "Vending Machine",
// "Bean Bag, Reading Nook".
describe('the second set of social pieces', () => {
  it('draws each one from the furniture table, named for a screen reader', () => {
    const names = {
      'pool-table': 'Pool table',
      'foosball-table': 'Foosball table',
      dartboard: 'Dartboard',
      'vending-machine': 'Vending machine',
      'bean-bag': 'Empty bean bag',
      'reading-nook': 'Empty reading nook',
    } as const;
    for (const [kind, label] of Object.entries(names) as [keyof typeof names, string][]) {
      expect(isFurnitureViewShape(kind), kind).toBe(true);
      const { container, unmount } = view(kind);
      expect(container.querySelector('svg')?.getAttribute('aria-label'), kind).toBe(label);
      unmount();
    }
  });

  it('lights the vending machine and the reading nook on dark paper only', () => {
    for (const kind of ['vending-machine', 'reading-nook'] as const) {
      expect(hasSocialArt(kind)).toBe(true);
      const light = view(kind);
      expect(light.container.querySelector('[data-night-glow]'), kind).toBeNull();
      light.unmount();
      const dark = view(kind, { surface: 'dark' });
      const glow = dark.container.querySelector('[data-night-glow]');
      expect(glow, kind).not.toBeNull();
      expect(glow!.querySelectorAll('ellipse')).toHaveLength(2);
      expect(glow!.querySelector('radialGradient')?.id).toBe(`lh-night-glow-${kind}`);
      dark.unmount();
    }
    for (const kind of ['pool-table', 'foosball-table', 'dartboard', 'bean-bag'])
      expect(hasSocialArt(kind), kind).toBe(false);
  });

  it('rings and names whoever sits in a bean bag or the reading nook', () => {
    for (const [kind, noun] of [
      ['bean-bag', 'Bean bag'],
      ['reading-nook', 'Reading nook'],
    ] as const) {
      const { container, unmount } = view(kind, { sitters: [sitter('Ada')] });
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
        `${noun}, Ada sitting`,
      );
      expect(container.querySelector('ellipse[stroke="#0ea5e9"]'), kind).not.toBeNull();
      expect(container.textContent).toContain('Ada');
      // Work Tracker #582: the pill sits above the sitter's head, not over it at the piece's top edge.
      const pill = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Ada')!;
      const grid = kind === 'bean-bag' ? BEAN_BAG_SEATS : READING_NOOK_SEATS;
      const feet = grid.seats[0]!.v * grid.height;
      expect(pill.style.top, kind).toBe(`${seatPillBottom(shape(kind), grid, [{ seat: 0 }])}px`);
      expect(parseFloat(pill.style.top), kind).toBeLessThan(feet - AVATAR_HEIGHT * 1.5);
      unmount();
    }
  });
});
