import { describe, expect, it } from 'vitest';
import {
  CALL_LOCATOR_MAX,
  isCallLayer,
  isCallTrackName,
  parseAvatarVoice,
  parseCallsCheck,
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

  // docs/specs/016-platform/calls-kill-switch.md "The room tells its clients".
  it('parses a calls-check op to its tab alone, a presence op', () => {
    expect(parseCallsCheck({ kind: 'calls-check', tabId: 't', extra: 1 })).toEqual({
      kind: 'calls-check',
      tabId: 't',
    });
    expect(parseCallsCheck({ kind: 'calls-check' })).toBeNull();
    expect(parseCallsCheck({ kind: 'calls-check', tabId: 'x'.repeat(65) })).toBeNull();
    expect(parseCallsCheck({ kind: 'call-track', tabId: 't' })).toBeNull();
    expect(parseCallsCheck(null)).toBeNull();
    expect(isPresenceOpKind('calls-check')).toBe(true);
  });

  it('takes a locator for a track a call publishes, within bounds', () => {
    expect(parseCallTrackLocator({ ...locator, more: true })).toEqual(locator);
    expect(parseCallTrackLocator({ ...locator, trackName: 'camera' })).toBeNull();
    expect(parseCallTrackLocator({ ...locator, trackName: 'cam' })?.trackName).toBe('cam');
    expect(parseCallTrackLocator({ ...locator, trackName: 'screen' })?.trackName).toBe('screen');
    // Held to one slot when named.
    expect(parseCallTrackLocator({ ...locator, trackName: 'cam' }, 'mic')).toBeNull();
    expect(parseCallTrackLocator(locator, 'mic')).toEqual(locator);
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
    // The microphone's slot takes only the microphone.
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: { ...locator, trackName: 'cam' } }),
    ).toBeNull();
  });

  it('parses the camera and screen slots (video-and-screen-bubbles.md "The wire")', () => {
    const cam = { ...locator, trackName: 'cam' };
    const screen = { ...locator, trackName: 'screen' };
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: null, video: cam, screen }),
    ).toEqual({ kind: 'call-track', tabId: 't', track: null, video: cam, screen });
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: locator, video: null, screen: null }),
    ).toEqual({ kind: 'call-track', tabId: 't', track: locator, video: null, screen: null });
    // Each slot names its own track, and a malformed slot refuses the op.
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: null, video: screen }),
    ).toBeNull();
    expect(parseCallTrack({ kind: 'call-track', tabId: 't', track: null, screen: cam })).toBeNull();
    expect(
      parseCallTrack({ kind: 'call-track', tabId: 't', track: null, video: 'cam' }),
    ).toBeNull();
  });

  it('knows the track names and the two layers', () => {
    expect(['mic', 'cam', 'screen', 'camera', 1].map(isCallTrackName)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(['h', 'f', 'q', null].map(isCallLayer)).toEqual([true, true, false, false]);
  });

  it('classes both as presence: unordered, never logged or replayed', () => {
    expect(isPresenceOpKind('avatar-voice')).toBe(true);
    expect(isPresenceOpKind('call-track')).toBe(true);
  });
});
