// The workbench page's states (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench
// page", `WorkbenchPhase`), as a pure transition function. The hooks run the effects (redeem, hello,
// revoke, post `ended`); this decides what each answer means. `ended`, `unbound`, `refused` and
// `failed` are terminal (WB12): a workbench reconnects by framing a fresh URL.
import type { WorkbenchSessionResponse } from '@livediagram/api-schema';

export type WorkbenchRefusalCause = 'no-ticket' | 'ticket' | 'mismatch';
// Why a mounted page stopped editing; `refused` is never a mounted page's.
export type WorkbenchPageEndReason = 'expired' | 'revoked' | 'trashed';

export type WorkbenchPhase =
  | { phase: 'reading' }
  | { phase: 'redeeming'; ticket: string; documentId: string | null }
  | { phase: 'binding'; session: WorkbenchSessionResponse }
  | { phase: 'mounted'; session: WorkbenchSessionResponse; name: string }
  | {
      phase: 'ended';
      session: WorkbenchSessionResponse;
      name: string;
      reason: WorkbenchPageEndReason;
    }
  | { phase: 'unbound'; origin: string }
  | { phase: 'refused'; cause: WorkbenchRefusalCause }
  | { phase: 'failed' };

export type WorkbenchEvent =
  | { type: 'read'; ticket: string | null; documentId: string | null }
  | { type: 'redeemed'; session: WorkbenchSessionResponse }
  | { type: 'redeem-refused' }
  | { type: 'redeem-failed' }
  | { type: 'acked'; name: string }
  | { type: 'unanswered' }
  | { type: 'renewed'; session: WorkbenchSessionResponse }
  | { type: 'ended'; reason: WorkbenchPageEndReason };

export const INITIAL_WORKBENCH_PHASE: WorkbenchPhase = { phase: 'reading' };

export function workbenchTransition(state: WorkbenchPhase, event: WorkbenchEvent): WorkbenchPhase {
  switch (state.phase) {
    case 'reading':
      if (event.type !== 'read') return state;
      return event.ticket === null
        ? { phase: 'refused', cause: 'no-ticket' }
        : { phase: 'redeeming', ticket: event.ticket, documentId: event.documentId };
    case 'redeeming':
      if (event.type === 'redeem-refused') return { phase: 'refused', cause: 'ticket' };
      if (event.type === 'redeem-failed') return { phase: 'failed' };
      if (event.type !== 'redeemed') return state;
      return event.session.documentId === state.documentId
        ? { phase: 'binding', session: event.session }
        : { phase: 'refused', cause: 'mismatch' };
    case 'binding':
      if (event.type === 'acked')
        return { phase: 'mounted', session: state.session, name: event.name };
      if (event.type === 'unanswered') return { phase: 'unbound', origin: state.session.origin };
      return state;
    case 'mounted':
      if (event.type === 'ended') return { ...state, phase: 'ended', reason: event.reason };
      if (event.type !== 'renewed') return state;
      return event.session.documentId === state.session.documentId &&
        event.session.origin === state.session.origin
        ? { ...state, session: event.session }
        : state;
    default:
      return state;
  }
}

// A request refused `401 invalid_session` (blueprint step 6): before the session's expiry it was
// revoked (token revoked, unpaired, document purged); after it, it expired.
export function endReasonOfInvalidSession(
  expiresAt: number,
  now: number,
): Exclude<WorkbenchPageEndReason, 'trashed'> {
  return now < expiresAt ? 'revoked' : 'expired';
}
