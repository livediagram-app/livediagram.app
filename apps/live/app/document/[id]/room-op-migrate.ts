// Room ops as they arrive from peers (docs/specs/006-document/stroke-points.md "Migration of
// stored strokes"): a peer whose browser loaded before a deploy still sends elements in a former
// stored shape, so every op that carries elements (a whole tab, an added or updated element, a
// change-log entry) runs the stored-element migrations before anything applies it. Pure; the op
// itself back when nothing needed migrating.
import { migrateIncomingElements, migrateIncomingTab, type Tab } from '@livediagram/document';
import type { RoomOp } from '@livediagram/api-schema';
import { migrateChangeLogEntry } from '@/lib/change-log-migrate';

export function migrateRoomOp(op: RoomOp): RoomOp {
  if (op.kind === 'tab') {
    const tab = migrateIncomingTab(op.tab) as Tab;
    return tab === op.tab ? op : { ...op, tab };
  }
  if (op.kind === 'el' && (op.op.kind === 'add' || op.op.kind === 'update')) {
    // Untrusted: a non-object element is left for applyElementOp's own guards.
    const [element] = migrateIncomingElements([op.op.element]);
    return !element || element === op.op.element ? op : { ...op, op: { ...op.op, element } };
  }
  if (op.kind === 'log') {
    const entry = migrateChangeLogEntry(op.entry);
    return entry === op.entry ? op : { ...op, entry };
  }
  return op;
}
