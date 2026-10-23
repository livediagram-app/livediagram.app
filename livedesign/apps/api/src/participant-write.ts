// A Participant's content, written by the room (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint
// "Behaviour and state"). A Participant never saves a whole tab: the room applies each element op it sends to the
// STORED tab through the participant content rule, then compare-and-swaps the row.
//
// Called ONLY from the design's room, on its tab write queue, so these writes never race each other. The
// compare-and-swap is the second line, against an editor's autosave and a linked tab's other room.

import {
  applyParticipantOp,
  type ElementOp,
  type ParticipantOpResult,
  type Tab,
} from '@livedesign/design';
import { getTabData, swapTabData } from './db';
import { tabStatsOf } from './db/tab-stats';
import { TabTooLargeError } from './limits';
import type { Env } from './types';

// Only an autosave or a linked tab's room can beat us to the row, so a handful of re-reads is plenty.
export const TAB_CAS_MAX_ATTEMPTS = 8;

export type ParticipantWriteFailure = { ok: false; status: 404 | 409 | 413 };
export type ParticipantWriteResult =
  { ok: true; outcome: ParticipantOpResult } | ParticipantWriteFailure;

type ParticipantOpRequest = {
  designId: string;
  tabId: string;
  op: ElementOp;
  adderKey: string | null;
};

type StoredTab = Omit<Tab, 'id' | 'name'>;

// Read, change and swap one tab row, retrying while somebody else wrote it between our read and our write.
// `change` answers the new tab, or null to write nothing.
async function swapTab<T>(
  env: Env,
  designId: string,
  tabId: string,
  change: (tab: Tab) => { next: Tab | null; answer: T },
): Promise<{ ok: true; answer: T } | ParticipantWriteFailure> {
  for (let attempt = 0; attempt < TAB_CAS_MAX_ATTEMPTS; attempt++) {
    const raw = await getTabData(env, designId, tabId);
    if (raw === null) return { ok: false, status: 404 };
    const data = JSON.parse(raw) as StoredTab;
    const { next, answer } = change({ ...data, id: tabId, name: '' });
    if (next === null) return { ok: true, answer };
    const { id: _id, name: _name, ...rest } = next;
    const nextData = JSON.stringify(rest);
    let swapped: boolean;
    try {
      swapped = await swapTabData(
        env,
        designId,
        tabId,
        raw,
        nextData,
        tabStatsOf(rest, nextData),
      );
    } catch (error) {
      if (error instanceof TabTooLargeError) return { ok: false, status: 413 };
      throw error;
    }
    if (swapped) return { ok: true, answer };
  }
  return { ok: false, status: 409 };
}

export async function writeParticipantOp(
  env: Env,
  req: ParticipantOpRequest,
): Promise<ParticipantWriteResult> {
  const result = await swapTab(env, req.designId, req.tabId, (tab) => {
    const outcome = applyParticipantOp(tab, req.op, req.adderKey);
    const next = outcome.result === 'applied' && outcome.changed ? outcome.tab : null;
    return { next, answer: outcome };
  });
  if (!result.ok) return result;
  return { ok: true, outcome: result.answer };
}
