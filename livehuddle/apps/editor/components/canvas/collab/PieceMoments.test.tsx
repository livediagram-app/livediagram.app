// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShapeElement } from '@livehuddle/document';
import { MOMENT_KINDS, playMoment, resetPieceMoments, type MomentKind } from '@/lib/piece-moments';
import { FurnitureView } from './FurnitureView';
import { PondView } from './PondView';

afterEach(() => {
  cleanup();
  resetPieceMoments();
});

const piece = (shape: MomentKind, id: string = shape) =>
  ({ id, type: 'shape', shape, x: 0, y: 0, width: 120, height: 160 }) as unknown as ShapeElement;

const draw = (shape: MomentKind, id: string = shape) =>
  shape === 'pond'
    ? render(<PondView element={piece(shape, id)} stroke="#64748b" floor="#7dd3fc" />)
    : render(<FurnitureView element={piece(shape, id)} stroke="#64748b" sitters={[]} />);

// docs/specs/009-elements/piece-moments.md "The moments".
describe('a piece moment on screen', () => {
  it('draws nothing extra until a moment plays', () => {
    const { container } = draw('tree');
    expect(container.querySelector('[data-moment-parts]')).toBeNull();
    expect(container.querySelector('[data-moment]')).toBeNull();
  });

  it.each(MOMENT_KINDS)('plays the %s moment, hidden from assistive tech', (kind) => {
    const { container } = draw(kind);
    act(() => playMoment(kind, 1));
    const parts = container.querySelector(`[data-moment-parts="${kind}"]`);
    expect(parts).not.toBeNull();
    expect(parts!.getAttribute('aria-hidden')).toBe('true');
    expect(parts!.querySelector('.lh-moment')).not.toBeNull();
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
});
