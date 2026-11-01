// A change to a main as a patch of named elements (docs/specs/009-elements/components.md "Sharing, collaboration and
// storage"): the editor sends what changed, the api applies it to the stored main element by element, so two people
// changing different elements of one main both keep their change. Pure.
import type { Element } from './index';
import { clampComponentName, type DesignComponent } from './components';

export type ComponentPatch = {
  name?: string;
  archived?: boolean;
  // Elements replaced by id, or appended when the main has no element with that id.
  upsert?: Element[];
  // Element ids taken out.
  remove?: string[];
  // The ids in their new order; ids it does not name keep their order after these.
  order?: string[];
};

/** The main with a patch applied, stamped `now`. */
export function applyComponentPatch(
  main: DesignComponent,
  patch: ComponentPatch,
  now: number,
): DesignComponent {
  let elements = main.elements;
  if (patch.remove?.length) {
    const gone = new Set(patch.remove);
    elements = elements.filter((e) => !gone.has(e.id));
  }
  if (patch.upsert?.length) {
    const byId = new Map(patch.upsert.map((e) => [e.id, e] as const));
    const placed = new Set<string>();
    elements = elements.map((e) => {
      const next = byId.get(e.id);
      if (!next) return e;
      placed.add(e.id);
      return next;
    });
    for (const e of patch.upsert) if (!placed.has(e.id)) elements = [...elements, e];
  }
  if (patch.order?.length) {
    const rank = new Map(patch.order.map((id, i) => [id, i] as const));
    const named = elements.filter((e) => rank.has(e.id));
    named.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    const rest = elements.filter((e) => !rank.has(e.id));
    elements = [...named, ...rest];
  }
  const next: DesignComponent = { ...main, elements, updatedAt: now };
  if (patch.name !== undefined) {
    const name = clampComponentName(patch.name);
    if (name) next.name = name;
  }
  if (patch.archived !== undefined) {
    if (patch.archived) next.archived = true;
    else delete next.archived;
  }
  return next;
}

function sameElement(a: Element, b: Element): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** The patch turning `before` into `after`, or null when they hold the same. */
export function diffComponent(
  before: DesignComponent,
  after: DesignComponent,
): ComponentPatch | null {
  const patch: ComponentPatch = {};
  const prev = new Map(before.elements.map((e) => [e.id, e] as const));
  const nextIds = new Set(after.elements.map((e) => e.id));
  const remove = before.elements.filter((e) => !nextIds.has(e.id)).map((e) => e.id);
  const upsert = after.elements.filter((e) => {
    const was = prev.get(e.id);
    return !was || !sameElement(was, e);
  });
  if (remove.length) patch.remove = remove;
  if (upsert.length) patch.upsert = upsert;
  const kept = before.elements.filter((e) => nextIds.has(e.id)).map((e) => e.id);
  const order = after.elements.map((e) => e.id);
  const keptInNewOrder = order.filter((id) => prev.has(id));
  if (keptInNewOrder.some((id, i) => id !== kept[i]) || upsert.some((e) => !prev.has(e.id)))
    patch.order = order;
  if (before.name !== after.name) patch.name = after.name;
  if (!!before.archived !== !!after.archived) patch.archived = !!after.archived;
  return Object.keys(patch).length ? patch : null;
}
