// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-config';
import { AvatarWalker } from './AvatarWalker';

afterEach(cleanup);

const walker = (status: 'available' | 'focus' | 'meeting' | 'away' | null, name?: string) =>
  render(
    <AvatarWalker
      pos={{ x: 0, y: 0 }}
      facing="down"
      config={DEFAULT_AVATAR_CONFIG}
      walking={false}
      stepFrame={0}
      standingOn={null}
      name={name}
      status={status}
    />,
  );

// docs/specs/008-canvas/avatar-mode.md "Status"
describe('a character’s status', () => {
  it('puts a peer’s status in their name chip, read with their name', () => {
    const { getByLabelText } = walker('meeting', 'Sam');
    expect(getByLabelText('Sam, In a Meeting')).toBeTruthy();
  });

  it('shows your own status alone above your head', () => {
    const { getByLabelText } = walker('available');
    expect(getByLabelText('Available')).toBeTruthy();
  });

  it('fades an Away character and floats a Zz over it', () => {
    const { container, getByText } = walker('away');
    expect(getByText('Zz')).toBeTruthy();
    expect(container.innerHTML).toContain('opacity: 0.5');
  });

  it('puts headphones on a Focusing character', () => {
    const focus = walker('focus').container.innerHTML;
    cleanup();
    const none = walker(null).container.innerHTML;
    expect(focus).toContain('#8b5cf6');
    expect(none).not.toContain('#8b5cf6');
  });
});
