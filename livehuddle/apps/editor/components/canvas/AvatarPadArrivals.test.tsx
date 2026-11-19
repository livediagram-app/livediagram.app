// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_PAD_ART,
  AVATAR_PAD_TONES,
  AVATAR_PALETTE,
  isAvatarPadLight,
} from '@livehuddle/document';
import { AvatarPadArrivals } from '@livehuddle/avatar/components/AvatarPadArrivals';
import { AvatarPadView } from './collab/AvatarPadView';
import type { PadArrival } from '@livehuddle/avatar/pad';

// docs/specs/009-elements/avatar-pad.md "The element" and "The arrival".
const arrival = (over: Partial<PadArrival> = {}): PadArrival => ({
  key: 'ann:1',
  personId: 'ann',
  padId: 'pad',
  x: 200,
  y: 300,
  color: '#f43f5e',
  startedAt: 1,
  ...over,
});

describe('AvatarPadView', () => {
  it('draws the fixed vector table, smooth, fitted whole, with the lights shimmering', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    const pad = container.querySelector('[data-avatar-pad]')!;
    expect(pad.getAttribute('role')).toBe('img');
    const layers = [...pad.querySelectorAll('svg')];
    for (const svg of layers) {
      expect(svg.getAttribute('shape-rendering')).toBeNull();
      expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    }
    // Back to front, in the table's order.
    expect(
      [...pad.querySelectorAll('[data-pad-role]')].map((p) => p.getAttribute('data-pad-role')),
    ).toEqual(AVATAR_PAD_ART.map((p) => p.role));
    expect(pad.querySelectorAll('rect')).toHaveLength(0);
  });
  // canvas-performance.md "A still Space does nothing": the lights shimmer on boxes of their own, which the compositor
  // fades, never on the SVG parts (a fade there repaints the board's layers on every step).
  it('shimmers its lights on boxes of their own, and only its lights', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    const lit = [...container.querySelectorAll('.avatar-pad-shimmer')];
    expect(lit.length).toBe(2);
    for (const box of lit) expect(box.tagName).toBe('DIV');
    const shimmering = lit.flatMap((box) =>
      [...box.querySelectorAll('[data-pad-role]')].map((p) => p.getAttribute('data-pad-role')),
    );
    expect(shimmering).toEqual(
      AVATAR_PAD_ART.filter((p) => isAvatarPadLight(p.role)).map((p) => p.role),
    );
    expect(container.querySelectorAll('svg .avatar-pad-shimmer')).toHaveLength(0);
  });
  it('outlines in the theme stroke and lights in the fixed cyan', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    const role = (r: string) => container.querySelector(`[data-pad-role="${r}"]`)!;
    expect(role('top').getAttribute('stroke')).toBe('#475569');
    expect(role('ring').getAttribute('stroke')).toBe(AVATAR_PAD_TONES.ring);
    const glow = role('glow').getAttribute('fill')!;
    expect(container.querySelector(`radialGradient${glow.slice(4, -1)}`)).not.toBeNull();
  });
  it('wears an element animation on its drawing', () => {
    const { container } = render(<AvatarPadView animClass="lvd-anim-text-glow" />);
    expect(container.firstElementChild?.className).toContain('lvd-anim-text-glow');
  });
});

describe('AvatarPadArrivals', () => {
  it('renders nothing with nobody arriving', () => {
    const { container } = render(<AvatarPadArrivals arrivals={[]} />);
    expect(container.innerHTML).toBe('');
  });
  it('stands a beam on the feet, in the arriving person’s colour', () => {
    const { container } = render(<AvatarPadArrivals arrivals={[arrival()]} />);
    const beam = container.querySelector<HTMLElement>('[data-avatar-pad-arrival]')!;
    expect(beam.classList.contains('avatar-pad-arrival')).toBe(true);
    expect(beam.style.left).toBe('160px');
    expect(beam.style.top).toBe('106px');
    expect(container.querySelector('.avatar-pad-beam rect')?.getAttribute('fill')).toBe('#f43f5e');
    expect(container.querySelectorAll('.avatar-pad-spark')).toHaveLength(6);
    expect(container.querySelectorAll('.avatar-pad-flash rect').length).toBeGreaterThan(10);
  });
  it('falls back to the sprite cyan for a colour it cannot mix', () => {
    const { container } = render(
      <AvatarPadArrivals arrivals={[arrival({ color: 'rebeccapurple' })]} />,
    );
    expect(container.querySelector('.avatar-pad-beam rect')?.getAttribute('fill')).toBe(
      AVATAR_PALETTE.shirt,
    );
  });
  it('plays one beam per arrival', () => {
    const { container } = render(
      <AvatarPadArrivals arrivals={[arrival(), arrival({ key: 'bob:2', personId: 'bob' })]} />,
    );
    expect(container.querySelectorAll('[data-avatar-pad-arrival]')).toHaveLength(2);
  });
});
