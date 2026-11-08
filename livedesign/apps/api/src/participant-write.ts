// A Participant's content, written by the room (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint
// "Behaviour and state"). A Participant never saves a whole tab: the room applies each element op it sends to the
// STORED tab through the participant content rule, then compare-and-swaps the row.
//
// Called ONLY from the design's room, on its tab write queue, so these writes never race each other. The
// compare-and-swap is the second line, against an editor's autosave and a linked tab's other room.

import {
  applyElementDelta,
  applyParticipantOp,
  type ElementDelta,
  type ElementOp,
  type ParticipantOpResult,
  type Tab,
} from '@livedesign/design';
import {
  swapTabChange,
  type TabChange,
  type TabSwapFailure,
  type TabSwapStore,
} from '@liveworkspace/api-kit/tab-swap';
import { getTabRow, swapTabData } from './db';
import { TabTooLargeError } from './limits';
import type { DesignEnv } from './types';

export { TAB_CAS_MAX_ATTEMPTS } from '@liveworkspace/api-kit/tab-swap';

export type ParticipantWriteFailure = TabSwapFailure;
export type ParticipantWriteResult =
  { ok: true; outcome: ParticipantOpResult } | ParticipantWriteFailure;

type ParticipantOpRequest = {
  designId: string;
  tabId: string;
  op: ElementOp;
  adderKey: string | null;
};

// One tab row of the design, as the swap reaches it.
export function participantTabStore(
  env: DesignEnv,
  designId: string,
  tabId: string,
): TabSwapStore<Tab> {
  return {
    tabId,
    read: () => getTabRow(env, designId, tabId),
    write: (expected, data, body) => swapTabData(env, designId, tabId, expected, data, body),
    tooLarge: (error) => error instanceof TabTooLargeError,
  };
}

// One element op through the participant content rule: written only when it applied and changed something.
export function participantOpChange(
  op: ElementOp,
  adderKey: string | null,
): TabChange<Tab, ParticipantOpResult> {
  return (tab) => {
    const outcome = applyParticipantOp(tab, op, adderKey);
    const next = outcome.result === 'applied' && outcome.changed ? outcome.tab : null;
    return { next, answer: outcome };
  };
}

export async function writeParticipantOp(
  env: DesignEnv,
  req: ParticipantOpRequest,
): Promise<ParticipantWriteResult> {
  const result = await swapTabChange(
    participantTabStore(env, req.designId, req.tabId),
    participantOpChange(req.op, req.adderKey),
  );
  if (!result.ok) return result;
  return { ok: true, outcome: result.answer };
}

// A Participant's comment reaction (docs/specs/012-collaboration/comment-reactions.md), as the room stamped it,
// into the stored tab: applied to the element it names through `applyElementDelta`, as every receiver applies it.
// Nothing is written when the element or the comment is not stored yet (an Editor's, inside its autosave, which
// then carries the reaction itself through the room's ledger) or the reaction is already so.
export async function writeParticipantReaction(
  env: DesignEnv,
  req: { designId: string; tabId: string; elementId: string; delta: ElementDelta },
): Promise<{ ok: true; changed: boolean } | ParticipantWriteFailure> {
  const result = await swapTabChange(
    participantTabStore(env, req.designId, req.tabId),
    (tab: Tab) => {
      let changed = false;
      const elements = tab.elements.map((el) => {
        if (el.id !== req.elementId) return el;
        const next = applyElementDelta(el, req.delta);
        if (next !== el) changed = true;
        return next;
      });
      return { next: changed ? { ...tab, elements } : null, answer: changed };
    },
  );
  if (!result.ok) return result;
  return { ok: true, changed: result.answer };
}
