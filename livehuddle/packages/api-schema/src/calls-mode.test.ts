import { describe, expect, it } from 'vitest';
import {
  callsModeAllows,
  callTrackKind,
  parseCallsModeOp,
  type CallsMediaKind,
} from './calls-mode';
import { isPresenceOpKind, isSystemOpKind } from './room-messages';

const KINDS: CallsMediaKind[] = ['session', 'audio', 'video', 'screen'];

describe('calls kill switch rule (calls-kill-switch.md "What each mode allows")', () => {
  it('allows everything when on, audio alone when audio only, and nothing when off', () => {
    expect(KINDS.map((k) => callsModeAllows('on', k))).toEqual([true, true, true, true]);
    expect(KINDS.map((k) => callsModeAllows('audio-only', k))).toEqual([true, true, false, false]);
    expect(KINDS.map((k) => callsModeAllows('off', k))).toEqual([false, false, false, false]);
  });

  it('knows the microphone, the camera and a screen, and no other name', () => {
    expect(callTrackKind('mic')).toBe('audio');
    expect(callTrackKind('cam')).toBe('video');
    expect(callTrackKind('screen')).toBe('screen');
    expect(callTrackKind('camera')).toBeNull();
    expect(callTrackKind('toString')).toBeNull();
  });

  it('parses the room push field by field', () => {
    expect(parseCallsModeOp({ kind: 'calls-mode', mode: 'off', extra: 1 })).toEqual({
      kind: 'calls-mode',
      mode: 'off',
    });
    expect(parseCallsModeOp({ kind: 'calls-mode', mode: 'audio-only' })?.mode).toBe('audio-only');
    expect(parseCallsModeOp({ kind: 'calls-mode', mode: 'loud' })).toBeNull();
    expect(parseCallsModeOp({ kind: 'call-track', mode: 'off' })).toBeNull();
    expect(parseCallsModeOp(null)).toBeNull();
  });

  it('is a system op: no client may send it', () => {
    expect(isSystemOpKind('calls-mode')).toBe(true);
    expect(isPresenceOpKind('calls-mode')).toBe(false);
  });
});
