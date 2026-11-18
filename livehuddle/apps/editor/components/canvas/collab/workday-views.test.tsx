// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  HOT_DESK_CARD,
  HOT_DESK_CARDS,
  OFFICE_ART,
  TREADMILL_BELTS,
  turnPiece,
  PET_LEG_MS,
  type ShapeElement,
} from '@livehuddle/document';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';
import { avatarScale } from '@livehuddle/avatar/config';
import { drawnRect } from '@livehuddle/avatar/seats';

vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// A drawn box on screen, for a bubble's measured place.
const screenRect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect;

const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.on,
}));

import { track } from '@/lib/telemetry';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { avatarClickIntent } from '@/lib/avatar-click-intent';
import { isPieceControlPress } from '@/lib/piece-control';
import { resetBell } from '@/lib/office/reception-bell';
import { setPetAreas, useWorkdayPieces } from '@/lib/office/useWorkdayPieces';
import { hasPieceArt, PieceArt } from '@/components/canvas/PieceArt';
import { FurnitureView, isFurnitureViewShape, type ChairSitter } from './FurnitureView';
import { hotDeskCard, hotDeskCardY, dogOffset } from './WorkdayFaces';
import { ReceptionistBubble } from '../receptionist/ReceptionistBubble';
import { KEEP_CLEAR_ATTR } from '../receptionist/keep-clear';
import { openReceptionist, resetReceptionistState } from '@/lib/receptionist/receptionist-store';

afterEach(() => {
  cleanup();
  resetBell();
  setPetAreas(new Map());
  reduced.on = false;
  vi.useRealTimers();
});

// docs/specs/009-elements/workday-pieces.md
const NAMES = {
  'nap-pod': 'Nap pod',
  treadmill: 'Treadmill',
  'weight-bench': 'Weight bench',
  'phone-booth': 'Phone booth',
  'standing-desk': 'Standing desk',
  'hot-desk': 'Hot desk',
  'pet-bed': 'Pet bed',
  'reception-desk': 'Reception desk',
} as const;
type Kind = keyof typeof NAMES;

const piece = (kind: Kind, x = 0, y = 0) =>
  ({ ...createShape(kind, x, y), id: kind }) as ShapeElement;
const sam: ChairSitter = { name: 'Sam', color: '#ef4444', seat: 0 };

const view = (kind: Kind, surface: 'light' | 'dark', sitters: ChairSitter[] = []) =>
  render(
    <CanvasSurfaceProvider surface={surface}>
      <FurnitureView
        element={piece(kind)}
        stroke={surface === 'dark' ? '#cbd5e1' : '#334155'}
        sitters={sitters}
      />
    </CanvasSurfaceProvider>,
  );

