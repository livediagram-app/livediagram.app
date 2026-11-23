// The pure steps of an agent changeset every product's api shares (each product's docs/specs/024-agents/
// agent-changesets.md, blueprint docs/specs/024-agents/blueprints/agent-changesets.md): the base check, the merge
// on save, the revert plan, and which targets a person holds. A product binds the three that read elements to its
// own model once, at module scope (`createChangesetPlans`, in its apps/api/src/changesets/plans.ts).

/** What the plans need of an element: its id. Everything else is the product's. */
export type PlanElement = { id: string };

/** An element op, as @liveworkspace/element-model's `ElementOp` of the product's element. */
export type PlanOp<E extends PlanElement> =
  | { kind: 'add'; element: E; at: number }
  | { kind: 'update'; element: E }
  | { kind: 'remove'; id: string }
  | { kind: 'reorder'; ids: string[] };

/** The fingerprints a changeset records: each target as it found it and as it left it, and the order it found. */
export type ChangesetFingerprints = {
  before: Record<string, string>;
  after: Record<string, string>;
  beforeOrder?: string[];
};

/** A recorded changeset a save merges: its fingerprints and its element ops. */
export type MergeEntry<E extends PlanElement> = {
  record: { fingerprints: ChangesetFingerprints };
  ops: readonly PlanOp<E>[];
};

// The wire shapes below are each product's api-schema's (`changesets.ts`), structurally.
export type ChangesetBase = { rev: number; elements?: Record<string, string> };
export type ChangesetConflict<E extends PlanElement> = {
  id: string;
  reason: 'changed' | 'vanished' | 'resolves_differently';
  readFingerprint: string | null;
  now: E | null;
};
export type HeldElement = { id: string; by: { name: string; color: string } };
export type RevertKept = { id: string; reason: 'changed' | 'gone' | 'present' | 'order' };

/** One person's selection in the room, as the room client answers it. */
export type HeldSelection = {
  elementIds: readonly string[];
  name: string;
  color: string;
  mine: boolean;
};

// Which of an agent changeset's targets a person holds (docs/specs/024-agents/agent-changesets.md
// "Held elements"): every element of anybody's selection, whatever their role, except the agent's
// owner's own sessions, whose selection is what the agent reads. Each held element once, with the
// first person holding it. Pure; a room that could not answer (`null`) holds nothing.
export function heldTargets(
  targets: readonly string[],
  selections: readonly HeldSelection[] | null,
): HeldElement[] {
  if (!selections) return [];
  const holder = new Map<string, { name: string; color: string }>();
  for (const s of selections) {
    if (s.mine) continue;
    for (const id of s.elementIds) {
      if (!holder.has(id)) holder.set(id, { name: s.name, color: s.color });
    }
  }
  const held: HeldElement[] = [];
  for (const id of new Set(targets)) {
    const by = holder.get(id);
    if (by) held.push({ id, by });
  }
  return held;
}

// The base check (docs/specs/024-agents/agent-changesets.md "Conflicts"): what the agent read
// against the tab as stored now. Pure. Only targets are checked: elements an operation merely
// shifts to make room are never fingerprinted, since a shift commutes with a person's move.

export type BaseOutcome<E extends PlanElement> =
  | { ok: true; rebasedOver: number; warnings: 'no_base'[] }
  | { ok: false; status: 400; error: 'strict_needs_base' | 'invalid_base' }
  | { ok: false; status: 412; error: 'stale_tab'; rev: number }
  | {
      ok: false;
      status: 409;
      error: 'changeset_conflict';
      rev: number;
      conflicts: ChangesetConflict<E>[];
    };

type PlanDeps<E extends PlanElement> = {
  /** The product's fingerprint of an element, which ignores its live fields. */
  elementFingerprint: (element: E) => string;
  /** The product's whole-element merge, which keeps the receiver's live fields. */
  mergeIncomingElement: (local: E, incoming: E) => E;
};

