// @vitest-environment jsdom
// Every surface that draws another person carries their published picture when there is one
// (docs/specs/014-identity/profile-picture.md §5), keeps its name for assistive technology, and
// shows initials alone when there is none.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ParticipantAvatar } from './ParticipantAvatar';
import { RemoteCursor } from '@/components/canvas/RemoteCursor';

afterEach(cleanup);

const PICTURE = 'https://img.clerk.com/ann';

describe('ParticipantAvatar', () => {
  it('lays the picture over the initials and stays named', () => {
    const view = render(
      <ParticipantAvatar
        participant={{
          id: 'p',
          name: 'Ann Lee',
          color: '#f00',
          status: 'online',
          picture: PICTURE,
        }}
      />,
    );
    expect(view.getByRole('img', { name: 'Ann Lee (Online)' })).toBeTruthy();
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
      `${PICTURE}?width=96&height=96`,
    );
  });

  it('draws initials alone without a picture', () => {
    const view = render(
      <ParticipantAvatar
        participant={{ id: 'p', name: 'Ann Lee', color: '#f00', status: 'online' }}
      />,
    );
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.getByText('AL')).toBeTruthy();
  });
});

describe('RemoteCursor', () => {
  const cursor = { id: 'c', name: 'Ann', color: '#f00', x: 0, y: 0 };

  it('leads the name pill with the picture when there is one', () => {
    const view = render(<RemoteCursor cursor={{ ...cursor, picture: PICTURE }} zoom={1} />);
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain(PICTURE);
    expect(view.getByText('Ann')).toBeTruthy();
  });

  it('keeps the plain name pill without one', () => {
    const view = render(<RemoteCursor cursor={cursor} zoom={1} />);
    expect(view.container.querySelector('[data-avatar-state]')).toBeNull();
  });
});
