import { describe, expect, it } from 'vitest';
import { parseAvatarHand, parseAvatarLetSpeak, PRESENCE_ID_MAX } from './call-hand';
import { isPresenceOpKind } from './room-messages';

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"
describe('raise hand wire', () => {
  it('parses a hand field by field', () => {
    expect(parseAvatarHand({ kind: 'avatar-hand', tabId: 't', raised: true, extra: 1 })).toEqual({
      kind: 'avatar-hand',
      tabId: 't',
      raised: true,
    });
    expect(
      parseAvatarHand({ kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: 'p1' }),
    ).toEqual({ kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: 'p1' });
    expect(
      parseAvatarHand({ kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: null }),
    ).toEqual({ kind: 'avatar-hand', tabId: 't', raised: true });
    // A lowered hand carries no let-speak, whatever was sent.
    expect(
      parseAvatarHand({ kind: 'avatar-hand', tabId: 't', raised: false, letSpeak: 'p1' }),
    ).toEqual({ kind: 'avatar-hand', tabId: 't', raised: false });
  });

  it('refuses a malformed hand', () => {
    for (const bad of [
      null,
      { kind: 'avatar-voice', tabId: 't', raised: true },
      { kind: 'avatar-hand', tabId: '', raised: true },
      { kind: 'avatar-hand', tabId: 'x'.repeat(65), raised: true },
      { kind: 'avatar-hand', tabId: 't', raised: 'yes' },
      { kind: 'avatar-hand', tabId: 't' },
      { kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: '' },
      { kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: 7 },
      { kind: 'avatar-hand', tabId: 't', raised: true, letSpeak: 'x'.repeat(PRESENCE_ID_MAX + 1) },
    ]) {
      expect(parseAvatarHand(bad)).toBeNull();
    }
  });

  it('parses a let-speak field by field and refuses a malformed one', () => {
    const op = { kind: 'avatar-let-speak', tabId: 't', targetId: 'p2', on: true };
    expect(parseAvatarLetSpeak({ ...op, extra: 1 })).toEqual(op);
    expect(parseAvatarLetSpeak({ ...op, on: false })).toEqual({ ...op, on: false });
    for (const bad of [
      null,
      { ...op, kind: 'avatar-hand' },
      { ...op, tabId: '' },
      { ...op, targetId: '' },
      { ...op, targetId: 'x'.repeat(PRESENCE_ID_MAX + 1) },
      { ...op, on: 1 },
    ]) {
      expect(parseAvatarLetSpeak(bad)).toBeNull();
    }
  });

  it('classifies both as presence', () => {
    expect(isPresenceOpKind('avatar-hand')).toBe(true);
    expect(isPresenceOpKind('avatar-let-speak')).toBe(true);
  });
});
