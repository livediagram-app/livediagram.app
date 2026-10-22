// Whether a peer's project-changing room op has the shape its kind promises
// (docs/specs/012-collaboration/realtime-conflict-resolution.md "A malformed op"). The room relays an Editor's op as
// it was sent and keeps it in the catch-up log, so an op without its tab list, its element or its patch reached
// every editor in the room, and every one that reconnected, and threw in the state update that applies it. One
// that is not well formed is dropped before anything reads it. Only the envelope is checked: what an element or a
// patch holds is the stored-element migrations' to settle (room-op-migrate.ts), and a kind this build does not
// apply passes, as it always has, to be ignored.
import { isRecord } from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';

const isText = (v: unknown): v is string => typeof v === 'string';
const isOptionalList = (v: unknown) => v === undefined || Array.isArray(v);

// One element op: an add or update carries an element with an id and a type, a remove an id, a reorder a list
// of ids, a patch (the room's, for a Participant's change) an id and the fields it sets.
function isElementOpShape(v: unknown, patch: boolean): boolean {
  if (!isRecord(v)) return false;
  switch (v.kind) {
    case 'add':
    case 'update':
      return isRecord(v.element) && isText(v.element.id) && isText(v.element.type);
    case 'remove':
      return isText(v.id);
    case 'reorder':
      return Array.isArray(v.ids);
    case 'patch':
      return patch && isText(v.id) && isRecord(v.set) && isOptionalList(v.clear);
    default:
      return false;
  }
}

export function roomOpIsWellFormed(op: unknown): op is RoomOp {
  if (!isRecord(op) || !isText(op.kind)) return false;
  switch (op.kind) {
    case 'tab':
      return isText(op.tabId) && isRecord(op.tab) && Array.isArray(op.tab.elements);
    case 'el':
      return isText(op.tabId) && isElementOpShape(op.op, true);
    case 'el-delta':
      return (
        isText(op.tabId) && isText(op.elementId) && isRecord(op.delta) && isText(op.delta.kind)
      );
    case 'changeset':
      return (
        isText(op.tabId) &&
        (op.tab === undefined || isRecord(op.tab)) &&
        (op.elementOps === undefined ||
          (Array.isArray(op.elementOps) && op.elementOps.every((o) => isElementOpShape(o, false))))
      );
    case 'vote':
      return isText(op.tabId) && isText(op.elementId) && isText(op.voter);
    case 'tab-meta':
      return isText(op.tabId) && isRecord(op.patch) && isOptionalList(op.clear);
    case 'article':
      return isText(op.tabId) && isText(op.flow);
    case 'project-meta':
      return (
        isText(op.name) &&
        Array.isArray(op.tabs) &&
        op.tabs.every((t) => isRecord(t) && isText(t.id) && isText(t.name))
      );
    default:
      return true;
  }
}
