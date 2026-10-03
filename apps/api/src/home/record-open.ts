// Recording an open (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Recording an
// open"). Called from the tab read when the editor declares the read an open, inside waitUntil:
// it never slows or fails the read, and a failure is logged, not thrown.
//
// Once per person per document per UTC day. The document_opens row is written first and gates
// the event, so the row and the event always agree on which days were counted.

import { getDocumentOpen, recordOpenDay } from '../db/document-opens';
import { recordDocumentOpened } from '../timeline/document-events';
import type { DocumentDTO, Env } from '../types';
import { nextFrecencyKey, utcDay } from '@livediagram/api-schema';

type DocumentRef = Pick<DocumentDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordDocumentOpen(
  env: Env,
  liveDoc: DocumentRef,
  personId: string,
  at: number,
): Promise<void> {
  try {
    const day = utcDay(at);
    const previous = await getDocumentOpen(env, personId, liveDoc.id);
    if (previous?.lastOpenDay === day) {
      console.info(`home: open-skipped reason=same-day doc=${liveDoc.id}`);
      return;
    }
    const recorded = await recordOpenDay(env, personId, liveDoc.id, {
      at,
      day,
      frecencyKey: nextFrecencyKey(previous?.frecencyKey ?? null, at),
    });
    if (!recorded) {
      // Another request counted this day between the read and the write.
      console.info(`home: open-skipped reason=race doc=${liveDoc.id}`);
      return;
    }
    await recordDocumentOpened(env, liveDoc, personId, at);
    console.info(`home: open-recorded doc=${liveDoc.id} days=${(previous?.openDays ?? 0) + 1}`);
  } catch (err) {
    console.error(`home: open-failed doc=${liveDoc.id}`, err);
  }
}
