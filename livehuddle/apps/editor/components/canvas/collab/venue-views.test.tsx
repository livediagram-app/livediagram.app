// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape } from '@livehuddle/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { avatarClickIntent } from '@/lib/avatar-click-intent';
import { hasPieceArt, PieceArt } from '@/components/canvas/PieceArt';
import { FurnitureView, isFurnitureViewShape } from './FurnitureView';
import { hasSocialArt } from './SocialArt';

afterEach(cleanup);

// docs/specs/009-elements/venue-pieces.md
const NAMES = {
  pillar: 'Pillar',
  column: 'Column',
  'car-park': 'Car park',
  'bike-rack': 'Bike rack',
  'stage-curtains': 'Stage curtains',
  podium: 'Podium',
} as const;
type Kind = keyof typeof NAMES;

const view = (kind: Kind, surface: 'light' | 'dark') =>
  render(
    <CanvasSurfaceProvider surface={surface}>
      <FurnitureView
        element={{ ...createShape(kind, 0, 0), id: kind }}
        stroke={surface === 'dark' ? '#cbd5e1' : '#334155'}
        sitters={[]}
      />
    </CanvasSurfaceProvider>,
  );

describe('the venue pieces on the canvas', () => {
  it('draws each grid piece from the furniture table, named for a screen reader, on light and dark paper', () => {
    for (const [kind, label] of Object.entries(NAMES) as [Kind, string][]) {
      expect(isFurnitureViewShape(kind), kind).toBe(true);
      expect(hasSocialArt(kind), kind).toBe(false);
      for (const surface of ['light', 'dark'] as const) {
        const { container, unmount } = view(kind, surface);
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('aria-label'), kind).toBe(label);
        expect(svg?.querySelectorAll('rect, ellipse, path').length, kind).toBeGreaterThan(4);
        unmount();
      }
    }
  });

  it('draws the swimming pool to its size, its water in the fill, with a ripple', () => {
    expect(hasPieceArt('swimming-pool')).toBe(true);
    expect(isFurnitureViewShape('swimming-pool')).toBe(false);
    const pool = { ...createShape('swimming-pool', 0, 0), id: 'pool', width: 500, height: 220 };
    const { container } = render(<PieceArt element={pool} stroke="#334155" fill="#38bdf8" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('Swimming pool');
    expect(svg.getAttribute('viewBox')).toBe('0 0 500 220');
    expect(svg.querySelector('[fill="#38bdf8"]')).not.toBeNull();
    expect(svg.querySelector('.lh-ripple')).not.toBeNull();
  });

  it('walks to each one when clicked in Avatar mode', () => {
    for (const kind of [...(Object.keys(NAMES) as Kind[]), 'swimming-pool' as const])
      expect(avatarClickIntent(kind), kind).toBe('walk');
  });
});
