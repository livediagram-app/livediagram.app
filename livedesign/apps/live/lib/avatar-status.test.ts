import { describe, expect, it } from 'vitest';
import { AVATAR_STATUS_IDS } from '@livedesign/api-schema';
import { AVATAR_STATUSES, avatarStatusLabel, parseAvatarStatus } from './avatar-status';

// docs/specs/008-canvas/avatar-mode.md "Status"
describe('avatar status', () => {
  it('has the four statuses, in order', () => {
    expect(AVATAR_STATUSES.map((s) => s.label)).toEqual([
      'Available',
      'Focusing',
      'In a Meeting',
      'Away',
    ]);
    expect(avatarStatusLabel('focus')).toBe('Focusing');
  });

  it('reads a known status off the wire and nothing else', () => {
    expect(parseAvatarStatus('away')).toBe('away');
    for (const bad of ['busy', '', null, undefined, 3]) expect(parseAvatarStatus(bad)).toBeNull();
  });
});

describe('avatar statuses and the wire', () => {
  it('offers every status the wire names, and no other', () => {
    expect(AVATAR_STATUSES.map((s) => s.id)).toEqual([...AVATAR_STATUS_IDS]);
  });
});
