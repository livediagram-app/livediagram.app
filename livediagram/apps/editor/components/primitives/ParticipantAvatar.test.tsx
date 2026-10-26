// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resetPictureFailures } from '@livediagram/ui';
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
  afterEach(resetPictureFailures);

  // liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures": the Google picture over the initials, which come back if it
  // fails; an agent row never wears one.
  it('draws a Google picture over the initials, at the avatar size, and falls back on error', () => {
    const picture = 'https://lh3.googleusercontent.com/a/webber=s96-c';
    const { container } = render(
      <ParticipantAvatar participant={{ ...webber, picture }} size={28} />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://lh3.googleusercontent.com/a/webber=s28-c');
    expect(img.getAttribute('alt')).toBe('');
    expect(screen.getByLabelText('Webber (Online)').textContent).toBe('WE');
    act(() => {
      fireEvent.error(img);
    });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('Webber (Online)').textContent).toBe('WE');
  });

  it('never draws a picture on an agent row, or one that is not a Google picture', () => {
    const { container } = render(
      <>
        <ParticipantAvatar
          participant={{ ...webber, agent: true, picture: 'https://lh3.googleusercontent.com/a/x' }}
        />
        <ParticipantAvatar participant={{ ...webber, picture: 'https://evil.example/w.png' }} />
      </>,
    );
    expect(container.querySelector('img')).toBeNull();
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
