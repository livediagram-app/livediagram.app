import { describe, expect, it } from 'vitest';
import {
  AVATAR_COSTUME_REFRESH_MS,
  type AvatarConfig,
  type AvatarPresence,
} from '@liveworkspace/api-schema/avatar';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { avatarGlideMs, avatarGlides, avatarSendIntervalMs, createAvatarPacker } from './relay';

describe('avatarSendIntervalMs', () => {
  it('sends at about 30 Hz up to 10, then steps down with the room', () => {
    expect(avatarSendIntervalMs(2)).toBe(33);
    expect(avatarSendIntervalMs(10)).toBe(33);
    expect(avatarSendIntervalMs(32)).toBe(50);
    expect(avatarSendIntervalMs(100)).toBe(66);
  });
});

describe('avatarGlideMs', () => {
  it('draws each packet where it lands up to 10, and glides over one step above', () => {
    expect(avatarGlideMs(10)).toBe(0);
    expect(avatarGlideMs(11)).toBe(50);
    expect(avatarGlideMs(100)).toBe(66);
  });
});

describe('avatarGlides', () => {
  const at = { x: 100, y: 100 };
  it('glides a walking step', () => {
    expect(avatarGlides(at, { x: 117, y: 100 }, 66, true)).toBe(true);
  });

  it('jumps when the room is quiet, when standing, or when the move is further than a walk goes', () => {
    expect(avatarGlides(at, { x: 117, y: 100 }, 0, true)).toBe(false);
    expect(avatarGlides(at, { x: 117, y: 100 }, 66, false)).toBe(false);
    expect(avatarGlides(at, { x: 900, y: 100 }, 66, true)).toBe(false);
  });
});

// docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is needed".
describe('createAvatarPacker', () => {
  const costume = { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' } as const;
  const walking = (x: number, config: AvatarConfig = costume): AvatarPresence => ({
    x,
    y: 10,
    facing: 'right',
    config,
    walking: true,
    stepFrame: 1,
    lift: 0,
    wave: null,
    seatedOn: null,
    holding: null,
  });
  const setup = () => {
    let clock = 1000;
    const packer = createAvatarPacker(() => clock);
    const carries = (tabId = 't1', packet = walking(1)) =>
      packer.pack(tabId, packet).config !== undefined;
    return { packer, carries, tick: (ms: number) => (clock += ms) };
  };

  it('carries the costume on the first packet only, and leaves the resting values out', () => {
    const { packer, carries } = setup();
    expect(packer.pack('t1', walking(1))).toEqual({
      x: 1,
      y: 10,
      facing: 'right',
      config: costume,
      walking: true,
      stepFrame: 1,
    });
    expect(packer.pack('t1', walking(2))).toEqual({
      x: 2,
      y: 10,
      facing: 'right',
      walking: true,
      stepFrame: 1,
    });
    expect(carries()).toBe(false);
  });

  it('carries it again when the costume changes, on a new tab, and after a reset', () => {
    const { packer, carries } = setup();
    carries();
    expect(carries('t1', walking(1, { ...costume, hair: 'afro' }))).toBe(true);
    expect(carries('t1', walking(1, { ...costume, hair: 'afro' }))).toBe(false);
    expect(carries('t2', walking(1, { ...costume, hair: 'afro' }))).toBe(true);
    packer.reset();
    expect(carries('t2', walking(1, { ...costume, hair: 'afro' }))).toBe(true);
  });

  // livehuddle's Hair menu sets a hair colour: picking one must reach everyone, not wait for the refresh.
  it('carries it again when only the hair colour changes', () => {
    const { carries } = setup();
    carries();
    expect(carries('t1', walking(1, { ...costume, hairColour: 'blonde' }))).toBe(true);
    expect(carries('t1', walking(1, { ...costume, hairColour: 'blonde' }))).toBe(false);
    expect(carries('t1', walking(1, costume))).toBe(true);
  });

  it('carries it every refresh interval while walking', () => {
    const { carries, tick } = setup();
    carries();
    tick(AVATAR_COSTUME_REFRESH_MS - 1);
    expect(carries()).toBe(false);
    tick(1);
    expect(carries()).toBe(true);
    expect(carries()).toBe(false);
  });

  it('carries it once when someone new joins the roster, and not when someone leaves', () => {
    const { packer, carries } = setup();
    packer.noteRoster(['a', 'b']);
    carries();
    packer.noteRoster(['a']);
    expect(carries()).toBe(false);
    packer.noteRoster(['a', 'c']);
    expect(carries()).toBe(true);
    expect(carries()).toBe(false);
    packer.noteRoster(['a', 'c']);
    expect(carries()).toBe(false);
  });

  it('reads the wall clock by default', () => {
    const packer = createAvatarPacker();
    const packet: AvatarPresence = { ...walking(1) };
    expect(packer.pack('t1', packet).config).toEqual(costume);
    expect(packer.pack('t1', packet).config).toBeUndefined();
  });

  it('never carries a costume the packet does not have', () => {
    const { packer } = setup();
    const { config: _config, ...bare } = walking(1);
    expect(packer.pack('t1', bare).config).toBeUndefined();
  });

  it('packs a 100-walker second of packets well inside a budget', () => {
    const { packer } = setup();
    packer.noteRoster(Array.from({ length: 100 }, (_, i) => `p${i}`));
    const packets = Array.from({ length: 1500 }, (_, i) => walking(i * 0.37));
    // One editor sends 15 a second; 1,500 is a hundred seconds of walking.
    expect(cpuMsOf(() => packets.forEach((p) => packer.pack('t1', p)))).toBeLessThan(
      cpuBudgetMs(50),
    );
  });
});