/** The base check, the merge on save and the revert plan, over a product's elements. */
export function createChangesetPlans<E extends PlanElement>(deps: PlanDeps<E>) {
  const { elementFingerprint, mergeIncomingElement } = deps;

  // `targetIds` are the existing elements the operations resolved; `createdIds` the elements the
  // changeset makes, which the base cannot have read. A null `stored` is a tab the changeset creates.
  function checkBase(
    base: ChangesetBase | undefined,
    stored: { elements: E[]; rev: number } | null,
    targetIds: readonly string[],
    createdIds: readonly string[],
    strict: boolean,
  ): BaseOutcome<E> {
    const storedRev = stored?.rev ?? 0;
    if (!base) {
      if (strict) return { ok: false, status: 400, error: 'strict_needs_base' };
      return { ok: true, rebasedOver: 0, warnings: ['no_base'] };
    }
    if (base.rev > storedRev) return { ok: false, status: 400, error: 'invalid_base' };
    if (base.rev === storedRev) return { ok: true, rebasedOver: 0, warnings: [] };
    if (strict) return { ok: false, status: 412, error: 'stale_tab', rev: storedRev };

    const now = new Map<string, E>((stored?.elements ?? []).map((e) => [e.id, e]));
    const read = base.elements ?? {};
    const conflicts: ChangesetConflict<E>[] = [];
    for (const [id, readFingerprint] of Object.entries(read)) {
      const current = now.get(id);
      if (!current) conflicts.push({ id, reason: 'vanished', readFingerprint, now: null });
      else if (elementFingerprint(current) !== readFingerprint) {
        conflicts.push({ id, reason: 'changed', readFingerprint, now: current });
      }
    }
    const created = new Set(createdIds);
    for (const id of new Set(targetIds)) {
      if (created.has(id) || Object.hasOwn(read, id)) continue;
      conflicts.push({
        id,
        reason: 'resolves_differently',
        readFingerprint: null,
        now: now.get(id) ?? null,
      });
    }
    if (conflicts.length > 0) {
      return { ok: false, status: 409, error: 'changeset_conflict', rev: storedRev, conflicts };
    }
    return { ok: true, rebasedOver: storedRev - base.rev, warnings: [] };
  }

  // The merge on save (docs/specs/024-agents/agent-changesets.md "The write path" step 8): every
  // recorded changeset after the revision an editor has seen is re-applied to the tab it saves,
  // element by element, before the write. A changeset's version is taken only where the save still
  // holds the element exactly as the changeset found it; anything else was changed by the person
  // after, and their version stands (`superseded`). Taking it keeps the save's live fields, which the
  // fingerprint ignores (CS44). Pure and idempotent.
  function mergeChangesetsIntoSave<T extends { elements: E[] }>(
    save: T,
    entries: readonly MergeEntry<E>[],
  ): { tab: T; merged: number; superseded: number } {
    let elements = save.elements;
    let merged = 0;
    let superseded = 0;
    for (const { record, ops } of entries) {
      for (const op of ops) {
        const step = mergeOne(elements, op, record.fingerprints);
        elements = step.elements;
        if (step.outcome === 'merged') merged += 1;
        if (step.outcome === 'superseded') superseded += 1;
      }
    }
    return { tab: elements === save.elements ? save : { ...save, elements }, merged, superseded };
  }

  type Step = { elements: E[]; outcome: 'merged' | 'superseded' | 'none' };

  function mergeOne(elements: E[], op: PlanOp<E>, fps: ChangesetFingerprints): Step {
    const keep = (outcome: Step['outcome']): Step => ({ elements, outcome });
    if (op.kind === 'reorder') return mergeReorder(elements, op.ids, fps.beforeOrder);
    const id = op.kind === 'remove' ? op.id : op.element.id;
    const index = elements.findIndex((e) => e.id === id);
    const cur = index === -1 ? undefined : elements[index]!;
    const fp = cur ? elementFingerprint(cur) : null;
    switch (op.kind) {
      case 'add': {
        if (!cur) {
          const next = elements.slice();
          next.splice(Math.min(op.at, next.length), 0, op.element);
          return { elements: next, outcome: 'merged' };
        }
        return keep(fp === fps.after[id] ? 'none' : 'superseded');
      }
      case 'update': {
        if (cur && fp === fps.before[id]) {
          const next = elements.slice();
          next[index] = mergeIncomingElement(cur, op.element);
          return { elements: next, outcome: 'merged' };
        }
        return keep(cur && fp === fps.after[id] ? 'none' : 'superseded');
      }
      case 'remove': {
        if (cur && fp === fps.before[id]) {
          return { elements: elements.filter((e) => e.id !== id), outcome: 'merged' };
        }
        return keep(cur ? 'superseded' : 'none');
      }
    }
  }

  // A reorder lands only where the save still has the elements it moved in the order the changeset
  // found them; their slots in the save then take the changeset's order.
  function mergeReorder(
    elements: E[],
    afterIds: readonly string[],
    beforeOrder: readonly string[] | undefined,
  ): Step {
    if (!beforeOrder) return { elements, outcome: 'none' };
    const present = new Set(elements.map((e) => e.id));
    const moved = new Set(beforeOrder.filter((id) => present.has(id)));
    const saveOrder = elements.filter((e) => moved.has(e.id)).map((e) => e.id);
    const foundOrder = beforeOrder.filter((id) => moved.has(id));
    const targetOrder = afterIds.filter((id) => moved.has(id));
    if (sameIds(saveOrder, targetOrder)) return { elements, outcome: 'none' };
    if (!sameIds(saveOrder, foundOrder)) return { elements, outcome: 'superseded' };
    const byId = new Map(elements.map((e) => [e.id, e] as const));
    let slot = 0;
    const next = elements.map((e) => (moved.has(e.id) ? byId.get(targetOrder[slot++]!)! : e));
    return { elements: next, outcome: 'merged' };
  }

  // A revert (docs/specs/024-agents/agent-changesets.md "Revert"): the changeset's inverse applied to
  // the tab as it is now, element by element. An element changed since the changeset (its fingerprint
  // differs from the after-image) is left as it is and listed as kept; the rest are reverted. Taking
  // the before-image keeps the current element's live fields (CS44). Pure.
  type RevertPlan = { elements: E[]; reverted: number; kept: RevertKept[] };

  function planRevert(
    current: { elements: E[] },
    ops: readonly PlanOp<E>[],
    inverse: readonly PlanOp<E>[],
    fps: ChangesetFingerprints,
  ): RevertPlan {
    const beforeImage = new Map<string, { element: E; at: number | null }>();
    let beforeIds: string[] | null = null;
    for (const op of inverse) {
      if (op.kind === 'add') beforeImage.set(op.element.id, { element: op.element, at: op.at });
      if (op.kind === 'update') beforeImage.set(op.element.id, { element: op.element, at: null });
      if (op.kind === 'reorder') beforeIds = op.ids;
    }

    let elements = current.elements;
    let reverted = 0;
    const kept: RevertKept[] = [];
    const find = (id: string) => elements.findIndex((e) => e.id === id);
    const asLeft = (index: number, id: string) =>
      index !== -1 && elementFingerprint(elements[index]!) === fps.after[id];

    for (const op of ops) {
      if (op.kind === 'reorder') continue;
      const id = op.kind === 'remove' ? op.id : op.element.id;
      const index = find(id);
      if (op.kind === 'add') {
        if (!asLeft(index, id)) {
          kept.push({ id, reason: index === -1 ? 'gone' : 'changed' });
          continue;
        }
        elements = elements.filter((e) => e.id !== id);
      } else if (op.kind === 'update') {
        const before = beforeImage.get(id);
        if (!before || !asLeft(index, id)) {
          kept.push({ id, reason: index === -1 ? 'gone' : 'changed' });
          continue;
        }
        elements = elements.slice();
        elements[index] = mergeIncomingElement(elements[index]!, before.element);
      } else {
        const before = beforeImage.get(id);
        if (index !== -1 || !before) {
          kept.push({ id, reason: 'present' });
          continue;
        }
        elements = elements.slice();
        elements.splice(Math.min(before.at ?? elements.length, elements.length), 0, before.element);
      }
      reverted += 1;
    }

    const reorder = ops.find(
      (op): op is Extract<PlanOp<E>, { kind: 'reorder' }> => op.kind === 'reorder',
    );
    if (reorder && beforeIds && fps.beforeOrder) {
      const order = revertOrder(elements, reorder.ids, fps.beforeOrder);
      if (order === null) kept.push({ id: fps.beforeOrder[0] ?? '', reason: 'order' });
      else elements = order;
    }
    return { elements, reverted, kept };
  }

  return { checkBase, mergeChangesetsIntoSave, planRevert };
}

// The elements in the order the changeset found them, when they still sit in the order it left;
// null when somebody reordered them since.
function revertOrder<E extends PlanElement>(
  elements: E[],
  afterIds: readonly string[],
  beforeOrder: readonly string[],
): E[] | null {
  const present = new Set(elements.map((e) => e.id));
  const moved = new Set(beforeOrder.filter((id) => present.has(id)));
  const nowOrder = elements.filter((e) => moved.has(e.id)).map((e) => e.id);
  const leftOrder = afterIds.filter((id) => moved.has(id));
  if (!nowOrder.every((id, i) => id === leftOrder[i]) || nowOrder.length !== leftOrder.length) {
    return null;
  }
  const target = beforeOrder.filter((id) => moved.has(id));
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  let slot = 0;
  return elements.map((e) => (moved.has(e.id) ? byId.get(target[slot++]!)! : e));
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
