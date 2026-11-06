// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape } from '@livehuddle/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { avatarClickIntent } from '@/lib/avatar-click-intent';
import { FurnitureView, isFurnitureViewShape } from './FurnitureView';
import { hasSocialArt } from './SocialArt';

afterEach(cleanup);

// docs/specs/009-elements/office-amenities.md
const NAMES = {
  printer: 'Printer',
  copier: 'Copier',
  lockers: 'Lockers',
  'coat-rack': 'Coat rack',
  'umbrella-stand': 'Umbrella stand',
  'kitchen-counter': 'Kitchen counter',
  'kitchen-sink': 'Kitchen sink',
  fridge: 'Fridge',
  microwave: 'Microwave',
  kettle: 'Kettle',
  'toilet-cubicle': 'Toilet cubicle',
  washbasin: 'Washbasin',
  'hand-dryer': 'Hand dryer',
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

describe('the office amenities on the canvas', () => {
  it('draws each one from the furniture table, named for a screen reader, on light and dark paper', () => {
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

  it('walks to each one when clicked in Avatar mode', () => {
    for (const kind of Object.keys(NAMES) as Kind[])
      expect(avatarClickIntent(kind), kind).toBe('walk');
  });
});
