// @vitest-environment jsdom
// A peer's Google picture on their avatar (docs/specs/014-identity/profile-and-email-notifications.md "Profile
// pictures"): over their initials, at the avatar's size, falling back to the initials when it fails; and the rule
// for what this person's own presence publishes.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPictureFailures } from '@liveplanner/ui';
import { ParticipantAvatar } from './ParticipantAvatar';
import { publishedPicture } from '@/lib/own-picture';
import type { Participant } from '@/lib/identity';

const PICTURE = 'https://lh3.googleusercontent.com/a/ada';
const ada = (over: Partial<Participant> = {}): Participant => ({
  id: 'p1',
  name: 'Ada Lovelace',
  color: '#0ea5e9',
  status: 'online',
  ...over,
});

afterEach(() => {
  cleanup();
  resetPictureFailures();
});

describe('ParticipantAvatar with a Google picture', () => {
  it('draws the picture over the initials at the avatar size, named by the disc', () => {
    const { getByRole } = render(<ParticipantAvatar participant={ada({ picture: PICTURE })} />);
    const disc = getByRole('img', { name: /Ada Lovelace/ });
    expect(disc.textContent).toBe('AL');
    const img = disc.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(`${PICTURE}=s28-c`);
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('keeps the initials alone when the picture fails or there is none', () => {
    const { getByRole, rerender } = render(
      <ParticipantAvatar participant={ada({ picture: PICTURE })} />,
    );
    fireEvent.error(getByRole('img', { name: /Ada Lovelace/ }).querySelector('img')!);
    expect(getByRole('img', { name: /Ada Lovelace/ }).querySelector('img')).toBeNull();
    rerender(<ParticipantAvatar participant={ada({ id: 'p2' })} />);
    expect(getByRole('img', { name: /Ada Lovelace/ }).querySelector('img')).toBeNull();
  });
});

describe('publishedPicture', () => {
  it('publishes the picture only for a signed-in person with the switch on, and only a Google one', () => {
    expect(publishedPicture(true, PICTURE, true)).toBe(PICTURE);
    expect(publishedPicture(true, PICTURE, false)).toBeNull();
    expect(publishedPicture(false, PICTURE, true)).toBeNull();
    expect(publishedPicture(true, 'https://evil.example/a.png', true)).toBeNull();
    expect(publishedPicture(true, null, true)).toBeNull();
  });
});
