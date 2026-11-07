// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, PET_LEG_MS, type ShapeElement } from '@livehuddle/document';

vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
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
import { hotDeskCard, dogOffset } from './WorkdayFaces';

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
  });
});

function AtDesk({ feet }: { feet: { x: number; y: number } | null }) {
  const desk = piece('reception-desk', 100, 100);
  useWorkdayPieces({ active: true, feet, elements: [desk] });
  return (
    <CanvasSurfaceProvider surface="light">
      <PieceArt element={desk} stroke="#334155" fill="#ffffff" sitters={[]} />
    </CanvasSurfaceProvider>
  );
}

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
});

describe('the office dog', () => {
  const bed = piece('pet-bed', 200, 200);
  const dogIn = () =>
    render(
      <CanvasSurfaceProvider surface="dark">
        <PieceArt element={bed} stroke="#cbd5e1" fill="#1e293b" sitters={[]} />
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
