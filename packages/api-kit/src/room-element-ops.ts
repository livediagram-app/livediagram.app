// The room's check on an Editor's element ops (each product's docs/specs/012-collaboration/
// realtime-conflict-resolution.md "An invalid element", blueprint docs/specs/015-api/blueprints/room-element-ops.md).
// The room relays an Editor's op to every peer and keeps it for catch-up, and each peer's next whole-tab save carries
// whatever it applied, so an element the tab save would refuse stops every peer saving. The room runs the newest
// build, so it judges each element the way its own tab save does (migrated, then validated) and drops the op that
// fails, for a kind and a field it knows. A kind it does not know, and a field its validator does not name, pass:
// a newer client's work survives a deploy. Each product binds its own validator (`RoomElementRules`).

import {
  OP_REFUSED_ID_MAX,
  type OpRefusedMessage,
  type RoomOpRefusalReason,
} from '@liveworkspace/api-schema/room-refusal';

/** What the judge needs of a product's model: its element types, its migrations, its validator and its tab bound. */
export type RoomElementRules = {
  knowsType: (type: string) => boolean;
  migrateElement: (element: Record<string, unknown>) => unknown;
  migrateTab: (tab: unknown) => unknown;
  issue: (element: unknown) => { field: string; rule: string } | null;
  maxElements: number;
};

/** Why an element op is dropped. */
export type RoomOpRefusal = { reason: RoomOpRefusalReason; elementId?: string; field?: string };

// The refusal log's bound: at most this many lines per window per room (blueprint "Constants").
export const REFUSAL_LOG_LIMIT = 10;
export const REFUSAL_LOG_WINDOW_MS = 60_000;

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const invalid = (field: string, elementId?: string): RoomOpRefusal =>
  elementId === undefined
    ? { reason: 'invalid-element', field }
    : { reason: 'invalid-element', elementId, field };

// One element: the frame every kind shares (an object with an id and a type), then, for a type the room knows, the
// product's validator over the migrated element. A tab's elements arrive migrated with their tab (`migrated`).
function judgeElement(
  element: unknown,
  rules: RoomElementRules,
  migrated: boolean,
): RoomOpRefusal | null {
  if (!isRecord(element)) return invalid('element');
  const { id, type } = element;
  if (typeof id !== 'string' || id.length === 0) return invalid('id');
  if (typeof type !== 'string') return invalid('type', id);
  if (!rules.knowsType(type)) return null;
  const found = rules.issue(migrated ? element : (rules.migrateElement(element) ?? element));
  return found ? invalid(found.field, id) : null;
}

function judgeTab(tab: Rec, rules: RoomElementRules): RoomOpRefusal | null {
  const sent = tab.elements as unknown[];
  if (sent.length > rules.maxElements) return { reason: 'too-many-elements' };
  const migrated = rules.migrateTab(tab);
  const upgraded = isRecord(migrated) && Array.isArray(migrated.elements);
  const elements = upgraded ? (migrated.elements as unknown[]) : sent;
  const seen = new Set<string>();
  for (const element of elements) {
    const refusal = judgeElement(element, rules, upgraded);
    if (refusal) return refusal;
    const id = (element as { id: string }).id;
    if (seen.has(id)) return { reason: 'duplicate-element', elementId: id };
    seen.add(id);
  }
  return null;
}

/**
 * Why the room must drop this op, or null to relay it. Judges a `tab` op's elements and an `el` add or update's
 * element; every other op passes, its envelope the receivers' to check.
 */
export function judgeRoomElementOp(op: unknown, rules: RoomElementRules): RoomOpRefusal | null {
  if (!isRecord(op)) return null;
  if (op.kind === 'el') {
    const inner = op.op;
    if (!isRecord(inner) || (inner.kind !== 'add' && inner.kind !== 'update')) return null;
    return judgeElement(inner.element, rules, false);
  }
  if (op.kind === 'tab' && isRecord(op.tab) && Array.isArray(op.tab.elements)) {
    return judgeTab(op.tab, rules);
  }
  return null;
}

type Warn = (fingerprint: string, fields: Record<string, unknown>) => void;

/**
 * A bounded log: at most `limit` lines per `windowMs`, the first line of a later window counting the lines held back
 * in the one before (`suppressed`). One per room, in memory; a hibernation wake only opens a new window.
 */
export function createRefusalLog(
  fingerprint: string,
  {
    limit = REFUSAL_LOG_LIMIT,
    windowMs = REFUSAL_LOG_WINDOW_MS,
    warn = console.warn,
  }: { limit?: number; windowMs?: number; warn?: Warn } = {},
): (fields: Record<string, unknown>, now: number) => void {
  let windowStart = Number.NEGATIVE_INFINITY;
  let logged = 0;
  let suppressed = 0;
  return (fields, now) => {
    let held = 0;
    if (now - windowStart >= windowMs) {
      held = suppressed;
      windowStart = now;
      logged = 0;
      suppressed = 0;
    }
    if (logged >= limit) {
      suppressed += 1;
      return;
    }
    logged += 1;
    warn(fingerprint, held > 0 ? { ...fields, suppressed: held } : fields);
  };
}

const clampId = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, OP_REFUSED_ID_MAX) : undefined;

const isRef = (ref: unknown): ref is number =>
  typeof ref === 'number' && Number.isSafeInteger(ref) && ref > 0;

/**
 * The room's element gate: null to relay the op, else the `op-refused` frame for the sender alone, with the refusal
 * logged through the bounded log. One per room.
 */
export function createRoomElementGate(
  rules: RoomElementRules,
  { now = Date.now, warn }: { now?: () => number; warn?: Warn } = {},
): (op: unknown, ref?: unknown) => OpRefusedMessage | null {
  const log = createRefusalLog('[room] element op refused', warn ? { warn } : {});
  return (op, ref) => {
    const refusal = judgeRoomElementOp(op, rules);
    if (!refusal) return null;
    const o = op as { kind: string; tabId?: unknown };
    const field = refusal.field ? { field: refusal.field } : {};
    log({ op: o.kind, reason: refusal.reason, ...field }, now());
    const tabId = clampId(o.tabId);
    const elementId = clampId(refusal.elementId);
    return {
      kind: 'op-refused',
      op: o.kind,
      reason: refusal.reason,
      ...(tabId ? { tabId } : {}),
      ...(elementId ? { elementId } : {}),
      ...field,
      ...(isRef(ref) ? { ref } : {}),
    };
  };
}
