import { describe, expect, it } from 'vitest';
import { AVATAR_STATUS_IDS } from '@liveworkspace/api-schema/avatar';
import {
  AVATAR_CALL_STATUSES,
  AVATAR_STATUSES,
  avatarStatusColour,
  avatarStatusLabel,
  parseAvatarStatus,
} from './status';

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
  it('names every status the wire names, and no other, with calls', () => {
    expect(AVATAR_CALL_STATUSES.map((s) => s.id)).toEqual([...AVATAR_STATUS_IDS]);
  });

  // livehuddle's docs/specs/012-collaboration/meeting-rooms-and-stage.md "Do Not Disturb": the calls' status, offered
  // only where there are calls, but read and drawn everywhere.
  it('keeps Do Not Disturb to the call list, and reads it everywhere', () => {
    expect(AVATAR_STATUSES.some((s) => s.id === 'dnd')).toBe(false);
    expect(AVATAR_CALL_STATUSES.at(-1)?.label).toBe('Do Not Disturb');
    expect(parseAvatarStatus('dnd')).toBe('dnd');
    expect(avatarStatusLabel('dnd')).toBe('Do Not Disturb');
    expect(avatarStatusColour('dnd')).toBe('#e11d48');
  });
});
