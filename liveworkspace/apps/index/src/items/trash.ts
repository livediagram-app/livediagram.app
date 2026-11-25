// An item into the Trash (one-explorer-contracts.md "Where an item stands"): what follows the row's move, the same for
// an Explorer Delete (DELETE /items/:id) and a Space made by Call whose call ended (item-call-sweep.ts).

import { touchItem, type DriveTouched } from '../drive';
import type { Env } from '../env';
import { signalKnowledgeSources } from '../knowledge-sources';
import type { ItemRow } from '../rows';
import { tellStanding } from '../standing';

/** After `row` moved into the Trash at `at`: its owner's Drive mirror, its app (which stops what it runs on its own
 *  clock for it) and the knowledgebases reading it (knowledge-sources.md "Keeping in step"). */
export function afterTrashed(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  drive: DriveTouched,
  row: Pick<ItemRow, 'id' | 'app' | 'owner_id' | 'team_id' | 'archived_at'>,
  at: number,
): void {
  touchItem(drive, row);
  tellStanding(env, waitUntil, row.app, row.id, {
    archived: row.archived_at != null,
    trashed: true,
    at,
  });
  waitUntil(signalKnowledgeSources(env, row.id, true));
}
