// Taking one step back through the room (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md "Undo
// through the room, never a stale copy"): a three-way revert of an id-keyed list. `before` and `after` are the list
// either side of the step; `current` is the list now, with whatever the person and their collaborators did since.
//
// - Removed by the step, still absent: back at its old place, after the nearest earlier neighbour still there.
// - Changed by the step, unchanged since: back to how it was. Changed again since: the later edit stays.
// - Added by the step, unchanged since: gone again.
// - Anything else (a collaborator's new item, their edits): kept as it is.
//
// With nothing changed since (`current === after`), the answer equals `before`. Linear in the three lists. Returns
// `current` itself when there is nothing to take back, so a caller's commit can see it changed nothing.

type Keyed = { readonly id: string };

export function revertStep<T extends Keyed>(
  before: readonly T[],
  after: readonly T[],
  current: readonly T[],
): T[] {
  const beforeById = new Map(before.map((x) => [x.id, x]));
  const afterById = new Map(after.map((x) => [x.id, x]));
  let changed = false;

  // What is there now: changed items back, added items gone, the rest as it is.
  const kept: T[] = [];
  for (const x of current) {
    const was = beforeById.get(x.id);
    const made = afterById.get(x.id);
    if (made !== undefined && x === made) {
      if (was === undefined) {
        changed = true;
        continue;
      }
      if (was !== made) {
        changed = true;
        kept.push(was);
        continue;
      }
    }
    kept.push(x);
  }

  // What the step removed and nobody has put back, grouped under the neighbour it followed.
  const present = new Set(current.map((x) => x.id));
  const back = new Map<string | null, T[]>();
  let anchor: string | null = null;
  for (const x of before) {
    if (present.has(x.id)) {
      anchor = x.id;
      continue;
    }
    // Still there after the step: someone else removed it since, and that stays.
    if (afterById.has(x.id)) continue;
    changed = true;
    const group = back.get(anchor);
    if (group) group.push(x);
    else back.set(anchor, [x]);
  }

  if (!changed) return current as T[];
  const out: T[] = [...(back.get(null) ?? [])];
  for (const x of kept) {
    out.push(x);
    const followers = back.get(x.id);
    if (followers) out.push(...followers);
  }
  return out;
}
