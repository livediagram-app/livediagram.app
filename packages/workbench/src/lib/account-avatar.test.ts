import { describe, expect, it } from 'vitest';
import { avatarColour, avatarFill } from '@liveworkspace/account-menu/initials';
import { participantWithProfile } from '@liveworkspace/settings-ui/profile-events';
import { accountAvatarFill, accountInitials } from './account-avatar';

describe('accountInitials', () => {
  it('takes two letters, from the first and last names', () => {
    expect(accountInitials({ firstName: 'Ada', lastName: 'Quinn', username: null })).toBe('AQ');
    expect(accountInitials({ firstName: 'webber', lastName: null, username: 'wt' })).toBe('WE');
  });

  it('falls back to the full name, the username, the email, then a question mark', () => {
    expect(
      accountInitials({ firstName: null, lastName: null, fullName: 'Tom Ray', username: null }),
    ).toBe('TR');
    expect(accountInitials({ firstName: null, username: 'tom' })).toBe('TO');
    expect(
      accountInitials({ firstName: '\u{1F680}', username: null, email: 'ada.quinn@example.com' }),
    ).toBe('AQ');
    expect(accountInitials({ firstName: null, username: null })).toBe('?');
    expect(accountInitials(null)).toBe('?');
  });
});

describe('accountAvatarFill', () => {
  const ada = { firstName: 'Ada', lastName: 'Quinn', fullName: 'Ada Quinn', username: null };

  it("paints the account's own colour in its deep shade, under white initials", () => {
    expect(accountAvatarFill({ ...ada, colour: '#8b5cf6' })).toBe('#6d28d9');
    expect(accountAvatarFill({ ...ada, colour: '#8B5CF6' })).toBe('#6d28d9');
  });

  it('paints Automatic in the colour picked from the full name', () => {
    expect(accountAvatarFill({ ...ada, colour: null })).toBe(avatarColour('Ada Quinn').deep);
    expect(accountAvatarFill(ada)).toBe(avatarColour('Ada Quinn').deep);
    expect(accountAvatarFill({ firstName: 'Ada', username: null })).toBe(avatarColour('Ada').deep);
    expect(accountAvatarFill({ firstName: null, username: 'aq' })).toBe(avatarColour('aq').deep);
    expect(accountAvatarFill({ firstName: null, username: null, email: 'a@x.io' })).toBe(
      avatarColour('a@x.io').deep,
    );
    expect(accountAvatarFill(null)).toBe(avatarColour('').deep);
  });

  it('ignores a colour that is not safe to paint into CSS', () => {
    expect(accountAvatarFill({ ...ada, colour: 'url(x)' })).toBe(avatarColour('Ada Quinn').deep);
  });

  it('takes a profile saved on this page over the session, Automatic included', () => {
    expect(accountAvatarFill({ ...ada, colour: '#8b5cf6' }, { name: null, colour: null })).toBe(
      avatarColour('Ada Quinn').deep,
    );
    expect(accountAvatarFill(ada, { name: 'Ada Q', colour: null })).toBe(
      avatarColour('Ada Q').deep,
    );
    expect(accountAvatarFill(ada, { name: 'Ada Quinn', colour: '#ef4444' })).toBe('#b91c1c');
  });
});

// Work Tracker 1158: one account on Automatic is one colour on every surface that draws them.
describe('one Automatic colour in every surface', () => {
  it('matches the header avatar, Settings, the cursor, author and assignee dots', () => {
    const name = 'Ada Quinn';
    const header = accountAvatarFill({
      firstName: 'Ada',
      lastName: 'Quinn',
      fullName: name,
      username: null,
      colour: null,
    });
    // Settings › Profile's preview and liveworkspace.app's account menu.
    const settings = avatarFill(name, null);
    // Each app's api fills a profile's missing colour with the shared rule (profiles.ts toParticipant), so cursors,
    // the presence list and comment author dots wear it; the assignee dots and the Explorer's history discs pick it
    // the same way. Painted as a disc, it is the same shade.
    const participant = avatarColour(name).value;
    // Picking Automatic in Settings repaints the editor's own cursor at once.
    const cursor = participantWithProfile(
      { name, color: '#0ea5e9' },
      { patch: { color: null }, name, color: null },
    )!.color;
    expect(cursor).toBe(participant);
    for (const fill of [settings, avatarFill('', participant), avatarFill('', cursor)]) {
      expect(fill).toBe(header);
    }
  });
});
