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
import { getTabData, swapTabData } from './db';
import { TabTooLargeError } from './limits';
import type { Env } from './types';

// Only an autosave or a linked tab's room can beat us to the row now, so a
// handful of re-reads is plenty.
const MAX_ATTEMPTS = 8;

export type QaWriteResult =
  | { ok: true; changed: boolean; notes: QaNote[]; rev: number }
  | { ok: false; status: 404 | 409 | 413 };

export type QaWriteRequest = {
  documentId: string;
  tabId: string;
  elementId: string;
  action: QaAction;
  actor: QaActor;
};

export async function writeQaAction(env: Env, req: QaWriteRequest): Promise<QaWriteResult> {
  const { documentId, tabId, elementId, action, actor } = req;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await getTabData(env, documentId, tabId);
    if (raw === null) return { ok: false, status: 404 };
    const data = JSON.parse(raw) as Omit<Tab, 'id' | 'name'>;
    const board = data.elements.find(
      (el): el is ShapeElement =>
        el.id === elementId && el.type === 'shape' && el.shape === 'qa-board',
    );
    if (!board) return { ok: false, status: 404 };
    const notes = board.qaNotes ?? [];
    const rev = board.qaRev ?? 0;
    const nextNotes = applyQaAction(notes, action, actor);
    // Nothing changed (a retried vote, a note removed meanwhile): answer with
    // what is there and write nothing.
    if (nextNotes === notes) return { ok: true, changed: false, notes, rev };
    const nextRev = rev + 1;
    const nextData = JSON.stringify({
      ...data,
      elements: data.elements.map((el) =>
        el === board ? { ...board, qaNotes: nextNotes, qaRev: nextRev } : el,
      ),
    });
    // Bytes, as D1 counts them, not UTF-16 units (docs/specs/015-api/api.md "Tab size").
    let swapped: boolean;
    try {
      swapped = await swapTabData(env, documentId, tabId, raw, nextData);
    } catch (error) {
      if (error instanceof TabTooLargeError) return { ok: false, status: 413 };
      throw error;
    }
    if (swapped) return { ok: true, changed: true, notes: nextNotes, rev: nextRev };
  }
  return { ok: false, status: 409 };
}
