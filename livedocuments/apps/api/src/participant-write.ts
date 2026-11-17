// A Participant's text, written by the room (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint
// "Behaviour and state"). A Participant never saves a whole tab: the room applies each element op and each article
// frame it sends to the STORED tab through the participant rules (text only), then compare-and-swaps the row on its
// revision (@liveworkspace/api-kit tab-swap.ts).
//
// Called ONLY from the document's room, on its tab write queue, so these writes never race each other. The
// compare-and-swap is the second line, against an editor's autosave and a linked tab's other room. The room drains a
// tab's waiting element ops and article frames together (`participantOpChange`, `participantArticleChange` through
// its TabChangeQueue): one read, every change in order, one write.

import {
  applyParticipantArticleOps,
  applyParticipantOp,
  type ArticleOp,
  type ElementOp,
  type ParticipantArticleResult,
  type ParticipantOpResult,
  type Tab,
} from '@livedocuments/document';
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
export type ParticipantArticleWriteResult =
  { ok: true; outcome: ParticipantArticleResult } | ParticipantWriteFailure;

type ParticipantOpRequest = {
  documentId: string;
  tabId: string;
  op: ElementOp;
};

type ParticipantArticleRequest = {
  documentId: string;
  tabId: string;
  flow: string;
  ops: readonly ArticleOp[];
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
export function participantOpChange(op: ElementOp): TabChange<Tab, ParticipantOpResult> {
  return (tab) => {
    const outcome = applyParticipantOp(tab, op);
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
    participantOpChange(req.op),
  );
  if (!result.ok) return result;
  return { ok: true, outcome: result.answer };
}

// One article frame's writing through the participant article rule: written only when it applied and changed
// something.
export function participantArticleChange(
  flow: string,
  ops: readonly ArticleOp[],
): TabChange<Tab, ParticipantArticleResult> {
  return (tab) => {
    const outcome = applyParticipantArticleOps(tab, flow, ops);
    const next = outcome.result === 'applied' && outcome.changed ? outcome.tab : null;
    return { next, answer: outcome };
  };
}

export async function writeParticipantArticle(
  env: DocumentEnv,
  req: ParticipantArticleRequest,
): Promise<ParticipantArticleWriteResult> {
  const result = await swapTabChange(
    participantTabStore(env, req.documentId, req.tabId),
    participantArticleChange(req.flow, req.ops),
  );
  if (!result.ok) return result;
  return { ok: true, outcome: result.answer };
}
