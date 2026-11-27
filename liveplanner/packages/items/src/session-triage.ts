// A Bug Triage session's rules (docs/specs/026-plan/session-tabs.md "Bug Triage", blueprint session-tabs.md
// "Behaviour and state"): where Close takes a card, the field a duplicate is linked through, the severity-style fields
// the triage strip offers, and a Close reason as kept. Pure.
import { doneNameKey } from './done-columns';
import { itemStatus, type Item } from './item';
import { linkTypesOf, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { typeStatusesOf } from './type-statuses';

// The longest Close reason kept: a line, not a comment.
export const SESSION_REASON_MAX = 200;

// Stage names (lower case) Bug Triage's Next Stage steps past: a bug waiting on its reporter is not accepted work.
export const TRIAGE_WAITING_STAGES: readonly string[] = [
  'needs info',
  'needs detail',
  'needs details',
  'waiting',
  'waiting for info',
  'on hold',
  'blocked',
];

// The closing stage names, as doneNameKey reads them, in the order Close Stage prefers them.
const CLOSE_LIKE = [
  "won't fix",
  "won't do",
  'cancelled',
  'canceled',
  'declined',
  'rejected',
  'not a bug',
  'invalid',
  'closed',
  'dropped',
  'abandoned',
];
const DUPLICATE_STAGES = ['duplicate', 'duplicates', 'duplicated'];
const DUPLICATE_FIELDS = ['duplicate of', 'duplicates', 'duplicate', 'duplicated by'];
// Choice fields the triage strip offers beside Priority, by name (lower case, a word of the label).
const SEVERITY_WORDS = ['severity', 'impact', 'urgency', 'criticality'];

// A Close reason as kept: trimmed, at most SESSION_REASON_MAX characters; empty reads as none.
export function sessionReason(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const reason = raw.trim().slice(0, SESSION_REASON_MAX).trim();
  return reason || undefined;
}

// Where Close takes `item` (docs/specs/026-plan/session-tabs.md "Bug Triage"): the stage the set-up names for its type
// (when the type uses it), else, with a duplicate linked, the type's Duplicate stage, else its first closing stage in
// CLOSE_LIKE's preference, else null (the card stays). A named stage that is the card's own also stays.
export function sessionCloseTarget(
  item: Item,
  types: readonly ItemTypeDef[],
  planStatuses: readonly string[],
  closeTargets?: Readonly<Record<string, string>>,
  opts: { names?: ReadonlyMap<string, string> | undefined; duplicate?: boolean } = {},
): string | null {
  const order = typeStatusesOf(typeIn(types, item.type), planStatuses);
  const own = itemStatus(item) ?? '';
  const pick = (s: string) => (s !== own ? s : null);
  const named = closeTargets?.[item.type];
  if (named && order.includes(named)) return pick(named);
  const key = (s: string) => doneNameKey(opts.names?.get(s) ?? s);
  if (opts.duplicate) {
    const dup = order.find((s) => DUPLICATE_STAGES.includes(key(s)));
    if (dup) return pick(dup);
  }
  for (const name of CLOSE_LIKE) {
    const s = order.find((x) => key(x) === name);
    if (s) return pick(s);
  }
  return null;
}

// The Card field of `type` a closed card's duplicate is linked through: one named like a duplicate (Duplicate Of,
// Duplicates) that links to `toType`, else undefined (the link is kept in the outcome alone).
export function duplicateFieldOf(type: ItemTypeDef, toType: string): CustomFieldDef | undefined {
  return type.custom?.find(
    (c) =>
      c.kind === 'card' &&
      type.fields.includes(c.id) &&
      DUPLICATE_FIELDS.includes(c.label.trim().toLowerCase()) &&
      linkTypesOf(c).includes(toType),
  );
}

// The Choice fields of `type` the triage strip offers beside Priority: those named like a severity, in field order.
export function severityFieldsOf(type: ItemTypeDef): CustomFieldDef[] {
  const out: CustomFieldDef[] = [];
  for (const id of type.fields) {
    const c = type.custom?.find((x) => x.id === id);
    if (
      c?.kind === 'choice' &&
      c.options?.length &&
      c.label
        .toLowerCase()
        .split(/\s+/)
        .some((w) => SEVERITY_WORDS.includes(w))
    )
      out.push(c);
  }
  return out;
}
