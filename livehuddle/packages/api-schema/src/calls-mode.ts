// The calls kill switch's shared rule (docs/specs/016-platform/calls-kill-switch.md "What each mode allows"): the
// three modes, which media each allows, a track's kind by its name, and the room's `calls-mode` push. The api's mint
// route and the editor read the same table, so a refusal and the control that explains it never disagree.
import { CALL_TRACK_NAME } from './call-voice';

export type CallsMode = 'on' | 'audio-only' | 'off';

/** What a mint asks for: a Realtime session, or a track of one kind. */
export type CallsMediaKind = 'session' | 'audio' | 'video' | 'screen';

export const CALLS_MODES: readonly CallsMode[] = ['on', 'audio-only', 'off'];

/** Whether `mode` lets the mint route hand out a session or a track of `kind`. */
export function callsModeAllows(mode: CallsMode, kind: CallsMediaKind): boolean {
  if (mode === 'off') return false;
  if (mode === 'audio-only') return kind === 'session' || kind === 'audio';
  return true;
}

// Every track name a browser publishes, by the media it carries. Video (#317) and screen sharing (#318) add theirs.
const TRACK_KINDS: Readonly<Record<string, CallsMediaKind>> = { [CALL_TRACK_NAME]: 'audio' };

/** The media a track name carries, or null for a name no call publishes. */
export function callTrackKind(trackName: string): CallsMediaKind | null {
  return Object.hasOwn(TRACK_KINDS, trackName) ? TRACK_KINDS[trackName]! : null;
}

/** The room's word that the switch changed: a system op, sent only by the room itself. */
export type CallsModeOp = { kind: 'calls-mode'; mode: CallsMode };

/** A `calls-mode` op as the room sent it, or null. */
export function parseCallsModeOp(op: unknown): CallsModeOp | null {
  const o = op as { kind?: unknown; mode?: unknown } | null;
  if (!o || o.kind !== 'calls-mode') return null;
  return (CALLS_MODES as readonly unknown[]).includes(o.mode)
    ? { kind: 'calls-mode', mode: o.mode as CallsMode }
    : null;
}
