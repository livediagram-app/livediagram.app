// A Participant's content and answers, written by the room (docs/specs/013-workspace/share-roles.md "Integrity";
// blueprint "Behaviour and state"). A Participant never saves a whole tab: the room applies each element op it
// sends to the STORED tab through the participant content rule, and folds its dots, responses and ideas from the
// room's ledger, then compare-and-swaps the row on its revision (@liveworkspace/api-kit tab-swap.ts).
//
// Called ONLY from the document's room, on its tab write queue, so these writes never race each other or the Q&A
// board's. The compare-and-swap is the second line, against an editor's autosave and a linked tab's other room,
// exactly as qa-board-write.ts. The room drains a tab's waiting element ops together (`participantOpChange` through
// its TabChangeQueue): one read, every op in order, one write.

import {
  applyParticipantOp,
  mergeLedgerAnswersIntoTab,
  type ElementOp,
  type ParticipantOpResult,
  type Tab,
  type TabLedger,
} from '@livediagram/document';
import {
  swapTabChange,
  type TabChange,
  type TabSwapFailure,
  type TabSwapStore,
} from '@liveworkspace/api-kit/tab-swap';
import { getTabRow, swapTabData } from './db';
import { TabTooLargeError } from './limits';
import type { DocumentEnv } from './types';

export { TAB_CAS_MAX_ATTEMPTS } from '@liveworkspace/api-kit/tab-swap';

export type ParticipantWriteFailure = TabSwapFailure;
export type ParticipantWriteResult =
  { ok: true; outcome: ParticipantOpResult } | ParticipantWriteFailure;

type ParticipantOpRequest = {
  documentId: string;
  tabId: string;
  op: ElementOp;
  adderKey: string | null;
};

// One tab row of the document, as the swap reaches it.
export function participantTabStore(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): TabSwapStore<Tab> {
  return {
    tabId,
    read: () => getTabRow(env, documentId, tabId),
    write: (expected, data, body) => swapTabData(env, documentId, tabId, expected, data, body),
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
  env: DocumentEnv,
  req: ParticipantOpRequest,
): Promise<ParticipantWriteResult> {
  const result = await swapTabChange(
    participantTabStore(env, req.documentId, req.tabId),
    participantOpChange(req.op, req.adderKey),
  );
  if (!result.ok) return result;
  return { ok: true, outcome: result.answer };
}

// The room's recorded answers for a tab into its stored row; `changed` is false when the row already held them.
export async function writeParticipantAnswers(
  env: DocumentEnv,
  req: { documentId: string; tabId: string; ledger: TabLedger },
): Promise<{ ok: true; changed: boolean } | ParticipantWriteFailure> {
  const result = await swapTabChange(
    participantTabStore(env, req.documentId, req.tabId),
    (tab: Tab) => {
      const merged = mergeLedgerAnswersIntoTab(tab, req.ledger);
      return merged === tab ? { next: null, answer: false } : { next: merged, answer: true };
    },
  );
  if (!result.ok) return result;
  return { ok: true, changed: result.answer };
}
