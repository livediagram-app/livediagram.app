// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { billboardOrigin, SPACE_BILLBOARD_ATTR } from '../billboard';
import { AvatarWalker } from './AvatarWalker';

afterEach(cleanup);

// docs/specs/008-canvas/3d-view.md "What it shows": characters stand up about their feet.
describe('a character in the 3D view', () => {
  it('draws its figure and chip inside a box that stands up about its feet', () => {
    const { container } = render(
      <AvatarWalker
        pos={{ x: 100, y: 200 }}
        facing="down"
        config={DEFAULT_AVATAR_CONFIG}
        walking={false}
        stepFrame={0}
        standingOn={null}
        name="Sam"
        status="meeting"
      />,
    );
    const stands = container.querySelectorAll<HTMLElement>('[data-avatar-stand]');
    expect(stands.length).toBeGreaterThan(0);
    const placed = container.querySelector<HTMLElement>('[data-avatar]')!;
    const stand = placed.querySelector<HTMLElement>('[data-avatar-stand]')!;
    // The placed box is translated so its origin offset lands on the feet: the stand turns about that offset.
    const [, tx, ty] = placed.style.transform
      .match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!
      .map(Number);
    expect(stand.style.transformOrigin).toBe(`${100 - tx!}px ${200 - ty!}px`);
  });

  // 3d-view.md "Pieces stand up": a sitter near a piece's front is nudged towards the camera, on its figure and chip.
  it("carries a sitter's seat lift on its box and chip, and none while standing", () => {
    const walker = (seated: boolean) =>
      render(
        <AvatarWalker
          pos={{ x: 100, y: 200 }}
          facing="down"
          config={DEFAULT_AVATAR_CONFIG}
          walking={false}
          stepFrame={0}
          standingOn={null}
          name="Sam"
          seated={seated}
          seatLift={30}
          chipShift={0}
        />,
      ).container;
    const sitting = walker(true);
    expect(
      sitting
        .querySelector<HTMLElement>('[data-avatar]')!
        .style.getPropertyValue('--space-seat-lift'),
    ).toBe('30px');
    expect(
      sitting
        .querySelector<HTMLElement>('[data-avatar-chip]')!
        .style.getPropertyValue('--space-seat-lift'),
    ).toBe('30px');
    cleanup();
    const standing = walker(false);
    expect(
      standing
        .querySelector<HTMLElement>('[data-avatar]')!
        .style.getPropertyValue('--space-seat-lift'),
    ).toBe('');
  });

  it('turns what floats over a head about the feet below it', () => {
    expect(SPACE_BILLBOARD_ATTR).toEqual({ 'data-space-billboard': '' });
    expect(billboardOrigin(0, 64)).toEqual({
      '--space-billboard-origin': 'calc(50% + 0px) calc(100% + 64px)',
    });
    expect(billboardOrigin(3, 4, '0px', '50%')).toEqual({
      '--space-billboard-origin': 'calc(0px + 3px) calc(50% + 4px)',
    });
  });
});
