// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from './ParticipantAvatar';

// The status line an agent sets (docs/specs/024-agents/blueprints/agent-presence.md "Presentation and UX",
// "Accessibility"), in the avatar's accessible name and its hover card.

const webber: Participant = { id: 'me', name: 'Webber', color: '#3b82f6', status: 'online' };

// The hover card opens at once on a mouse pointer; its text is the title, then the description.
function hoverText(participant: Participant): string {
  const view = render(<ParticipantAvatar participant={participant} withHoverCard />);
  fireEvent.pointerEnter(screen.getByRole('img'), { pointerType: 'mouse' });
  const text = document.body.textContent ?? '';
  view.unmount();
  return text;
}

describe('ParticipantAvatar', () => {
  afterEach(cleanup);

  // docs/specs/014-identity/profile-picture.md §4: the Google picture over the initials, the initials alone without.
  it('draws the Google picture the room relayed over the initials, and the initials without one', () => {
    const picture = 'https://lh3.googleusercontent.com/a/webber';
    const { container, unmount } = render(
      <ParticipantAvatar participant={{ ...webber, picture }} size={28} />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(`${picture}=s28-c`);
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(container.textContent).toBe('WE');
    unmount();
    const plain = render(<ParticipantAvatar participant={webber} />);
    expect(plain.container.querySelector('img')).toBeNull();
    expect(plain.container.textContent).toBe('WE');
  });

  it('reads an owner’s agent status in the accessible name', () => {
    render(<ParticipantAvatar participant={{ ...webber, statusLine: 'adding payment service' }} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Webber (Online), adding payment service',
    );
  });

  it('leads an owner’s hover card with their agent’s status line', () => {
    expect(hoverText({ ...webber, statusLine: 'adding payment' })).toContain(
      'adding payment · Online',
    );
    expect(hoverText(webber)).toMatch(/WebberOnline$/);
  });

  it('says only what an agent row is doing, or that it is online', () => {
    const row = { ...webber, agent: true as const, lastActiveAt: 1 };
    expect(hoverText({ ...row, statusLine: 'reviewing' })).toMatch(/Webberreviewing$/);
    expect(hoverText(row)).toMatch(/WebberOnline$/);
  });
});
