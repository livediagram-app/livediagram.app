import { describe, expect, it } from 'vitest';
import { BELL_THROTTLE_MS, parseAvatarBell } from './bell';
import { createKnockThrottle } from './knock';

// docs/specs/009-elements/workday-pieces.md "The wire".
describe('parseAvatarBell', () => {
  it('keeps a well-formed ring and nothing else', () => {
    expect(parseAvatarBell({ kind: 'avatar-bell', tabId: 't', deskId: 'd', extra: 1 })).toEqual({
      kind: 'avatar-bell',
      tabId: 't',
      deskId: 'd',
    });
  });
  it('refuses a wrong kind, missing or oversized fields', () => {
    expect(parseAvatarBell(null)).toBeNull();
    expect(parseAvatarBell({ kind: 'avatar-knock', tabId: 't', deskId: 'd' })).toBeNull();
    expect(parseAvatarBell({ kind: 'avatar-bell', tabId: 't' })).toBeNull();
    expect(parseAvatarBell({ kind: 'avatar-bell', tabId: '', deskId: 'd' })).toBeNull();
    expect(parseAvatarBell({ kind: 'avatar-bell', tabId: 't', deskId: 'x'.repeat(65) })).toBeNull();
    expect(parseAvatarBell({ kind: 'avatar-bell', tabId: 't', deskId: 4 })).toBeNull();
  });
  it('lets one ring a sender through each five seconds', () => {
    const bells = createKnockThrottle(BELL_THROTTLE_MS);
    expect(bells.allow('a', 0)).toBe(true);
    expect(bells.allow('a', BELL_THROTTLE_MS - 1)).toBe(false);
    expect(bells.allow('b', 1)).toBe(true);
    expect(bells.allow('a', BELL_THROTTLE_MS)).toBe(true);
  });
});
