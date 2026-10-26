import { describe, expect, it } from 'vitest';
import { initialsOf as identityInitials } from '../dialogs/share/IdentityRow';
import { initialsOf as teamInitials } from './TeamCard';

// A name that starts with an emoji keeps it whole in its disc: half of a surrogate pair draws as a
// replacement character.
describe('initials', () => {
  it("a team's disc", () => {
    expect(teamInitials('Design Team')).toBe('DT');
    expect(teamInitials('design')).toBe('D');
    expect(teamInitials('')).toBe('?');
    expect(teamInitials('\u{1F680} Launch')).toBe('\u{1F680}L');
    expect(teamInitials('\u{1F680}')).toBe('\u{1F680}');
  });

  it('the Share dialog\'s "Sharing as" disc', () => {
    expect(identityInitials('Curious Falcon')).toBe('CF');
    expect(identityInitials('owl')).toBe('OW');
    expect(identityInitials('\u{1F680} Fan')).toBe('\u{1F680}F');
    expect(identityInitials('Fan \u{1F680}')).toBe('F\u{1F680}');
  });
});
