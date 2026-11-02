// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATAR_PAD_PARTS, AVATAR_PALETTE } from '@livehuddle/document';
import { AvatarPadArrivals } from '@liveworkspace/avatar/components/AvatarPadArrivals';
import { AvatarPadView } from './collab/AvatarPadView';
import type { PadArrival } from '@liveworkspace/avatar/pad';

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
  it('draws every pixel run, crisp, with the lights in the shimmering group', () => {
    const { container } = render(<AvatarPadView />);
    const svg = container.querySelector('svg[data-avatar-pad]')!;
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(svg.querySelectorAll('rect')).toHaveLength(AVATAR_PAD_PARTS.length);
    const lights = AVATAR_PAD_PARTS.filter((p) => p.role === 'ring' || p.role === 'lamp');
    expect(svg.querySelectorAll('.avatar-pad-shimmer rect')).toHaveLength(lights.length);
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
