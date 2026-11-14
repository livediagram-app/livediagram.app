// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShapeElement } from '@livehuddle/document';
import { MOMENT_KINDS, playMoment, resetPieceMoments, type MomentKind } from '@/lib/piece-moments';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { PieceArt } from '@/components/canvas/PieceArt';
import { FurnitureView } from './FurnitureView';
import { DARK_FLARE, PieceMoment } from './PieceMoments';
import { hasOfficeMoment } from './OfficeMoments';
import { PondView } from './PondView';
import { SwimmingPoolView } from './SwimmingPoolView';

afterEach(() => {
  cleanup();
  resetPieceMoments();
});

const piece = (shape: MomentKind, id: string = shape, chairFacing?: string) =>
  ({
    id,
    type: 'shape',
    shape,
    x: 0,
    y: 0,
    width: 120,
    height: 160,
    chairFacing,
  }) as unknown as ShapeElement;

// The walk-up answers a piece's live face or its own view plays (WalkUpMoments.tsx): drawn as the canvas draws them.
const WHOLE_PIECE: readonly MomentKind[] = [
  'notice-board',
  'world-clock',
  'calendar-wall',
  'window',
];

const draw = (shape: MomentKind, id: string = shape, chairFacing?: string) =>
  WHOLE_PIECE.includes(shape)
    ? render(<PieceArt element={piece(shape, id, chairFacing)} stroke="#64748b" fill="#f8fafc" />)
    : shape === 'pond'
      ? render(<PondView element={piece(shape, id)} stroke="#64748b" floor="#7dd3fc" />)
      : shape === 'swimming-pool'
        ? render(<SwimmingPoolView element={piece(shape, id)} stroke="#64748b" floor="#7dd3fc" />)
        : render(
            <FurnitureView element={piece(shape, id, chairFacing)} stroke="#64748b" sitters={[]} />,
          );

