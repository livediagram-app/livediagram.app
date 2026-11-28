// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATAR_PAD_ART, AVATAR_PAD_TONES, AVATAR_PALETTE } from '@livehuddle/document';
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
  it('draws the fixed vector table, smooth, fitted whole, in one SVG', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    const pad = container.querySelector('[data-avatar-pad]')!;
    expect(pad.getAttribute('role')).toBe('img');
    const layers = [...pad.querySelectorAll('svg')];
    expect(layers).toHaveLength(1);
    expect(layers[0]!.getAttribute('shape-rendering')).toBeNull();
    expect(layers[0]!.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    // Back to front, in the table's order.
    expect(
      [...pad.querySelectorAll('[data-pad-role]')].map((p) => p.getAttribute('data-pad-role')),
    ).toEqual(AVATAR_PAD_ART.map((p) => p.role));
    expect(pad.querySelectorAll('rect')).toHaveLength(0);
  });
  // canvas-performance.md "A still Space does nothing": the pad is drawn once and never moves (the owner, 2026-11-27:
  // "make it less scifi"): no shimmer, no gradient.
  it('is still: no shimmer and no glow', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    expect(container.querySelectorAll('.avatar-pad-shimmer')).toHaveLength(0);
    expect(container.querySelectorAll('radialGradient')).toHaveLength(0);
  });
  it('outlines in the theme stroke, in its own woods and rug', () => {
    const { container } = render(<AvatarPadView stroke="#475569" />);
    const role = (r: string) => container.querySelector(`[data-pad-role="${r}"]`)!;
    expect(role('top').getAttribute('stroke')).toBe('#475569');
    expect(role('side').getAttribute('fill')).toBe(AVATAR_PAD_TONES.oak);
    expect(role('rug').getAttribute('fill')).toBe(AVATAR_PAD_TONES.cream);
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
