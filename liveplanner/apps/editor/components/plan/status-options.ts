// The columns a card may move to (docs/specs/026-plan/item-types.md "The statuses a type uses"): the Details Status
// picker and the phone header's status pill (plan-board.md "status pill") list the same ones, the same way.
import {
  typeAllowsStatus,
  typeStatusesOf,
  type ItemTypeDef,
  type StatusPhase,
} from '@liveplanner/items';
import { PHASE_COLOURS } from '@liveplanner/plan-art';

export type StatusOption = { status: string; name: string; excluded?: true };

// Only the statuses this card type uses, in its order, the same on every tab; a card already in one it leaves out
// shows it last, marked, and can move out of it but never back in.
export function statusOptionsOf(
  type: ItemTypeDef,
  statuses: readonly { status: string; name: string }[],
  status: string,
): StatusOption[] {
  const byId = new Map(statuses.map((s) => [s.status, s]));
  const options: StatusOption[] = typeStatusesOf(type, byId.keys()).flatMap((id) => {
    const s = byId.get(id);
    return s ? [{ status: s.status, name: s.name }] : [];
  });
  const current = byId.get(status);
  if (current && !typeAllowsStatus(type, status))
    options.push({
      status: current.status,
      name: `${current.name} (not used by ${type.label})`,
      excluded: true,
    });
  return options;
}

// The pill's sheet: the open columns, then the done ones (a board's done columns: Done, Cancelled) in a group of their
// own, so a thumb never lands on one by accident.
export function statusPillGroups(
  options: readonly StatusOption[],
  phases: ReadonlyMap<string, StatusPhase>,
): { open: StatusOption[]; done: StatusOption[] } {
  const open: StatusOption[] = [];
  const done: StatusOption[] = [];
  for (const o of options) (phases.get(o.status) === 'done' ? done : open).push(o);
  return { open, done };
}

// A column's dot: the colour the first board naming the status gives its column, else its stage's colour.
export function statusDotColour(
  status: string,
  boards: readonly { colours?: ReadonlyMap<string, string> }[],
  phases: ReadonlyMap<string, StatusPhase>,
): string {
  for (const b of boards) {
    const c = b.colours?.get(status);
    if (c) return c;
  }
  return PHASE_COLOURS[phases.get(status) ?? 'todo'];
}
