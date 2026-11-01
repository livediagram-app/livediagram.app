// Which changes may wait, by share role (docs/specs/007-editor/offline-changes.md "Roles"): a Viewer's never, a
// Participant's only what it may write (cards added, edited and moved, time entries, Sheet cell values), an Editor's
// all. Presentation only: the server is the rule, and refuses on replay what it would refuse online.
import type { AccessLevel } from '@liveplanner/api-schema';
import type { ItemWrite } from '@liveplanner/items';
import type { SheetWrite } from '@liveplanner/sheets';

const PARTICIPANT_ITEM_WRITES: ReadonlySet<ItemWrite['kind']> = new Set([
  'create',
  'patch',
  'patches',
  'move',
  'moves',
  'time',
]);

export function itemWriteMayWait(level: AccessLevel, write: ItemWrite): boolean {
  if (level === 'edit') return true;
  if (level === 'participate') return PARTICIPANT_ITEM_WRITES.has(write.kind);
  return false;
}

// What this session may write on a Sheet: `cells` (Editor and Participant) and `shape` (Editor).
export type SheetQueueRights = { cells: boolean; shape: boolean };

export function sheetOpMayWait(
  rights: SheetQueueRights,
  op: 'write' | 'create' | 'delete',
  write?: SheetWrite,
): boolean {
  if (rights.shape) return true;
  return rights.cells && op === 'write' && write?.kind === 'cells';
}
