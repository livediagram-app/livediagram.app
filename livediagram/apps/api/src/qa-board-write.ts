// One Q&A board write (docs/specs/012-collaboration/qa-board.md): read the tab, apply the action with the
// shared reducer, bump `qaRev`, and compare-and-swap it back.
//
// Called ONLY from the document's room (DocumentRoom's qa queue), which runs
// these one at a time per document. That queue is what makes a room voting in
// the same second safe: board writes never race each other at all. The CAS
// here is the second line, against the one other writer of the same row, an
// editor's tab autosave (whose read-then-write can straddle ours), plus a tab
// linked into a second document (docs/specs/006-document/tab-document-many-to-many.md), whose room queues separately.

import {
  applyQaAction,
  type QaAction,
  type QaActor,
  type QaNote,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { swapTabChange } from '@liveworkspace/api-kit/tab-swap';
import { participantTabStore } from './participant-write';
import type { DocumentEnv } from './types';

type QaWriteResult =
  | { ok: true; changed: boolean; notes: QaNote[]; rev: number }
  | { ok: false; status: 404 | 409 | 413 };

export type QaWriteRequest = {
  documentId: string;
  tabId: string;
  elementId: string;
  action: QaAction;
  actor: QaActor;
};

type QaAnswer = { changed: boolean; notes: QaNote[]; rev: number } | null;

// The tab row's compare-and-swap is the room's (participantTabStore): re-read up to TAB_CAS_MAX_ATTEMPTS times.
export async function writeQaAction(env: DocumentEnv, req: QaWriteRequest): Promise<QaWriteResult> {
  const { documentId, tabId, elementId, action, actor } = req;
  const result = await swapTabChange(
    participantTabStore(env, documentId, tabId),
    (tab: Tab): { next: Tab | null; answer: QaAnswer } => {
      const board = tab.elements.find(
        (el): el is ShapeElement =>
          el.id === elementId && el.type === 'shape' && el.shape === 'qa-board',
      );
      if (!board) return { next: null, answer: null };
      const notes = board.qaNotes ?? [];
      const rev = board.qaRev ?? 0;
      const nextNotes = applyQaAction(notes, action, actor);
      // Nothing changed (a retried vote, a note removed meanwhile): answer with
      // what is there and write nothing.
      if (nextNotes === notes) return { next: null, answer: { changed: false, notes, rev } };
      const nextRev = rev + 1;
      const next = {
        ...tab,
        elements: tab.elements.map((el) =>
          el === board ? { ...board, qaNotes: nextNotes, qaRev: nextRev } : el,
        ),
      };
      return { next, answer: { changed: true, notes: nextNotes, rev: nextRev } };
    },
  );
  if (!result.ok) return result;
  if (!result.answer) return { ok: false, status: 404 };
  return { ok: true, ...result.answer };
}
