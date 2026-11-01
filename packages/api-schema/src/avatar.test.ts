import { describe, expect, it } from 'vitest';
import { AVATAR_STATUS_IDS, type AvatarPresence, type AvatarStatus } from './avatar';

// livediagram's docs/specs/008-canvas/avatar-mode.md "Status" and "Realtime".
describe('avatar wire shapes', () => {
  it('names the four statuses both ends of the wire read', () => {
    expect(AVATAR_STATUS_IDS).toEqual(['available', 'focus', 'meeting', 'away']);
  });

  it('carries a status on a presence packet', () => {
    const status: AvatarStatus = 'focus';
    const packet: AvatarPresence = {
      x: 0,
      y: 0,
      facing: 'down',
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      status,
    };
    expect(packet.status).toBe('focus');
  });
});
