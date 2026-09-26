// One Q&A board write (docs/specs/012-collaboration/qa-board.md): read the tab, apply the action with the
// shared reducer, bump `qaRev`, and compare-and-swap it back.
//
// Called ONLY from the diagram's room (DiagramRoom's qa queue), which runs
// these one at a time per diagram. That queue is what makes a room voting in
// the same second safe: board writes never race each other at all. The CAS
// here is the second line, against the one other writer of the same row, an
// editor's tab autosave (whose read-then-write can straddle ours), plus a tab
// linked into a second diagram (docs/specs/006-diagram/tab-diagram-many-to-many.md), whose room queues separately.

import {
  applyQaAction,
  type QaAction,
  type QaActor,
  type QaNote,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { getTabData, swapTabData } from './db';
import { MAX_TAB_BYTES } from './limits';
import type { Env } from './types';

// Only an autosave or a linked tab's room can beat us to the row now, so a
// handful of re-reads is plenty.
const MAX_ATTEMPTS = 8;

export type QaWriteResult =
  | { ok: true; changed: boolean; notes: QaNote[]; rev: number }
  | { ok: false; status: 404 | 409 | 413 };

export type QaWriteRequest = {
  diagramId: string;
  tabId: string;
  elementId: string;
  action: QaAction;
  actor: QaActor;
};

export async function writeQaAction(env: Env, req: QaWriteRequest): Promise<QaWriteResult> {
  const { diagramId, tabId, elementId, action, actor } = req;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await getTabData(env, diagramId, tabId);
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
    if (nextData.length > MAX_TAB_BYTES) return { ok: false, status: 413 };
    if (await swapTabData(env, diagramId, tabId, raw, nextData)) {
      return { ok: true, changed: true, notes: nextNotes, rev: nextRev };
    }
  }
  return { ok: false, status: 409 };
}
