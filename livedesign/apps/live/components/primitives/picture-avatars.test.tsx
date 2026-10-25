// @vitest-environment jsdom
// Google pictures on livedesign's avatars (docs/specs/014-identity/profile-and-email-notifications.md "Avatars"):
// a presence avatar draws the picture the room relayed over the initials, falls back to them when it fails, and
// the person's own picture follows Show My Google Picture only in what the room is sent.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { resetPictureFailures } from '@livedesign/ui';
import type { Participant } from '@/lib/identity';
import {
  ownPicture,
  publishedPicture,
  resetOwnPicture,
  setOwnPicture,
  setOwnPictureShown,
} from '@/lib/own-picture';
import { buildRemoteCursorRows } from '@/lib/presence-rows';
import { ParticipantAvatar } from './ParticipantAvatar';

const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s1000-c';
const ada: Participant = {
  id: 'p1',
  name: 'Ada Lovelace',
  color: '#3b82f6',
  status: 'online',
  picture: PICTURE,
};

afterEach(() => {
  cleanup();
  resetPictureFailures();
  resetOwnPicture();
});

describe('a presence avatar', () => {
  it('draws the picture over the initials, at its own size', () => {
    const { container } = render(<ParticipantAvatar participant={ada} size={28} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://lh3.googleusercontent.com/a/ACg8ocAda=s28-c');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(container.textContent).toContain('AL');
  });

  it('falls back to the initials when the picture fails', () => {
    const { container } = render(<ParticipantAvatar participant={ada} size={28} />);
    act(() => {
      fireEvent.error(container.querySelector('img')!);
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('AL');
  });

  it('draws the initials alone without a picture', () => {
    const { container } = render(
      <ParticipantAvatar participant={{ ...ada, picture: undefined }} size={28} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('the cursor pill', () => {
  it('carries the picture with the name', () => {
    const rows = buildRemoteCursorRows(
      new Map([['p1', { tabId: 't', x: 1, y: 2 }]]),
      new Map([['p1', ada]]),
      'me',
      't',
    );
    expect(rows[0]).toMatchObject({ name: 'Ada Lovelace', picture: PICTURE });
  });
});

describe('the own picture', () => {
  it('is published only while Show My Google Picture is on, and never when it is not a Google one', () => {
    setOwnPicture(PICTURE, false);
    expect(publishedPicture(ownPicture())).toBe(PICTURE);
    setOwnPictureShown(false);
    expect(ownPicture().picture).toBe(PICTURE);
    expect(publishedPicture(ownPicture())).toBeNull();
    setOwnPicture('https://evil.example/a.png', false);
    expect(publishedPicture(ownPicture())).toBeNull();
    setOwnPicture(PICTURE, true);
    expect(publishedPicture(ownPicture())).toBeNull();
  });
});
