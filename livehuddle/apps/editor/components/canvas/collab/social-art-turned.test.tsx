// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, turnPiece, type ShapeElement } from '@livehuddle/document';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';

vi.mock('@/lib/jukebox-listening', async (actual) => ({
  ...(await actual<typeof import('@/lib/jukebox-listening')>()),
  useJukeboxPlaying: () => true,
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { FurnitureView } from './FurnitureView';
import { SocialArt } from './SocialArt';
import { overlayGrid } from './SocialFaces';

afterEach(cleanup);

// docs/specs/009-elements/furniture-facing.md "Live faces", social-pieces.md: what is on a piece's front shows on its
// front and on the side's strip of front, never from behind, and the faces lie on the drawing the facing shows.

const piece = (kind: Parameters<typeof createShape>[0], facing: SeatFacing): ShapeElement =>
  turnPiece({ ...createShape(kind, 0, 0), id: kind }, facing);

const art = (kind: string, facing: SeatFacing, surface: 'light' | 'dark' = 'light') =>
  render(
    <CanvasSurfaceProvider surface={surface}>
      <svg>
        <SocialArt kind={kind} id={kind} sitters={0} facing={facing} />
      </svg>
    </CanvasSurfaceProvider>,
  ).container;

describe('the live parts of a turned social piece', () => {
  it('shows the arcade screen, the flames and the jukebox lights on the front and the side, never from behind', () => {
    const cases = [
      ['arcade-machine', '[data-arcade-screen="side"]'],
      ['fireplace', '[data-flicker="side"]'],
      ['jukebox', '[data-jukebox-playing="side"]'],
    ] as const;
    for (const [kind, side] of cases) {
      expect(art(kind, 'n').querySelector('g'), kind).not.toBeNull();
      expect(art(kind, 'n').querySelector(side), kind).toBeNull();
      expect(art(kind, 'e').querySelector(side), kind).not.toBeNull();
      expect(art(kind, 's').querySelector('g'), kind).toBeNull();
    }
    expect(art('fireplace', 'n').querySelector('[data-flicker="front"]')).not.toBeNull();
    expect(art('jukebox', 'n').querySelector('[data-jukebox-playing="front"]')).not.toBeNull();
  });

  it('mirrors the side’s parts for facing right, and only then', () => {
    const left = art('arcade-machine', 'e');
    expect(left.querySelector('g[transform]')).toBeNull();
    const right = art('arcade-machine', 'w');
    expect(right.querySelector('g[transform]')!.getAttribute('transform')).toBe(
      'translate(60 0) scale(-1 1)',
    );
    expect(right.querySelector('[data-arcade-screen="side"]')).not.toBeNull();
  });

  it('glows the vending machine where its window shows and the nook’s lamp from every side, on dark paper', () => {
    expect(art('vending-machine', 's', 'dark').querySelector('[data-night-glow]')).toBeNull();
    expect(art('vending-machine', 'e', 'dark').querySelector('[data-night-glow]')).not.toBeNull();
    for (const facing of ['n', 'e', 's', 'w'] as const)
      expect(
        art('reading-nook', facing, 'dark').querySelector('[data-night-glow]'),
        facing,
      ).not.toBeNull();
    expect(art('reading-nook', 'e', 'light').querySelector('[data-night-glow]')).toBeNull();
  });

  it('is drawn on the turned piece by the canvas view', () => {
    const { container } = render(
      <FurnitureView element={piece('arcade-machine', 'e')} stroke="#94a3b8" sitters={[]} />,
    );
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 60 112');
    expect(container.querySelector('[data-arcade-screen="side"]')).not.toBeNull();
  });
});

describe('overlayGrid', () => {
  it('lays a face on the drawing its piece’s facing shows', () => {
    expect(overlayGrid(piece('jukebox', 'n'))).toMatchObject({ width: 72, height: 112 });
    expect(overlayGrid(piece('jukebox', 'e'))).toMatchObject({ width: 56, height: 112 });
    expect(overlayGrid(piece('ping-pong-table', 'w'))).toMatchObject({ width: 112, height: 184 });
    // A piece that never turns keeps its one drawing, whatever is stored on it.
    expect(overlayGrid({ ...piece('notice-board', 'n'), chairFacing: 'e' })).toMatchObject({
      width: 176,
      height: 128,
    });
  });
});
