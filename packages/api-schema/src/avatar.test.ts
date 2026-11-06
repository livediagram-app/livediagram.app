import { describe, expect, it } from 'vitest';
import {
  AVATAR_STATUS_IDS,
  expandAvatarPacket,
  isLeanAvatarPacket,
  leanAvatarPacket,
  type AvatarPresence,
  type AvatarStatus,
} from './avatar';

// livediagram's docs/specs/008-canvas/avatar-mode.md "Status" and "Realtime".
describe('avatar wire shapes', () => {
  it('names the five statuses both ends of the wire read', () => {
    expect(AVATAR_STATUS_IDS).toEqual(['available', 'focus', 'meeting', 'away', 'dnd']);
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

// livediagram's docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is needed".
describe('lean avatar packets', () => {
  const costume = { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' } as const;
  const resting: AvatarPresence = {
    x: 512.3456789012345,
    y: 300.004,
    facing: 'right',
    config: costume,
    walking: true,
    stepFrame: 0,
    lift: 0,
    wave: null,
    seatedOn: null,
    seat: null,
    holding: null,
    status: null,
  };

  it('leaves out the costume and every resting value, and rounds the position', () => {
    expect(leanAvatarPacket(resting, false)).toEqual({
      x: 512.35,
      y: 300,
      facing: 'right',
      walking: true,
    });
  });

  it('carries the costume when asked, and every field that is not at rest', () => {
    const busy: AvatarPresence = {
      ...resting,
      stepFrame: 1,
      lift: 4,
      wave: 0,
      seatedOn: 'chair-1',
      seat: { index: 1, at: 5, tie: 0.5 },
      holding: 'coffee',
      status: 'focus',
      reaction: { kind: 'wave', elapsedMs: 120 },
    };
    expect(leanAvatarPacket(busy, true)).toEqual({ ...busy, x: 512.35, y: 300 });
  });

  it('knows a lean packet from a full one', () => {
    expect(isLeanAvatarPacket(resting)).toBe(false);
    expect(isLeanAvatarPacket(leanAvatarPacket(resting, true))).toBe(true);
    expect(isLeanAvatarPacket({ ...resting, config: undefined })).toBe(true);
    const { lift: _lift, ...noLift } = resting;
    expect(isLeanAvatarPacket(noLift)).toBe(true);
    const { wave: _wave, ...noWave } = resting;
    expect(isLeanAvatarPacket(noWave)).toBe(true);
  });

  it('fills a lean packet back out with the costume last seen', () => {
    const lean = leanAvatarPacket(resting, false);
    expect(expandAvatarPacket(lean, costume)).toEqual({
      ...lean,
      config: costume,
      stepFrame: 0,
      lift: 0,
      wave: null,
    });
  });

  it("keeps a packet's own costume over the one last seen, and none when neither is known", () => {
    const other = { ...costume, hair: 'afro' } as const;
    expect(expandAvatarPacket(resting, other).config).toBe(costume);
    const expanded = expandAvatarPacket(leanAvatarPacket(resting, false), undefined);
    expect('config' in expanded).toBe(false);
  });

  it('keeps a full packet as it is', () => {
    expect(expandAvatarPacket(resting, undefined)).toEqual(resting);
  });
});
