import { describe, expect, it } from 'vitest';
import { avatarGlideMs, avatarGlides, avatarSendIntervalMs } from './relay';

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
