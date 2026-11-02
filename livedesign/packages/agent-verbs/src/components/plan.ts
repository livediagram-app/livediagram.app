// Make Component for agents (docs/specs/024-agents/edit-operations.md "Components", docs/specs/015-api/cli.md
// `component make`, the MCP's change_components): the elements an agent names become a main, by the editor's own
// `makeComponent`, and the tab change it makes is written as edit operations, so it is a changeset like any other:
// based on the revision read, attributed, relayed live and revertable. Pure.
import {
  MAX_COMPONENT_ELEMENTS,
  clampComponentName,
  computeRefs,
  elementFingerprint,
  libraryLookup,
  libraryOf,
  makeComponent,
  nextComponentName,
  resolveRef,
  slugIdFor,
  type DesignComponent,
  type Element,
  type MakeComponentRefusal,
  type Tab,
} from '@livedesign/design';

export type ComponentRefused = { ok: false; code: string; message: string; hint?: string };

export type MakePlan = {
  ok: true;
  component: DesignComponent;
  instanceId: string;
  // The JSON form of the edit operations that put the instance in the selection's place.
  operations: Record<string, unknown>[];
  // The changeset's base: the revision read and the fingerprint of every element the operations change.
  base: { rev: number; elements: Record<string, string> };
};

const LIST_HINT = 'read the tab for its refs: livedesign tab view <doc>';

const REFUSALS: Record<MakeComponentRefusal, string> = {
  empty: 'name at least one element to make a component of',
  locked: 'a locked element cannot go in a component; unlock it first',
  kind: "images, videos, embeds, link cards and tab windows can't go in a component yet",
  too_many: `a component holds at most ${MAX_COMPONENT_ELEMENTS} elements`,
  missing_main: 'an instance among them has no main in the design to detach first',
};

// The always-safe ref of an element: its full id as `id:"…"`, so no id reads as a keyword or a term.
export const safeRef = (id: string) => `id:${JSON.stringify(id)}`;

// The element ids the refs name, or the refusal naming the first that names nothing or several.
function resolveAll(tab: Tab, refs: readonly string[]): Set<string> | ComponentRefused {
  const table = computeRefs(tab.elements.map((e) => e.id));
  const ids = new Set<string>();
  for (const ref of refs) {
    const found = resolveRef(ref, table);
    if (found.kind === 'found') {
      ids.add(found.id);
      continue;
    }
    const ambiguous = found.kind === 'ambiguous';
    const names = ambiguous ? found.candidates : found.nearest;
    return {
      ok: false,
      code: ambiguous ? 'target_ambiguous' : 'target_not_found',
      message: `"${ref}" ${ambiguous ? 'matches several elements' : 'names no element'}${names.length ? `: ${names.join(', ')}` : ''}`,
      hint: LIST_HINT,
    };
  }
  return ids;
}

// One element's fields that differ, as a `set` writes them: changed values, and `null` for a field it lost.
function changedFields(before: Element, after: Element): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const was = before as Record<string, unknown>;
  const now = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (key === 'id' || key === 'type') continue;
    if (JSON.stringify(was[key]) === JSON.stringify(now[key])) continue;
    fields[key] = key in now ? now[key] : null;
  }
  return fields;
}

/** The edit operations that turn `before` into `after` when `after` adds elements and changes or removes others:
 *  each added element whole, put in its place in the stack; each changed one `set` on what differs; each removed
 *  one `rm` (arrows first, then the rest with their arrows kept, which were re-pinned or removed already). */
export function elementChangeOperations(
  before: readonly Element[],
  after: readonly Element[],
): Record<string, unknown>[] {
  const was = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const added: Record<string, unknown>[] = [];
  after.forEach((el, i) => {
    if (was.has(el.id)) return;
    added.push({ op: 'add', element: el });
    // Directly below the next element that stays, which keeps the stack as `after` has it.
    const next = after.slice(i + 1).find((e) => was.has(e.id));
    if (next) added.push({ op: 'order', target: safeRef(el.id), below: safeRef(next.id) });
  });
  const changed = after.flatMap((el) => {
    const prior = was.get(el.id);
    if (!prior || prior === el) return [];
    const fields = changedFields(prior, el);
    return Object.keys(fields).length ? [{ op: 'set', target: safeRef(el.id), fields }] : [];
  });
  const gone = before.filter((e) => !now.has(e.id));
  const removed = [
    ...gone.filter((e) => e.type === 'arrow').map((e) => ({ op: 'rm', target: safeRef(e.id) })),
    ...gone
      .filter((e) => e.type !== 'arrow')
      .map((e) => ({ op: 'rm', target: safeRef(e.id), keepArrows: true })),
  ];
  return [...added, ...changed, ...removed];
}

/** Make Component on a tab read at `rev`: the main (named `name`, else `Component <n>`), and the changeset that puts
 *  one instance in the selection's place. */
export function planMakeComponent(
  tab: Tab & { rev: number },
  refs: readonly string[],
  library: readonly DesignComponent[],
  opts: { name?: string; now: number },
): MakePlan | ComponentRefused {
  const ids = resolveAll(tab, refs);
  if ('ok' in ids) return ids;
  // Whitespace collapsed and cut at COMPONENT_NAME_MAX, as the editor's rename stores it.
  const name = clampComponentName(opts.name ?? '') || nextComponentName(library);
  const taken = new Set(tab.elements.map((e) => e.id));
  const componentId = slugIdFor(name, 'component', new Set(library.map((c) => c.id)));
  const instanceId = slugIdFor(name, 'instance', taken);
  taken.add(instanceId);
  const made = makeComponent(tab.elements, ids, {
    componentId,
    instanceId,
    name,
    now: opts.now,
    lookup: libraryLookup(libraryOf(library)),
    // Ids for what a detached instance in the selection brings into the main; they never reach the tab.
    newId: () => {
      const id = slugIdFor('', 'element', taken);
      taken.add(id);
      return id;
    },
  });
  if (!made.ok)
    return { ok: false, code: made.reason, message: REFUSALS[made.reason], hint: LIST_HINT };
  const operations = elementChangeOperations(tab.elements, made.elements);
  const after = new Set(made.elements);
  const elements: Record<string, string> = {};
  for (const el of tab.elements) if (!after.has(el)) elements[el.id] = elementFingerprint(el);
  return {
    ok: true,
    component: made.component,
    instanceId,
    operations,
    base: { rev: tab.rev, elements },
  };
}
