// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { AvatarWalker } from './AvatarWalker';

afterEach(cleanup);

const peer = (x: number, walking: boolean, glideMs?: number) => (
  <AvatarWalker
    pos={{ x, y: 100 }}
    facing="right"
    config={DEFAULT_AVATAR_CONFIG}
    walking={walking}
    stepFrame={0}
    standingOn={null}
    name="Sam"
    glideMs={glideMs}
  />
);

const box = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-avatar="peer"]')!;

// docs/specs/008-canvas/avatar-mode.md "A busy room"
describe('a peer’s character in a busy room', () => {
  it('slides a walking step over one step', () => {
    const { container, rerender } = render(peer(100, true, 66));
    rerender(peer(117, true, 66));
    expect(box(container).style.transition).toBe('left 66ms linear, top 66ms linear');
  });

  it('lands a jump, a stop and a quiet room’s packet at once', () => {
    const { container, rerender } = render(peer(100, true, 66));
    rerender(peer(900, true, 66));
    expect(box(container).style.transition).toBe('');
    rerender(peer(910, false, 66));
    expect(box(container).style.transition).toBe('');
    rerender(peer(920, true));
    expect(box(container).style.transition).toBe('');
  });
});

// livehuddle's Receptionist (docs/specs/008-canvas/receptionist.md "Where he is"): a host is never counted as a peer.
describe('a host character', () => {
  it('is marked a host, not a peer or you', () => {
    const { container } = render(
      <AvatarWalker
        pos={{ x: 0, y: 0 }}
        facing="right"
        config={DEFAULT_AVATAR_CONFIG}
        walking={false}
        stepFrame={0}
        standingOn={null}
        name="Receptionist"
        host
      />,
    );
    expect(container.querySelectorAll('[data-avatar="host"]')).toHaveLength(1);
    expect(container.querySelector('[data-avatar="peer"]')).toBeNull();
  });
});
