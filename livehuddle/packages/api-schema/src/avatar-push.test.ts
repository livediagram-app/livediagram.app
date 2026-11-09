import { describe, expect, it } from 'vitest';
import { parseAvatarPush } from './avatar-push';

// docs/specs/008-canvas/avatar-mode.md "You can push each other": a malformed push reaches nobody.
describe('parseAvatarPush', () => {
  const push = { kind: 'avatar-push', tabId: 't', targetId: 'p', dx: 3, dy: 4 };

  it('keeps a push, its direction made a unit vector and nothing else carried', () => {
    expect(parseAvatarPush({ ...push, extra: 'x'.repeat(1000) })).toEqual({
      kind: 'avatar-push',
      tabId: 't',
      targetId: 'p',
      dx: 0.6,
      dy: 0.8,
    });
  });

  it.each([
    ['a direction that is not a number', { dx: 'a' }],
    ['an object for a direction', { dy: {} }],
    ['an endless direction', { dx: Infinity }],
    ['a NaN direction', { dy: NaN }],
    ['no direction at all', { dx: 0, dy: 0 }],
    ['a missing target', { targetId: '' }],
    ['an overlong target', { targetId: 'p'.repeat(65) }],
    ['an overlong tab', { tabId: 't'.repeat(65) }],
    ['another kind', { kind: 'avatar' }],
  ])('drops %s', (_, patch) => {
    expect(parseAvatarPush({ ...push, ...patch })).toBeNull();
  });

  it('drops a non-object', () => {
    expect(parseAvatarPush(null)).toBeNull();
    expect(parseAvatarPush('avatar-push')).toBeNull();
  });
});
