// Recording an open (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Recording an
// open"). Called from the tab read when the editor declares the read an open, inside waitUntil:
// it never slows or fails the read, and a failure is logged, not thrown.
//
// The day once per person per design per UTC day: the design_opens row is written first and
// gates the day's `design_opened` event, so the row and the events always agree on which days
// were counted. Every open, the first of the day or not, moves the last open Recent reads.

import { getDesignOpen, recordOpenDay, touchLastOpen } from '../db/design-opens';
import { recordDesignOpened } from '../timeline/design-events';
import type { DesignDTO, Env } from '../types';
import { utcDay } from '@livedesign/api-schema';

type DesignRef = Pick<DesignDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordDesignOpen(
  env: Env,
  liveDoc: DesignRef,
  personId: string,
  at: number,
): Promise<void> {
  try {
    const day = utcDay(at);
    const previous = await getDesignOpen(env, personId, liveDoc.id);
    if (previous?.lastOpenDay === day) {
      await touchLastOpen(env, personId, liveDoc.id, at);
      console.info(`home: open-touched doc=${liveDoc.id}`);
      return;
    }
    const recorded = await recordOpenDay(env, personId, liveDoc.id, { at, day });
    if (!recorded) {
      // Another request counted this day between the read and the write.
      console.info(`home: open-skipped reason=race doc=${liveDoc.id}`);
      return;
    }
    await recordDesignOpened(env, liveDoc, personId, at);
    console.info(`home: open-recorded doc=${liveDoc.id}`);
  } catch (err) {
    console.error(`home: open-failed doc=${liveDoc.id}`, err);
  }
}
