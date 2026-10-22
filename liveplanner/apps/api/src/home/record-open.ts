// Recording an open (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Recording an
// open"). Called from the tab read when the editor declares the read an open, inside waitUntil:
// it never slows or fails the read, and a failure is logged, not thrown.
//
// The day once per person per project per UTC day: the project_opens row is written first and
// gates the day's `project_opened` event, so the row and the events always agree on which days
// were counted. Every open, the first of the day or not, moves the last open Recent reads.

import { getProjectOpen, recordOpenDay, touchLastOpen } from '../db/project-opens';
import { recordProjectOpened } from '../timeline/project-events';
import type { ProjectDTO, Env } from '../types';
import { utcDay } from '@liveplanner/api-schema';

type ProjectRef = Pick<ProjectDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordProjectOpen(
  env: Env,
  liveDoc: ProjectRef,
  personId: string,
  at: number,
): Promise<void> {
  try {
    const day = utcDay(at);
    const previous = await getProjectOpen(env, personId, liveDoc.id);
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
    await recordProjectOpened(env, liveDoc, personId, at);
    console.info(`home: open-recorded doc=${liveDoc.id}`);
  } catch (err) {
    console.error(`home: open-failed doc=${liveDoc.id}`, err);
  }
}