describe('the workday pieces on the canvas', () => {
  it('draws each one from the furniture table, named for a screen reader, on light and dark paper', () => {
    for (const [kind, label] of Object.entries(NAMES) as [Kind, string][]) {
      expect(isFurnitureViewShape(kind), kind).toBe(true);
      expect(hasPieceArt(kind), kind).toBe(true);
      expect(avatarClickIntent(kind), kind).toBe('walk');
      for (const surface of ['light', 'dark'] as const) {
        const { container, unmount } = view(kind, surface);
        const svg = container.querySelector('svg');
        const name = svg?.getAttribute('aria-label') ?? '';
        expect(name.toLowerCase(), kind).toContain(label.toLowerCase());
        expect(svg?.querySelectorAll('rect, ellipse, path').length, kind).toBeGreaterThan(4);
        unmount();
      }
    }
  });

  it('runs the treadmill belt and lights the booth lamp only while someone is there', () => {
    for (const [kind, attr] of [
      ['treadmill', 'data-belt-running'],
      ['phone-booth', 'data-booth-lamp'],
    ] as const) {
      const empty = view(kind, 'light');
      expect(empty.container.querySelector(`[${attr}]`), kind).toBeNull();
      empty.unmount();
      const used = view(kind, 'dark', [sam]);
      expect(used.container.querySelector(`[${attr}]`), kind).not.toBeNull();
      used.unmount();
    }
  });

  it('writes the sitter’s name on a hot desk card, Hot Desk while it is free', () => {
    expect(hotDeskCard([])).toBe('Hot Desk');
    expect(hotDeskCard([{ ...sam, name: 'Alexandria Ocasio' }])).toBe('Alexandria…');
    const free = view('hot-desk', 'light');
    expect(free.container.querySelector('[data-hot-desk-card="free"]')?.textContent).toBe(
      'Hot Desk',
    );
    free.unmount();
    const held = view('hot-desk', 'light', [sam]);
    expect(held.container.querySelector('[data-hot-desk-card="held"]')?.textContent).toBe('Sam');
    // The raised card is the desk's pill: no second name over it.
    expect(held.container.querySelector('span')).toBeNull();
  });

  it('raises a held hot desk’s card clear of its sitter’s head, a tall one’s higher still', () => {
    const desk = piece('hot-desk');
    // An unturned hot desk shows its back drawing: its sitter faces up at the monitor.
    const grid = OFFICE_ART['hot-desk'].back;
    expect(hotDeskCardY(desk, grid, [])).toBe(HOT_DESK_CARD.y);
    const drawn = drawnRect(desk, grid);
    const perGrid = drawn.height / grid.height;
    const seat = grid.seats[0]!;
    for (const size of ['regular', 'tall'] as const) {
      const scale = avatarScale(size);
      const y = hotDeskCardY(desk, grid, [{ ...sam, scale }]);
      // The card's foot, in canvas px down from the desk's top, is above the top of the head, by more than its chip.
      const cardFoot = drawn.y - desk.y + (y + HOT_DESK_CARD.h) * perGrid;
      const headTop = drawn.y - desk.y + seat.v * drawn.height - AVATAR_HEIGHT * scale;
      expect(cardFoot, size).toBeLessThan(headTop - 16);
      expect(y, size).toBeLessThan(HOT_DESK_CARD.y);
    }
    expect(hotDeskCardY(desk, grid, [{ ...sam, scale: avatarScale('tall') }])).toBeLessThan(
      hotDeskCardY(desk, grid, [{ ...sam, scale: avatarScale('regular') }]),
    );
    const held = view('hot-desk', 'light', [sam]);
    expect(
      Number(
        held.container
          .querySelector('[data-hot-desk-card-at]')
          ?.getAttribute('data-hot-desk-card-at'),
      ),
    ).toBe(hotDeskCardY(desk, grid, [sam]));
  });
});

function AtDesk({
  feet,
  sign = null,
}: {
  feet: { x: number; y: number } | null;
  sign?: { x: number; y: number } | null;
}) {
  const desk = piece('reception-desk', 100, 100);
  const elements = sign
    ? [desk, { ...createShape('room-sign', sign.x, sign.y), id: 'sign' } as ShapeElement]
    : [desk];
  useWorkdayPieces({ active: true, feet, elements });
  return (
    <CanvasSurfaceProvider surface="light">
      <PieceArt element={desk} stroke="#334155" fill="#ffffff" />
    </CanvasSurfaceProvider>
  );
}

