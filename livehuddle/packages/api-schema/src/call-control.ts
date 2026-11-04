// The calls' control wire (docs/specs/012-collaboration/proximity-audio.md "The wire", "The mint route";
// video-and-screen-bubbles.md "Share roles"): a call proving its Realtime session to the room, so the mint route can
// ask the room who may hear whom (#483), and an Editor asking someone to stop their screen share (#469). Both are
// presence ops the room consumes or addresses; neither is relayed to the room at large.
import { PRESENCE_ID_MAX } from './call-hand';
import { CALL_LOCATOR_MAX } from './call-voice';

const TAB_ID_MAX = 64;

/** A subscription the room says the subscriber may not hear now: answered in its place by the tracks route. */
export const CALL_NOT_HEARD = 'not_heard';

/** This connection's Realtime session and its private proof, for the room alone. */
export type CallSessionOp = {
  kind: 'call-session';
  tabId: string;
  sessionId: string;
  sessionToken: string;
};

/** An Editor's request that `targetId` stop sharing their screen: addressed to that person alone. */
export type CallStopShareOp = { kind: 'call-stop-share'; tabId: string; targetId: string };

const isField = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** A `call-session` op as sent, or null. */
export function parseCallSession(op: unknown): CallSessionOp | null {
  const o = op as Partial<Record<keyof CallSessionOp, unknown>> | null;
  if (!o || o.kind !== 'call-session' || !isField(o.tabId, TAB_ID_MAX)) return null;
  if (!isField(o.sessionId, CALL_LOCATOR_MAX) || !isField(o.sessionToken, CALL_LOCATOR_MAX)) {
    return null;
  }
  return {
    kind: 'call-session',
    tabId: o.tabId,
    sessionId: o.sessionId,
    sessionToken: o.sessionToken,
  };
}

/** A `call-stop-share` op as sent, or null. */
export function parseCallStopShare(op: unknown): CallStopShareOp | null {
  const o = op as Partial<Record<keyof CallStopShareOp, unknown>> | null;
  if (!o || o.kind !== 'call-stop-share' || !isField(o.tabId, TAB_ID_MAX)) return null;
  if (!isField(o.targetId, PRESENCE_ID_MAX)) return null;
  return { kind: 'call-stop-share', tabId: o.tabId, targetId: o.targetId };
}
