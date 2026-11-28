// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { AvatarWalker } from './AvatarWalker';

afterEach(cleanup);

const walker = (status: 'available' | 'focus' | 'meeting' | 'away' | 'dnd' | null, name?: string) =>
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
  // Read out where assistive tech can reach it: never under the character's aria-hidden drawing.
  const exposed = (el: HTMLElement) => el.closest('[aria-hidden="true"]') === null;

  it('puts a peer’s status in their name chip, read with their name', () => {
    const { getByText } = walker('meeting', 'Sam');
    expect(exposed(getByText('Sam, In a Meeting'))).toBe(true);
  });

  it('shows your own status alone above your head, read as yours', () => {
    const { getByText } = walker('available');
    expect(exposed(getByText('Your status: Available'))).toBe(true);
  });

  it('labels a peer’s dot after their name, the status kept whole', () => {
    const { container } = walker('focus', 'Alexandria Montgomery-Smythe');
    const chip = container.querySelector('.truncate')!.parentElement!;
    const label = [...chip.querySelectorAll('span')].find((el) => el.textContent === '· Focusing')!;
    expect(label).toBeTruthy();
    expect(label.className).toContain('shrink-0');
  });

  it('labels your own dot with your status', () => {
    const { container } = walker('dnd');
    const own = container.querySelector('[data-own-status]')!;
    expect(own.textContent).toBe('Do Not Disturb');
    expect(own.querySelector('[data-status-dot="dnd"]')).not.toBeNull();
  });

  it('shows no label without a status', () => {
    const { container } = walker(null, 'Sam');
    expect(container.textContent).not.toContain('·');
    expect(container.querySelector('[data-own-status]')).toBeNull();
  });

  it('ends a long name in an ellipsis inside the chip', () => {
    const { getByText } = walker('meeting', 'Alexandria Montgomery-Smythe');
    const name = getByText('Alexandria Montgomery-Smythe');
    // Its own box beside the status dot: bare text in the flex chip clips mid-letter with no ellipsis.
    expect(name.tagName).toBe('SPAN');
    expect(name.className).toContain('truncate');
  });

  it('floats a Zz over an Away character', () => {
    expect(walker('away').getByText('Zz')).toBeTruthy();
  });

  // The figure is the 3D scene's (3d-engine.md): the walker hands it the status to wear (Away's fade, Focusing's
  // headphones) and draws no figure of its own.
  it('hands the status to the 3D figure and draws no flat figure', () => {
    const { container } = walker('focus');
    const box = container.querySelector<HTMLElement>('[data-figure]')!;
    const figure = JSON.parse(box.dataset.figure ?? '{}') as { status?: string };
    expect(figure.status).toBe('focus');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws Do Not Disturb as a rose dot with a white bar, read by name', () => {
    const { container, getByText } = walker('dnd', 'Sam');
    expect(exposed(getByText('Sam, Do Not Disturb'))).toBe(true);
    const dot = container.querySelector('[data-status-dot="dnd"]');
    expect(dot?.getAttribute('style')).toContain('rgb(225, 29, 72)');
    expect(dot?.querySelector('.bg-white')).not.toBeNull();
  });
});
