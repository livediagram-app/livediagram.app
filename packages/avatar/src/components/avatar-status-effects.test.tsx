// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from '../config';
import { AVATAR_CALL_STATUSES, type AvatarStatus } from '../status';
import type { AvatarFacing } from '../walk';
import { AvatarSprite } from './avatar-sprite';
import { AvatarWalker } from './AvatarWalker';
import { avatarStatusHeadroomPx, avatarStatusOverflows } from './avatar-status-effects';

afterEach(cleanup);

const sprite = (
  status: AvatarStatus | null,
  {
    facing = 'down',
    holding = null,
    hair = DEFAULT_AVATAR_CONFIG.hair,
    portrait = false,
  }: {
    facing?: AvatarFacing;
    holding?: 'coffee' | null;
    hair?: AvatarConfig['hair'];
    portrait?: boolean;
  } = {},
) =>
  render(
    <AvatarSprite
      facing={facing}
      config={{ ...DEFAULT_AVATAR_CONFIG, hair }}
      walking={false}
      stepFrame={0}
      lift={0}
      wave={null}
      holding={holding}
      portrait={portrait}
      status={status}
    />,
  ).container;

// The statuses whose signature the effects module draws (Focusing's headphones and Away's fade are the sprite's and
// the walker's own).
const DRAWN = AVATAR_CALL_STATUSES.map((s) => s.id).filter((id) => id !== 'focus' && id !== 'away');

// docs/specs/008-canvas/avatar-mode.md "Status": a signature on the character for every status.
describe('status signatures', () => {
  it('draws each status’s signature in every view', () => {
    for (const status of DRAWN) {
      for (const facing of ['down', 'up', 'left', 'right'] as const) {
        const c = sprite(status, { facing });
        expect(
          c.querySelector(`[data-status-effect="${status}"]`),
          `${status} ${facing}`,
        ).not.toBeNull();
        cleanup();
      }
    }
  });

  it('draws nothing without a status, and keeps Focusing to its headphones', () => {
    expect(sprite(null).querySelector('[data-status-effect]')).toBeNull();
    cleanup();
    const focus = sprite('focus');
    expect(focus.querySelector('[data-status-effect]')).toBeNull();
  });

  it('puffs steam from both ears when Angry, one in profile, and furrows the brow only on the face', () => {
    expect(sprite('angry').querySelectorAll('.avatar-status-steam-l')).toHaveLength(2);
    expect(sprite('angry').querySelectorAll('.avatar-status-steam-r').length).toBeGreaterThan(0);
    cleanup();
    const profile = sprite('angry', { facing: 'left' });
    expect(profile.querySelectorAll('.avatar-status-steam-l')).toHaveLength(0);
    expect(profile.querySelectorAll('.avatar-status-steam-r')).toHaveLength(2);
    cleanup();
    // From behind there is no face: steam, but no flush.
    expect(sprite('angry', { facing: 'up' }).querySelector('[opacity="0.35"]')).toBeNull();
  });

  it('animates only through CSS classes, and a still status has no animated node', () => {
    for (const still of ['meeting', 'dnd', 'sick'] as const) {
      expect(sprite(still).querySelector('[class*="avatar-status-"]'), still).toBeNull();
      cleanup();
    }
    // An animated group never carries a transform attribute: the CSS transform would replace it.
    for (const status of DRAWN) {
      for (const el of sprite(status).querySelectorAll('[class*="avatar-status-"]')) {
        expect(el.getAttribute('transform'), status).toBeNull();
      }
      cleanup();
    }
  });

  it('puts the sandwich down while a drink holds the hand', () => {
    expect(sprite('lunch').querySelector('[data-status-effect="lunch"]')).not.toBeNull();
    cleanup();
    expect(
      sprite('lunch', { holding: 'coffee' }).querySelector('[data-status-effect="lunch"]'),
    ).toBeNull();
  });

  it('lets a cropped portrait show a signature past its edge', () => {
    expect(sprite('celebrating', { portrait: true }).querySelector('svg')?.style.overflow).toBe(
      'visible',
    );
    cleanup();
    expect(sprite(null, { portrait: true }).querySelector('svg')?.style.overflow).toBe('');
    expect(avatarStatusOverflows('away')).toBe(false);
    expect(avatarStatusOverflows('angry')).toBe(true);
  });

  it('lifts the name chip over a signature worn over the head, more over tall hair', () => {
    expect(avatarStatusHeadroomPx(null, 'short', 1)).toBe(0);
    expect(avatarStatusHeadroomPx('angry', 'short', 1)).toBe(0);
    const hat = avatarStatusHeadroomPx('celebrating', 'short', 1);
    expect(hat).toBeGreaterThan(0);
    expect(avatarStatusHeadroomPx('celebrating', 'afro', 1)).toBeGreaterThan(hat);
    expect(avatarStatusHeadroomPx('celebrating', 'short', 2)).toBe(hat * 2);
    const chipTop = (status: AvatarStatus) => {
      const { container } = render(
        <AvatarWalker
          pos={{ x: 0, y: 0 }}
          facing="down"
          config={DEFAULT_AVATAR_CONFIG}
          walking={false}
          stepFrame={0}
          standingOn={null}
          name="Sam"
          status={status}
        />,
      );
      const top = parseFloat(
        (container.querySelector('.truncate')!.parentElement as HTMLElement).style.top,
      );
      cleanup();
      return top;
    };
    expect(chipTop('thinking')).toBeLessThan(chipTop('available'));
  });
});
