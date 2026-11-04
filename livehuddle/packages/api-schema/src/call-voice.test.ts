import { describe, expect, it } from 'vitest';
import {
  CALL_LOCATOR_MAX,
  parseAvatarVoice,
  parseCallTrack,
  parseCallTrackLocator,
  parseVoiceLevel,
} from './call-voice';
import { isPresenceOpKind } from './room-messages';

const locator = { sessionId: 's1', trackName: 'mic', token: 'tok' };

describe('proximity audio wire (proximity-audio.md "The wire")', () => {
  it('takes a level only as an integer 0 to 4', () => {
    expect([0, 1, 4].map(parseVoiceLevel)).toEqual([0, 1, 4]);
    expect([5, -1, 1.5, '2', null].map(parseVoiceLevel)).toEqual([null, null, null, null, null]);
  });

  it('parses an avatar-voice op field by field', () => {
    expect(parseAvatarVoice({ kind: 'avatar-voice', tabId: 't', level: 3, extra: 1 })).toEqual({
      kind: 'avatar-voice',
      tabId: 't',
      level: 3,
    });
    expect(parseAvatarVoice({ kind: 'avatar-voice', tabId: 't', level: 9 })).toBeNull();
    expect(parseAvatarVoice({ kind: 'avatar-voice', tabId: '', level: 1 })).toBeNull();
    expect(parseAvatarVoice({ kind: 'avatar-voice', tabId: 'x'.repeat(65), level: 1 })).toBeNull();
    expect(parseAvatarVoice({ kind: 'avatar', tabId: 't', level: 1 })).toBeNull();
    expect(parseAvatarVoice(null)).toBeNull();
  });

  it('takes a locator for the microphone only, within bounds', () => {
    expect(parseCallTrackLocator({ ...locator, more: true })).toEqual(locator);
    expect(parseCallTrackLocator({ ...locator, trackName: 'camera' })).toBeNull();
    expect(parseCallTrackLocator({ ...locator, sessionId: '' })).toBeNull();
    expect(
      parseCallTrackLocator({ ...locator, token: 'x'.repeat(CALL_LOCATOR_MAX + 1) }),
    ).toBeNull();
    expect(parseCallTrackLocator('mic')).toBeNull();
    expect(parseCallTrackLocator(null)).toBeNull();
  });

  it('parses a call-track op, null meaning stopped', () => {
    expect(parseCallTrack({ kind: 'call-track', tabId: 't', track: locator })).toEqual({
      kind: 'call-track',
      tabId: 't',
      track: locator,
    });
    expect(parseCallTrack({ kind: 'call-track', tabId: 't', track: null })?.track).toBeNull();
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: { sessionId: 's' } }),
    ).toBeNull();
    expect(parseCallTrack({ kind: 'call-track', tabId: 1, track: null })).toBeNull();
    expect(parseCallTrack(undefined)).toBeNull();
  });

  it('classes both as presence: unordered, never logged or replayed', () => {
    expect(isPresenceOpKind('avatar-voice')).toBe(true);
    expect(isPresenceOpKind('call-track')).toBe(true);
  });
});
