import { describe, expect, it } from 'vitest';
import { initialsOf as teamInitials } from './TeamCard';

// A team's name that starts with an emoji keeps it whole in its disc: half of a surrogate pair draws as a
// replacement character. People's initials are model-core's initialsOf, which skips emoji and punctuation.
describe('initials', () => {
  it("a team's disc", () => {
    expect(teamInitials('Design Team')).toBe('DT');
    expect(teamInitials('design')).toBe('D');
    expect(teamInitials('')).toBe('?');
    expect(teamInitials('\u{1F680} Launch')).toBe('\u{1F680}L');
    expect(teamInitials('\u{1F680}')).toBe('\u{1F680}');
  });
});
