import { describe, expect, it } from 'vitest';
import { parseAvatarConfig } from './config';
import {
  AVATAR_STATUS_IDS,
  expandAvatarPacket,
  isLeanAvatarPacket,
  leanAvatarPacket,
  type AvatarPacket,
  type AvatarPresence,
  type AvatarStatus,
} from './wire';

// docs/specs/008-canvas/avatar-mode.md "Status" and "Realtime".
describe('avatar wire shapes', () => {
  it('names every status both ends of the wire read, the original five first', () => {
    expect(AVATAR_STATUS_IDS).toEqual([
      'available',
      'focus',
      'meeting',
      'away',
      'dnd',
      'help',
      'lunch',
      'angry',
      'celebrating',
      'thinking',
      'sick',
      'break',
      'busy',
    ]);
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

// docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is needed".
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

  it('carries a raised hand and a newer Behaviour, and leaves a lowered hand out', () => {
    const up: AvatarPresence = {
      ...resting,
      handUp: true,
      reaction: { kind: 'clap', elapsedMs: 40 },
    };
    const lean = leanAvatarPacket(up, false);
    expect(lean.handUp).toBe(true);
    expect(lean.reaction).toEqual({ kind: 'clap', elapsedMs: 40 });
    expect(expandAvatarPacket(lean, costume).handUp).toBe(true);
    expect('handUp' in leanAvatarPacket({ ...resting, handUp: false }, false)).toBe(false);
    // Through JSON, as the room relays it.
    expect((JSON.parse(JSON.stringify(lean)) as AvatarPresence).handUp).toBe(true);
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

  // docs/specs/008-canvas/avatar-mode.md "Build": optional on the wire, Regular when absent or unknown.
  it('carries a build through a packet, and reads one without it (an older sender) as Regular', () => {
    const broad = { ...costume, build: 'large' } as const;
    const sent: AvatarPacket = JSON.parse(
      JSON.stringify(leanAvatarPacket({ ...resting, config: broad }, true)),
    );
    const got = expandAvatarPacket(sent, undefined);
    expect(got.config).toEqual(broad);
    expect(parseAvatarConfig(got.config).build).toBe('large');
    const older: AvatarPacket = JSON.parse(JSON.stringify(leanAvatarPacket(resting, true)));
    expect(older.config).not.toHaveProperty('build');
    expect(parseAvatarConfig(expandAvatarPacket(older, undefined).config).build).toBe('regular');
    // A lean packet keeps the build last seen.
    const lean = leanAvatarPacket({ ...resting, config: broad }, false);
    expect(expandAvatarPacket(lean, broad).config?.build).toBe('large');
  });
});