// docs/specs/009-elements/furniture-facing.md "Live faces": each live part on the drawing the facing shows.
describe('the workday pieces turned', () => {
  const turned = (kind: Kind, facing: 'n' | 'e' | 's' | 'w', sitters: ChairSitter[] = []) =>
    render(
      <CanvasSurfaceProvider surface="light">
        <FurnitureView
          element={turnPiece(piece(kind), facing)}
          stroke="#334155"
          sitters={sitters}
        />
      </CanvasSurfaceProvider>,
    );
  // Whether a node is drawn inside the drawing's mirror (its words would read backwards).
  const mirroredAt = (node: Element | null) => node?.closest('g[transform*="scale(-1 1)"]') ?? null;

  it('runs the treadmill belt the way it goes at every facing, on the belt in view', () => {
    const cases = [
      ['s', 'toward', TREADMILL_BELTS.back.x],
      ['n', 'away', TREADMILL_BELTS.front.x],
      ['e', 'along', TREADMILL_BELTS.side.x],
      [
        'w',
        'along',
        OFFICE_ART.treadmill.side.width - TREADMILL_BELTS.side.x - TREADMILL_BELTS.side.w,
      ],
    ] as const;
    for (const [facing, way, x] of cases) {
      const { container, unmount } = turned('treadmill', facing, [sam]);
      const belt = container.querySelector('[data-belt-running]');
      expect(belt?.getAttribute('data-belt-running'), facing).toBe(way);
      expect(Number(belt?.querySelector('clipPath rect')?.getAttribute('x')), facing).toBe(x);
      expect(belt?.querySelector('.lh-belt-run-along') !== null, facing).toBe(way === 'along');
      unmount();
    }
  });

  it('stands the hot desk card on the turned desk, its words never mirrored', () => {
    const W = OFFICE_ART['hot-desk'].side.width;
    const cases = [
      ['n', HOT_DESK_CARDS.front.x + HOT_DESK_CARDS.front.w / 2],
      ['e', HOT_DESK_CARDS.side.x + HOT_DESK_CARDS.side.w / 2],
      ['w', W - HOT_DESK_CARDS.side.x - HOT_DESK_CARDS.side.w / 2],
    ] as const;
    for (const [facing, middle] of cases) {
      const { container, unmount } = turned('hot-desk', facing);
      const text = container.querySelector('[data-hot-desk-card="free"]');
      expect(text?.textContent, facing).toBe('Hot Desk');
      expect(Number(text?.getAttribute('x')), facing).toBe(middle);
      expect(mirroredAt(text), facing).toBeNull();
      unmount();
    }
    // Held, the raised card centres on the sitter's seat: right of the desk on its side, left of it mirrored.
    const seatX = OFFICE_ART['hot-desk'].side.seats[0]!.u * W;
    for (const [facing, x] of [
      ['e', seatX],
      ['w', W - seatX],
    ] as const) {
      const { container, unmount } = turned('hot-desk', facing, [sam]);
      const text = container.querySelector('[data-hot-desk-card="held"]');
      expect(text?.textContent, facing).toBe('Sam');
      expect(Number(text?.getAttribute('x')), facing).toBeCloseTo(x);
      expect(mirroredAt(text), facing).toBeNull();
      unmount();
    }
  });

  it('lights the booth lamp on the roof at every facing', () => {
    for (const facing of ['n', 'e', 's', 'w'] as const) {
      const { container, unmount } = turned('phone-booth', facing, [sam]);
      expect(container.querySelector('[data-booth-lamp="on"]'), facing).not.toBeNull();
      unmount();
    }
  });
});