// docs/specs/009-elements/piece-moments.md "The moments".
describe('a piece moment on screen', () => {
  it('draws nothing extra until a moment plays', () => {
    const { container } = draw('tree');
    expect(container.querySelector('[data-moment-parts]')).toBeNull();
    expect(container.querySelector('[data-moment]')).toBeNull();
  });

  it.each(MOMENT_KINDS)(
    'plays the %s moment, every drawn-over part hidden from assistive tech',
    (kind) => {
      const { container } = draw(kind);
      expect(container.querySelector('.lh-moment')).toBeNull();
      act(() => playMoment(kind, 1));
      // Something moves: a drawn-over part, one of the piece's own parts, or the whole drawing.
      expect(container.querySelector('.lh-moment')).not.toBeNull();
      const parts = container.querySelector(`[data-moment-parts="${kind}"]`);
      if (parts) {
        expect(parts.getAttribute('aria-hidden')).toBe('true');
        expect(parts.querySelector('.lh-moment')).not.toBeNull();
      } else expect(container.querySelector('[data-moment-part]')).not.toBeNull();
    },
  );

  it('moves the cupboard door and the bike nearest you', () => {
    const moved = (kind: MomentKind, side: -1 | 1) => {
      const id = `${kind}${side}`;
      const { container } = draw(kind, id);
      act(() => playMoment(id, side));
      return [...container.querySelectorAll('[data-moment-part]')].map((g) =>
        Number(g.getAttribute('data-moment-part')),
      );
    };
    expect(moved('kitchen-counter', -1)).toEqual([10, 11, 12]);
    expect(moved('kitchen-counter', 1)).toEqual([13, 14, 15]);
    expect(moved('bike-rack', -1)).toEqual([11]);
    expect(moved('bike-rack', 1)).toEqual([24]);
  });

  it('runs a wave of books from your end of the shelf, swinging on a pivot where one is named', () => {
    const { container } = draw('bookshelf', 'b');
    act(() => playMoment('b', -1));
    const delay = (part: number) =>
      parseFloat(
        container
          .querySelector<SVGGElement>(`[data-moment-part="${part}"]`)!
          .style.getPropertyValue('--delay'),
      );
    expect(delay(13)).toBeLessThan(delay(21));
    const rack = draw('coat-rack', 'r');
    act(() => playMoment('r', 1));
    const coat = rack.container.querySelector<SVGGElement>('[data-moment-part="4"]')!;
    expect(coat.classList.contains('lh-moment-swing')).toBe(true);
    expect(coat.style.transformOrigin).toBe('28px 22px');
  });

  it('nudges a turned piece instead, with nothing drawn over its back', () => {
    const { container } = draw('bookshelf', 'back', 's');
    act(() => playMoment('back', 1));
    expect(container.querySelector('[data-moment="bookshelf"]')!.classList).toContain(
      'lh-moment-nudge',
    );
    expect(container.querySelector('[data-moment-part]')).toBeNull();
    expect(container.querySelector('[data-moment-parts]')).toBeNull();
  });

  it('rocks a tree away from your side, a plant with a shiver, and not a fire', () => {
    const tree = draw('tree', 't');
    act(() => playMoment('t', -1));
    const sway = tree.container.querySelector<SVGGElement>('[data-moment="tree"]')!;
    expect(sway.classList.contains('lh-moment-sway')).toBe(true);
    expect(sway.style.getPropertyValue('--lean')).toBe('1');
    const plant = draw('plant', 'p');
    act(() => playMoment('p', 1));
    const rustle = plant.container.querySelector<SVGGElement>('[data-moment="plant"]')!;
    expect(rustle.classList.contains('lh-moment-rustle')).toBe(true);
    expect(rustle.style.getPropertyValue('--lean')).toBe('-1');
    const fire = draw('fireplace', 'f');
    act(() => playMoment('f', 1));
    expect(fire.container.querySelector('[data-moment]')).toBeNull();
  });

  it('replays on a new moment and never replays an old one after a remount', () => {
    const first = draw('campfire', 'c');
    act(() => playMoment('c', 1));
    const was = first.container.querySelector('[data-moment-parts]');
    act(() => playMoment('c', 1));
    const now = first.container.querySelector('[data-moment-parts]');
    expect(now).not.toBe(was);
    first.unmount();
    // A tab switched back to: the store still holds the moment, the new view does not play it.
    const again = draw('campfire', 'c');
    expect(again.container.querySelector('[data-moment-parts]')).toBeNull();
    const pond = draw('pond', 'w');
    act(() => playMoment('w', 1));
    pond.unmount();
    expect(draw('pond', 'w').container.querySelector('[data-moment-parts]')).toBeNull();
  });

  it('flares a stoked fire in a light amber on dark paper, its own orange on light', () => {
    const flare = (surface: 'light' | 'dark', id: string) => {
      const { container } = render(
        <CanvasSurfaceProvider surface={surface}>
          <FurnitureView element={piece('campfire', id)} stroke="#64748b" sitters={[]} />
        </CanvasSurfaceProvider>,
      );
      act(() => playMoment(id, 1));
      return container.querySelector('.lh-moment-flare')!.getAttribute('fill');
    };
    expect(flare('dark', 'd')).toBe(DARK_FLARE);
    expect(flare('light', 'l')).not.toBe(DARK_FLARE);
  });

  it('throws the pebble and the coin from your side', () => {
    const left = draw('fountain', 'l');
    act(() => playMoment('l', -1));
    const right = draw('fountain', 'r');
    act(() => playMoment('r', 1));
    const startX = (c: HTMLElement) =>
      Number(
        c
          .querySelector('[data-moment-parts] > g')!
          .getAttribute('transform')!
          .match(/translate\(([-\d.]+)/)![1],
      );
    expect(startX(left.container)).toBeLessThan(68);
    expect(startX(right.container)).toBeGreaterThan(68);
  });

  it('draws every office moment from either side, on light and dark paper', () => {
    for (const surface of ['light', 'dark'] as const)
      for (const side of [-1, 1] as const)
        for (const kind of MOMENT_KINDS.filter(hasOfficeMoment)) {
          const id = `${kind}-${surface}-${side}`;
          const { container } = render(
            <CanvasSurfaceProvider surface={surface}>
              <FurnitureView element={piece(kind, id)} stroke="#64748b" sitters={[]} />
            </CanvasSurfaceProvider>,
          );
          act(() => playMoment(id, side));
          expect(
            container.querySelector(`[data-moment-parts="${kind}"] .lh-moment`),
          ).not.toBeNull();
        }
  });

  it('draws nothing over a piece whose own parts are its whole moment', () => {
    const { container } = render(
      <svg>
        <PieceMoment kind="bookshelf" id="shelf" />
      </svg>,
    );
    act(() => playMoment('shelf', 1));
    expect(container.querySelector('[data-moment-parts="bookshelf"]')!.childElementCount).toBe(0);
  });

  it('rocks the hammock on its ropes, and lifts the note out of the suggestion box as its bulb glows', () => {
    const hammock = draw('hammock', 'h');
    act(() => playMoment('h', 1));
    const parts = [...hammock.container.querySelectorAll<SVGGElement>('[data-moment-part]')];
    expect(parts.map((g) => Number(g.getAttribute('data-moment-part')))).toEqual([3, 4, 5, 6]);
    expect(parts[0]!.classList.contains('lh-moment-swing')).toBe(true);
    expect(parts[0]!.style.transformOrigin).toBe('76px 16px');
    expect(hammock.container.querySelector('[data-moment-parts]')).toBeNull();
    const box = draw('suggestion-box', 'b');
    act(() => playMoment('b', -1));
    expect(
      [...box.container.querySelectorAll('[data-moment-part]')].map((g) =>
        g.getAttribute('data-moment-part'),
      ),
    ).toEqual(['9', '10']);
    expect(
      box.container.querySelector('[data-moment-parts="suggestion-box"] .lh-moment-pulse'),
    ).not.toBeNull();
  });

  const board = (id: string, notes: number) =>
    ({
      ...piece('notice-board', id),
      width: 176,
      height: 128,
      noticeNotes: Array.from({ length: notes }, (_, i) => ({
        id: `n${i}`,
        text: `Note ${i}`,
        author: 'Sam',
        at: i,
      })),
    }) as unknown as ShapeElement;

  it('swings the top note on your side of the notice board, or wobbles a pin on bare cork', () => {
    const swung = (id: string, notes: number, side: -1 | 1) => {
      const { container } = render(
        <PieceArt element={board(id, notes)} stroke="#64748b" fill="#f8fafc" />,
      );
      act(() => playMoment(id, side));
      return container;
    };
    // Newest first: the top row is the two newest notes.
    const left = swung('l', 3, -1).querySelector('[data-moment-part="note"]')!;
    expect(left.querySelector('text')!.textContent).toBe('Note 2');
    const right = swung('r', 3, 1).querySelector<SVGGElement>('[data-moment-part="note"]')!;
    expect(right.querySelector('text')!.textContent).toBe('Note 1');
    expect(right.style.getPropertyValue('--lean')).toBe('-1');
    // One note: it swings from either side.
    expect(swung('one', 1, 1).querySelector('[data-moment-part="note"]')).not.toBeNull();
    const bare = swung('bare', 0, 1);
    expect(bare.querySelector('[data-moment-part]')).toBeNull();
    const pin = bare.querySelector('[data-moment-parts="notice-board"]')!;
    expect(pin.getAttribute('aria-hidden')).toBe('true');
    expect(pin.getAttribute('transform')).toBe('translate(148 30)');
    expect(
      swung('bare-l', 0, -1).querySelector('[data-moment-parts]')!.getAttribute('transform'),
    ).toBe('translate(32 30)');
  });

  it("ticks each world clock's minute hand round, dial by dial from your side", () => {
    const clock = {
      ...piece('world-clock', 'c'),
      width: 168,
      height: 72,
      clockZones: [
        { zone: 'UTC', label: 'London' },
        { zone: 'Asia/Tokyo', label: 'Tokyo' },
      ],
    } as unknown as ShapeElement;
    const { container } = render(<PieceArt element={clock} stroke="#64748b" fill="#f8fafc" />);
    act(() => playMoment('c', -1));
    const hands = [...container.querySelectorAll<SVGGElement>('[data-moment-part="hand"]')];
    expect(hands).toHaveLength(2);
    expect(hands.every((g) => g.classList.contains('lh-moment-tick'))).toBe(true);
    const delay = (g: SVGGElement) => parseFloat(g.style.getPropertyValue('--delay'));
    expect(delay(hands[0]!)).toBeLessThan(delay(hands[1]!));
    expect(hands[0]!.style.transformOrigin).toBe('46px 32px');
  });

  it('lifts the calendar page at the bottom corner on your side', () => {
    const corner = (id: string, side: -1 | 1) => {
      const { container } = draw('calendar-wall', id);
      act(() => playMoment(id, side));
      return container.querySelector<SVGGElement>(
        '[data-moment-parts="calendar-wall"] .lh-moment-lift',
      )!.style.transformOrigin;
    };
    expect(corner('cl', -1)).toBe('0px 160px');
    expect(corner('cr', 1)).toBe('200px 160px');
  });

  it("brightens a window's light and runs a glint across its pane from your end", () => {
    const glint = (id: string, side: -1 | 1) => {
      const { container } = draw('window', id);
      act(() => playMoment(id, side));
      const parts = container.querySelector('[data-moment-parts="window"]')!;
      expect(parts.querySelector('.lh-moment-pulse')!.getAttribute('fill')).toMatch(/^url\(#/);
      return parseFloat(
        parts.querySelector<SVGPathElement>('.lh-moment-sweep')!.style.getPropertyValue('--dx'),
      );
    };
    expect(glint('wl', -1)).toBeGreaterThan(0);
    expect(glint('wr', 1)).toBeLessThan(0);
  });

  it("plays a face piece's answer on its face when it is turned, with no nudge", () => {
    const { container } = draw('calendar-wall', 'turned', 's');
    act(() => playMoment('turned', 1));
    expect(container.querySelector('.lh-moment-nudge')).toBeNull();
    expect(container.querySelector('[data-moment-parts="calendar-wall"]')).not.toBeNull();
  });
});
