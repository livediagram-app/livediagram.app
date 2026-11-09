// `detach <instance>` (docs/specs/024-agents/edit-operations.md "Components", blueprint "Operations"): the instance
// is replaced, in its place in the element order, by its main's elements as it draws them (overrides, scale,
// rotation and layer), each with a fresh slug id; arrows pinned to it keep that end as a free point. The main is
// never changed. The geometry is `detachInstance`'s, the editor's own Detach.
import type { EditRejection } from '@livedesign/api-schema';
import {
  detachInstance,
  isInstance,
  kindWordOf,
  type ArrowElement,
  type Element,
} from '@livedesign/design';
import { mintId } from '../ids';
import { COMPONENTS_HINT } from '../instances';
import { resolveOne } from '../selectors';
import {
  currentElements,
  insertElement,
  refsOf,
  refuseLocked,
  removeElement,
  writeFields,
  type EditState,
} from '../state';
import type { DetachOperation } from '../types';

const pinnedTo = (arrow: ArrowElement, id: string) =>
  [arrow.from, arrow.to].some(
    (end) =>
      (end.kind === 'pinned' && end.elementId === id) ||
      (end.kind === 'on-arrow' && end.arrowId === id),
  );

export function applyDetach(
  state: EditState,
  { target }: DetachOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveOne(state, target, operation);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  const ref = refsOf(state).refOf(el.id);
  if (!isInstance(el))
    return {
      code: 'invalid_value',
      operation,
      details: [`${target}: ${ref} is not a component instance`],
      hint: 'detach takes an instance: the outline prints one as instance of "<name>"',
    };
  const lock = state.locked.get(el.id);
  if (lock) return refuseLocked(state, 'detach', operation, el, lock);
  const main = state.components?.get(el.componentId);
  if (!main)
    return {
      code: 'invalid_value',
      operation,
      details: [`${target}: its main ${el.componentId} is not in the design`],
      hint: COMPONENTS_HINT,
    };
  // An arrow in the main attached to an element the main no longer holds (a patch's `remove` can leave one) has no
  // place to land once detached: refused by name rather than placed pinned to nothing.
  const held = new Set(main.elements.map((m) => m.id));
  for (const m of main.elements) {
    if (m.type !== 'arrow') continue;
    for (const end of [m.from, m.to]) {
      const to =
        end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : null;
      if (to !== null && !held.has(to))
        return {
          code: 'invalid_value',
          operation,
          details: [
            `${target}: its main's arrow ${m.id} is attached to ${to}, which the main no longer holds`,
          ],
          hint: COMPONENTS_HINT,
        };
    }
  }
  const current = currentElements(state) as Element[];
  const freed = current.filter((a): a is ArrowElement => a.type === 'arrow' && pinnedTo(a, el.id));
  for (const arrow of freed) {
    const arrowLock = state.locked.get(arrow.id);
    if (arrowLock) return refuseLocked(state, 'detach', operation, arrow, arrowLock);
  }
  // `detachInstance` asks for one id a main element, in the main's order: each is minted as `add` mints one, from
  // the label it draws with (its override's, else its own) or its kind word, free among every id the tab and the
  // changeset hold.
  let next = 0;
  const newId = () => {
    // One call a main element; a further one (an arrow end or a host naming an id the main no longer holds, as a
    // patch's `remove` can leave) mints a plain id rather than reading past the main's elements.
    const source = main.elements[next++];
    const label = source
      ? (el.componentOverrides?.[source.id]?.label ?? Reflect.get(source, 'label'))
      : undefined;
    const id = mintId(
      state,
      typeof label === 'string' ? label : undefined,
      source ? kindWordOf(source) : 'element',
    );
    state.taken.add(id);
    return id;
  };
  const after = detachInstance(current, el.id, main, newId);
  const before = new Map(current.map((e) => [e.id, e]));
  for (const placed of after) {
    const was = before.get(placed.id);
    if (was === undefined) {
      insertElement(state, placed, operation, { before: el.id });
      state.created.push(placed.id);
    } else if (was !== placed && placed.type === 'arrow' && was.type === 'arrow') {
      const ends = (['from', 'to'] as const).filter((end) => placed[end] !== was[end]);
      writeFields(state, placed, operation, ends);
      state.warnings.push({
        code: 'arrows_freed',
        ref: placed.id,
        message: `${refsOf(state).refOf(placed.id)} ${ends.join(' and ')} freed where it was drawn: ${ref} was detached`,
      });
    }
  }
  removeElement(state, el.id, operation, {});
  state.log('[edit-ops] detached', { operation, elements: main.elements.length });
  return null;
}