describe('the Reception Desk', () => {
  it('says Welcome to you at its counter, and its Ring Bell keeps its press, then reads Rang', () => {
    const { container, rerender } = render(<AtDesk feet={{ x: 600, y: 600 }} />);
    expect(screen.queryByText('Welcome')).toBeNull();
    rerender(<AtDesk feet={{ x: 200, y: 230 }} />);
    expect(screen.getByRole('status').textContent).toContain('Welcome');
    const ring = screen.getByRole('button', { name: 'Ring the bell' });
    expect(isPieceControlPress(ring)).toBe(true);
    fireEvent.click(ring);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'ReceptionBell');
    expect(screen.getByRole('button', { name: 'Bell rung' })).toHaveProperty('disabled', true);
    expect(container.querySelector('[data-bell-ringing]')).not.toBeNull();
  });

  // Work Tracker 1256: the Receptionist's bubble, open at the desk after a ring, sat over the Ring Bell and swallowed
  // the next press until I'll Explore closed it.
  it('keeps the Ring Bell clear of the Receptionist’s bubble, so it rings twice with the bubble open', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(1_000_000);
    const root = document.body.appendChild(document.createElement('div'));
    root.setAttribute('data-canvas-root', '');
    // The canvas, a desktop's; the Welcome bubble under where his card would stand; his card 300 px wide over his
    // head, moved by its nudge.
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === root) return screenRect(0, 0, 1440, 900);
        if (this.hasAttribute(KEEP_CLEAR_ATTR)) return screenRect(300, 260, 100, 24);
        const shift = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0);
        return screenRect(200 + shift, 100, 300, 200);
      });
    try {
      openReceptionist('bell');
      render(
        <>
          <AtDesk feet={{ x: 200, y: 230 }} />
          <ReceptionistBubble head={{ x: 350, y: 300 }} feet={{ x: 350, y: 380 }} zoom={1} />
        </>,
        { container: root },
      );
      const card = screen.getByRole('dialog', { name: 'Receptionist' })
        .firstElementChild as HTMLElement;
      // Off to the right of the Welcome (its left edge 8 px past the Welcome's right), the left having no room.
      expect(card.style.transform).toBe('translateX(208px)');
      // Only the moved card takes presses; the box left where he stands lets them through to the Ring Bell.
      expect(screen.getByRole('dialog', { name: 'Receptionist' }).className).toContain(
        'pointer-events-none',
      );
      expect(card.className).toContain('pointer-events-auto');
      fireEvent.click(screen.getByRole('button', { name: 'Ring the bell' }));
      act(() => {
        vi.advanceTimersByTime(5_001);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Ring the bell' }));
      expect(vi.mocked(track).mock.calls.filter((c) => c[2] === 'ReceptionBell')).toHaveLength(2);
      expect(screen.getByRole('dialog', { name: 'Receptionist' })).toBeTruthy();
    } finally {
      rect.mockRestore();
      resetReceptionistState();
      root.remove();
    }
  });

  // Work Tracker 793: a Room Sign placed by hand just above the desk would sit under the Welcome bubble.
  it('shows the Welcome beside the desk when a hand-placed Room Sign stands where it rises', () => {
    const bubble = () => screen.getByRole('status');
    const { rerender } = render(<AtDesk feet={{ x: 200, y: 230 }} />);
    expect(bubble().getAttribute('data-bubble-side')).toBe('above');
    expect(bubble().className).toContain('bottom-[calc(100%+6px)]');
    rerender(<AtDesk feet={{ x: 200, y: 230 }} sign={{ x: 170, y: 40 }} />);
    // The sign hangs past the desk's right end, so the left has the most room.
    expect(bubble().getAttribute('data-bubble-side')).toBe('left');
    expect(bubble().className).toContain('right-[calc(100%+6px)]');
    expect(bubble().style.getPropertyValue('--lh-bubble-x')).toBe('0px');
    // A sign well clear of the bubble's room leaves it above.
    rerender(<AtDesk feet={{ x: 200, y: 230 }} sign={{ x: 700, y: 40 }} />);
    expect(bubble().getAttribute('data-bubble-side')).toBe('above');
  });

  // A phone's view holds the desk and little more: a Welcome beside it would leave the screen, so it shows below.
  it('shows the Welcome below the desk when beside it would leave the view', () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(screenRect(window.innerWidth - 60, 100, 150, 28));
    render(<AtDesk feet={{ x: 200, y: 230 }} sign={{ x: 170, y: 40 }} />);
    const bubble = screen.getByRole('status');
    expect(bubble.getAttribute('data-bubble-side')).toBe('below');
    expect(bubble.className).toContain('top-[calc(100%+6px)]');
    expect(screen.getByRole('button', { name: 'Ring the bell' })).toBeTruthy();
    rect.mockRestore();
  });
});

describe('the office dog', () => {
  const bed = piece('pet-bed', 200, 200);
  const dogIn = () =>
    render(
      <CanvasSurfaceProvider surface="dark">
        <PieceArt element={bed} stroke="#cbd5e1" fill="#1e293b" />
      </CanvasSurfaceProvider>,
    );

  it('sleeps in its bed until the board is read, then wanders its area leg by leg', () => {
    vi.useFakeTimers();
    vi.setSystemTime(PET_LEG_MS * 4);
    const area = { kind: 'box' as const, box: { x: 0, y: 0, width: 600, height: 400 } };
    expect(dogOffset(bed, null, 0)).toEqual({ x: 36, y: 48 * 0.72, asleep: true });
    // Leg 3 of every four naps in the bed; the others are a spot relative to it.
    expect(dogOffset(bed, area, 3).asleep).toBe(true);
    const spot = dogOffset(bed, area, 4);
    expect(spot.asleep).toBe(false);
    expect(spot.x + bed.x).toBeGreaterThanOrEqual(0);
    expect(spot.x + bed.x).toBeLessThanOrEqual(600);
    const { container } = dogIn();
    expect(container.querySelector('[data-pet]')?.getAttribute('data-pet')).toBe('asleep');
    act(() => setPetAreas(new Map([[bed.id, area]])));
    expect(container.querySelector('[data-pet]')?.getAttribute('data-pet')).toBe('awake');
    const first = (container.querySelector('[data-pet]') as HTMLElement).style.transform;
    act(() => {
      vi.advanceTimersByTime(PET_LEG_MS + 50);
    });
    expect((container.querySelector('[data-pet]') as HTMLElement).style.transform).not.toBe(first);
  });

  // docs/specs/008-canvas/canvas-performance.md "A still Space does nothing": the trot is one animation the compositor
  // plays, its legs, bob and tail boxes of their own, and once it stops nothing loops.
  it('trots as one animation, steps and wags on boxes of their own, and rests when it arrives', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(PET_LEG_MS * 4);
    const played: { frames: Keyframe[]; options: KeyframeAnimationOptions; anim: Animation }[] = [];
    const animate = vi.fn(function (frames: Keyframe[], options: KeyframeAnimationOptions) {
      const anim = { currentTime: 0, cancel: vi.fn(), onfinish: null } as unknown as Animation;
      played.push({ frames, options, anim });
      return anim;
    });
    const was = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate;
    try {
      const area = { kind: 'box' as const, box: { x: 0, y: 0, width: 600, height: 400 } };
      const { container } = dogIn();
      const dog = () => container.querySelector<HTMLElement>('[data-pet]')!;
      const tail = () => container.querySelector('[data-pet-tail]')?.getAttribute('data-pet-tail');
      act(() => setPetAreas(new Map([[bed.id, area]])));
      // One animation along the route, linear, from where it lay to its spot.
      // (A dog left out of its bed by an earlier test walks home first: the newest is this leg's.)
      const { frames, options, anim } = played[played.length - 1]!;
      expect(options).toMatchObject({ easing: 'linear', fill: 'forwards' });
      expect(frames[0]!.offset).toBe(0);
      expect(frames[frames.length - 1]!.offset).toBe(1);
      // A transform's numbers, as the style rounds them.
      const at = (t: unknown) =>
        String(t)
          .match(/-?[\d.]+/g)!
          .map((n) => Math.round(Number(n) * 100));
      expect(at(frames[0]!.transform)).toEqual(at(dog().style.transform));
      // Trotting is a mark on the dog, not a render: its stylesheet steps the legs, bobs it and wags the tail, each
      // on a box of its own (no SVG part animates).
      expect(dog().hasAttribute('data-pet-trot')).toBe(true);
      expect(container.querySelectorAll('.lh-pet-leg')).toHaveLength(4);
      for (const leg of container.querySelectorAll('.lh-pet-leg')) expect(leg.tagName).toBe('SPAN');
      expect(container.querySelector('.lh-pet-bob')?.tagName).toBe('DIV');
      expect(tail()).toBe('calm');
      expect(container.querySelectorAll('svg [class]')).toHaveLength(0);
      // It arrives: the drawing stands at the route's end, the animation lets go and the loops stop.
      act(() => {
        anim.onfinish?.call(anim, {} as AnimationPlaybackEvent);
      });
      expect(anim.cancel).toHaveBeenCalled();
      expect(at(dog().style.transform)).toEqual(at(frames[frames.length - 1]!.transform));
      expect(dog().hasAttribute('data-pet-trot')).toBe(false);
      expect(tail()).toBe('calm');
      // A pat wags it fast, then it rests again.
      fireEvent.click(screen.getByRole('button', { name: 'Pat the Dog' }));
      expect(tail()).toBe('fast');
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(tail()).toBe('calm');
    } finally {
      HTMLElement.prototype.animate = was;
    }
  });

  it('stands where it had got to when a new goal stops it on its way', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(PET_LEG_MS * 4);
    const anims: Animation[] = [];
    const was = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = vi.fn(() => {
      const anim = { currentTime: 0, cancel: vi.fn(), onfinish: null } as unknown as Animation;
      anims.push(anim);
      return anim;
    });
    try {
      const area = { kind: 'box' as const, box: { x: 0, y: 0, width: 600, height: 400 } };
      const { container } = dogIn();
      act(() => setPetAreas(new Map([[bed.id, area]])));
      const start = container.querySelector<HTMLElement>('[data-pet]')!.style.transform;
      // The bed is taken away mid-trot, at its very start: it stays put and the animation lets go.
      act(() => setPetAreas(new Map()));
      expect(anims[0]!.cancel).toHaveBeenCalled();
      expect(container.querySelector<HTMLElement>('[data-pet]')!.style.transform).toBe(start);
      // Still trotting only if it set off afresh (home to its bed).
      expect(container.querySelector('[data-pet]')!.hasAttribute('data-pet-trot')).toBe(
        anims.length > 1,
      );
    } finally {
      HTMLElement.prototype.animate = was;
    }
  });

  it('raises a heart when patted, and keeps the press its own', () => {
    dogIn();
    const dog = screen.getByRole('button', { name: 'Pat the Dog' });
    expect(isPieceControlPress(dog)).toBe(true);
    fireEvent.click(dog);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'PatPet');
    expect(document.querySelector('[data-pet-heart]')).not.toBeNull();
  });

  it('stays asleep in its bed under reduced motion', () => {
    reduced.on = true;
    const area = { kind: 'box' as const, box: { x: 0, y: 0, width: 600, height: 400 } };
    setPetAreas(new Map([[bed.id, area]]));
    const { container } = dogIn();
    expect(container.querySelector('[data-pet]')?.getAttribute('data-pet')).toBe('asleep');
  });

  it('goes back to its bed the moment reduced motion is turned on, and wakes when it is off', async () => {
    // Leg 4 trots (every fourth naps), so the switch is what puts it to bed.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(PET_LEG_MS * 4);
    const area = { kind: 'box' as const, box: { x: 0, y: 0, width: 600, height: 400 } };
    setPetAreas(new Map([[bed.id, area]]));
    const { container, unmount } = dogIn();
    const state = () => container.querySelector('[data-pet]')?.getAttribute('data-pet');
    expect(state()).toBe('awake');
    // The in-app preference: its class on <html>, which the dog watches.
    reduced.on = true;
    await act(async () => {
      document.documentElement.classList.add('reduce-motion');
      await Promise.resolve();
    });
    expect(state()).toBe('asleep');
    reduced.on = false;
    await act(async () => {
      document.documentElement.classList.remove('reduce-motion');
      await Promise.resolve();
    });
    expect(state()).toBe('awake');
    unmount();
  });
});
